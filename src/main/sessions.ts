import * as fs from 'fs'
import * as path from 'path'
import { app, ipcMain } from 'electron'
import { profileStore } from './profileStore'

const SESSIONS_DIR = 'sessions'

export interface Session {
  slug: string
  name: string
  createdAt: string
  messageCount: number
}

export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
  thinking?: string
}

function getSessionsPath(profileSlug: string): string {
  return path.join(app.getPath('userData'), 'profiles', profileSlug, SESSIONS_DIR)
}

function getSessionPath(profileSlug: string, sessionSlug: string): string {
  return path.join(getSessionsPath(profileSlug), sessionSlug)
}

function getMessagesPath(profileSlug: string, sessionSlug: string): string {
  return path.join(getSessionPath(profileSlug, sessionSlug), 'messages.json')
}

export function createSession(profileSlug: string, sessionSlug: string): { path: string; messagesPath: string } {
  const basePath = getSessionPath(profileSlug, sessionSlug)
  const messagesPath = path.join(basePath, 'messages.json')

  fs.mkdirSync(basePath, { recursive: true })
  fs.writeFileSync(messagesPath, JSON.stringify([]))

  return { path: basePath, messagesPath }
}

export function deleteSession(profileSlug: string, sessionSlug: string): boolean {
  // Prevent deleting main session
  if (sessionSlug === 'main') {
    return false
  }

  const sessionPath = getSessionPath(profileSlug, sessionSlug)
  if (fs.existsSync(sessionPath)) {
    fs.rmSync(sessionPath, { recursive: true, force: true })
    return true
  }
  return false
}

export function sessionExists(profileSlug: string, sessionSlug: string): boolean {
  const sessionPath = getSessionPath(profileSlug, sessionSlug)
  return fs.existsSync(sessionPath)
}

export function ensureMainSession(profileSlug: string): void {
  const mainSlug = 'main'
  if (!sessionExists(profileSlug, mainSlug)) {
    createSession(profileSlug, mainSlug)
  }
}

export function listSessions(profileSlug: string): Session[] {
  const sessionsPath = getSessionsPath(profileSlug)

  if (!fs.existsSync(sessionsPath)) {
    return []
  }

  const entries = fs.readdirSync(sessionsPath, { withFileTypes: true })
  return entries
    .filter(entry => entry.isDirectory())
    .map(entry => {
      const messagesPath = path.join(sessionsPath, entry.name, 'messages.json')
      let messageCount = 0

      if (fs.existsSync(messagesPath)) {
        try {
          const messages = JSON.parse(fs.readFileSync(messagesPath, 'utf-8'))
          messageCount = Array.isArray(messages) ? messages.length : 0
        } catch {
          messageCount = 0
        }
      }

      // Get creation time from folder
      const stats = fs.statSync(path.join(sessionsPath, entry.name))
      const name = entry.name === 'main' ? 'Main Session' : entry.name

      return {
        slug: entry.name,
        name,
        createdAt: stats.birthtime.toISOString(),
        messageCount,
      }
    })
    .sort((a, b) => {
      // Always put 'main' first
      if (a.slug === 'main') return -1
      if (b.slug === 'main') return 1
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    })
}

export function saveMessages(profileSlug: string, sessionSlug: string, messages: Message[]): void {
  const messagesPath = getMessagesPath(profileSlug, sessionSlug)
  fs.writeFileSync(messagesPath, JSON.stringify(messages, null, 2))
}

export function loadMessages(profileSlug: string, sessionSlug: string): Message[] {
  const messagesPath = getMessagesPath(profileSlug, sessionSlug)

  if (!fs.existsSync(messagesPath)) {
    return []
  }

  try {
    const content = fs.readFileSync(messagesPath, 'utf-8')
    return JSON.parse(content)
  } catch {
    return []
  }
}

// Register IPC handlers
export function registerSessionsIpcHandlers(): void {
  // List sessions for a profile
  ipcMain.handle('sessions:list', async (_event, profileSlug: string) => {
    try {
      ensureMainSession(profileSlug)
      return listSessions(profileSlug)
    } catch (error) {
      console.error('[Sessions] Failed to list:', error)
      throw error
    }
  })

  // Create new session
  ipcMain.handle('sessions:create', async (_event, profileSlug: string, sessionSlug: string) => {
    try {
      if (sessionExists(profileSlug, sessionSlug)) {
        throw new Error('Session already exists')
      }
      return createSession(profileSlug, sessionSlug)
    } catch (error) {
      console.error('[Sessions] Failed to create:', error)
      throw error
    }
  })

  // Delete session
  ipcMain.handle('sessions:delete', async (_event, profileSlug: string, sessionSlug: string) => {
    try {
      const deleted = deleteSession(profileSlug, sessionSlug)
      return { success: deleted }
    } catch (error) {
      console.error('[Sessions] Failed to delete:', error)
      throw error
    }
  })

  // Get session info
  ipcMain.handle('sessions:get', async (_event, profileSlug: string, sessionSlug: string) => {
    try {
      const exists = sessionExists(profileSlug, sessionSlug)
      return { slug: sessionSlug, exists }
    } catch (error) {
      console.error('[Sessions] Failed to get:', error)
      throw error
    }
  })

  // Ensure main session exists
  ipcMain.handle('sessions:ensureMain', async (_event, profileSlug: string) => {
    try {
      ensureMainSession(profileSlug)
      return { success: true }
    } catch (error) {
      console.error('[Sessions] Failed to ensure main:', error)
      throw error
    }
  })

  // Save messages
  ipcMain.handle('sessions:saveMessages', async (
    _event,
    profileSlug: string,
    sessionSlug: string,
    messages: Message[]
  ) => {
    try {
      saveMessages(profileSlug, sessionSlug, messages)
      return { success: true }
    } catch (error) {
      console.error('[Sessions] Failed to save messages:', error)
      throw error
    }
  })

  // Load messages
  ipcMain.handle('sessions:loadMessages', async (
    _event,
    profileSlug: string,
    sessionSlug: string
  ) => {
    try {
      return loadMessages(profileSlug, sessionSlug)
    } catch (error) {
      console.error('[Sessions] Failed to load messages:', error)
      throw error
    }
  })
}

// Initialize sessions for all existing profiles on startup
export function initSessions(): void {
  try {
    const profiles = profileStore.getAll()
    for (const profile of profiles) {
      ensureMainSession(profile.id)
    }
    console.log('[Sessions] Initialized for', profiles.length, 'profiles')
  } catch (error) {
    console.error('[Sessions] Failed to init:', error)
  }
}