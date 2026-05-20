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
  messages: number
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontFamily: monoFont, fontSize: 11, letterSpacing: '0.14em', color: MUTED, textTransform: 'uppercase', marginBottom: 8 }}>
      {children}
    </p>
  )
}

export default function Sessions() {
  const sessions: Session[] = [
    { id: '1', title: 'Headache and fatigue', date: 'Today', messages: 12 },
    { id: '2', title: 'Chest pain consultation', date: 'Yesterday', messages: 8 },
    { id: '3', title: 'Medication review', date: '3 days ago', messages: 15 },
    { id: '4', title: 'Back pain analysis', date: '1 week ago', messages: 6 },
    { id: '5', title: 'Fever and chills', date: '2 weeks ago', messages: 10 },
  ]

  return (
    <div style={{ padding: '32px', fontFamily: sansFont }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <SectionLabel>Sessions</SectionLabel>
        <h1 style={{ fontFamily: sansFont, fontSize: 28, fontWeight: 300, color: NAVY, margin: 0, lineHeight: 1.2 }}>
          <strong style={{ fontWeight: 500 }}>Your</strong> conversations
        </h1>
      </div>

      {/* Sessions Table */}
      <div style={{ background: '#fff', border: '1px solid #e0e0f0', borderRadius: 8, overflow: 'hidden' }}>
        {/* Teal top accent */}
        <div style={{ height: 3, background: TEAL }} />
        
        {/* Table Header */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px 100px', padding: '12px 16px', background: LIGHT_BLUE, borderBottom: '1px solid #e0e0f0' }}>
          <span style={{ fontFamily: monoFont, fontSize: 10, letterSpacing: '0.12em', color: MUTED, textTransform: 'uppercase' }}>Conversation</span>
          <span style={{ fontFamily: monoFont, fontSize: 10, letterSpacing: '0.12em', color: MUTED, textTransform: 'uppercase' }}>Date</span>
          <span style={{ fontFamily: monoFont, fontSize: 10, letterSpacing: '0.12em', color: MUTED, textTransform: 'uppercase', textAlign: 'right' }}>Messages</span>
        </div>

        {/* Table Rows */}
        <div>
          {sessions.map((session, index) => (
            <motion.div
              key={session.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: index * 0.05 }}
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 120px 100px',
                padding: '16px',
                borderBottom: index < sessions.length - 1 ? '1px solid #e0e0f0' : 'none',
                cursor: 'pointer',
              }}
              whileHover={{ backgroundColor: LIGHT_BLUE }}
            >
              <span style={{ fontFamily: sansFont, fontSize: 14, color: NAVY, fontWeight: 500 }}>{session.title}</span>
              <span style={{ fontFamily: monoFont, fontSize: 11, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{session.date}</span>
              <span style={{ fontFamily: monoFont, fontSize: 12, color: MUTED, textAlign: 'right' }}>{session.messages}</span>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  )
}