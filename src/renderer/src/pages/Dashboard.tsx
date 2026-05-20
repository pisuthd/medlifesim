import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'

const BLUE = '#1A1AE8'
const TEAL = '#3EC4C0'
const NAVY = '#0a0a5c'
const MUTED = '#9999bb'
const LIGHT_BLUE = '#f7f7fc'

const monoFont = "'Space Mono', monospace"
const sansFont = "'DM Sans', sans-serif"

interface Session {
  id: string
  title: string
  date: string
  preview: string
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontFamily: monoFont, fontSize: 11, letterSpacing: '0.14em', color: MUTED, textTransform: 'uppercase', marginBottom: 8 }}>
      {children}
    </p>
  )
}

function StatCard({ label, value, subtext }: { label: string; value: string; subtext: string }) {
  return (
    <div style={{ padding: '20px 24px', background: '#fff', border: '1px solid #e0e0f0', borderRadius: 8 }}>
      <p style={{ fontFamily: monoFont, fontSize: 10, letterSpacing: '0.12em', color: MUTED, textTransform: 'uppercase', marginBottom: 8 }}>{label}</p>
      <p style={{ fontFamily: sansFont, fontSize: 32, fontWeight: 300, color: NAVY, margin: 0, lineHeight: 1 }}>{value}</p>
      <p style={{ fontFamily: monoFont, fontSize: 11, color: TEAL, marginTop: 8 }}>{subtext}</p>
    </div>
  )
}

export default function Dashboard() {
  const navigate = useNavigate()

  const recentSessions: Session[] = [
    { id: '1', title: 'Headache and fatigue', date: 'Today', preview: 'I have been experiencing...' },
    { id: '2', title: 'Chest pain consultation', date: 'Yesterday', preview: 'Started feeling chest discomfort...' },
    { id: '3', title: 'Medication review', date: '3 days ago', preview: 'I am taking aspirin daily...' },
  ]

  return (
    <div style={{ padding: '32px', fontFamily: sansFont }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <SectionLabel>Dashboard</SectionLabel>
        <h1 style={{ fontFamily: sansFont, fontSize: 28, fontWeight: 300, color: NAVY, margin: 0, lineHeight: 1.2 }}>
          <strong style={{ fontWeight: 500 }}>Health</strong> Overview
        </h1>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 32 }}>
        <StatCard label="Total Sessions" value="12" subtext="+3 this week" />
        <StatCard label="Documents" value="5" subtext="Medical notes" />
        <StatCard label="Tools" value="0" subtext="Enabled" />
      </div>

      {/* Recent Conversations */}
      <div style={{ background: '#fff', border: '1px solid #e0e0f0', borderRadius: 8, overflow: 'hidden' }}>
        {/* Teal top accent */}
        <div style={{ height: 3, background: TEAL }} />
        
        <div style={{ padding: '24px' }}>
          <SectionLabel>Recent Conversations</SectionLabel>
          <h2 style={{ fontFamily: sansFont, fontSize: 18, fontWeight: 300, color: NAVY, marginBottom: 16, margin: '0 0 16px 0' }}>
            <strong style={{ fontWeight: 500 }}>Your</strong> recent chats
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {recentSessions.map((session, index) => (
              <motion.button
                key={session.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                whileHover={{ x: 4 }}
                onClick={() => navigate('/chat', { state: { sessionId: session.id } })}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '14px 16px',
                  background: LIGHT_BLUE,
                  border: '1px solid #e0e0f0',
                  borderRadius: 6,
                  cursor: 'pointer',
                  textAlign: 'left',
                  width: '100%',
                }}
              >
                <div style={{ flex: 1 }}>
                  <span style={{ display: 'block', fontFamily: sansFont, fontSize: 14, fontWeight: 500, color: NAVY }}>{session.title}</span>
                  <span style={{ fontFamily: sansFont, fontSize: 12, color: MUTED }}>{session.preview}</span>
                </div>
                <span style={{ fontFamily: monoFont, fontSize: 10, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.08em', marginLeft: 16 }}>
                  {session.date}
                </span>
              </motion.button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}