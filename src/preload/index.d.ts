import { ElectronAPI } from '@electron-toolkit/preload'

export type ProfileType = 'self' | 'family' | 'doctor' | 'community'

export interface Profile {
  id: string
  name: string
  type: ProfileType
  age?: number
  gender?: 'male' | 'female'
  createdAt: string
}

export interface Session {
  slug: string
  name: string
  createdAt: string
  messageCount: number
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
  thinking?: string
}

export interface AIStatus {
  isReady: boolean
  modelName: string
  uptime: number
  downloading: boolean
  downloadProgress: number
  error?: string
}

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

export interface ModelLoadProgress {
  phase: 'downloading' | 'loading'
  downloaded: number
  total: number
  percentage: number
  requestId?: string
}

export interface ModelErrorPayload {
  code: string
  message: string
  retryable: boolean
}

export interface ModelStatus {
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

export interface ModelsAPI {
  list: () => Promise<ModelEntry[]>
  add: (entry: { name: string; source: string; description?: string; quantization?: string; params?: string }) => Promise<ModelEntry>
  remove: (id: string) => Promise<boolean>
  select: (id: string) => Promise<{ success: boolean; error?: string }>
  cancel: (opts?: { clearCache?: boolean }) => Promise<{ success: boolean }>
  status: () => Promise<ModelStatus>
  pickFile: () => Promise<string | null>
  onProgress: (callback: (p: ModelLoadProgress) => void) => () => void
  onError: (callback: (e: ModelErrorPayload) => void) => () => void
}

export interface Tool {
  id: string
  name: string
  description: string
  enabled: boolean
  status: 'available' | 'coming_soon'
}

export interface ProfileAPI {
  profiles: {
    getAll: () => Promise<Profile[]>
    add: (profile: { name: string; type: ProfileType; age?: number; gender?: 'male' | 'female' }) => Promise<Profile>
    remove: (id: string) => Promise<boolean>
  }
  models: ModelsAPI
  ai: {
    getStatus: () => Promise<AIStatus>
    load: () => Promise<{ success: boolean; status?: AIStatus; error?: string }>
    unload: () => Promise<{ success: boolean; error?: string }>
    reload: () => Promise<{ success: boolean; status?: AIStatus; error?: string }>
    sendMessage: (profileSlug: string, sessionSlug: string, message: string, history: ChatMessage[], profile?: { name: string; type: string; age?: number; gender?: string }) => Promise<{ success: boolean; error?: string }>
    onDownloadProgress: (callback: (progress: number) => void) => () => void
    onLoadProgress: (callback: (msg: string) => void) => () => void
    onStreamToken: (callback: (token: string) => void) => () => void
    onStreamThinking: (callback: (thinking: string) => void) => () => void
    onStreamDone: (callback: () => void) => () => void
    onError: (callback: (error: string) => void) => () => void
  }
  sessions: {
    list: (profileSlug: string) => Promise<Session[]>
    create: (profileSlug: string, sessionSlug: string) => Promise<{ path: string; messagesPath: string }>
    delete: (profileSlug: string, sessionSlug: string) => Promise<{ success: boolean }>
    clearMessages: (profileSlug: string, sessionSlug: string) => Promise<{ success: boolean }>
    loadMessages: (profileSlug: string, sessionSlug: string) => Promise<Message[]>
    saveMessages: (profileSlug: string, sessionSlug: string, messages: Message[]) => Promise<{ success: boolean }>
  }
  tools: {
    getAll: () => Promise<Tool[]>
    setEnabled: (toolId: string, enabled: boolean) => Promise<boolean>
  }
  settings: {
    get: () => Promise<{ ctx_size: number }>
    setCtxSize: (ctx_size: number) => Promise<{ success: boolean }>
  }
  documents: {
    list: () => Promise<any[]>
    get: (docId: string) => Promise<any>
    add: (doc: { type: 'text' | 'ocr' | 'note'; name: string; content: string; metadata?: Record<string, unknown> }) => Promise<any>
    update: (docId: string, updates: any) => Promise<{ success: boolean; document?: any }>
    delete: (docId: string) => Promise<{ success: boolean }>
    search: (query: string) => Promise<any[]>
    setProfile: (profileSlug: string) => Promise<{ success: boolean }>
    processOcr: (imagePath: string) => Promise<{ success: boolean; text?: string; error?: string }>
  }
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: ProfileAPI
  }
}