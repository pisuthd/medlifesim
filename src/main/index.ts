import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { profileStore } from './profileStore'
import { registerSessionsIpcHandlers, initSessions } from './sessions'
 
import { toolsStore, settingsStore, getToolsSystemPrompt } from './toolsStore'

// ============================================
// QVAC AI Model Management
// ============================================
import { loadModel, unloadModel, completion, type ToolCall } from '@qvac/sdk'
import { saveMessages, loadMessages, ensureMainSession } from './sessions'

const MODEL_FILE = 'medpsy-1.7b-q4_k_m-imat.gguf'
const MODEL_URL = 'https://github.com/pisuthd/medpsy-doctor/releases/download/v.0.1.0/medpsy-1.7b-q4_k_m-imat.gguf'

interface AIStatus {
  isReady: boolean
  modelName: string
  uptime: number // seconds
  downloading: boolean
  downloadProgress: number // 0-100
  error?: string
}

let modelId: string | null = null
let modelStartTime: number | null = null
let mainWindowRef: BrowserWindow | null = null

// Download progress tracking
let downloadProgress = 0
let isDownloading = false

function getModelPath(): string {
  return join(app.getPath('userData'), MODEL_FILE)
}

async function checkModelExists(): Promise<boolean> {
  const fs = await import('fs')
  const modelPath = getModelPath()
  return fs.existsSync(modelPath)
}

async function downloadModel(): Promise<boolean> {
  return new Promise((resolve) => {
    const https = require('https')
    const fs = require('fs')
    const modelPath = getModelPath()
    
    isDownloading = true
    downloadProgress = 0
    
    // Ensure directory exists
    const dir = app.getPath('userData')
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    
    const file = fs.createWriteStream(modelPath)
    
    https.get(MODEL_URL, (response: any) => {
      // Handle redirects
      if (response.statusCode === 302 || response.statusCode === 301) {
        https.get(response.headers.location, (redirectResponse: any) => {
          const totalSize = parseInt(redirectResponse.headers['content-length'] || '0', 10)
          let downloaded = 0
          
          redirectResponse.on('data', (chunk: Buffer) => {
            downloaded += chunk.length
            file.write(chunk)
            downloadProgress = totalSize > 0 ? Math.round((downloaded / totalSize) * 100) : 0
            
            // Send progress to renderer
            if (mainWindowRef) {
              mainWindowRef.webContents.send('ai:downloadProgress', downloadProgress)
            }
          })
          
          redirectResponse.on('end', () => {
            file.end()
            isDownloading = false
            downloadProgress = 100
            resolve(true)
          })
        })
      } else {
        const totalSize = parseInt(response.headers['content-length'] || '0', 10)
        let downloaded = 0
        
        response.on('data', (chunk: Buffer) => {
          downloaded += chunk.length
          file.write(chunk)
          downloadProgress = totalSize > 0 ? Math.round((downloaded / totalSize) * 100) : 0
          
          if (mainWindowRef) {
            mainWindowRef.webContents.send('ai:downloadProgress', downloadProgress)
          }
        })
        
        response.on('end', () => {
          file.end()
          isDownloading = false
          downloadProgress = 100
          resolve(true)
        })
      }
    }).on('error', (err: Error) => {
      console.error('[Download] Error:', err)
      isDownloading = false
      resolve(false)
    })
  })
}

async function loadAIModel(): Promise<boolean> {
  // Don't reload if already loaded
  if (modelId !== null) {
    console.log('[AI] Model already loaded, skipping:', modelId)
    return true
  }
  
  try {
    const modelPath = getModelPath()
    console.log('[AI] Loading model from:', modelPath)
    
    modelId = await loadModel({
      modelSrc: modelPath,
      modelType: 'llamacpp-completion',
      modelConfig: {
        ctx_size: settingsStore.getCtxSize(),
        tools: false,
      },
      onProgress: (progress) => {
        const msg = typeof progress === 'string' ? progress : JSON.stringify(progress)
        console.log('[AI]', msg)
        
        if (mainWindowRef) {
          mainWindowRef.webContents.send('ai:loadProgress', msg)
        }
      }
    })
    
    modelStartTime = Date.now()
    console.log('[AI] Model loaded successfully:', modelId)
    return true
  } catch (error) {
    console.error('[AI] Failed to load model:', error)
    modelId = null
    return false
  }
}

function getAIStatus(): AIStatus {
  const uptime = modelStartTime ? Math.floor((Date.now() - modelStartTime) / 1000) : 0
  
  return {
    isReady: modelId !== null,
    modelName: modelId ? 'Medpsy-1.7B' : 'Loading',
    uptime,
    downloading: isDownloading,
    downloadProgress,
  }
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
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
app.whenReady().then(async () => {
  electronApp.setAppUserModelId('com.medpsy.doctor')

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

  // Model reload handler
  ipcMain.handle('ai:reload', async () => {
    try {
      console.log('[AI] Reloading model...')
      
      // Unload existing model if loaded
      if (modelId) {
        await unloadModel({ modelId })
        modelId = null
        modelStartTime = null
        console.log('[AI] Model unloaded')
      }
      
      // Reload with current settings
      const success = await loadAIModel()
      
      if (success) {
        return { success: true, status: getAIStatus() }
      } else {
        return { success: false, error: 'Failed to reload model' }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      console.error('[AI] Reload failed:', message)
      return { success: false, error: message }
    }
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

  // AI IPC handlers
  ipcMain.handle('ai:getStatus', () => {
    return getAIStatus()
  })

  ipcMain.handle('ai:load', async () => {
    try {
      // Don't reload if already loaded
      if (modelId !== null) {
        console.log('[AI] Model already loaded:', modelId)
        return { 
          success: true, 
          status: getAIStatus()
        }
      }
      
      // Check if model exists, if not download first
      const exists = await checkModelExists()
      
      if (!exists) {
        console.log('[AI] Model not found, downloading...')
        const downloaded = await downloadModel()
        
        if (!downloaded) {
          return { success: false, error: 'Failed to download model' }
        }
      }
      
      // Load the model in background
      await loadAIModel()
      
      return { 
        success: true, 
        status: getAIStatus()
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      return { success: false, error: message }
    }
  })

  ipcMain.handle('ai:unload', async () => {
    try {
      if (modelId) {
        await unloadModel({ modelId })
        modelId = null
        modelStartTime = null
      }
      return { success: true }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to unload model'
      return { success: false, error: message }
    }
  })

  // Execute tool by name
  async function executeToolCall(toolName: string, args: Record<string, unknown>): Promise<string> {
    // if (toolName === 'get_documents') {
    //   return getDocumentsTool.execute()
    // } else if (toolName === 'search_documents') {
    //   return searchDocumentsTool.execute(args)
    // }
    return JSON.stringify({ error: `Unknown tool: ${toolName}` })
  }

  // AI Chat with streaming and tool calls
  ipcMain.handle('ai:sendMessage', async (_event, profileSlug: string, sessionSlug: string, message: string, history: any[], profile?: { name: string; type: string; age?: number; gender?: string }) => {
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
  
  // Auto-load AI model on startup (with download if needed)
  console.log('[AI] Starting model load on startup...')
  ;(async () => {
    // Check if model exists, if not download first
    const exists = await checkModelExists()
    
    if (!exists) {
      console.log('[AI] Model not found, downloading...')
      const downloaded = await downloadModel()
      
      if (!downloaded) {
        console.log('[AI] Failed to download model')
        return
      }
    }
    
    // Now load the model
    const success = await loadAIModel()
    if (success) {
      console.log('[AI] Startup model load complete')
    } else {
      console.log('[AI] Startup model load failed')
      // Send error to renderer
      if (mainWindowRef) {
        mainWindowRef.webContents.send('ai:error', 'Failed to load AI model. Click Reload to try again.')
      }
    }
  })()
  
  createWindow()

  console.log('[App] MedPsy Doctor ready')

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
  if (modelId) {
    try {
      await unloadModel({ modelId })
      console.log('[AI] Model unloaded on exit')
    } catch (error) {
      console.error('Failed to unload model:', error)
    }
  }
})