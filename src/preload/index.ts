import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Custom APIs for renderer
const api = {
  profiles: {
    getAll: () => ipcRenderer.invoke('profiles:getAll'),
    add: (profile: { name: string; type: string; age?: number; gender?: string }) => 
      ipcRenderer.invoke('profiles:add', profile),
    remove: (id: string) => ipcRenderer.invoke('profiles:remove', id),
  },
  
  ai: {
    getStatus: () => ipcRenderer.invoke('ai:getStatus'),
    load: () => ipcRenderer.invoke('ai:load'),
    unload: () => ipcRenderer.invoke('ai:unload'),
    
    // Chat streaming
    sendMessage: (profileSlug, sessionSlug, message, history) => 
      ipcRenderer.invoke('ai:sendMessage', profileSlug, sessionSlug, message, history),
    
    // Event listeners for progress
    onDownloadProgress: (callback: (progress: number) => void) => {
      const handler = (_: any, progress: number) => callback(progress)
      ipcRenderer.on('ai:downloadProgress', handler)
      return () => ipcRenderer.removeListener('ai:downloadProgress', handler)
    },
    
    onLoadProgress: (callback: (msg: string) => void) => {
      const handler = (_: any, msg: string) => callback(msg)
      ipcRenderer.on('ai:loadProgress', handler)
      return () => ipcRenderer.removeListener('ai:loadProgress', handler)
    },
    
    onStreamToken: (callback: (token: string) => void) => {
      const handler = (_: any, token: string) => callback(token)
      ipcRenderer.on('ai:streamToken', handler)
      return () => ipcRenderer.removeListener('ai:streamToken', handler)
    },
    
    onStreamThinking: (callback: (thinking: string) => void) => {
      const handler = (_: any, thinking: string) => callback(thinking)
      ipcRenderer.on('ai:streamThinking', handler)
      return () => ipcRenderer.removeListener('ai:streamThinking', handler)
    },
    
    onStreamDone: (callback: () => void) => {
      const handler = () => callback()
      ipcRenderer.on('ai:streamDone', handler)
      return () => ipcRenderer.removeListener('ai:streamDone', handler)
    },
    
    onError: (callback: (error: string) => void) => {
      const handler = (_: any, error: string) => callback(error)
      ipcRenderer.on('ai:error', handler)
      return () => ipcRenderer.removeListener('ai:error', handler)
    },
  },
  
  sessions: {
    list: (profileSlug) => ipcRenderer.invoke('sessions:list', profileSlug),
    create: (profileSlug, sessionSlug) => ipcRenderer.invoke('sessions:create', profileSlug, sessionSlug),
    delete: (profileSlug, sessionSlug) => ipcRenderer.invoke('sessions:delete', profileSlug, sessionSlug),
    clearMessages: (profileSlug, sessionSlug) => ipcRenderer.invoke('sessions:clearMessages', profileSlug, sessionSlug),
    loadMessages: (profileSlug, sessionSlug) => ipcRenderer.invoke('sessions:loadMessages', profileSlug, sessionSlug),
    saveMessages: (profileSlug, sessionSlug, messages) => 
      ipcRenderer.invoke('sessions:saveMessages', profileSlug, sessionSlug, messages),
  },
  
  documents: {
    list: () => ipcRenderer.invoke('documents:list'),
    get: (docId: string) => ipcRenderer.invoke('documents:get', docId),
    add: (doc: { type: 'text' | 'ocr' | 'note'; name: string; content: string; metadata?: Record<string, unknown> }) => 
      ipcRenderer.invoke('documents:add', doc),
    update: (docId: string, updates: any) => ipcRenderer.invoke('documents:update', docId, updates),
    delete: (docId: string) => ipcRenderer.invoke('documents:delete', docId),
    search: (query: string) => ipcRenderer.invoke('documents:search', query),
    setProfile: (profileSlug: string) => ipcRenderer.invoke('documents:setProfile', profileSlug),
    processOcr: (imagePath: string) => ipcRenderer.invoke('documents:processOcr', imagePath),
  },
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}