import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type { ChatMessage, ModelEntry, ModelLoadProgress, ModelErrorPayload, ModelStatus } from './index.d'

// Custom APIs for renderer
const api = {
  profiles: {
    getAll: () => ipcRenderer.invoke('profiles:getAll'),
    add: (profile: { name: string; type: string; age?: number; gender?: string }) =>
      ipcRenderer.invoke('profiles:add', profile),
    remove: (id: string) => ipcRenderer.invoke('profiles:remove', id),
  },

  models: {
    list: (): Promise<ModelEntry[]> => ipcRenderer.invoke('models:list'),
    add: (entry: { name: string; source: string; description?: string; quantization?: string; params?: string }): Promise<ModelEntry> =>
      ipcRenderer.invoke('models:add', entry),
    remove: (id: string): Promise<boolean> => ipcRenderer.invoke('models:remove', id),
    select: (id: string): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('models:select', id),
    cancel: (opts?: { clearCache?: boolean }): Promise<{ success: boolean }> =>
      ipcRenderer.invoke('models:cancel', opts),
    resetCache: (id: string): Promise<{ success: boolean; deleted: string[]; error?: string }> =>
      ipcRenderer.invoke('models:resetCache', id),
    status: (): Promise<ModelStatus> => ipcRenderer.invoke('models:status'),
    pickFile: (): Promise<string | null> => ipcRenderer.invoke('models:pickFile'),
    onProgress: (callback: (progress: ModelLoadProgress) => void) => {
      const handler = (_: unknown, progress: ModelLoadProgress) => callback(progress)
      ipcRenderer.on('models:progress', handler)
      return () => ipcRenderer.removeListener('models:progress', handler)
    },
    onError: (callback: (err: ModelErrorPayload) => void) => {
      const handler = (_: unknown, err: ModelErrorPayload) => callback(err)
      ipcRenderer.on('models:error', handler)
      return () => ipcRenderer.removeListener('models:error', handler)
    },
  },

  ai: {
    getStatus: () => ipcRenderer.invoke('ai:getStatus'),
    load: () => ipcRenderer.invoke('ai:load'),
    unload: () => ipcRenderer.invoke('ai:unload'),
    reload: () => ipcRenderer.invoke('ai:reload'),
    
    // Chat streaming
    sendMessage: (profileSlug: string, sessionSlug: string, message: string, history: ChatMessage[], profile?: { name: string; type: string; age?: number; gender?: string }) => 
      ipcRenderer.invoke('ai:sendMessage', profileSlug, sessionSlug, message, history, profile),
    
    // Scenario generation
    generateScenario: (profileSlug: string, payload: { prompt: string }) =>
      ipcRenderer.invoke('ai:generateScenario', profileSlug, payload),
    
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
    list: (profileSlug: string) => ipcRenderer.invoke('sessions:list', profileSlug),
    create: (profileSlug: string, sessionSlug: string) => ipcRenderer.invoke('sessions:create', profileSlug, sessionSlug),
    delete: (profileSlug: string, sessionSlug: string) => ipcRenderer.invoke('sessions:delete', profileSlug, sessionSlug),
    clearMessages: (profileSlug: string, sessionSlug: string) => ipcRenderer.invoke('sessions:clearMessages', profileSlug, sessionSlug),
    loadMessages: (profileSlug: string, sessionSlug: string) => ipcRenderer.invoke('sessions:loadMessages', profileSlug, sessionSlug),
    saveMessages: (profileSlug: string, sessionSlug: string, messages: ChatMessage[]) => 
      ipcRenderer.invoke('sessions:saveMessages', profileSlug, sessionSlug, messages),
  },
  
  tools: {
    getAll: () => ipcRenderer.invoke('tools:getAll'),
    setEnabled: (toolId: string, enabled: boolean) => ipcRenderer.invoke('tools:setEnabled', toolId, enabled),
  },
  
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    setCtxSize: (ctx_size: number) => ipcRenderer.invoke('settings:setCtxSize', ctx_size),
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

  simulations: {
    list: (profileSlug: string) => ipcRenderer.invoke('simulations:list', profileSlug),
    get: (profileSlug: string, simId: string) =>
      ipcRenderer.invoke('simulations:get', profileSlug, simId),
    create: (profileSlug: string, name: string, description: string, canvas: any) =>
      ipcRenderer.invoke('simulations:create', profileSlug, name, description, canvas),
    delete: (profileSlug: string, simId: string) =>
      ipcRenderer.invoke('simulations:delete', profileSlug, simId),
    requeue: (profileSlug: string, simId: string, outcomeId?: string) =>
      ipcRenderer.invoke('simulations:requeue', profileSlug, simId, outcomeId),
    getOutcome: (profileSlug: string, simId: string, outcomeId: string) =>
      ipcRenderer.invoke('simulations:getOutcome', profileSlug, simId, outcomeId),
    listOutcomes: (profileSlug: string, simId: string) =>
      ipcRenderer.invoke('simulations:listOutcomes', profileSlug, simId),
    getReport: (profileSlug: string, simId: string) =>
      ipcRenderer.invoke('simulations:getReport', profileSlug, simId),
    setModalOpen: (profileSlug: string, isOpen: boolean) =>
      ipcRenderer.invoke('simulations:setModalOpen', profileSlug, isOpen),
    onProgress: (callback: (event: any) => void) => {
      const handler = (_: unknown, e: any) => callback(e)
      ipcRenderer.on('simulations:progress', handler)
      return () => ipcRenderer.removeListener('simulations:progress', handler)
    },
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