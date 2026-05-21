import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'

const BLUE = '#1A1AE8'
const TEAL = '#3EC4C0'
const NAVY = '#0a0a5c'
const MUTED = '#9999bb'
const LIGHT_BLUE = '#f7f7fc'

const monoFont = "'Space Mono', monospace"
const sansFont = "'DM Sans', sans-serif"

type Tab = 'ai' | 'tools' | 'about'

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontFamily: monoFont, fontSize: 11, letterSpacing: '0.14em', color: MUTED, textTransform: 'uppercase', marginBottom: 8 }}>
      {children}
    </p>
  )
}

interface Tool {
  id: string
  name: string
  description: string
  enabled: boolean
  status: 'available' | 'coming_soon'
}

function ToolCard({ tool, onToggle }: { tool: Tool; onToggle: () => void }) {
  return (
    <div
      style={{
        padding: '20px',
        background: '#fff',
        border: '1px solid #e0e0f0',
        borderRadius: 8,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 16,
        opacity: tool.status === 'coming_soon' ? 0.6 : 1,
      }}
    >
      <div style={{ flex: 1 }}>
        <h3 style={{ fontFamily: sansFont, fontSize: 15, fontWeight: 500, color: NAVY, margin: '0 0 4px 0' }}>{tool.name}</h3>
        <p style={{ fontFamily: sansFont, fontSize: 13, color: MUTED, margin: 0 }}>{tool.description}</p>
        {tool.status === 'coming_soon' && (
          <span
            style={{
              display: 'inline-block',
              marginTop: 8,
              padding: '4px 8px',
              background: LIGHT_BLUE,
              fontFamily: monoFont,
              fontSize: 9,
              color: MUTED,
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
            }}
          >
            Coming Soon
          </span>
        )}
      </div>

      <button
        onClick={onToggle}
        disabled={tool.status === 'coming_soon'}
        style={{
          width: 44,
          height: 24,
          background: tool.enabled ? BLUE : '#e0e0f0',
          borderRadius: 12,
          border: 'none',
          position: 'relative',
          cursor: tool.status === 'available' ? 'pointer' : 'not-allowed',
          transition: 'background 0.2s',
          flexShrink: 0,
        }}
      >
        <span
          style={{
            position: 'absolute',
            top: 2,
            left: tool.enabled ? 22 : 2,
            width: 20,
            height: 20,
            background: '#fff',
            borderRadius: '50%',
            transition: 'left 0.2s',
          }}
        />
      </button>
    </div>
  )
}

export default function Settings() {
  const [activeTab, setActiveTab] = useState<Tab>('ai')
  const [ctxSize, setCtxSize] = useState(4096)
  const [tools, setTools] = useState<Tool[]>([])
  const [loading, setLoading] = useState(true)

  // Load settings and tools on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        const [settings, loadedTools] = await Promise.all([
          window.api.settings.get(),
          window.api.tools.getAll(),
        ])
        setCtxSize(settings.ctx_size)
        setTools(loadedTools)
      } catch (error) {
        console.error('Failed to load settings:', error)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

  const handleCtxSizeChange = async (newSize: number) => {
    setCtxSize(newSize)
    try {
      await window.api.settings.setCtxSize(newSize)
    } catch (error) {
      console.error('Failed to save ctx_size:', error)
    }
  }

  const toggleTool = async (id: string) => {
    const tool = tools.find(t => t.id === id)
    if (!tool || tool.status !== 'available') return

    const newEnabled = !tool.enabled
    
    try {
      await window.api.tools.setEnabled(id, newEnabled)
      setTools(prev => prev.map(t => 
        t.id === id ? { ...t, enabled: newEnabled } : t
      ))
    } catch (error) {
      console.error('Failed to toggle tool:', error)
    }
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'ai', label: 'AI Settings' },
    { id: 'tools', label: 'Tools' },
    { id: 'about', label: 'About' },
  ]

  return (
    <div style={{ display: 'flex', minHeight: '100%' }}>
      {/* Side Tab Navigation */}
      <div
        style={{
          width: 200,
          borderRight: '1px solid #e0e0f0',
          padding: '32px 24px',
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
        }}
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '12px 16px',
              border: 'none',
              borderRadius: 8,
              background: activeTab === tab.id ? LIGHT_BLUE : 'transparent',
              color: activeTab === tab.id ? BLUE : NAVY,
              fontFamily: sansFont,
              fontSize: 14,
              fontWeight: activeTab === tab.id ? 500 : 400,
              textAlign: 'left',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content Area */}
      <div style={{ flex: 1, padding: '32px 48px', overflowY: 'auto' }}>
        {/* AI Settings Tab */}
        {activeTab === 'ai' && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <SectionLabel>Model Settings</SectionLabel>
            <h1 style={{ fontFamily: sansFont, fontSize: 28, fontWeight: 300, color: NAVY, margin: '0 0 32px 0', lineHeight: 1.2 }}>
              <strong style={{ fontWeight: 500 }}>AI</strong> Configuration
            </h1>

            <div style={{ marginBottom: 32 }}>
              <p style={{ fontFamily: sansFont, fontSize: 14, color: MUTED, marginBottom: 16 }}>
                Context size determines how much conversation history the AI can process. Higher values allow for longer conversations but use more memory.
              </p>

              <div style={{ display: 'flex', gap: 12 }}>
                {[2048, 4096, 8192].map((size) => (
                  <button
                    key={size}
                    onClick={() => handleCtxSizeChange(size)}
                    style={{
                      padding: '12px 24px',
                      background: ctxSize === size ? BLUE : '#fff',
                      color: ctxSize === size ? '#fff' : NAVY,
                      border: ctxSize === size ? 'none' : '1px solid #e0e0f0',
                      borderRadius: 8,
                      fontFamily: monoFont,
                      fontSize: 14,
                      fontWeight: 500,
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                  >
                    {size} tokens
                  </button>
                ))}
              </div>

              <p style={{ fontFamily: sansFont, fontSize: 12, color: MUTED, marginTop: 12 }}>
                Current: {ctxSize} tokens
                {ctxSize === 2048 && ' (Lightweight, faster) - Lower context window.'}
                {ctxSize === 4096 && ' (Balanced) - Default setting.'}
                {ctxSize === 8192 && ' (Extended) - Requires more memory.'}
              </p>
            </div>

            <div
              style={{
                padding: 20,
                background: LIGHT_BLUE,
                borderRadius: 8,
                borderLeft: `3px solid ${TEAL}`,
              }}
            >
              <p style={{ fontFamily: sansFont, fontSize: 13, color: MUTED, margin: 0 }}>
                <strong>Note:</strong> Changing context size requires a model reload to take effect. The model will automatically reload when you restart the app.
              </p>
            </div>
          </motion.div>
        )}

        {/* Tools Tab */}
        {activeTab === 'tools' && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <SectionLabel>Tools</SectionLabel>
            <h1 style={{ fontFamily: sansFont, fontSize: 28, fontWeight: 300, color: NAVY, margin: '0 0 32px 0', lineHeight: 1.2 }}>
              <strong style={{ fontWeight: 500 }}>Enable</strong> integrations
            </h1>

            {loading ? (
              <div style={{ padding: 24, textAlign: 'center', color: MUTED }}>
                Loading...
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {tools.map((tool, index) => (
                  <motion.div
                    key={tool.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <ToolCard tool={tool} onToggle={() => toggleTool(tool.id)} />
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {/* About Tab */}
        {activeTab === 'about' && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <SectionLabel>Application</SectionLabel>
            <h1 style={{ fontFamily: sansFont, fontSize: 28, fontWeight: 300, color: NAVY, margin: '0 0 32px 0', lineHeight: 1.2 }}>
              <strong style={{ fontWeight: 500 }}>About</strong> MedPsy Doctor
            </h1>

            <div style={{ marginBottom: 24 }}>
              <h2 style={{ fontFamily: sansFont, fontSize: 20, fontWeight: 500, color: NAVY, margin: '0 0 8px 0' }}>
                MedPsy Doctor
              </h2>
              <p style={{ fontFamily: monoFont, fontSize: 12, color: MUTED, margin: 0 }}>
                Version 1.0.0-beta.1
              </p>
            </div>

            <p style={{ fontFamily: sansFont, fontSize: 14, color: MUTED, lineHeight: 1.6, marginBottom: 24 }}>
              A free, open-source desktop application for QVAC MedPsy - the medical language model launched by Tether AI. 
              This app brings on-device AI medical assistance to your computer with privacy-first design.
            </p>

            <div
              style={{
                padding: 20,
                background: LIGHT_BLUE,
                borderRadius: 8,
                borderLeft: `3px solid ${BLUE}`,
                marginBottom: 24,
              }}
            >
              <h3 style={{ fontFamily: sansFont, fontSize: 14, fontWeight: 500, color: NAVY, margin: '0 0 8px 0' }}>
                QVAC MedPsy
              </h3>
              <p style={{ fontFamily: sansFont, fontSize: 13, color: MUTED, margin: 0 }}>
                A cutting-edge medical language model from Tether AI, designed to run directly on devices with limited processing power.
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <p style={{ fontFamily: sansFont, fontSize: 13, color: MUTED }}>
                <strong>AI Model:</strong> Medpsy-1.7B (GGUF format)
              </p>
              <p style={{ fontFamily: sansFont, fontSize: 13, color: MUTED }}>
                <strong>Context Size:</strong> {ctxSize} tokens
              </p>
              <p style={{ fontFamily: sansFont, fontSize: 13, color: MUTED }}>
                <strong>Framework:</strong> Electron + React
              </p>
            </div>

            <div style={{ marginTop: 32 }}>
              <a
                href="https://github.com/pisuthd/medpsy-doctor"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-block',
                  padding: '10px 20px',
                  background: BLUE,
                  color: '#fff',
                  fontFamily: sansFont,
                  fontSize: 13,
                  textDecoration: 'none',
                  borderRadius: 8,
                }}
              >
                View on GitHub
              </a>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  )
}