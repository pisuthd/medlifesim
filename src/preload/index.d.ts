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

export interface ProfileAPI {
  profiles: {
    getAll: () => Promise<Profile[]>
    add: (profile: { name: string; type: ProfileType; age?: number; gender?: 'male' | 'female' }) => Promise<Profile>
    remove: (id: string) => Promise<boolean>
  }
  ai: {
    getStatus: () => Promise<AIStatus>
    load: () => Promise<{ success: boolean; status?: AIStatus; error?: string }>
    unload: () => Promise<{ success: boolean; error?: string }>
    sendMessage: (profileSlug: string, sessionSlug: string, message: string, history: ChatMessage[]) => Promise<{ success: boolean; error?: string }>
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