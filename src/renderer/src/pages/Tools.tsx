import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { BLUE, NAVY, MUTED, LIGHT_BLUE, monoFont, sansFont } from '../theme'

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

      {/* Toggle Switch */}
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

export default function Tools() {
  const [tools, setTools] = useState<Tool[]>([])
  const [loading, setLoading] = useState(true)

  // Load tools from backend on mount
  useEffect(() => {
    const loadTools = async () => {
      try {
        const loadedTools = await window.api.tools.getAll()
        setTools(loadedTools)
      } catch (error) {
        console.error('Failed to load tools:', error)
      } finally {
        setLoading(false)
      }
    }
    loadTools()
  }, [])

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

  return (
    <div style={{ padding: '32px', fontFamily: sansFont }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <SectionLabel>Tools</SectionLabel>
        <h1 style={{ fontFamily: sansFont, fontSize: 28, fontWeight: 300, color: NAVY, margin: 0, lineHeight: 1.2 }}>
          <strong style={{ fontWeight: 500 }}>Enable</strong> integrations
        </h1>
      </div>

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
    </div>
  )
}