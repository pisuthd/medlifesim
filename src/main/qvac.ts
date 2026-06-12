import { app, BrowserWindow } from 'electron'
import { join, basename as pathBasename } from 'path'
import { existsSync, writeFileSync, mkdirSync, promises as fsPromises } from 'fs'
import {
  loadModel,
  unloadModel,
  downloadAsset,
  cancel,
  ModelType,
  InferenceCancelledError,
  ContextOverflowError,
  WorkerCrashedError,
  WorkerShutdownError,
} from '@qvac/sdk'
import { settingsStore } from './toolsStore'
import { modelStore, type ModelEntry, type ModelSourceKind } from './modelStore'

/**
 * Single chokepoint around the QVAC SDK. Owns:
 *  - the SDK config (cacheDirectory)
 *  - the in-flight requestId (for cancellation)
 *  - the currently-loaded modelId (so ai:sendMessage can stream)
 *  - normalized progress emission (models:progress)
 *  - error mapping → { code, message, retryable } for the renderer
 *  - LoRA-binding plumbing (pendingLoraPath + currentLoraId) so the
 *    next `loadModel` picks up the user-selected LoRA adapter
 *  - training-mode lock so the chat / Model Selector disable while a
 *    fine-tune run is in flight
 */

// ───────────────────────────── module state ─────────────────────────────

let mainWindowRef: BrowserWindow | null = null
let currentRequestId: string | null = null
let currentModelId: string | null = null
let currentEntry: ModelEntry | null = null
let currentLoadedAt: number | null = null

// LoRA binding state. `pendingLoraPath` is set by the
// `models:selectLora` IPC and consumed by the next `loadModel` call;
// `currentLoraId` is the registered LoraEntry.id bound to the
// currently loaded model and is surfaced on the status payload so
// the renderer can show "active LoRA" badges and disable its
// Delete button on the Training page.
let pendingLoraPath: string | null = null
let currentLoraId: string | null = null
let currentLoraName: string | null = null

// Training lock. When a fine-tune run is in flight we set this so
// `buildStatus()` reports `active.loaded = false`; that flips the
// chat input disabled (Chat.tsx `!isReady` branch) and the Model
// Selector cards' `disabled` flag.
let isTrainingActive = false

// ───────────────────────────── config bootstrap ─────────────────────────

/**
 * Writes `userData/qvac.config.json` so the SDK's Node resolver picks it
 * up via QVAC_CONFIG_PATH. Must be called BEFORE any loadModel/downloadAsset
 * call so the worker writes its cache where we can inspect it.
 */
export function ensureQvacConfig(): void {
  if (process.env.QVAC_CONFIG_PATH) return
  const userDataPath = app.getPath('userData')
  const cacheDir = join(userDataPath, 'qvac-cache')
  mkdirSync(cacheDir, { recursive: true })
  const cfgPath = join(userDataPath, 'qvac.config.json')
  const cfg = { cacheDirectory: cacheDir }
  try {
    writeFileSync(cfgPath, JSON.stringify(cfg, null, 2), 'utf-8')
    process.env.QVAC_CONFIG_PATH = cfgPath
    console.log('[qvac] Wrote config to', cfgPath)
  } catch (error) {
    console.error('[qvac] Failed to write qvac.config.json:', error)
  }
}

export function setMainWindow(window: BrowserWindow | null): void {
  mainWindowRef = window
}

// ───────────────────────────── progress emission ─────────────────────────

function send(channel: string, payload: unknown): void {
  if (mainWindowRef && !mainWindowRef.isDestroyed()) {
    mainWindowRef.webContents.send(channel, payload)
  }
}

function emitProgress(
  phase: 'downloading' | 'loading',
  p: { downloaded: number; total: number; percentage: number; requestId?: string },
): void {
  send('models:progress', { phase, ...p })
}

// ───────────────────────────── cache-file utility ──────────────────────

/**
 * Compute the basename of an HTTP(S) source URL, matching how the QVAC
 * SDK constructs cache filenames at http.js:328-329:
 *   `<shortHash(source)>_<basename>`
 * `generateShortHash` is not exported from the SDK, so we discover
 * cache files by `endsWith` on the basename only.
 */
function basenameOfSource(source: string): string {
  if (!/^https?:\/\//i.test(source)) return ''
  try {
    return pathBasename(new URL(source).pathname) || ''
  } catch {
    return ''
  }
}

/**
 * Find every file in `<userData>/qvac-cache/` whose name ends with
 * `_<basename(entry.source)>` and unlink it. Used both by auto-recovery
 * (after a retryable download error in downloadThenLoad) and by the
 * manual `resetCache` IPC. Returns the absolute paths that were deleted.
 */
export async function findAndUnlinkCacheFile(
  entry: ModelEntry,
): Promise<string[]> {
  const basename = basenameOfSource(entry.source)
  if (!basename) return []
  const cacheDir = join(app.getPath('userData'), 'qvac-cache')
  let names: string[]
  try {
    names = await fsPromises.readdir(cacheDir)
  } catch (err) {
    console.warn('[qvac] resetCache: cache dir unreadable:', cacheDir, err)
    return []
  }
  const suffix = `_${basename}`
  const deleted: string[] = []
  for (const name of names) {
    if (!name.endsWith(suffix)) continue
    const abs = join(cacheDir, name)
    try {
      await fsPromises.unlink(abs)
      deleted.push(abs)
      console.log('[qvac] Deleted cache file:', abs)
    } catch (err) {
      // EBUSY/EPERM on Windows if the worker still holds a handle —
      // log and continue. Auto-recovery will retry on the next launch.
      console.warn('[qvac] Failed to delete cache file:', abs, err)
    }
  }
  return deleted
}

/**
 * Public manual-reset entry point. Used by the `models:resetCache` IPC.
 */
export async function resetCache(
  entry: ModelEntry,
): Promise<{ success: boolean; deleted: string[]; error?: string }> {
  if (entry.sourceKind === 'file') {
    return { success: false, deleted: [], error: 'Cannot reset local file' }
  }
  try {
    const deleted = await findAndUnlinkCacheFile(entry)
    console.log(`[qvac] resetCache: removed ${deleted.length} file(s) for ${entry.id}`)
    return { success: true, deleted }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[qvac] resetCache failed:', message)
    return { success: false, deleted: [], error: message }
  }
}

// ───────────────────────────── error mapping ─────────────────────────────

/**
 * The QVAC SDK declares many specific error classes
 * (`ModelLoadFailedError`, `DownloadAssetFailedError`, etc.) but only a small
 * subset is re-exported from the package root. We look them up by stable
 * class name to avoid coupling to deep import paths that may move between
 * SDK versions.
 */
function errorName(err: unknown): string {
  if (err && typeof err === 'object' && 'name' in err) {
    const n = (err as { name: unknown }).name
    if (typeof n === 'string') return n
  }
  return ''
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  if (err && typeof err === 'object' && 'message' in err) {
    const m = (err as { message: unknown }).message
    if (typeof m === 'string') return m
  }
  return ''
}

export function mapError(err: unknown): { code: string; message: string; retryable: boolean } {
  if (err instanceof InferenceCancelledError) {
    return { code: 'CANCELLED', message: 'Cancelled', retryable: false }
  }
  if (err instanceof ContextOverflowError) {
    return {
      code: 'CONTEXT_OVERFLOW',
      message:
        'Conversation too long for the current context size. Increase ctx_size in Settings or start a new session.',
      retryable: false,
    }
  }
  if (err instanceof WorkerCrashedError || err instanceof WorkerShutdownError) {
    return {
      code: 'WORKER_DIED',
      message: 'Inference engine crashed. Reload to retry.',
      retryable: true,
    }
  }

  const name = errorName(err)
  const message = errorMessage(err)

  if (name === 'DownloadCancelledError') {
    return { code: 'CANCELLED', message: 'Download cancelled', retryable: false }
  }
  if (name === 'ModelFileNotFoundError' || name === 'ModelFileNotFoundInDirError') {
    const path = (err as { modelPath?: string })?.modelPath
    return {
      code: 'FILE_NOT_FOUND',
      message: `File not found: ${path ?? ''}`.trim(),
      retryable: false,
    }
  }
  if (name === 'ModelFileLocateFailedError') {
    const meta = err as { modelType?: string; modelPath?: string }
    return {
      code: 'LOCATE_FAILED',
      message: `Could not locate ${meta.modelType ?? 'model'} at ${meta.modelPath ?? ''}`.trim(),
      retryable: false,
    }
  }
  if (name === 'ChecksumValidationFailedError') {
    const fileName = (err as { fileName?: string })?.fileName
    return {
      code: 'CHECKSUM_FAILED',
      message: `Checksum failed: ${fileName ?? 'file'}. The download will be re-attempted.`,
      retryable: true,
    }
  }
  if (name === 'PartialDownloadOfflineError') {
    return {
      code: 'PARTIAL_OFFLINE',
      message: 'Saved partial download. Reconnect to the internet to resume.',
      retryable: true,
    }
  }
  if (name === 'HTTPError') {
    return { code: 'HTTP_ERROR', message: message || 'HTTP error during download', retryable: true }
  }
  if (name === 'DownloadAssetFailedError') {
    return {
      code: 'DOWNLOAD_FAILED',
      message: 'Download failed: check your connection or the URL.',
      retryable: true,
    }
  }
  if (name === 'ModelLoadFailedError') {
    return { code: 'LOAD_FAILED', message: message || 'Model load failed', retryable: true }
  }
  if (err instanceof Error) {
    return { code: 'UNKNOWN', message: err.message || 'Unknown error', retryable: true }
  }
  return { code: 'UNKNOWN', message: 'Unknown error', retryable: true }
}

// ───────────────────────────── public API ────────────────────────────────

export async function ensureModel(
  entry: ModelEntry,
): Promise<{ modelId: string; fromCache: boolean }> {
  // Publish the entry as the in-flight selection up-front so buildStatus()
  // (and the renderer's `activeId` lookup) can attribute the upcoming
  // progress events to a specific row in the model list. Without this the
  // entry's `tone` would stay 'idle' for the whole download + load window
  // and the per-row progress bar would never render.
  currentEntry = entry
  currentModelId = null
  currentLoadedAt = null
  if (entry.sourceKind === 'file') {
    if (!existsSync(entry.source)) {
      currentEntry = null
      throw {
        code: 'FILE_NOT_FOUND',
        message: `File not found: ${entry.source}`,
        retryable: false,
      }
    }
    return await loadLocal(entry)
  }
  return await downloadThenLoad(entry)
}

async function loadLocal(
  entry: ModelEntry,
): Promise<{ modelId: string; fromCache: boolean }> {
  const op = loadModel({
    modelSrc: entry.source,
    modelType: ModelType.llamacppCompletion,
    modelConfig: buildModelConfig(),
    onProgress: (p) =>
      emitProgress('loading', {
        downloaded: p.downloaded,
        total: p.total,
        percentage: p.percentage,
        requestId: op.requestId,
      }),
  })
  currentRequestId = op.requestId
  try {
    const modelId = await op
    currentRequestId = null
    currentModelId = modelId
    currentEntry = entry
    currentLoadedAt = Date.now()
    resolveActiveLora()
    emitProgress('loading', {
      downloaded: 1,
      total: 1,
      percentage: 100,
      requestId: op.requestId,
    })
    console.log('[qvac] Local model loaded:', modelId, '(', entry.source, ')')
    return { modelId, fromCache: false }
  } catch (err) {
    currentRequestId = null
    throw mapError(err)
  }
}

async function downloadThenLoad(
  entry: ModelEntry,
): Promise<{ modelId: string; fromCache: boolean }> {
  // 1) Download (resume is automatic when QVAC's cacheDirectory already has a partial file for the same URL)
  const downloadOp = downloadAsset({
    assetSrc: entry.source,
    onProgress: (p) =>
      emitProgress('downloading', {
        downloaded: p.downloaded,
        total: p.total,
        percentage: p.percentage,
        requestId: downloadOp.requestId,
      }),
  })
  currentRequestId = downloadOp.requestId
  try {
    await downloadOp
  } catch (err) {
    currentRequestId = null
    throw mapError(err)
  }
  currentRequestId = null

  // 2) Load by passing the same URL; the SDK reuses the cached asset by its source identifier.
  const loadOp = loadModel({
    modelSrc: entry.source,
    modelType: ModelType.llamacppCompletion,
    modelConfig: buildModelConfig(),
    onProgress: (p) =>
      emitProgress('loading', {
        downloaded: p.downloaded,
        total: p.total,
        percentage: p.percentage,
        requestId: loadOp.requestId,
      }),
  })
  currentRequestId = loadOp.requestId
  try {
    const modelId = await loadOp
    currentRequestId = null
    currentModelId = modelId
    currentEntry = entry
    currentLoadedAt = Date.now()
    resolveActiveLora()
    emitProgress('loading', {
      downloaded: 1,
      total: 1,
      percentage: 100,
      requestId: loadOp.requestId,
    })
    console.log('[qvac] URL model loaded:', modelId, '(', entry.source, ')')
    return { modelId, fromCache: false }
  } catch (err) {
    currentRequestId = null
    throw mapError(err)
  }
}

export async function cancelCurrentRequest(opts: { clearCache?: boolean } = {}): Promise<void> {
  if (!currentRequestId) return
  const id = currentRequestId
  currentRequestId = null
  try {
    await cancel({ requestId: id, clearCache: opts.clearCache })
  } catch (err) {
    if (!(err instanceof InferenceCancelledError)) {
      console.warn('[qvac] cancel failed:', err)
    }
  }
}

export async function unloadCurrent(modelId: string): Promise<void> {
  try {
    await unloadModel({ modelId })
    if (currentModelId === modelId) {
      currentModelId = null
      currentEntry = null
      currentLoadedAt = null
      currentLoraId = null
      currentLoraName = null
    }
  } catch (e) {
    console.warn('[qvac] unload failed:', e)
  }
}

export function getActiveModelId(): string | null {
  return currentModelId
}

/**
 * Returns the currently-loaded model entry (or null). Used by the
 * fine-tuning driver to verify the base model is the one the user
 * intends to train against.
 */
export function getActiveEntry(): ModelEntry | null {
  return currentEntry
}

/**
 * Build the per-load `modelConfig` object. Threads the pending
 * LoRA path (if any) into the SDK's `lora` field so the next
 * `loadModel` call binds the user-selected adapter. Uses
 * `lora_apply_mode: 'immediately'` so subsequent `completion()`
 * calls see the adapter without a follow-up reload.
 *
 * The `lora` field is defined on the llamacpp completion engine;
 * the SDK's `common.d.ts` schema marks it optional. We cast
 * `modelConfig as any` only at the seam where the lora field
 * doesn't appear in the public overloads.
 */
function buildModelConfig(): Record<string, unknown> {
  const cfg: Record<string, unknown> = {
    ctx_size: settingsStore.getCtxSize(),
    tools: false,
  }
  if (pendingLoraPath) {
    cfg.lora = pendingLoraPath
    cfg.lora_apply_mode = 'immediately'
  }
  return cfg
}

/**
 * After a successful load, copy the pending LoRA path into
 * `currentLoraId` by reverse-resolving the path to its registered
 * LoraEntry. If no entry is registered for this path, leave
 * `currentLoraId` as `null` and set `currentLoraName` to the file
 * basename so the status surface still has something to show.
 *
 * Lazy import: the loraStore is only available once the rest of
 * the app is wired up. We use a dynamic require-equivalent via
 * top-level import (it's safe to import unconditionally here).
 */
function resolveActiveLora(): void {
  if (!pendingLoraPath) {
    currentLoraId = null
    currentLoraName = null
    return
  }
  const path = pendingLoraPath
  // Defer-resolve the LoraEntry in a microtask so we don't create
  // a circular import at module-load time.
  Promise.resolve()
    .then(async () => {
      const { getLoraByPath } = await import('./loraStore')
      const entry = getLoraByPath(path)
      if (entry) {
        currentLoraId = entry.id
        currentLoraName = entry.name
      } else {
        currentLoraId = null
        // Use the file basename as a fallback display name.
        const slash = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'))
        currentLoraName = slash >= 0 ? path.slice(slash + 1) : path
      }
      pendingLoraPath = null
    })
    .catch((err) => {
      console.warn('[qvac] resolveActiveLora failed', err)
      pendingLoraPath = null
    })
}

/**
 * Set the LoRA the next `loadModel` call should bind. Pass `null`
 * to clear (load the base model with no adapter). Called by the
 * `models:selectLora` IPC handler in `index.ts`.
 */
export function setPendingLoraPath(path: string | null, loraId: string | null, loraName: string | null): void {
  pendingLoraPath = path
  if (path === null) {
    currentLoraId = null
    currentLoraName = null
  } else {
    currentLoraId = loraId
    currentLoraName = loraName
  }
}

export function getCurrentLoraId(): string | null {
  return currentLoraId
}

/**
 * Toggle the training-mode lock. While `true`, `buildStatus()`
 * reports `active.loaded = false` so the chat / Model Selector
 * disable. Called by `finetune.ts` around the lifecycle of a
 * training run.
 */
export function setTrainingMode(active: boolean): void {
  isTrainingActive = active
}

export function buildStatus(): {
  active: {
    id: string | null
    name: string
    source: string
    sourceKind: ModelSourceKind | null
    loaded: boolean
    requestId: string | null
    loadedAt: number | null
  }
  lastSelectedId: string | null
  available: ReturnType<typeof modelStore.getAll>
  activeLora: { id: string | null; name: string | null; path: string | null }
  trainingActive: boolean
} {
  // `loaded` collapses to `false` while a training run holds the
  // single loaded model — the chat and the Model Selector both
  // gate on this and disable themselves accordingly.
  const loaded = currentModelId !== null && !isTrainingActive
  return {
    active: {
      id: currentEntry?.id ?? null,
      name: currentEntry?.name ?? '',
      source: currentEntry?.source ?? '',
      sourceKind: currentEntry?.sourceKind ?? null,
      loaded,
      requestId: currentRequestId,
      loadedAt: currentLoadedAt,
    },
    lastSelectedId: modelStore.getLastSelected()?.id ?? null,
    available: modelStore.getAll(),
    activeLora: {
      id: currentLoraId,
      name: currentLoraName,
      path: pendingLoraPath,
    },
    trainingActive: isTrainingActive,
  }
}
