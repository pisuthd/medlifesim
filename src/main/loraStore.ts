import * as fs from 'fs'
import * as path from 'path'
import { app } from 'electron'

/**
 * On-disk registry of LoRA adapters. Each `LoraEntry` is a single
 * `.gguf` adapter file the user can pick from the Model Selector to
 * bind to the loaded base model. Sources are either `training` (the
 * adapter was just produced by a `finetune()` run) or `imported` (the
 * user picked a file via the file dialog).
 */

export type LoraSource = 'training' | 'imported'

export interface LoraEntry {
  id: string
  name: string
  baseModelId: string
  loraPath: string
  source: LoraSource
  trainingRunId: string | null
  createdAt: string
  sizeBytes?: number
}

const REGISTRY_PATH = 'loras.json'

function registryPath(): string {
  return path.join(app.getPath('userData'), REGISTRY_PATH)
}

function readRegistry(): LoraEntry[] {
  const p = registryPath()
  if (!fs.existsSync(p)) return []
  try {
    return JSON.parse(fs.readFileSync(p, 'utf-8')) as LoraEntry[]
  } catch {
    return []
  }
}

function writeRegistry(list: LoraEntry[]): void {
  const p = registryPath()
  fs.mkdirSync(path.dirname(p), { recursive: true })
  const tmp = p + '.tmp-' + Date.now()
  fs.writeFileSync(tmp, JSON.stringify(list, null, 2), 'utf-8')
  fs.renameSync(tmp, p)
}

function newId(): string {
  return (
    'lora_' +
    Date.now().toString(36) +
    '_' +
    Math.random().toString(36).slice(2, 8)
  )
}

function nowIso(): string {
  return new Date().toISOString()
}

function loraStoreDir(): string {
  return path.join(app.getPath('userData'), 'loras-store')
}

export function listLoras(): LoraEntry[] {
  return readRegistry().sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )
}

export function getLora(id: string): LoraEntry | null {
  return readRegistry().find((l) => l.id === id) ?? null
}

export function getLoraByPath(p: string): LoraEntry | null {
  return readRegistry().find((l) => l.loraPath === p) ?? null
}

export interface CreateLoraInput {
  name: string
  baseModelId: string
  loraPath: string
  source: LoraSource
  trainingRunId: string | null
  sizeBytes?: number
}

export function createLora(input: CreateLoraInput): LoraEntry {
  const id = newId()
  const entry: LoraEntry = {
    id,
    name: input.name.trim() || `LoRA · ${nowIso()}`,
    baseModelId: input.baseModelId,
    loraPath: input.loraPath,
    source: input.source,
    trainingRunId: input.trainingRunId,
    createdAt: nowIso(),
    sizeBytes: input.sizeBytes,
  }
  const list = readRegistry()
  list.push(entry)
  writeRegistry(list)
  return entry
}

/**
 * Delete a LoRA entry and unlink its on-disk file. The caller is
 * responsible for first checking that this LoRA is NOT the active
 * LoRA bound to the currently loaded model — the Training page
 * disables its Delete button when `currentLoraId === lora.id` and
 * the only way to free it up is via the Model Selector.
 *
 * Returns `true` when an entry was removed, `false` otherwise.
 */
export function deleteLora(id: string): { removed: boolean; lora: LoraEntry | null } {
  const list = readRegistry()
  const target = list.find((l) => l.id === id) ?? null
  if (!target) return { removed: false, lora: null }
  const next = list.filter((l) => l.id !== id)
  writeRegistry(next)
  // Unlink the on-disk .gguf. We don't fail the delete if the
  // unlink fails — the registry entry is the source of truth.
  try {
    if (fs.existsSync(target.loraPath)) {
      fs.unlinkSync(target.loraPath)
    }
    // If this was an imported LoRA copied into our store dir, the
    // parent directory is now empty — clean it up.
    const parent = path.dirname(target.loraPath)
    if (parent.startsWith(loraStoreDir()) && fs.existsSync(parent)) {
      const remaining = fs.readdirSync(parent)
      if (remaining.length === 0) {
        fs.rmdirSync(parent)
      }
    }
  } catch (err) {
    console.warn('[loraStore] failed to unlink LoRA file', target.loraPath, err)
  }
  return { removed: true, lora: target }
}

/**
 * Copy an externally-picked .gguf into the LoRA store dir and
 * register it as `imported`. Returns the new LoraEntry.
 *
 * `baseModelId` is the model the user is currently loaded with —
 * stored on the entry so the Model Selector can warn when a
 * different base model is required to use this adapter.
 */
export function importLoraFromPath(srcPath: string, baseModelId: string): LoraEntry | null {
  if (!fs.existsSync(srcPath)) return null
  if (!srcPath.toLowerCase().endsWith('.gguf')) return null
  const id = newId()
  const destDir = path.join(loraStoreDir(), id)
  fs.mkdirSync(destDir, { recursive: true })
  const destPath = path.join(destDir, 'adapter.gguf')
  try {
    fs.copyFileSync(srcPath, destPath)
  } catch (err) {
    console.error('[loraStore] copyFile failed', err)
    return null
  }
  let sizeBytes: number | undefined
  try {
    sizeBytes = fs.statSync(destPath).size
  } catch {
    /* ignore */
  }
  return createLora({
    name: path.basename(srcPath, path.extname(srcPath)),
    baseModelId,
    loraPath: destPath,
    source: 'imported',
    trainingRunId: null,
    sizeBytes,
  })
}
