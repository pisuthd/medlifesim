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
    onDownloadProgress: (callback: (progress: number) => void) => () => void
    onLoadProgress: (callback: (msg: string) => void) => () => void
  }
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: ProfileAPI
  }
}