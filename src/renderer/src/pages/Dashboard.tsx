import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { BLUE, TEAL, NAVY, MUTED, monoFont, sansFont } from '../theme'
import { useAI } from '../context/AIContext'

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
  const { isReady, activeModel, progress, status, error } = useAI()

  const [uptime, setUptime] = useState(0)
  useEffect(() => {
    if (!status?.active.loadedAt) {
      setUptime(0)
      return
    }
    const tick = () => {
      setUptime(Math.floor((Date.now() - (status.active.loadedAt ?? Date.now())) / 1000))
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [status?.active.loadedAt])

  const modelName = activeModel?.name ?? '—'
  const modelSubtext = progress
    ? `${progress.phase === 'downloading' ? 'Downloading' : 'Loading'} ${Math.round(progress.percentage)}%`
    : error
    ? 'Error loading'
    : undefined

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
          <p style={{ fontFamily: monoFont, fontSize: 11, letterSpacing: '0.14em', color: MUTED, textTransform: 'uppercase', marginBottom: 8 }}>
            Account
          </p>
          <motion.h1 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            style={{ fontFamily: sansFont, fontSize: 36, fontWeight: 300, color: NAVY, margin: '0 0 24px 0', lineHeight: 1.2 }}
          >
            <strong style={{ fontWeight: 600 }}>Free & Private</strong><br />
            Medical Consultation
          </motion.h1>

          {/* Stats Row */}
          <div style={{ display: 'flex', flexWrap: 'wrap' }}>
            <StatItem
              label="Model"
              value={modelName}
              subtext={modelSubtext}
            />
            <StatItem
              label="Status"
              value={isReady ? 'Ready' : 'Loading'}
            />
            <StatItem
              label="Uptime"
              value={isReady ? formatUptime(uptime) : '--'}
            />
          </div>
        </div>

        {/* Teal left accent */}
        <div style={{ position: 'absolute', bottom: 0, left: 0, width: 4, height: 120, background: TEAL }} />
      </div>

      {/* CTA Section */}
      <div style={{ padding: '48px 48px 48px 56px' }}>
        <div style={{ maxWidth: 900 }}>
          {/* Free & Open Source Card */}
          <div style={{
            padding: 20,
            background: '#fff',
            border: '1px solid #e0e0f0',
            borderRadius: 8,
            borderLeft: `3px solid ${BLUE}`,
            marginBottom: 24,
          }}>
            <h3 style={{ fontFamily: sansFont, fontSize: 16, fontWeight: 500, color: NAVY, margin: '0 0 8px 0' }}>
              MedLifeSim
            </h3>
            <p style={{ fontFamily: sansFont, fontSize: 13, color: MUTED, margin: 0 }}>
              Free & Open Source. A desktop application that brings on-device AI medical assistance with privacy-first design.
            </p>
          </div>

          {/* CTA */}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => navigate('/chat')}
            style={{
              padding: '14px 28px',
              background: isReady ? BLUE : MUTED,
              border: 'none',
              borderRadius: 6,
              color: '#fff',
              fontFamily: monoFont,
              fontWeight: 700,
              fontSize: 12,
              letterSpacing: '0.1em',
              cursor: isReady ? 'pointer' : 'not-allowed',
            }}
          >
            START CHATTING →
          </motion.button>
        </div>
      </div>
    </div>
  )
}
