import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { profileStore } from './profileStore'
import { registerSessionsIpcHandlers, initSessions } from './sessions'

import { toolsStore, settingsStore, getToolsSystemPrompt } from './toolsStore'

// ============================================
// QVAC AI Model Management (QVAC-native flow)
// ============================================
import { completion, type ToolCall } from '@qvac/sdk'
import { saveMessages, loadMessages, ensureMainSession } from './sessions'
import {
  ensureQvacConfig,
  setMainWindow,
  ensureModel,
  cancelCurrentRequest,
  unloadCurrent,
  getActiveModelId,
  buildStatus,
} from './qvac'
import { modelStore, type ModelEntry, type ModelSourceKind } from './modelStore'

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
}

let mainWindowRef: BrowserWindow | null = null

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
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
app.whenReady().then(async () => {
  electronApp.setAppUserModelId('com.medpsy.doctor')

  // Bootstrap the QVAC config (sets QVAC_CONFIG_PATH) BEFORE any SDK call.
  ensureQvacConfig()

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  ipcMain.on('ping', () => console.log('pong'))

  // Tools IPC handlers
  ipcMain.handle('tools:getAll', () => {
    return toolsStore.getTools()
  })

  ipcMain.handle('tools:setEnabled', (_, toolId: string, enabled: boolean) => {
    return toolsStore.setToolEnabled(toolId, enabled)
  })

  // Settings IPC handlers
  ipcMain.handle('settings:get', () => {
    return settingsStore.getSettings()
  })

  ipcMain.handle('settings:setCtxSize', (_, ctx_size: number) => {
    settingsStore.setCtxSize(ctx_size)
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
      return { success: true, status: buildStatus() }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to reload model'
      return { success: false, error: message }
    }
  })

  // Execute tool by name
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async function executeToolCall(toolName: string, _args: Record<string, unknown>): Promise<string> {
    // if (toolName === 'get_documents') {
    //   return getDocumentsTool.execute()
    // } else if (toolName === 'search_documents') {
    //   return searchDocumentsTool.execute(args)
    // }
    return JSON.stringify({ error: `Unknown tool: ${toolName}` })
  }

  // AI Chat with streaming and tool calls
  ipcMain.handle('ai:sendMessage', async (_event, profileSlug: string, sessionSlug: string, message: string, history: any[], profile?: { name: string; type: string; age?: number; gender?: string }) => {
    const modelId = getActiveModelId()
    if (!modelId || !mainWindowRef) {
      return { success: false, error: 'AI model not loaded' }
    }

    try {
      ensureMainSession(profileSlug)

      // Set profile for documents store so tools can access user documents
      // documentsStore.setProfile(profileSlug)

      // Get system prompt based on enabled tools and profile context
      const toolsPrompt = getToolsSystemPrompt(profile)

      // Build conversation history
      const conversationHistory = [
        ...history.map((h: any) => ({ role: h.role, content: h.content })),
        { role: 'user', content: toolsPrompt + '\n\n' + message }
      ]

      // Get enabled tools based on Documents tool being enabled
      // const enabledTools = toolsStore.getEnabledTools()
      // const hasDocumentsTool = enabledTools.some(t => t.id === '1')
      // const tools = hasDocumentsTool ? [getDocumentsTool, searchDocumentsTool] : []

      let fullResponse = ''
      let thinkingContent = ''
      const maxToolCalls = 3 // Prevent infinite loops
      let toolCallCount = 0

      while (toolCallCount < maxToolCalls) {
        const result = completion({
          modelId: modelId,
          history: conversationHistory,
          stream: true,
          kvCache: true,
          captureThinking: true,
          tools: []
          // tools: tools.length > 0 ? tools : undefined,
        })

        // Stream tokens and thinking
        for await (const event of result.events) {
          switch (event.type) {
            case 'contentDelta':
              fullResponse += event.text
              mainWindowRef!.webContents.send('ai:streamToken', event.text)
              break
            case 'thinkingDelta':
              thinkingContent += event.text
              mainWindowRef!.webContents.send('ai:streamThinking', event.text)
              break
            case 'toolCall':
              console.log(`[AI] Tool call: ${event.call.name}(${JSON.stringify(event.call.arguments)})`)
              break
          }
        }

        // Get tool calls after streaming
        const toolCalls: ToolCall[] = await result.toolCalls

        if (toolCalls.length === 0) {
          // No more tool calls, we're done
          break
        }

        toolCallCount++
        console.log(`[AI] Executing ${toolCalls.length} tool call(s)...`)

        // Execute tool calls and add results to history
        for (const call of toolCalls) {
          const toolResult = await executeToolCall(call.name, call.arguments as Record<string, unknown>)
          console.log(`[AI] Tool ${call.name} result:`, toolResult.substring(0, 100))
          conversationHistory.push({
            role: 'tool',
            content: toolResult,
          })
        }

        // Add a continuation prompt
        conversationHistory.push({
          role: 'user',
          content: 'Based on the tool results above, please continue your response.',
        })

        console.log(`[AI] Tool call ${toolCallCount} completed, continuing...`)
      }

      // Send completion signal
      mainWindowRef.webContents.send('ai:streamDone', '')

      // Save messages
      const messages = loadMessages(profileSlug, sessionSlug)
      messages.push(
        { id: Date.now().toString(), role: 'user', content: message, timestamp: new Date().toISOString() },
        { id: (Date.now() + 1).toString(), role: 'assistant', content: fullResponse, timestamp: new Date().toISOString(), thinking: thinkingContent }
      )
      saveMessages(profileSlug, sessionSlug, messages)

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
