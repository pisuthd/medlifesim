import { app } from 'electron'
import { join } from 'path'
import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from 'fs'

/**
 * User-managed model registry persisted at `userData/models.json`.
 *
 * Pre-seeds the curated MedPsy model library on first launch (1.7B Q8_0
 * for low-spec machines, 4B Q4_K_M for high-spec machines) and migrates
 * any legacy `*.gguf` files already in `userData` (notably the old
 * `medpsy-1.7b-q4_k_m-imat.gguf` produced by the previous downloader)
 * as `sourceKind: 'file'` entries so users do not have to re-download.
 */

export type ModelSourceKind = 'http' | 'https' | 'registry' | 'file'

export interface ModelEntry {
  id: string
  name: string
  source: string
  sourceKind: ModelSourceKind
  size?: number
  quantization?: string
  params?: string
  description?: string
  createdAt: string
  builtin?: boolean
}

export interface ModelRegistryFile {
  version: 1
  models: ModelEntry[]
  lastSelectedModelId: string | null
}

const REGISTRY_FILE = 'models.json'
const LEGACY_MODEL_FILE = 'medpsy-1.7b-q4_k_m-imat.gguf'

/**
 * Curated MedPsy builtin presets. These are the only models the app
 * ships with — users can add custom URL/file entries alongside via
 * "Add custom model" in the picker.
 *
 * Size is the on-disk .gguf byte count, hardcoded so the model card
 * can render "2.16 GB" without doing a HEAD request on the URL.
 */
const BUILTIN_PRESETS: Array<Omit<ModelEntry, 'id' | 'createdAt'>> = [
  {
    name: 'MedPsy 1.7B (Q8_0)',
    source:
      'https://huggingface.co/qvac/MedPsy-1.7B-GGUF/resolve/main/medpsy-1.7b-q8_0.gguf?download=true',
    sourceKind: 'https',
    quantization: 'Q8_0',
    params: '1.7B',
    size: 2.16 * 1024 * 1024 * 1024,
    description:
      'Default model, runs on 8 GB RAM laptops.',
    builtin: true,
  },
  {
    name: 'MedPsy 4B (Q8_0)',
    source:
      'https://huggingface.co/qvac/MedPsy-4B-GGUF/resolve/main/medpsy-4b-q8_0.gguf?download=true',
    sourceKind: 'https',
    quantization: 'Q8_0',
    params: '4B',
    size: 4.69 * 1024 * 1024 * 1024,
    description:
      'Larger model, requires 16 GB+ RAM and a discrete GPU.',
    builtin: true,
  },
]

export function deriveSourceKind(src: string): ModelSourceKind {
  if (src.startsWith('registry://')) return 'registry'
  if (src.startsWith('https://')) return 'https'
  if (src.startsWith('http://')) return 'http'
  // Absolute path on Windows (C:\...) or POSIX (/...) → file
  if (src.length >= 2 && (src[1] === ':' || src.startsWith('/') || src.startsWith('\\\\'))) {
    return 'file'
  }
  // Fallback: treat as a URL
  return 'https'
}

function newId(): string {
  return `m_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

class ModelStore {
  private filePath: string
  private state: ModelRegistryFile = { version: 1, models: [], lastSelectedModelId: null }

  constructor() {
    const userDataPath = app.getPath('userData')
    if (!existsSync(userDataPath)) {
      mkdirSync(userDataPath, { recursive: true })
    }
    this.filePath = join(userDataPath, REGISTRY_FILE)
    this.load()
    this.scanExistingGguf()
    this.preSeedIfEmpty()
    this.save()
  }

  private load(): void {
    try {
      if (existsSync(this.filePath)) {
        const data = readFileSync(this.filePath, 'utf-8')
        const parsed = JSON.parse(data) as ModelRegistryFile
        if (parsed && Array.isArray(parsed.models)) {
          this.state = {
            version: 1,
            models: parsed.models,
            lastSelectedModelId: parsed.lastSelectedModelId ?? null,
          }
        }
      }
    } catch (error) {
      console.error('[ModelStore] Failed to load registry:', error)
      this.state = { version: 1, models: [], lastSelectedModelId: null }
    }
  }

  private save(): void {
    try {
      writeFileSync(this.filePath, JSON.stringify(this.state, null, 2), 'utf-8')
    } catch (error) {
      console.error('[ModelStore] Failed to save registry:', error)
    }
  }

  private preSeedIfEmpty(): void {
    if (this.state.models.length > 0) return
    const now = new Date().toISOString()
    // Default `lastSelectedModelId` to the 1.7B (low-spec) entry so
    // first-time users on small machines get the right default.
    let firstEntryId: string | null = null
    for (const preset of BUILTIN_PRESETS) {
      const entry: ModelEntry = {
        id: newId(),
        ...preset,
        createdAt: now,
      }
      this.state.models.push(entry)
      if (firstEntryId === null) firstEntryId = entry.id
    }
    if (firstEntryId !== null) {
      this.state.lastSelectedModelId = firstEntryId
    }
  }

  private scanExistingGguf(): void {
    try {
      const userDataPath = app.getPath('userData')
      const files = readdirSync(userDataPath)
      const ggufFiles = files.filter((f) => f.toLowerCase().endsWith('.gguf'))

      for (const filename of ggufFiles) {
        const absPath = join(userDataPath, filename)
        let stat
        try {
          stat = statSync(absPath)
          if (!stat.isFile()) continue
        } catch {
          continue
        }

        // If the URL entry for a builtin still exists AND the legacy
        // file is present, remove the URL entry to avoid showing both.
        if (filename === LEGACY_MODEL_FILE) {
          for (const preset of BUILTIN_PRESETS) {
            this.state.models = this.state.models.filter(
              (m) => m.source !== preset.source,
            )
          }
        }

        // Skip if a local-file entry with this exact path already exists.
        const exists = this.state.models.some(
          (m) => m.sourceKind === 'file' && m.source === absPath,
        )
        if (exists) continue

        const entry: ModelEntry = {
          id: newId(),
          name:
            filename === LEGACY_MODEL_FILE
              ? 'MedPsy 1.7B (Q4_K_M) — local copy'
              : filename.replace(/\.gguf$/i, ''),
          source: absPath,
          sourceKind: 'file',
          size: stat.size,
          quantization: 'Q4_K_M',
          params: '1.7B',
          description: 'Local GGUF file detected in userData',
          createdAt: new Date().toISOString(),
          builtin: false,
        }
        this.state.models.push(entry)
      }

      // Ensure lastSelectedModelId still points at an existing entry.
      if (
        this.state.lastSelectedModelId &&
        !this.state.models.some((m) => m.id === this.state.lastSelectedModelId)
      ) {
        this.state.lastSelectedModelId = this.state.models[0]?.id ?? null
      }
    } catch (error) {
      console.error('[ModelStore] Failed to scan userData for .gguf files:', error)
    }
  }

  getAll(): ModelEntry[] {
    return [...this.state.models]
  }

  getById(id: string): ModelEntry | undefined {
    return this.state.models.find((m) => m.id === id)
  }

  add(
    input: Omit<
      ModelEntry,
      'id' | 'createdAt' | 'sourceKind' | 'size'
    > & {
      sourceKind?: ModelSourceKind
      size?: number
    },
  ): ModelEntry {
    const sourceKind = input.sourceKind ?? deriveSourceKind(input.source)
    const entry: ModelEntry = {
      id: newId(),
      name: input.name,
      source: input.source,
      sourceKind,
      size: input.size,
      quantization: input.quantization,
      params: input.params,
      description: input.description,
      createdAt: new Date().toISOString(),
      builtin: input.builtin ?? false,
    }
    this.state.models.push(entry)
    this.save()
    return entry
  }

  remove(id: string): boolean {
    const entry = this.getById(id)
    if (!entry) return false
    if (entry.builtin) return false
    this.state.models = this.state.models.filter((m) => m.id !== id)
    if (this.state.lastSelectedModelId === id) {
      this.state.lastSelectedModelId = this.state.models[0]?.id ?? null
    }
    this.save()
    return true
  }

  setLastSelected(id: string | null): void {
    if (id !== null && !this.getById(id)) return
    this.state.lastSelectedModelId = id
    this.save()
  }

  getLastSelected(): ModelEntry | null {
    if (!this.state.lastSelectedModelId) return null
    return this.getById(this.state.lastSelectedModelId) ?? null
  }
}

export const modelStore = new ModelStore()
