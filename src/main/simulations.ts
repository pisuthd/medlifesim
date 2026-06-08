import * as fs from 'fs'
import * as path from 'path'
import { app, BrowserWindow, ipcMain } from 'electron'
import { deleteSession } from './sessions'
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
 * Duplicate of the renderer-only `enumeratePaths` in
 * `src/renderer/src/data/simulationPaths.ts`. The traversal logic is
 * ~12 lines, so we keep it inline here rather than crossing the
 * renderer/main module boundary.
 */
function freshOutcomeId(): string {
  return 'outcome-' + Date.now() + '-' + Math.random().toString(36).slice(2, 10)
}

function enumeratePaths(
  cards: CanvasCard[],
  connections: Connection[]
): SimPathPreview[] {
  const byId = new Map(cards.map((c) => [c.placementId, c]))
  const outgoing = new Map<string, string[]>()

  for (const conn of connections) {
    if (!outgoing.has(conn.from)) outgoing.set(conn.from, [])
    outgoing.get(conn.from)!.push(conn.to)
  }

  const getChildren = (id: string, cat: SimCategory): CanvasCard[] =>
    (outgoing.get(id) ?? [])
      .map((toId) => byId.get(toId))
      .filter((c): c is CanvasCard => !!c && c.category === cat)

  const results: SimPathPreview[] = []
  const envs = cards.filter((c) => c.category === 'environment')

  for (const env of envs) {
    for (const subj of getChildren(env.placementId, 'subject')) {
      for (const expo of getChildren(subj.placementId, 'exposure')) {
        for (const health of getChildren(expo.placementId, 'health-state')) {
          for (const intv of getChildren(health.placementId, 'intervention')) {
            results.push({
              id: freshOutcomeId(),
              interventionId: intv.id,
              pathLabels: {
                environment: env.title,
                subject: subj.title,
                exposure: expo.title,
                healthState: health.title,
                intervention: intv.title,
              },
              placementIds: {
                environment: env.placementId,
                subject: subj.placementId,
                exposure: expo.placementId,
                healthState: health.placementId,
                intervention: intv.placementId,
              },
              status: 'pending',
            })
          }
        }
      }
    }
  }

  return results
}

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
  const completedCount = Math.max(0, current.completedCount + delta)
  const errorCount = Math.max(0, current.errorCount + errorDelta)
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
    updateOutcome(profileSlug, simId, o.id, { status: 'pending', error: undefined })
  }
  return { success: true, requeued: targets.length }
}

// ────────────────────────────── IPC wiring ───────────────────────────────

export function registerSimulationsIpcHandlers(): void {
  ipcMain.handle('simulations:list', async (_e, profileSlug: string) => {
    try {
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
    async (_e, profileSlug: string, name: string, canvas: CanvasState) => {
      try {
        return createSimulation(profileSlug, name, canvas)
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
}

export function initSimulations(): void {
  // No global state to seed; the worker reads from disk on each tick.
  console.log('[simulations] store initialized')
}
