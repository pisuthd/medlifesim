import { useState } from 'react'
import { motion } from 'framer-motion'

const BLUE = '#1A1AE8'
const TEAL = '#3EC4C0'
const NAVY = '#0a0a5c'
const MUTED = '#9999bb'
const LIGHT_BLUE = '#f7f7fc'

const monoFont = "'Space Mono', monospace"
const sansFont = "'DM Sans', sans-serif"

interface Message {
  id: string
  type: 'user' | 'ai'
  content: string
  time: string
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontFamily: monoFont, fontSize: 11, letterSpacing: '0.14em', color: MUTED, textTransform: 'uppercase', marginBottom: 8 }}>
      {children}
    </p>
  )
}

export default function Chat() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')

  const handleSend = () => {
    if (!input.trim()) return
    
    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: input,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }
    
    setMessages((prev) => [...prev, userMessage])
    setInput('')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', fontFamily: sansFont }}>
      {/* Header */}
      <div style={{ padding: '24px 32px', borderBottom: '1px solid #e0e0f0' }}>
        <SectionLabel>Chat</SectionLabel>
        <h1 style={{ fontFamily: sansFont, fontSize: 24, fontWeight: 300, color: NAVY, margin: 0, lineHeight: 1.2 }}>
          <strong style={{ fontWeight: 500 }}>New</strong> conversation
        </h1>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflow: 'auto', padding: '24px 32px' }}>
        {messages.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 0' }}>
            <p style={{ fontFamily: sansFont, fontSize: 14, color: MUTED }}>
              Start a conversation by typing below
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {messages.map((msg) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                style={{
                  display: 'flex',
                  justifyContent: msg.type === 'user' ? 'flex-end' : 'flex-start',
                }}
              >
                <div
                  style={{
                    maxWidth: '70%',
                    padding: '12px 16px',
                    background: msg.type === 'user' ? BLUE : '#fff',
                    border: msg.type === 'user' ? 'none' : '1px solid #e0e0f0',
                    borderRadius: 8,
                    color: msg.type === 'user' ? '#fff' : NAVY,
                    fontFamily: sansFont,
                    fontSize: 14,
                  }}
                >
                  <p style={{ margin: 0 }}>{msg.content}</p>
                  <p
                    style={{
                      fontFamily: monoFont,
                      fontSize: 10,
                      color: msg.type === 'user' ? 'rgba(255,255,255,0.7)' : MUTED,
                      marginTop: 4,
                      textAlign: 'right',
                    }}
                  >
                    {msg.time}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Input */}
      <div style={{ padding: '24px 32px', borderTop: '1px solid #e0e0f0', background: '#fff' }}>
        <div style={{ display: 'flex', gap: 12 }}>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Type your message..."
            style={{
              flex: 1,
              padding: '12px 16px',
              border: '1px solid #e0e0f0',
              borderRadius: 8,
              fontFamily: sansFont,
              fontSize: 14,
              color: NAVY,
              outline: 'none',
            }}
          />
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={handleSend}
            style={{
              padding: '12px 24px',
              background: BLUE,
              border: 'none',
              borderRadius: 8,
              color: '#fff',
              fontFamily: monoFont,
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: '0.1em',
              cursor: 'pointer',
            }}
          >
            SEND
          </motion.button>
        </div>
      </div>
    </div>
  )
}