import * as fs from 'fs'
import * as path from 'path'
import { app } from 'electron'

export interface P2PPeer {
  id: string
  name: string
  publicKey: string
  createdAt: string
}

export interface AppSettings {
  ctx_size: number
  workerEnabled: boolean
  maxCards: number
  /**
   * P2P provider settings — used to expose this machine's GPU to a
   * remote peer over a Hyperswarm DHT (QVAC `startQVACProvider`).
   */
  p2pProviderEnabled: boolean
  /**
   * 64-char hex (32 bytes) Hyperswarm seed. Generated once on first
   * provider start, persisted, and set as `QVAC_HYPERSWARM_SEED` at
   * boot so the provider's public key is stable across restarts.
   */
  p2pProviderSeed: string | null
  /**
   * P2P consumer settings — when enabled, the simulation outcome
   * worker delegates its completions to the active peer instead of
   * running them locally. Chat + scenario generation are unaffected.
   */
  p2pConsumerEnabled: boolean
  p2pConsumerPeers: P2PPeer[]
  p2pActiveConsumerPeerId: string | null
}

const SETTINGS_FILE = 'settings.json'

const DEFAULT_SETTINGS: AppSettings = {
  ctx_size: 4096,
  workerEnabled: true,
  maxCards: 12,
  p2pProviderEnabled: false,
  p2pProviderSeed: null,
  p2pConsumerEnabled: false,
  p2pConsumerPeers: [],
  p2pActiveConsumerPeerId: null,
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

  getMaxCards(): number {
    return this.settings.maxCards
  }

  setMaxCards(maxCards: number): void {
    this.settings.maxCards = maxCards
    saveSettings(this.settings)
  }

  // ─── P2P provider / consumer ──────────────────────────────────────────

  getP2pProviderEnabled(): boolean {
    return this.settings.p2pProviderEnabled
  }

  setP2pProviderEnabled(enabled: boolean): void {
    this.settings.p2pProviderEnabled = enabled
    saveSettings(this.settings)
  }

  getP2pProviderSeed(): string | null {
    return this.settings.p2pProviderSeed
  }

  setP2pProviderSeed(seed: string | null): void {
    this.settings.p2pProviderSeed = seed
    saveSettings(this.settings)
  }

  getP2pConsumerEnabled(): boolean {
    return this.settings.p2pConsumerEnabled
  }

  setP2pConsumerEnabled(enabled: boolean): void {
    this.settings.p2pConsumerEnabled = enabled
    saveSettings(this.settings)
  }

  getP2pConsumerPeers(): P2PPeer[] {
    return this.settings.p2pConsumerPeers
  }

  setP2pConsumerPeers(peers: P2PPeer[]): void {
    this.settings.p2pConsumerPeers = peers
    saveSettings(this.settings)
  }

  getP2pActiveConsumerPeerId(): string | null {
    return this.settings.p2pActiveConsumerPeerId
  }

  setP2pActiveConsumerPeerId(id: string | null): void {
    this.settings.p2pActiveConsumerPeerId = id
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
