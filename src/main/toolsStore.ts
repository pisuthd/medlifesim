import * as fs from 'fs'
import * as path from 'path'
import { app } from 'electron'

export interface AppSettings {
  ctx_size: number
  workerEnabled: boolean
}

const SETTINGS_FILE = 'settings.json'

const DEFAULT_SETTINGS: AppSettings = {
  ctx_size: 4096,
  workerEnabled: true,
}

function getSettingsFilePath(): string {
  return path.join(app.getPath('userData'), SETTINGS_FILE)
}

// Settings Store
function loadSettings(): AppSettings {
  try {
    const filePath = getSettingsFilePath()
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8')
      return { ...DEFAULT_SETTINGS, ...JSON.parse(content) }
    }
  } catch (error) {
    console.error('[Settings] Failed to load:', error)
  }
  return { ...DEFAULT_SETTINGS }
}

function saveSettings(settings: AppSettings): void {
  try {
    const filePath = getSettingsFilePath()
    fs.writeFileSync(filePath, JSON.stringify(settings, null, 2))
    console.log('[Settings] Saved to:', filePath)
  } catch (error) {
    console.error('[Settings] Failed to save:', error)
  }
}

class SettingsStore {
  private settings: AppSettings

  constructor() {
    this.settings = loadSettings()
  }

  getSettings(): AppSettings {
    return { ...this.settings }
  }

  getCtxSize(): number {
    return this.settings.ctx_size
  }

  setCtxSize(ctx_size: number): void {
    this.settings.ctx_size = ctx_size
    saveSettings(this.settings)
  }

  getWorkerEnabled(): boolean {
    return this.settings.workerEnabled
  }

  setWorkerEnabled(enabled: boolean): void {
    this.settings.workerEnabled = enabled
    saveSettings(this.settings)
  }

  reset(): void {
    this.settings = { ...DEFAULT_SETTINGS }
    saveSettings(this.settings)
  }
}

// Singleton instance
export const settingsStore = new SettingsStore()

// Profile context interface
export interface ProfileContext {
  name: string
  type: string
  age?: number
  gender?: string
}

/**
 * Build the user-context block that prefixes the user's actual message
 * on every completion. Just injects profile name / type / age / gender
 * as a "## User Context" section so the model has stable identity to
 * refer to.
 */
export function getSystemPrompt(profile?: ProfileContext): string {
  let prompt = ''

  // Add user context if available
  if (profile) {
    prompt += '\n\n## User Context\n\n'
    prompt += `You are speaking with ${profile.name}. `
    prompt += `Patient type: ${profile.type}. `

    if (profile.age || profile.gender) {
      const ageStr = profile.age ? `${profile.age} year old` : ''
      const genderStr = profile.gender ? profile.gender : ''
      if (ageStr && genderStr) {
        prompt += `Patient demographics: ${ageStr} ${genderStr}. `
      } else if (ageStr) {
        prompt += `Patient demographics: ${ageStr} old. `
      } else if (genderStr) {
        prompt += `Patient gender: ${genderStr}. `
      }
    }

    prompt += '\n'
  }

  return prompt
}
