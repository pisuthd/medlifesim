import { app, shell, BrowserWindow, ipcMain, Menu, MenuItemConstructorOptions } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { profileStore, Profile } from './profileStore'

// ============================================
// QVAC AI Model Management
// ============================================
import { loadModel, unloadModel } from '@qvac/sdk'

const MODEL_FILE = 'medpsy-1.7b-q4_k_m-imat.gguf'
const MODEL_URL = 'https://github.com/pisuthd/my-doctor-ai/releases/download/v.0.1.0/medpsy-1.7b-q4_k_m-imat.gguf'

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
  try {
    const modelPath = getModelPath()
    console.log('[AI] Loading model from:', modelPath)
    
    modelId = await loadModel({
      modelSrc: modelPath,
      modelType: 'llm',
      modelConfig: {
        ctx_size: 4096,
        tools: true,
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
    modelName: modelId ? 'Medpsy-1.7B' : 'Not loaded',
    uptime,
    downloading: isDownloading,
    downloadProgress,
  }
}

function createDefaultMenu(): void {
  const template: MenuItemConstructorOptions[] = [
    {
      label: 'File',
      submenu: [
        { role: 'quit' }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'close' }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'About My Doctor AI',
          click: async () => {
            const { shell } = await import('electron')
            await shell.openExternal('https://github.com/pisuthd/my-doctor-ai')
          }
        }
      ]
    }
  ]

  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)
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
  electronApp.setAppUserModelId('com.my-doctor-ai')

  createDefaultMenu()

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  ipcMain.on('ping', () => console.log('pong'))

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
      // Check if model exists, if not download first
      const exists = await checkModelExists()
      
      if (!exists) {
        console.log('[AI] Model not found, downloading...')
        const downloaded = await downloadModel()
        
        if (!downloaded) {
          return { success: false, error: 'Failed to download model' }
        }
      }
      
      // Load the model
      const loaded = await loadAIModel()
      
      return { 
        success: loaded, 
        status: getAIStatus(),
        error: loaded ? undefined : 'Failed to load model'
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

  createWindow()

  console.log('[App] My Doctor AI ready')

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