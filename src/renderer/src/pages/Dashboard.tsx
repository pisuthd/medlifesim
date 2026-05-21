import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'

const BLUE = '#1A1AE8'
const TEAL = '#3EC4C0'
const NAVY = '#0a0a5c'
const MUTED = '#9999bb'
// const LIGHT_BLUE = '#f7f7fc'

const monoFont = "'Space Mono', monospace"
const sansFont = "'DM Sans', sans-serif"

interface AIStatus {
  isReady: boolean
  modelName: string
  uptime: number
  downloading: boolean
  downloadProgress: number
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontFamily: monoFont, fontSize: 11, letterSpacing: '0.14em', color: MUTED, textTransform: 'uppercase', marginBottom: 8 }}>
      {children}
    </p>
  )
}

function StepCard({ num, title, subtitle }: { num: string; title: string; subtitle: string }) {
  return (
    <div style={{ 
      padding: '24px', 
      background: '#fff', 
      border: '1px solid #e0e0f0', 
      borderRadius: 8,
      display: 'flex',
      alignItems: 'flex-start',
      gap: 16,
    }}>
      <div style={{
        width: 40,
        height: 40,
        background: BLUE,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: monoFont,
        fontWeight: 700,
        fontSize: 14,
        color: '#fff',
        flexShrink: 0,
      }}>
        {num}
      </div>
      <div>
        <h3 style={{ fontFamily: sansFont, fontSize: 16, fontWeight: 500, color: NAVY, margin: '0 0 4px 0' }}>{title}</h3>
        <p style={{ fontFamily: sansFont, fontSize: 13, color: MUTED, margin: 0 }}>{subtitle}</p>
      </div>
    </div>
  )
}

function StatItem({ label, value, subtext }: { label: string; value: string; subtext?: string }) {
  return (
    <div style={{ marginRight: 32 }}>
      <p style={{ fontFamily: monoFont, fontSize: 10, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>
        {label}
      </p>
      <p style={{ fontFamily: monoFont, fontSize: 18, fontWeight: 700, color: NAVY, margin: 0 }}>{value}</p>
      {subtext && <p style={{ fontFamily: monoFont, fontSize: 9, color: MUTED, margin: '2px 0 0 0' }}>{subtext}</p>}
    </div>
  )
}

function formatUptime(seconds: number): string {
  if (seconds < 60) return '<1m'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`
  return `${Math.floor(seconds / 3600)}h`
}

export default function Dashboard() {
  const navigate = useNavigate()
  const [aiStatus, setAIStatus] = useState<AIStatus>({
    isReady: false,
    modelName: 'Medpsy-1.7B',
    uptime: 0,
    downloading: false,
    downloadProgress: 0,
  }) 

  // Poll AI status every second
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const status = await window.api.ai.getStatus()
        setAIStatus(status)
      } catch (error) {
        console.error('Failed to get AI status:', error)
      }
    }

    fetchStatus()
    const interval = setInterval(fetchStatus, 3000)
    return () => clearInterval(interval)
  }, [])
 

  return (
    <div style={{ fontFamily: sansFont, minHeight: '100vh', position: 'relative' }}>
      {/* Hero Section */}
      <div style={{ 
        padding: '48px 48px 48px 56px', 
        background: '#fff',
        position: 'relative',
        overflow: 'hidden',
        minHeight: 320,
      }}>
        {/* Geometric staircase blocks - top right */}
        <div style={{ position: 'absolute', top: 0, right: 0, zIndex: 1 }}>
          <div style={{ 
            position: 'absolute', 
            top: 0, 
            right: 0, 
            width: 300, 
            height: 200, 
            background: BLUE 
          }} />
          <div style={{ 
            position: 'absolute', 
            top: 200, 
            right: 0, 
            width: 200, 
            height: 160, 
            background: TEAL 
          }} />
          <div style={{ 
            position: 'absolute', 
            top: 360, 
            right: 100, 
            width: 100, 
            height: 80, 
            background: BLUE,
            opacity: 0.5
          }} />
        </div>

        {/* Content */}
        <div style={{ position: 'relative', zIndex: 2, maxWidth: 600 }}>
          <SectionLabel>Dashboard</SectionLabel>
          <h1 style={{ fontFamily: sansFont, fontSize: 36, fontWeight: 300, color: NAVY, margin: '0 0 24px 0', lineHeight: 1.2 }}>
            <strong style={{ fontWeight: 600 }}>Free & Private</strong><br />
            Medical Consultation
          </h1>

          {/* Stats Row */}
          <div style={{ display: 'flex', flexWrap: 'wrap' }}>
            <StatItem 
              label="Model" 
              value={aiStatus.modelName}
              subtext={aiStatus.downloading ? `Downloading ${aiStatus.downloadProgress}%` : undefined}
            />
            <StatItem 
              label="Status" 
              value={aiStatus.isReady ? 'Ready' : 'Loading'}
            />
            <StatItem 
              label="Uptime" 
              value={aiStatus.isReady ? formatUptime(aiStatus.uptime) : '--'}
            />
          </div>
        </div>

        {/* Teal left accent */}
        <div style={{ position: 'absolute', bottom: 0, left: 0, width: 4, height: 120, background: TEAL }} />
      </div>

      {/* CTA Section */}
      <div style={{ padding: '48px 48px 48px 56px' }}>
        <div style={{ maxWidth: 900 }}>
          {/* CTA */}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => navigate('/chat')}
            style={{
              padding: '14px 28px',
              background: aiStatus.isReady ? BLUE : MUTED,
              border: 'none',
              borderRadius: 6,
              color: '#fff',
              fontFamily: monoFont,
              fontWeight: 700,
              fontSize: 12,
              letterSpacing: '0.1em',
              cursor: aiStatus.isReady ? 'pointer' : 'not-allowed',
            }}
          >
            START CHATTING →
          </motion.button>
        </div>
      </div>
    </div>
  )
}