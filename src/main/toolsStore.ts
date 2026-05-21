import * as fs from 'fs'
import * as path from 'path'
import { app } from 'electron'

export interface ToolConfig {
  id: string
  name: string
  description: string
  enabled: boolean
  status: 'available' | 'coming_soon'
}

export interface AppSettings {
  ctx_size: number
}

const TOOLS_FILE = 'tools-config.json'
const SETTINGS_FILE = 'settings.json'

const DEFAULT_SETTINGS: AppSettings = {
  ctx_size: 4096,
}

function getToolsFilePath(): string {
  return path.join(app.getPath('userData'), TOOLS_FILE)
}

function getSettingsFilePath(): string {
  return path.join(app.getPath('userData'), SETTINGS_FILE)
}

// Default tools configuration
const DEFAULT_TOOLS: ToolConfig[] = [
  { id: '1', name: 'Documents', description: 'Upload medical documents, notes, and PDFs. AI can read and reference them in conversations.', enabled: true, status: 'available' },
  { id: '2', name: 'Clinic Scheduling', description: 'Schedule appointments with local clinics directly from chat', enabled: false, status: 'coming_soon' },
  { id: '3', name: 'Medication Reminders', description: 'Set reminders for taking medications', enabled: false, status: 'coming_soon' },
  { id: '4', name: 'Health Records', description: 'Connect to your electronic health records', enabled: false, status: 'coming_soon' },
  { id: '5', name: 'Emergency Contacts', description: 'Quick access to emergency services and contacts', enabled: false, status: 'coming_soon' },
]

function loadTools(): ToolConfig[] {
  try {
    const filePath = getToolsFilePath()
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8')
      return JSON.parse(content)
    }
  } catch (error) {
    console.error('[Tools] Failed to load:', error)
  }
  // Return default if no file exists
  return DEFAULT_TOOLS
}

function saveTools(tools: ToolConfig[]): void {
  try {
    const filePath = getToolsFilePath()
    fs.writeFileSync(filePath, JSON.stringify(tools, null, 2))
    console.log('[Tools] Saved to:', filePath)
  } catch (error) {
    console.error('[Tools] Failed to save:', error)
  }
}

class ToolsStore {
  private tools: ToolConfig[] = []

  constructor() {
    this.tools = loadTools()
  }

  getTools(): ToolConfig[] {
    return [...this.tools]
  }

  getEnabledTools(): ToolConfig[] {
    return this.tools.filter(t => t.enabled && t.status === 'available')
  }

  setToolEnabled(id: string, enabled: boolean): boolean {
    const tool = this.tools.find(t => t.id === id)
    if (tool && tool.status === 'available') {
      tool.enabled = enabled
      saveTools(this.tools)
      return true
    }
    return false
  }

  reset(): void {
    this.tools = [...DEFAULT_TOOLS]
    saveTools(this.tools)
  }
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

  reset(): void {
    this.settings = { ...DEFAULT_SETTINGS }
    saveSettings(this.settings)
  }
}

// Singleton instance
export const toolsStore = new ToolsStore()
export const settingsStore = new SettingsStore()

// Generate system prompt based on enabled tools
export function getToolsSystemPrompt(): string {
  const enabledTools = toolsStore.getEnabledTools()
  
  if (enabledTools.length === 0) {
    return ''
  }

  let prompt = '\n\n## Available Tools\n\n'
  prompt += 'You have access to the following tools that the user has enabled:\n\n'
  
  for (const tool of enabledTools) {
    prompt += `- **${tool.name}**: ${tool.description}\n`
  }
  
  prompt += '\nUse these tools when relevant to help answer the user\'s questions. '
  prompt += 'For example, if the user asks about their medical documents, use the document tools to retrieve that information.\n'
  
  return prompt
}