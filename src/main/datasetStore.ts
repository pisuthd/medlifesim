import * as fs from 'fs'
import * as path from 'path'
import { app } from 'electron'
import {
  buildPerOutcomeSystemPrompt,
  buildPerOutcomeUserPrompt,
} from './simulationWorker'
import { getSimulation, listOutcomes } from './simulations'
import { loadMessages } from './sessions'

/**
 * On-disk registry of fine-tuning datasets. Each `DatasetEntry`
 * describes which simulations + custom data the user has assembled.
 *
 * A dataset ends up as one of two on-disk files, depending on its
 * content mix:
 *
 *   - `<userData>/datasets/<id>/train.jsonl` — SFT (Supervised
 *     Fine-Tuning) data. One `{"messages":[{role,content},...]}`
 *     triple per line. Reconstructed from simulation outcomes, and
 *     extended by `jsonl-text` / `jsonl-file` custom data.
 *   - `<userData>/datasets/<id>/train.txt`  — Causal fine-tuning
 *     data. Raw plain text, concatenated from `text` custom data
 *     entries with blank lines between them. Used for domain
 *     adaptation / style transfer per the SDK docs.
 *
 * A dataset can have both files (e.g. simulation outcomes + plain
 * text). `finetune.ts` prefers the JSONL if present, otherwise the
 * txt — i.e. mixed datasets train as SFT and the plain text is
 * preserved on disk but not consumed.
 */

export type CustomDataSource =
  | { kind: 'jsonl-text'; label: string; text: string }
  | { kind: 'text'; label: string; text: string }
  | { kind: 'jsonl-file'; label: string; path: string }

export interface DatasetEntry {
  id: string
  name: string
  createdAt: string
  updatedAt: string
  sources: {
    simulationIds: string[]
    customData: CustomDataSource[]
  }
  sampleCount: number
  /** SFT JSONL path (one messages-triple per line). Null if the dataset has no SFT content. */
  trainJsonlPath: string | null
  /** Causal plain-text path. Null if the dataset has no plain-text content. */
  trainTxtPath: string | null
}

const REGISTRY_PATH = 'datasets.json'

// ─────────────────────────── helpers ──────────────────────────────────────

function registryPath(): string {
  return path.join(app.getPath('userData'), REGISTRY_PATH)
}

function readRegistry(): DatasetEntry[] {
  const p = registryPath()
  if (!fs.existsSync(p)) return []
  try {
    return JSON.parse(fs.readFileSync(p, 'utf-8')) as DatasetEntry[]
  } catch {
    return []
  }
}

function writeRegistry(list: DatasetEntry[]): void {
  const p = registryPath()
  fs.mkdirSync(path.dirname(p), { recursive: true })
  const tmp = p + '.tmp-' + Date.now()
  fs.writeFileSync(tmp, JSON.stringify(list, null, 2), 'utf-8')
  fs.renameSync(tmp, p)
}

function newId(): string {
  return (
    'ds_' +
    Date.now().toString(36) +
    '_' +
    Math.random().toString(36).slice(2, 8)
  )
}

function nowIso(): string {
  return new Date().toISOString()
}

function datasetDir(id: string): string {
  return path.join(app.getPath('userData'), 'datasets', id)
}

function datasetJsonlPath(id: string): string {
  return path.join(datasetDir(id), 'train.jsonl')
}

function datasetTxtPath(id: string): string {
  return path.join(datasetDir(id), 'train.txt')
}

function parseJsonlText(text: string): Array<Record<string, unknown>> {
  const out: Array<Record<string, unknown>> = []
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line) continue
    try {
      const obj = JSON.parse(line)
      if (obj && typeof obj === 'object' && Array.isArray((obj as { messages?: unknown }).messages)) {
        out.push(obj as Record<string, unknown>)
      }
    } catch {
      // Skip malformed lines silently; the user can fix them in the
      // Training page if their custom data doesn't validate.
    }
  }
  return out
}

function readJsonlFile(p: string): Array<Record<string, unknown>> {
  if (!fs.existsSync(p)) return []
  try {
    return parseJsonlText(fs.readFileSync(p, 'utf-8'))
  } catch {
    return []
  }
}

// ─────────────────────────── write on-disk files ──────────────────────────

/**
 * Re-emit the dataset's on-disk files. Returns the number of
 * training samples written and the absolute paths produced.
 *
 * Two files may be written, depending on the source mix:
 *   - `train.jsonl` for SFT data (simulation outcomes + jsonl-text
 *     + jsonl-file). One `{"messages":[{role,content},...]}`
 *     triple per line. The system + user prompts are reconstructed
 *     via the same helpers the simulation worker uses, so the SFT
 *     data matches the inference prompt exactly.
 *   - `train.txt` for Causal plain-text data. The `text` custom
 *     data entries are concatenated, separated by a blank line.
 *     Saved as-is (no JSON wrapper) per the SDK's Causal
 *     fine-tuning format.
 *
 * If a dataset has both kinds of sources, BOTH files are written.
 * The `finetune.ts` driver prefers the JSONL (SFT wins).
 */
export interface WriteDatasetResult {
  sampleCount: number
  jsonlPath: string | null
  txtPath: string | null
  error?: string
}

export function writeDatasetJsonl(
  entry: Pick<DatasetEntry, 'id' | 'sources'>,
  profileSlug: string
): WriteDatasetResult {
  const dir = datasetDir(entry.id)
  fs.mkdirSync(dir, { recursive: true })
  const jsonlPath = datasetJsonlPath(entry.id)
  const txtPath = datasetTxtPath(entry.id)

  const jsonlLines: string[] = []
  const txtChunks: string[] = []
  let sampleCount = 0

  // 1. Per-outcome triples from each selected sim (SFT only).
  for (const simId of entry.sources.simulationIds) {
    const sim = getSimulation(profileSlug, simId)
    if (!sim) continue
    const outcomes = listOutcomes(profileSlug, simId)
    const allSubjects =
      sim.canvas.cards
        .filter((c) => c.category === 'subject')
        .map((c) => ({ id: c.id, title: c.title })) ?? []
    const systemPrompt = buildPerOutcomeSystemPrompt()
    for (const o of outcomes) {
      if (o.status !== 'done') continue
      const msgs = loadMessages(profileSlug, o.sessionSlug)
      const assistant = [...msgs].reverse().find((m) => m.role === 'assistant')
      if (!assistant) continue
      const userPrompt = buildPerOutcomeUserPrompt(o, allSubjects)
      const triple = {
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
          { role: 'assistant', content: assistant.content },
        ],
      }
      jsonlLines.push(JSON.stringify(triple))
      sampleCount++
    }
  }

  // 2. Custom data sources.
  for (const src of entry.sources.customData) {
    if (src.kind === 'jsonl-text') {
      for (const rec of parseJsonlText(src.text)) {
        jsonlLines.push(JSON.stringify(rec))
        sampleCount++
      }
    } else if (src.kind === 'jsonl-file') {
      for (const rec of readJsonlFile(src.path)) {
        jsonlLines.push(JSON.stringify(rec))
        sampleCount++
      }
    } else if (src.kind === 'text') {
      // Causal fine-tuning: write the raw text as-is. No JSON wrapper.
      const body = src.text.trim()
      if (body.length > 0) {
        txtChunks.push(body)
        sampleCount++
      }
    }
  }

  // Best-effort cleanup of stale files (e.g. an old dataset that used
  // to be SFT-only is now text-only — we want the old .jsonl gone so
  // finetune.ts picks the right one).
  let writeError: string | undefined
  try {
    if (jsonlLines.length > 0) {
      const tmp = jsonlPath + '.tmp-' + Date.now()
      fs.writeFileSync(tmp, jsonlLines.join('\n') + '\n', 'utf-8')
      fs.renameSync(tmp, jsonlPath)
    } else if (fs.existsSync(jsonlPath)) {
      fs.unlinkSync(jsonlPath)
    }
    if (txtChunks.length > 0) {
      const tmp = txtPath + '.tmp-' + Date.now()
      fs.writeFileSync(tmp, txtChunks.join('\n\n') + '\n', 'utf-8')
      fs.renameSync(tmp, txtPath)
    } else if (fs.existsSync(txtPath)) {
      fs.unlinkSync(txtPath)
    }
  } catch (err) {
    writeError = err instanceof Error ? err.message : String(err)
  }

  return {
    sampleCount,
    jsonlPath: jsonlLines.length > 0 ? jsonlPath : null,
    txtPath: txtChunks.length > 0 ? txtPath : null,
    error: writeError,
  }
}

// ─────────────────────────── public API ───────────────────────────────────

export function listDatasets(): DatasetEntry[] {
  return readRegistry().sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  )
}

export function getDataset(id: string): DatasetEntry | null {
  return readRegistry().find((d) => d.id === id) ?? null
}

export interface CreateDatasetInput {
  name: string
  sources: DatasetEntry['sources']
  profileSlug: string
}

export function createDataset(input: CreateDatasetInput): DatasetEntry {
  const id = newId()
  const now = nowIso()
  const writeResult = writeDatasetJsonl({ id, sources: input.sources }, input.profileSlug)
  const entry: DatasetEntry = {
    id,
    name: input.name.trim() || `Dataset · ${now}`,
    createdAt: now,
    updatedAt: now,
    sources: input.sources,
    sampleCount: writeResult.sampleCount,
    trainJsonlPath: writeResult.jsonlPath,
    trainTxtPath: writeResult.txtPath,
  }
  const list = readRegistry()
  list.push(entry)
  writeRegistry(list)
  return entry
}

export function updateDataset(
  id: string,
  patch: Partial<Pick<DatasetEntry, 'name' | 'sources'>>,
  profileSlug: string
): DatasetEntry | null {
  const list = readRegistry()
  const idx = list.findIndex((d) => d.id === id)
  if (idx === -1) return null
  const now = nowIso()
  const next: DatasetEntry = {
    ...list[idx],
    name: patch.name?.trim() || list[idx].name,
    sources: patch.sources ?? list[idx].sources,
    updatedAt: now,
  }
  if (patch.sources) {
    const r = writeDatasetJsonl({ id, sources: next.sources }, profileSlug)
    next.sampleCount = r.sampleCount
    next.trainJsonlPath = r.jsonlPath
    next.trainTxtPath = r.txtPath
  }
  list[idx] = next
  writeRegistry(list)
  return next
}

export function deleteDataset(id: string): boolean {
  const list = readRegistry()
  const next = list.filter((d) => d.id !== id)
  if (next.length === list.length) return false
  writeRegistry(next)
  // Best-effort unlink of the on-disk JSONL. We don't fail the delete
  // if the unlink fails (e.g. file already gone) — the registry entry
  // is the source of truth.
  try {
    const dir = datasetDir(id)
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  } catch (err) {
    console.warn('[datasetStore] failed to remove dataset dir', id, err)
  }
  return true
}
