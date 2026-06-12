import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { profileStore } from './profileStore'
import { registerSessionsIpcHandlers, initSessions } from './sessions'
import {
  initSimulations,
  registerSimulationsIpcHandlers,
  setSimulationsMainWindowGetter,
} from './simulations'
import { startSimulationWorker, stopSimulationWorker } from './simulationWorker'
import { registerScenarioGeneratorHandlers } from './scenarioGenerator'
import * as p2p from './p2p'

import { settingsStore, getSystemPrompt } from './toolsStore'

// ============================================
// Datasets / Training runs / LoRAs
// ============================================
import {
  createDataset,
  deleteDataset,
  getDataset,
  listDatasets,
  updateDataset,
  type DatasetEntry,
} from './datasetStore'
import {
  deleteTraining,
  getTraining,
  listTrainings,
  type TrainingRun,
} from './trainingStore'
import {
  deleteLora,
  getLora,
  importLoraFromPath,
  listLoras,
} from './loraStore'
import {
  cancelTraining,
  pauseTraining,
  resumeTraining,
  startTraining,
} from './finetune'

// ============================================
// QVAC AI Model Management (QVAC-native flow)
// ============================================
import { completion, type ToolCall } from '@qvac/sdk'
import { saveMessages, loadMessages, ensureMainSession } from './sessions'
import { withLock } from './completionLock'
import {
  ensureQvacConfig,
  setMainWindow,
  ensureModel,
  cancelCurrentRequest,
  unloadCurrent,
  getActiveModelId,
  getActiveEntry,
  setPendingLoraPath,
  getCurrentLoraId,
  buildStatus,
  resetCache,
} from './qvac'
import { modelStore, type ModelEntry, type ModelSourceKind } from './modelStore'
import {
  ensureTranslationModelLoaded,
  getSupportedLanguages,
  getTranslationStatus,
  unloadTranslationModel,
  type SupportedTargetLang,
  type TranslationStatus,
} from './translation'

interface ModelsStatus {
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
  available: ModelEntry[]
  activeLora: { id: string | null; name: string | null; path: string | null }
  trainingActive: boolean
  outcomeModel: {
    loaded: boolean
    id: string | null
    name: string
    source: string
    sourceKind: ModelSourceKind | null
    loadedAt: number | null
    delegatedTo: { publicKey: string } | null
  }
}

let mainWindowRef: BrowserWindow | null = null

// ────────────────────────────── runCompletion ────────────────────────────

/**
 * Execute a single AI completion against the active model and persist the
 * resulting user + assistant messages into the session's messages.json.
 *
 * Optional callbacks let callers stream tokens to the renderer (chat UI)
 * or stay silent (the simulation worker, which only cares about the
 * final reply). On any internal error the function throws and the caller
 * is responsible for surfacing it.
 */
export interface CompletionOptions {
  /** Fired for each streamed content token. */
  onToken?: (token: string) => void
  /** Fired for each streamed thinking token. */
  onThinking?: (token: string) => void
  /** Fired after the final response has been persisted. */
  onDone?: (info: { content: string; thinking: string }) => void
}

export interface CompletionArgs {
  profileSlug: string
  sessionSlug: string
  userMessage: string
  history: { role: string; content: string }[]
  /**
   * When provided, sent as a real `{ role: 'system' }` message at the
   * top of the conversation. If omitted, defaults to the profile
   * context prompt (`getSystemPrompt(args.profile)`) for backward
   * compatibility with chat callers that don't pass one.
   */
  systemPrompt?: string
  profile?: { name: string; type: string; age?: number; gender?: string }
}

export async function runCompletion(
  args: CompletionArgs,
  options: CompletionOptions = {},
  lockKind: 'chat' | 'worker' = 'chat',
  modelIdOverride?: string
): Promise<{ content: string; thinking: string }> {
  // When the caller passes a `modelIdOverride` (e.g. the simulation
  // worker, which may be using a delegated model id from P2P) use
  // that id directly. Otherwise fall back to the chat slot's
  // `currentModelId`. The chat IPC handler does NOT pass an
  // override, so its behaviour is unchanged.
  const modelId = modelIdOverride ?? getActiveModelId()
  if (!modelId) throw new Error('AI model not loaded')

  // Real system role. `args.systemPrompt` wins if the caller passed
  // one (e.g. the simulation worker passes its analysis prompt);
  // otherwise fall back to the profile-context prompt so chat callers
  // that don't supply one keep their existing behaviour.
  const systemPrompt = args.systemPrompt ?? getSystemPrompt(args.profile)
  const conversationHistory: { role: string; content: string }[] = [
    ...args.history.map((h) => ({ role: h.role, content: h.content })),
  ]
  if (systemPrompt) {
    conversationHistory.unshift({ role: 'system', content: systemPrompt })
  }
  conversationHistory.push({ role: 'user', content: args.userMessage })

  let fullResponse = ''
  let thinkingContent = ''
  const maxToolCalls = 3
  let toolCallCount = 0

  // Hard ceiling per completion iteration. If the SDK stalls (no events,
  // no completionDone) this rejects so the caller's catch can mark the
  // outcome errored and the worker can move on.
  const COMPLETION_TIMEOUT_MS = 10 * 60 * 1000

  while (toolCallCount < maxToolCalls) {
    // withLock serialises against the other caller of runCompletion (the
    // chat IPC handler vs the simulation worker). The worker also
    // short-circuits with shouldDefer() at the top of its tick so it
    // never queues behind chat — it just retries next tick.
    const { content, thinking, toolCalls, stopReason } = await withLock(
      lockKind,
      async () => {

        const result = completion({
          modelId,
          history: conversationHistory,
          stream: true,
          kvCache: true,
          captureThinking: true,
          tools: [],
        })

        let iterContent = ''
        let iterThinking = ''
        let iterStopReason: string | null = null

        const consume = (async () => {
          let eventCount = 0
          console.log(`[AI] Starting to iterate events for requestId=${result.requestId}`)
          try {
            for await (const event of result.events) {
              eventCount++
              // Per-event diagnostic — cheap, single-line. If the bug
              // recurs we'll see exactly which events (if any) arrived.
              console.log(`[AI] event[${eventCount}]: ${event.type}`, JSON.stringify(event).slice(0, 200))
              switch (event.type) {
              case 'contentDelta':
                iterContent += event.text
                console.log("content:", event.text)
                options.onToken?.(event.text)
                break
              case 'thinkingDelta':
                iterThinking += event.text
                console.log("thinking:", event.text)
                options.onThinking?.(event.text)
                break
              case 'toolCall':
                console.log(
                  `[AI] Tool call: ${event.call.name}(${JSON.stringify(event.call.arguments)})`
                )
                break
              case 'completionDone':
                // The SDK's only stream-terminator event. Break the
                // loop on it instead of relying on iterator termination,
                // which can hang indefinitely if the SDK never delivers.
                iterStopReason =
                  (event as { stopReason?: string }).stopReason ?? 'unknown'
                console.log(`[AI] completionDone stopReason=${iterStopReason}`)
                return
              }
            }
          } catch (err) {
            console.log(`[AI] Error consuming events:`, err)
          }
        })()

        const timeout = new Promise<never>((_, reject) => {
          setTimeout(
            () =>
              reject(
                new Error(
                  `[AI] completion timeout after ${COMPLETION_TIMEOUT_MS}ms`
                )
              ),
            COMPLETION_TIMEOUT_MS
          )
        })

        await Promise.race([consume, timeout])
        const iterToolCalls: ToolCall[] = await result.toolCalls
        return {
          content: iterContent,
          thinking: iterThinking,
          toolCalls: iterToolCalls,
          stopReason: iterStopReason,
        }
      }
    )

    fullResponse += content
    thinkingContent += thinking
    if (stopReason === 'error' || stopReason === 'cancelled') {
      // Surface SDK-level errors as a thrown error so the worker's catch
      // (or the chat IPC's catch) records a real error message.
      throw new Error(`[AI] completion ended with stopReason=${stopReason}`)
    }

    if (toolCalls.length === 0) break

    toolCallCount++
    for (const call of toolCalls) {
      const toolResult = await executeToolCall(
        call.name,
        call.arguments as Record<string, unknown>
      )
      conversationHistory.push({ role: 'tool', content: toolResult })
    }
    conversationHistory.push({
      role: 'user',
      content: 'Based on the tool results above, please continue your response.',
    })
  }

  // Persist user + assistant messages into the session.
  const messages = loadMessages(args.profileSlug, args.sessionSlug)
  messages.push(
    {
      id: Date.now().toString(),
      role: 'user',
      content: args.userMessage,
      timestamp: new Date().toISOString(),
    },
    {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: fullResponse,
      timestamp: new Date().toISOString(),
      thinking: thinkingContent,
    }
  )
  saveMessages(args.profileSlug, args.sessionSlug, messages)

  const result = { content: fullResponse, thinking: thinkingContent }
  options.onDone?.(result)
  return result
}

// Top-level tool executor. Currently a no-op (no tools wired in); exists
// so runCompletion can be called from any module.
async function executeToolCall(
  toolName: string,
  _args: Record<string, unknown>
): Promise<string> {
  return JSON.stringify({ error: `Unknown tool: ${toolName}` })
}

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

   mainWindow.setMenuBarVisibility(false)

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  mainWindowRef = mainWindow
  setMainWindow(mainWindow)
  p2p.setMainWindow(mainWindow)
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
app.whenReady().then(async () => {
  electronApp.setAppUserModelId('com.medpsy.doctor')

  // Set QVAC_HYPERSWARM_SEED from the persisted provider seed BEFORE
  // any SDK call touches the swarm. The swarm is a process singleton —
  // once it's constructed without a seed, setting the env var later
  // has no effect. No-op if no provider seed has been generated yet.
  p2p.ensureHyperswarmSeed()

  // Bootstrap the QVAC config (sets QVAC_CONFIG_PATH) BEFORE any SDK call.
  ensureQvacConfig()

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  ipcMain.on('ping', () => console.log('pong'))

  // Settings IPC handlers
  ipcMain.handle('settings:get', () => {
    return settingsStore.getSettings()
  })

  ipcMain.handle('settings:setCtxSize', (_, ctx_size: number) => {
    settingsStore.setCtxSize(ctx_size)
    return { success: true }
  })

  ipcMain.handle('settings:setWorkerEnabled', (_, enabled: boolean) => {
    settingsStore.setWorkerEnabled(enabled)
    if (enabled) startSimulationWorker()
    else stopSimulationWorker()
    return { success: true }
  })

  ipcMain.handle('settings:setMaxCards', (_, maxCards: number) => {
    settingsStore.setMaxCards(maxCards)
    return { success: true }
  })

  // Profile IPC handlers
  ipcMain.handle('profiles:getAll', () => {
    return profileStore.getAll()
  })

  ipcMain.handle('profiles:add', (_, profile) => {
    return profileStore.add(profile)
  })

  ipcMain.handle('profiles:remove', (_, id) => {
    return profileStore.remove(id)
  })

  // ─── Model registry (QVAC-backed) ──────────────────────────────────────
  ipcMain.handle('models:list', () => {
    return modelStore.getAll()
  })

  ipcMain.handle(
    'models:add',
    (
      _,
      entry: { name: string; source: string; description?: string; quantization?: string; params?: string },
    ) => {
      if (!entry?.name?.trim() || !entry?.source?.trim()) {
        throw new Error('Both name and source are required')
      }
      const trimmed = entry.source.trim()
      return modelStore.add({
        name: entry.name.trim(),
        source: trimmed,
        description: entry.description?.trim(),
        quantization: entry.quantization?.trim(),
        params: entry.params?.trim(),
      })
    },
  )

  ipcMain.handle('models:remove', (_, id: string) => {
    return modelStore.remove(id)
  })

  ipcMain.handle('models:status', (): ModelsStatus => {
    return buildStatus() as ModelsStatus
  })

  ipcMain.handle('models:pickFile', async () => {
    const win = mainWindowRef ?? BrowserWindow.getFocusedWindow()
    if (!win) return null
    const result = await dialog.showOpenDialog(win, {
      title: 'Select a GGUF model file',
      properties: ['openFile'],
      filters: [
        { name: 'GGUF Models', extensions: ['gguf'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    })
    if (result.canceled || result.filePaths.length === 0) return null
    const picked = result.filePaths[0]
    if (!picked.toLowerCase().endsWith('.gguf')) {
      throw new Error('Selected file is not a .gguf model')
    }
    return picked
  })

  ipcMain.handle('models:select', async (_, id: string) => {
    const entry = modelStore.getById(id)
    if (!entry) {
      return { success: false, error: 'Unknown model id' }
    }

    try {
      // Cancel any in-flight request and unload the currently-loaded model.
      await cancelCurrentRequest()
      const prevId = getActiveModelId()
      if (prevId) {
        await unloadCurrent(prevId)
      }
      // Mark this entry as the user's most recent choice.
      modelStore.setLastSelected(entry.id)
      // Drive the download + load.
      await ensureModel(entry)
      // If the P2P consumer is connected, re-bind the outcomes slot to
      // the new chat base entry. Done in the background so the chat
      // model switch itself isn't blocked.
      void p2p.onChatBaseModelChanged()
      return { success: true }
    } catch (err) {
      const mapped = (err && typeof err === 'object' && 'code' in err)
        ? (err as { code: string; message: string; retryable: boolean })
        : { code: 'UNKNOWN', message: String(err), retryable: true }
      // Surface the error to the renderer via the push channel too.
      mainWindowRef?.webContents.send('models:error', mapped)
      return { success: false, error: mapped.message }
    }
  })

  ipcMain.handle('models:cancel', async (_, opts?: { clearCache?: boolean }) => {
    await cancelCurrentRequest({ clearCache: opts?.clearCache })
    return { success: true }
  })

  ipcMain.handle('models:resetCache', async (_, id: string) => {
    const entry = modelStore.getById(id)
    if (!entry) {
      return { success: false, deleted: [], error: 'Unknown model id' }
    }
    return resetCache(entry)
  })

  // Bind (or unbind) a LoRA adapter to the loaded model. Setting loraId
  // to null re-loads the base model with no adapter.
  ipcMain.handle('models:selectLora', async (_, loraId: string | null) => {
    try {
      if (loraId === null) {
        setPendingLoraPath(null, null, null)
      } else {
        const lora = getLora(loraId)
        if (!lora) return { success: false, error: 'LoRA not found' }
        setPendingLoraPath(lora.loraPath, lora.id, lora.name)
      }
      // Re-load the active base model (or fall back to the user's
      // last-selected entry if nothing is currently loaded) so the
      // pending lora path is threaded into modelConfig.lora.
      const target = getActiveEntry() ?? modelStore.getLastSelected()
      if (!target) return { success: false, error: 'No base model selected' }
      await cancelCurrentRequest()
      const prevId = getActiveModelId()
      if (prevId) await unloadCurrent(prevId)
      modelStore.setLastSelected(target.id)
      await ensureModel(target)
      return { success: true }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return { success: false, error: message }
    }
  })

  // ─── Datasets ──────────────────────────────────────────────────────────
  ipcMain.handle('datasets:list', () => {
    return listDatasets()
  })

  ipcMain.handle('datasets:get', (_, id: string) => {
    return getDataset(id)
  })

  ipcMain.handle(
    'datasets:create',
    (
      _,
      entry: {
        name: string
        sources: { simulationIds: string[]; customData: DatasetEntry['sources']['customData'] }
        profileSlug: string
      },
    ) => {
      return createDataset(entry)
    },
  )

  ipcMain.handle(
    'datasets:update',
    (
      _,
      id: string,
      patch: {
        name?: string
        sources?: { simulationIds: string[]; customData: DatasetEntry['sources']['customData'] }
      },
      profileSlug: string,
    ) => {
      return updateDataset(id, patch, profileSlug)
    },
  )

  ipcMain.handle('datasets:delete', (_, id: string) => {
    return deleteDataset(id)
  })

  ipcMain.handle('datasets:importJsonl', async () => {
    const win = mainWindowRef ?? BrowserWindow.getFocusedWindow()
    if (!win) return null
    const r = await dialog.showOpenDialog(win, {
      title: 'Select a JSONL file',
      properties: ['openFile'],
      filters: [
        { name: 'JSONL', extensions: ['jsonl', 'json'] },
        { name: 'All files', extensions: ['*'] },
      ],
    })
    if (r.canceled || r.filePaths.length === 0) return null
    return r.filePaths[0]
  })

  // ─── Training runs ─────────────────────────────────────────────────────
  ipcMain.handle('trainings:list', () => {
    return listTrainings()
  })

  ipcMain.handle('trainings:get', (_, id: string) => {
    return getTraining(id)
  })

  ipcMain.handle(
    'trainings:start',
    (
      _,
      payload: {
        name: string
        datasetId: string
        baseModelId: string
        options: TrainingRun['options']
      },
    ) => {
      return startTraining(payload)
    },
  )

  ipcMain.handle('trainings:pause', (_, id: string) => {
    return { success: pauseTraining(id) }
  })

  ipcMain.handle('trainings:resume', (_, id: string) => {
    return { success: resumeTraining(id) }
  })

  ipcMain.handle('trainings:cancel', (_, id: string) => {
    return { success: cancelTraining(id) }
  })

  ipcMain.handle('trainings:delete', (_, id: string) => {
    return { success: deleteTraining(id) }
  })

  // ─── LoRA adapters ─────────────────────────────────────────────────────
  ipcMain.handle('loras:list', () => {
    return listLoras()
  })

  ipcMain.handle('loras:get', (_, id: string) => {
    return getLora(id)
  })

  ipcMain.handle('loras:delete', async (_, id: string) => {
    // Protect the LoRA currently bound to the loaded model — the user
    // must switch back to the base model (or another LoRA) via the
    // chat input LoRA picker first.
    if (getCurrentLoraId() === id) {
      return {
        success: false,
        error: 'This LoRA is currently active. Set the chat input LoRA picker to "None" (or to another LoRA) to free it up.',
      }
    }
    return deleteLora(id)
  })

  ipcMain.handle('loras:import', async () => {
    const win = mainWindowRef ?? BrowserWindow.getFocusedWindow()
    if (!win) return null
    const r = await dialog.showOpenDialog(win, {
      title: 'Import LoRA adapter (.gguf)',
      properties: ['openFile'],
      filters: [
        { name: 'GGUF', extensions: ['gguf'] },
        { name: 'All files', extensions: ['*'] },
      ],
    })
    if (r.canceled || r.filePaths.length === 0) return null
    const picked = r.filePaths[0]
    if (!picked.toLowerCase().endsWith('.gguf')) {
      throw new Error('Selected file is not a .gguf adapter')
    }
    // Bind to the currently-active base model; the user can re-pick
    // another base model later via the Model Selector.
    const base = getActiveEntry() ?? modelStore.getLastSelected()
    if (!base) {
      throw new Error('No base model selected — load a base model before importing a LoRA')
    }
    return importLoraFromPath(picked, base.id)
  })

  // ─── Translation (Bergamot on-device) ───────────────────────────────
  // PDF report translation. The translation model is opt-in per export
  // — we do not load a Bergamot model on boot. The renderer calls
  // `translation:load(lang)` the first time the user picks a target
  // language, then `simulations.exportReport(..., 'pdf', translateTo)`.

  ipcMain.handle('translation:supportedLanguages', () => {
    return getSupportedLanguages()
  })

  ipcMain.handle('translation:status', (): TranslationStatus => {
    return getTranslationStatus()
  })

  ipcMain.handle(
    'translation:load',
    async (_e, lang: SupportedTargetLang) => {
      return ensureTranslationModelLoaded(lang)
    }
  )

  ipcMain.handle('translation:unload', async () => {
    return unloadTranslationModel()
  })

  // ─── P2P resource sharing ────────────────────────────────────────────
  // Provider: shares this machine's GPU with a remote peer over a
  // Hyperswarm DHT. Consumer: delegates simulation outcome
  // completions to a remote provider. Chat / scenarios are unaffected.

  ipcMain.handle('p2p:status', () => {
    return p2p.getStatus()
  })

  ipcMain.handle('p2p:providerStart', async () => {
    return await p2p.startProvider()
  })

  ipcMain.handle('p2p:providerStop', async () => {
    return await p2p.stopProvider()
  })

  ipcMain.handle('p2p:providerSetEnabled', (_, enabled: boolean) => {
    settingsStore.setP2pProviderEnabled(enabled)
    if (enabled) void p2p.startProvider()
    else void p2p.stopProvider()
    return { success: true }
  })

  ipcMain.handle('p2p:consumerSetEnabled', async (_, enabled: boolean) => {
    settingsStore.setP2pConsumerEnabled(enabled)
    if (enabled) {
      const activeId = settingsStore.getP2pActiveConsumerPeerId()
      const peer = activeId
        ? settingsStore.getP2pConsumerPeers().find((p) => p.id === activeId)
        : null
      if (peer) {
        return await p2p.connectToPeer(peer)
      }
      // No active peer — outcomes will be paused until the user
      // connects one. Status still flips to enabled.
      p2p.broadcastStatus()
      return { success: true }
    }
    return await p2p.disconnectFromPeer()
  })

  ipcMain.handle('p2p:peersList', () => {
    return { peers: p2p.getPeers() }
  })

  ipcMain.handle('p2p:peersAdd', (_, input: { name: string; publicKey: string }) => {
    return p2p.addPeer(input)
  })

  ipcMain.handle('p2p:peersRemove', async (_, id: string) => {
    return await p2p.removePeer(id)
  })

  ipcMain.handle('p2p:peersConnect', async (_, id: string) => {
    const peer = settingsStore.getP2pConsumerPeers().find((p) => p.id === id)
    if (!peer) return { success: false, error: 'Unknown peer id' }
    return await p2p.connectToPeer(peer)
  })

  ipcMain.handle('p2p:peersDisconnect', async () => {
    return await p2p.disconnectFromPeer()
  })

  // ─── AI: legacy shims (back-compat for Chat/Settings/Dashboard) ───────
  // Status is now backed by the new buildStatus() snapshot.
  ipcMain.handle('ai:getStatus', () => {
    const status = buildStatus()
    const modelName = status.active.name || (status.active.loaded ? 'Model' : 'Loading')
    return {
      isReady: status.active.loaded,
      modelName,
      uptime: status.active.loadedAt
        ? Math.floor((Date.now() - status.active.loadedAt) / 1000)
        : 0,
      downloading: status.active.requestId !== null,
      downloadProgress: 0, // legacy field; the new `models:progress` channel carries real numbers
      loraName: status.activeLora?.name ?? null,
    }
  })

  // ai:load → trigger a load of the currently-selected model (if any).
  ipcMain.handle('ai:load', async () => {
    const last = modelStore.getLastSelected() ?? modelStore.getAll()[0]
    if (!last) {
      return { success: false, error: 'No models in registry' }
    }
    try {
      await cancelCurrentRequest()
      const prevId = getActiveModelId()
      if (prevId) await unloadCurrent(prevId)
      modelStore.setLastSelected(last.id)
      await ensureModel(last)
      void p2p.onChatBaseModelChanged()
      return { success: true, status: buildStatus() }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load model'
      return { success: false, error: message }
    }
  })

  // ai:unload → unload current model.
  ipcMain.handle('ai:unload', async () => {
    const id = getActiveModelId()
    if (!id) return { success: true }
    try {
      await unloadCurrent(id)
      return { success: true }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to unload model'
      return { success: false, error: message }
    }
  })

  // ai:reload → unload then re-load currently-selected model.
  ipcMain.handle('ai:reload', async () => {
    const last = modelStore.getLastSelected() ?? modelStore.getAll()[0]
    if (!last) return { success: false, error: 'No models in registry' }
    try {
      await cancelCurrentRequest()
      const prevId = getActiveModelId()
      if (prevId) await unloadCurrent(prevId)
      await ensureModel(last)
      void p2p.onChatBaseModelChanged()
      return { success: true, status: buildStatus() }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to reload model'
      return { success: false, error: message }
    }
  })

  // AI Chat with streaming and tool calls. Delegates to runCompletion
  // (exported above) so the simulation worker can call the same
  // completion code path without going through IPC.
  ipcMain.handle('ai:sendMessage', async (_event, profileSlug: string, sessionSlug: string, message: string, history: any[], profile?: { name: string; type: string; age?: number; gender?: string }) => {
    if (!mainWindowRef) {
      return { success: false, error: 'AI model not loaded' }
    }
    try {
      ensureMainSession(profileSlug)
      await runCompletion(
        { profileSlug, sessionSlug, userMessage: message, history, profile },
        {
          onToken: (token) => mainWindowRef!.webContents.send('ai:streamToken', token),
          onThinking: (token) =>
            mainWindowRef!.webContents.send('ai:streamThinking', token),
          onDone: () => mainWindowRef!.webContents.send('ai:streamDone', ''),
        }
      )
      return { success: true }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      mainWindowRef?.webContents.send('ai:error', errorMsg)
      return { success: false, error: errorMsg }
    }
  })

  // Initialize sessions for existing profiles
  initSessions()

  // Register sessions IPC handlers
  registerSessionsIpcHandlers()

  // Register scenario generator IPC handler
  registerScenarioGeneratorHandlers()

  // Initialize simulations store and IPC
  initSimulations()
  registerSimulationsIpcHandlers()
  setSimulationsMainWindowGetter(() => mainWindowRef)

  // Start the background worker that drains queued outcomes (only if the
  // user has the worker enabled in settings; the IPC handler above
  // starts/stops it on toggle).
  if (settingsStore.getWorkerEnabled()) startSimulationWorker()

  // Start the P2P provider if the user has it enabled in settings.
  // Fire-and-forget — the provider's status surfaces on `p2p:status`.
  if (settingsStore.getP2pProviderEnabled()) {
    void p2p.startProvider()
  }

  // Register documents IPC handlers
  // registerDocumentsHandlers()
  // registerDocumentsOcrHandler()

  // No silent background auto-load — the renderer drives loading via the
  // `model` boot step (see App.tsx). The user always picks a model first.

  createWindow()

  console.log('[App] MedLifeSim ready')

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', async () => {
  // If a download is mid-flight, cancel it with clearCache so the
  // partial file is unlinked at the SDK level. This addresses the
  // Windows file-handle-leak angle that the QVAC SDK does not handle
  // for non-cancel errors (see node_modules/@qvac/sdk/.../http.js:377-400).
  try {
    await cancelCurrentRequest({ clearCache: true })
  } catch (e) {
    console.warn('[qvac] before-quit cancel failed:', e)
  }

  const modelId = getActiveModelId()
  if (modelId) {
    try {
      await unloadCurrent(modelId)
      console.log('[AI] Model unloaded on exit')
    } catch (error) {
      console.error('Failed to unload model:', error)
    }
  }
})
