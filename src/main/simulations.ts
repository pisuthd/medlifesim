import * as fs from 'fs'
import * as path from 'path'
import { app, BrowserWindow, dialog, ipcMain } from 'electron'
import { deleteSession, loadMessages, clearSessionMessages } from './sessions'
import { enumeratePaths } from '../shared/simulationPaths'
import { parseOutcomeReport, parseOutcomeJson, type ParsedOutcomeReport } from '../shared/outcomeParser'
import { aggregateOutcomes, type ReportAggregate } from '../shared/outcomeReport'
import { setProfileModalOpen } from './simulationWorker'
import {
  defaultExportFileName,
  writeCsvExport,
  writeJsonExport,
  writeMarkdownExport,
  writePdfExport,
  type ExportResult,
  type ReportData,
} from './reportExport'
import { translateReportData, type SupportedTargetLang } from './translation'
import type {
  CanvasCard,
  CanvasState,
  Connection,
  PathStatus,
  SimCategory,
  SimPathPreview,
  SimulationOutcome,
  SimulationParent,
  SimulationProgressEvent,
  SimulationStatus,
} from '../preload/simulation'

// Re-export shared types from preload (the single source of truth for IPC).
export type {
  CanvasCard,
  CanvasState,
  Connection,
  SimCategory,
  SimPathPreview,
  PathStatus,
  SimulationOutcome,
  SimulationParent,
  SimulationProgressEvent,
  SimulationStatus,
}

const SIMULATIONS_DIR = 'simulations'

// ──────────────────────────────── paths ───────────────────────────────────

function getSimulationsRoot(profileSlug: string): string {
  return path.join(app.getPath('userData'), 'profiles', profileSlug, SIMULATIONS_DIR)
}
function getSimulationDir(profileSlug: string, simId: string): string {
  return path.join(getSimulationsRoot(profileSlug), simId)
}
function getSimulationJsonPath(profileSlug: string, simId: string): string {
  return path.join(getSimulationDir(profileSlug, simId), 'simulation.json')
}
function getOutcomesDir(profileSlug: string, simId: string): string {
  return path.join(getSimulationDir(profileSlug, simId), 'outcomes')
}
function getOutcomePath(
  profileSlug: string,
  simId: string,
  outcomeId: string
): string {
  return path.join(getOutcomesDir(profileSlug, simId), `${outcomeId}.json`)
}

// ──────────────────────── main-process path enumeration ───────────────────

/**
 * `enumeratePaths` is imported from `src/shared/simulationPaths.ts` so the
 * renderer and main process use the exact same logic.
 */

// ────────────────────────── atomic write helper ──────────────────────────

function atomicWriteJson(targetPath: string, data: unknown): void {
  const dir = path.dirname(targetPath)
  fs.mkdirSync(dir, { recursive: true })
  const tmp = targetPath + '.tmp-' + Date.now()
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf-8')
  fs.renameSync(tmp, targetPath)
}

function readJson<T>(p: string): T | null {
  if (!fs.existsSync(p)) return null
  try {
    return JSON.parse(fs.readFileSync(p, 'utf-8')) as T
  } catch {
    return null
  }
}

function nowIso(): string {
  return new Date().toISOString()
}

// ─────────────────────────── public API ──────────────────────────────────

export function createSimulation(
  profileSlug: string,
  name: string,
  description: string,
  canvas: CanvasState
): SimulationParent {
  const simId = 'sim-' + Date.now() + '-' + Math.random().toString(36).slice(2, 10)
  const paths = enumeratePaths(canvas.cards, canvas.connections)
  const now = nowIso()

  // Ensure sim dir + outcomes dir
  fs.mkdirSync(getOutcomesDir(profileSlug, simId), { recursive: true })

  // Write each outcome. The matching child chat session is created
  // lazily by the worker when it picks the outcome up — until then
  // there's no folder to look at, so the chat list stays empty.
  for (const path_ of paths) {
    const sessionSlug = `sim-${simId}-outcome-${path_.id}`
    const outcome: SimulationOutcome = {
      id: path_.id,
      simId,
      sessionSlug,
      interventionId: path_.interventionId,
      pathLabels: path_.pathLabels,
      details: path_.details,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    }
    atomicWriteJson(getOutcomePath(profileSlug, simId, path_.id), outcome)
  }

  const parent: SimulationParent = {
    id: simId,
    profileSlug,
    name: name || `Scenario · ${now}`,
    description: description || undefined,
    createdAt: now,
    updatedAt: now,
    status: 'queued',
    canvas,
    outcomeCount: paths.length,
    completedCount: 0,
    errorCount: 0,
  }
  atomicWriteJson(getSimulationJsonPath(profileSlug, simId), parent)
  return parent
}

export function listSimulations(profileSlug: string): SimulationParent[] {
  const root = getSimulationsRoot(profileSlug)
  if (!fs.existsSync(root)) return []
  const entries = fs.readdirSync(root, { withFileTypes: true })
  const results: SimulationParent[] = []
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const jsonPath = path.join(root, entry.name, 'simulation.json')
    const parent = readJson<SimulationParent>(jsonPath)
    if (parent) results.push(parent)
  }
  return results.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )
}

export function getSimulation(
  profileSlug: string,
  simId: string
): SimulationParent | null {
  return readJson<SimulationParent>(getSimulationJsonPath(profileSlug, simId))
}

export function getOutcome(
  profileSlug: string,
  simId: string,
  outcomeId: string
): SimulationOutcome | null {
  return readJson<SimulationOutcome>(getOutcomePath(profileSlug, simId, outcomeId))
}

export function listOutcomes(
  profileSlug: string,
  simId: string
): SimulationOutcome[] {
  const dir = getOutcomesDir(profileSlug, simId)
  if (!fs.existsSync(dir)) return []
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  const results: SimulationOutcome[] = []
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.json')) continue
    const outcome = readJson<SimulationOutcome>(path.join(dir, entry.name))
    if (outcome) results.push(outcome)
  }
  return results
}

export function deleteSimulation(profileSlug: string, simId: string): boolean {
  // Remove child session folders first.
  const outcomes = listOutcomes(profileSlug, simId)
  for (const o of outcomes) {
    try {
      deleteSession(profileSlug, o.sessionSlug)
    } catch (err) {
      console.warn('[simulations] failed to delete child session', o.sessionSlug, err)
    }
  }
  // Then the sim folder.
  const simDir = getSimulationDir(profileSlug, simId)
  try {
    if (fs.existsSync(simDir)) {
      fs.rmSync(simDir, { recursive: true })
    }
    return true
  } catch (err) {
    console.error('[simulations] failed to delete sim dir', err)
    return false
  }
}

export function listPendingOutcomes(
  profileSlug: string
): { simId: string; outcome: SimulationOutcome }[] {
  const root = getSimulationsRoot(profileSlug)
  if (!fs.existsSync(root)) return []
  const sims = fs.readdirSync(root, { withFileTypes: true }).filter((e) => e.isDirectory())
  const out: { simId: string; outcome: SimulationOutcome }[] = []
  for (const sim of sims) {
    const outcomes = listOutcomes(profileSlug, sim.name).filter(
      (o) => o.status === 'pending'
    )
    for (const o of outcomes) out.push({ simId: sim.name, outcome: o })
  }
  return out
}

export function updateOutcome(
  profileSlug: string,
  simId: string,
  outcomeId: string,
  patch: Partial<Pick<SimulationOutcome, 'status' | 'error'>>
): SimulationOutcome | null {
  const target = getOutcomePath(profileSlug, simId, outcomeId)
  const current = readJson<SimulationOutcome>(target)
  if (!current) return null
  const merged: SimulationOutcome = {
    ...current,
    ...patch,
    updatedAt: nowIso(),
  }
  atomicWriteJson(target, merged)
  return merged
}

export function bumpCompleted(
  profileSlug: string,
  simId: string,
  delta: number,
  errorDelta = 0
): SimulationParent | null {
  const target = getSimulationJsonPath(profileSlug, simId)
  const current = readJson<SimulationParent>(target)
  if (!current) return null
  // Defensive cap at `outcomeCount` so a misbehaving call site cannot
  // push either count past the number of outcomes (e.g. the previous
  // `+1, +1` on the worker error path produced "10 / 5" headers).
  const cap = current.outcomeCount
  const completedCount = Math.min(cap, Math.max(0, current.completedCount + delta))
  const errorCount = Math.min(cap, Math.max(0, current.errorCount + errorDelta))
  let status: SimulationStatus = current.status
  if (completedCount + errorCount >= current.outcomeCount && current.outcomeCount > 0) {
    status = errorCount > 0 ? 'partial' : 'completed'
  } else if (completedCount > 0 || errorCount > 0) {
    status = 'processing'
  } else {
    status = 'queued'
  }
  const merged: SimulationParent = {
    ...current,
    completedCount,
    errorCount,
    status,
    updatedAt: nowIso(),
  }
  atomicWriteJson(target, merged)
  return merged
}

/**
 * Recompute the parent's `completedCount` / `errorCount` from the
 * on-disk outcomes list and persist the result. Idempotent and a
 * no-op when the counts already match (cost is one read of the
 * outcomes directory per sim).
 *
 * Used to repair old corrupt sims whose parent file
 * (`completedCount` or `errorCount` drifted away from the actual
 * outcomes) — the recent-simulation list and the report header
 * both read these counts from the parent, so a one-time write
 * fixes the display. New sims keep their counts accurate by
 * construction since `bumpCompleted` is the only writer.
 */
export function recomputeCountsFromOutcomes(
  profileSlug: string,
  simId: string
): SimulationParent | null {
  const target = getSimulationJsonPath(profileSlug, simId)
  const current = readJson<SimulationParent>(target)
  if (!current) return null
  const outcomes = listOutcomes(profileSlug, simId)
  const doneCount = outcomes.filter((o) => o.status === 'done').length
  const errorCount = outcomes.filter((o) => o.status === 'error').length
  if (current.completedCount === doneCount && current.errorCount === errorCount) {
    return current
  }
  let status: SimulationStatus = current.status
  if (doneCount + errorCount >= current.outcomeCount && current.outcomeCount > 0) {
    status = errorCount > 0 ? 'partial' : 'completed'
  } else if (doneCount > 0 || errorCount > 0) {
    status = 'processing'
  } else {
    status = 'queued'
  }
  const merged: SimulationParent = {
    ...current,
    completedCount: doneCount,
    errorCount,
    status,
    updatedAt: nowIso(),
  }
  atomicWriteJson(target, merged)
  return merged
}

export function recoveryPass(profileSlug: string): void {
  const root = getSimulationsRoot(profileSlug)
  if (!fs.existsSync(root)) return
  const sims = fs.readdirSync(root, { withFileTypes: true }).filter((e) => e.isDirectory())
  for (const sim of sims) {
    const outcomes = listOutcomes(profileSlug, sim.name)
    for (const o of outcomes) {
      if (o.status === 'processing') {
        updateOutcome(profileSlug, sim.name, o.id, { status: 'pending', error: undefined })
      }
    }
  }
}

// ──────────────────────── progress broadcasting ──────────────────────────

let mainWindowGetter: () => BrowserWindow | null = () => null

export function setSimulationsMainWindowGetter(
  getter: () => BrowserWindow | null
): void {
  mainWindowGetter = getter
}

export function broadcastProgress(event: SimulationProgressEvent): void {
  const win = mainWindowGetter()
  if (win && !win.isDestroyed()) {
    win.webContents.send('simulations:progress', event)
  }
}

export function requeueOutcome(
  profileSlug: string,
  simId: string,
  outcomeId?: string
): { success: boolean; requeued: number } {
  const outcomes = listOutcomes(profileSlug, simId)
  const targets = outcomes.filter(
    (o) =>
      o.status === 'error' && (outcomeId === undefined || o.id === outcomeId)
  )
  for (const o of targets) {
    // Wipe the prior child-session messages so the new completion starts
    // from a clean slate — the worker passes `history: []` but the on-disk
    // messages.json would otherwise grow a stale assistant turn per requeue.
    try {
      clearSessionMessages(profileSlug, o.sessionSlug)
    } catch (err) {
      console.warn(
        `[simulations] failed to clear messages for ${o.sessionSlug}:`,
        err
      )
    }
    updateOutcome(profileSlug, simId, o.id, { status: 'pending', error: undefined })
  }
  // Decrement the parent's error count by the number of outcomes we just
  // requeued. Without this the parent stays in "partial" with a stale
  // error count after a successful retry run, and the Report button
  // (gated on `completed`/`partial`) reads "8/8 (4 err)" instead of
  // landing on "8/8 Completed" when the retries all succeed.
  if (targets.length > 0) {
    bumpCompleted(profileSlug, simId, 0, -targets.length)
  }
  return { success: true, requeued: targets.length }
}

// ────────────────────────────── IPC wiring ───────────────────────────────

/**
 * Reassemble the `{ sim, outcomes, reports, aggregate }` payload
 * the renderer fetches via `simulations:getReport`. Shared between
 * the report IPC and the new `reports:translate` IPC so the two
 * stay byte-identical.
 *
 * Returns `null` when the simulation can't be found (deleted or
 * never existed) so callers can short-circuit.
 */
function assembleReportData(
  profileSlug: string,
  simId: string
): ReportData | null {
  // Repair the parent's counts first (in case a previous worker
  // run left them drifted from the outcomes list).
  // `recomputeCountsFromOutcomes` is a no-op when the counts are
  // already correct.
  const sim = recomputeCountsFromOutcomes(profileSlug, simId)
  if (!sim) return null
  const outcomes = listOutcomes(profileSlug, simId)

  const reports: Record<string, ParsedOutcomeReport | null> = {}
  for (const o of outcomes) {
    if (o.status !== 'done') {
      reports[o.id] = null
      continue
    }
    const msgs = loadMessages(profileSlug, o.sessionSlug)
    // Find the last assistant message — the AI response.
    let assistant: { content: string } | undefined
    for (let i = msgs.length - 1; i >= 0; i--) {
      if (msgs[i].role === 'assistant') {
        assistant = msgs[i]
        break
      }
    }
    // Try the new JSON contract first (worker per-outcome
    // completion); fall back to the legacy markdown parser for
    // outcomes that pre-date the redesign.
    reports[o.id] = assistant
      ? parseOutcomeJson(assistant.content) ?? parseOutcomeReport(assistant.content)
      : null
  }
  const aggregate: ReportAggregate = aggregateOutcomes(
    outcomes,
    new Map(Object.entries(reports))
  )
  return { sim, outcomes, reports, aggregate }
}

export function registerSimulationsIpcHandlers(): void {
  ipcMain.handle('simulations:list', async (_e, profileSlug: string) => {
    try {
      const sims = listSimulations(profileSlug)
      // Repair any sim whose parent counts drifted away from its
      // outcomes list. Idempotent and a no-op when counts are
      // already accurate (see `recomputeCountsFromOutcomes`).
      for (const sim of sims) {
        recomputeCountsFromOutcomes(profileSlug, sim.id)
      }
      // Re-read after repair so the returned objects reflect the
      // updated counts/statuses.
      return listSimulations(profileSlug)
    } catch (err) {
      console.error('[simulations] list failed:', err)
      throw err
    }
  })

  ipcMain.handle(
    'simulations:get',
    async (_e, profileSlug: string, simId: string) => {
      try {
        return getSimulation(profileSlug, simId)
      } catch (err) {
        console.error('[simulations] get failed:', err)
        throw err
      }
    }
  )

  ipcMain.handle(
    'simulations:create',
    async (
      _e,
      profileSlug: string,
      name: string,
      description: string,
      canvas: CanvasState
    ) => {
      try {
        return createSimulation(profileSlug, name, description, canvas)
      } catch (err) {
        console.error('[simulations] create failed:', err)
        throw err
      }
    }
  )

  ipcMain.handle(
    'simulations:delete',
    async (_e, profileSlug: string, simId: string) => {
      try {
        return { success: deleteSimulation(profileSlug, simId) }
      } catch (err) {
        console.error('[simulations] delete failed:', err)
        throw err
      }
    }
  )

  ipcMain.handle(
    'simulations:requeue',
    async (_e, profileSlug: string, simId: string, outcomeId?: string) => {
      try {
        return requeueOutcome(profileSlug, simId, outcomeId)
      } catch (err) {
        console.error('[simulations] requeue failed:', err)
        throw err
      }
    }
  )

  ipcMain.handle(
    'simulations:getOutcome',
    async (
      _e,
      profileSlug: string,
      simId: string,
      outcomeId: string
    ) => {
      try {
        return getOutcome(profileSlug, simId, outcomeId)
      } catch (err) {
        console.error('[simulations] getOutcome failed:', err)
        throw err
      }
    }
  )

  ipcMain.handle(
    'simulations:listOutcomes',
    async (_e, profileSlug: string, simId: string) => {
      try {
        return listOutcomes(profileSlug, simId)
      } catch (err) {
        console.error('[simulations] listOutcomes failed:', err)
        throw err
      }
    }
  )

  ipcMain.handle(
    'simulations:getReport',
    async (_e, profileSlug: string, simId: string) => {
      try {
        return assembleReportData(profileSlug, simId)
      } catch (err) {
        console.error('[simulations] getReport failed:', err)
        throw err
      }
    }
  )

  // Translate the report in place. Re-uses the same data-assembly
  // path as `getReport` (no extra IPC round-trip — the renderer
  // already has the original data, so it could translate locally
  // by calling the SDK itself, but centralising it here keeps the
  // translate logic on the main-process side and lets the renderer
  // stay pure-render). The Bergamot model is lazy-loaded via
  // `ensureTranslationModelLoaded` inside `translateReportData`.
  ipcMain.handle(
    'reports:translate',
    async (_e, profileSlug: string, simId: string, targetLang: SupportedTargetLang) => {
      try {
        const data = assembleReportData(profileSlug, simId)
        if (!data) return null
        const translated = await translateReportData(data, targetLang)
        return translated
      } catch (err) {
        console.error('[simulations] translate failed:', err)
        throw err
      }
    }
  )

  ipcMain.handle(
    'simulations:setModalOpen',
    async (_e, profileSlug: string, isOpen: boolean) => {
      // Tells the simulation worker to skip its tick for this profile
      // while the builder's pre-submit OutcomesModal is open. See
      // `setProfileModalOpen` in `simulationWorker.ts` for the gating.
      setProfileModalOpen(profileSlug, !!isOpen)
    }
  )

  // Report export — produces JSON / Markdown / CSV / PDF. Driven by the
  // Export button on the individual report page (NOT the list page, which
  // is read-only and only links through to a single report at a time).
  //
  // If the caller passes a `data` payload (the typical path now that
  // translation is an in-place render-side action), the writer renders
  // it as-is — no re-fetch, no translate. If `data` is omitted, the
  // writer re-fetches the report from disk and writes the original
  // English.
  ipcMain.handle(
    'reports:export',
    async (
      _e,
      profileSlug: string,
      simId: string,
      format: 'pdf' | 'json' | 'md' | 'csv',
      data: ReportData | null = null
    ): Promise<ExportResult> => {
      try {
        // 1. Resolve the data we'll write. Renderer-supplied data
        //    (the translated overlay) takes precedence; otherwise
        //    re-fetch from disk.
        let exportData = data
        if (!exportData) {
          const fetched = assembleReportData(profileSlug, simId)
          if (!fetched) return { ok: false, error: 'Simulation not found' }
          exportData = fetched
        }

        // 2. Save dialog.
        const win = mainWindowGetter() ?? BrowserWindow.getFocusedWindow()
        if (!win) return { ok: false, error: 'No window' }
        const result = await dialog.showSaveDialog(win, {
          title: 'Export report',
          defaultPath: defaultExportFileName(exportData.sim, format),
          filters: [
            { name: format.toUpperCase(), extensions: [format] },
            { name: 'All files', extensions: ['*'] },
          ],
        })
        if (result.canceled || !result.filePath) {
          return { ok: false, canceled: true }
        }

        // 3. Dispatch by format.
        switch (format) {
          case 'json':
            return writeJsonExport(result.filePath, exportData)
          case 'md':
            return writeMarkdownExport(result.filePath, exportData)
          case 'csv':
            return writeCsvExport(result.filePath, exportData)
          case 'pdf':
            return writePdfExport(win, result.filePath, exportData)
        }
      } catch (err) {
        console.error('[simulations] export failed:', err)
        return { ok: false, error: err instanceof Error ? err.message : String(err) }
      }
    }
  )
}

export function initSimulations(): void {
  // No global state to seed; the worker reads from disk on each tick.
  console.log('[simulations] store initialized')
}
