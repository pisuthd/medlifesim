import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'

const BLUE = '#1A1AE8'
const TEAL = '#3EC4C0'
const NAVY = '#0a0a5c'
const MUTED = '#9999bb'
const LIGHT_BLUE = '#f7f7fc'

const monoFont = "'Space Mono', monospace"
const sansFont = "'DM Sans', sans-serif"

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
  thinking?: string
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontFamily: monoFont, fontSize: 11, letterSpacing: '0.14em', color: MUTED, textTransform: 'uppercase', marginBottom: 8 }}>
      {children}
    </p>
  )
}

export default function Chat() {
  const [searchParams] = useSearchParams()
  const sessionSlug = searchParams.get('session') || 'main'
  
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [streamingContent, setStreamingContent] = useState('')
  const [streamingThinking, setStreamingThinking] = useState('')
  const [currentProfileId, setCurrentProfileId] = useState<string | null>(null)
  
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Get current profile
  useEffect(() => {
    const savedProfileId = localStorage.getItem('currentProfileId')
    setCurrentProfileId(savedProfileId)
  }, [])

  // Load messages for session
  useEffect(() => {
    if (!currentProfileId) return

    const loadMessages = async () => {
      try {
        const msgs = await window.api.sessions.loadMessages(currentProfileId, sessionSlug)
        setMessages(msgs)
      } catch (error) {
        console.error('Failed to load messages:', error)
      }
    }

    loadMessages()
  }, [currentProfileId, sessionSlug])

  // Set up streaming listeners
  useEffect(() => {
    const unsubToken = window.api.ai.onStreamToken((token) => {
      setStreamingContent((prev) => prev + token)
    })

    const unsubThinking = window.api.ai.onStreamThinking((thinking) => {
      setStreamingThinking((prev) => prev + thinking)
    })

    const unsubDone = window.api.ai.onStreamDone(() => {
      // Add the complete response to messages
      const assistantMessage: ChatMessage = {
        id: Date.now().toString(),
        role: 'assistant',
        content: streamingContent,
        timestamp: new Date().toISOString(),
        thinking: streamingThinking,
      }
      setMessages((prev) => [...prev, assistantMessage])
      setStreamingContent('')
      setStreamingThinking('')
      setLoading(false)
    })

    const unsubError = window.api.ai.onError((error) => {
      console.error('AI error:', error)
      setLoading(false)
    })

    return () => {
      unsubToken()
      unsubThinking()
      unsubDone()
      unsubError()
    }
  }, [streamingContent, streamingThinking])

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingContent])

  const handleSend = async () => {
    if (!input.trim() || loading || !currentProfileId) return

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date().toISOString(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setLoading(true)
    setStreamingContent('')
    setStreamingThinking('')

    // Build history for AI (excluding current message)
    const history = messages.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      timestamp: m.timestamp,
    }))

    try {
      await window.api.ai.sendMessage(currentProfileId, sessionSlug, userMessage.content, history)
    } catch (error) {
      console.error('Failed to send message:', error)
      setLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', fontFamily: sansFont }}>
      {/* Header */}
      <div style={{ padding: '24px 32px', borderBottom: '1px solid #e0e0f0' }}>
        <SectionLabel>Chat</SectionLabel>
        <h1 style={{ fontFamily: sansFont, fontSize: 28, fontWeight: 300, color: NAVY, margin: 0, lineHeight: 1.2 }}>
          <strong style={{ fontWeight: 500 }}>{sessionSlug === 'main' ? 'Main Session' : sessionSlug}</strong>
        </h1>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflow: 'auto', padding: '24px 32px' }}>
        {messages.length === 0 && !loading && (
          <div style={{ textAlign: 'center', color: MUTED, padding: 48 }}>
            <p style={{ fontFamily: monoFont, fontSize: 13 }}>No messages yet</p>
            <p style={{ fontSize: 14, marginTop: 8 }}>Start a conversation with your health assistant</p>
          </div>
        )}

        {messages.map((message) => (
          <motion.div
            key={message.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              marginBottom: 24,
              display: 'flex',
              flexDirection: 'column',
              alignItems: message.role === 'user' ? 'flex-end' : 'flex-start',
            }}
          >
            <div
              style={{
                maxWidth: '70%',
                padding: '12px 16px',
                borderRadius: 12,
                background: message.role === 'user' ? BLUE : '#fff',
                color: message.role === 'user' ? '#fff' : NAVY,
                border: message.role === 'user' ? 'none' : '1px solid #e0e0f0',
              }}
            >
              <p style={{ margin: 0, fontSize: 14, whiteSpace: 'pre-wrap' }}>{message.content}</p>
            </div>
            
            {/* Thinking box for assistant */}
            {message.role === 'assistant' && message.thinking && (
              <div
                style={{
                  marginTop: 8,
                  maxWidth: '70%',
                  padding: '8px 12px',
                  borderRadius: 8,
                  background: LIGHT_BLUE,
                  border: '1px solid #e0e0f0',
                  fontSize: 12,
                  color: MUTED,
                }}
              >
                <p style={{ margin: 0, fontFamily: monoFont, fontSize: 10, textTransform: 'uppercase', marginBottom: 4 }}>
                  Thinking...
                </p>
                <p style={{ margin: 0, fontSize: 12, whiteSpace: 'pre-wrap' }}>{message.thinking}</p>
              </div>
            )}
          </motion.div>
        ))}

        {/* Streaming response */}
        {loading && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            style={{ marginBottom: 24 }}
          >
            <div
              style={{
                maxWidth: '70%',
                padding: '12px 16px',
                borderRadius: 12,
                background: '#fff',
                border: '1px solid #e0e0f0',
              }}
            >
              {streamingContent ? (
                <p style={{ margin: 0, fontSize: 14, whiteSpace: 'pre-wrap' }}>{streamingContent}</p>
              ) : (
                <p style={{ margin: 0, fontSize: 14, color: MUTED }}>Thinking...</p>
              )}
            </div>
            
            {/* Streaming thinking */}
            {streamingThinking && (
              <div
                style={{
                  marginTop: 8,
                  maxWidth: '70%',
                  padding: '8px 12px',
                  borderRadius: 8,
                  background: LIGHT_BLUE,
                  border: '1px solid #e0e0f0',
                }}
              >
                <p style={{ margin: 0, fontFamily: monoFont, fontSize: 10, textTransform: 'uppercase', color: MUTED }}>
                  Thinking...
                </p>
                <p style={{ margin: '4px 0 0 0', fontSize: 12, whiteSpace: 'pre-wrap', color: MUTED }}>
                  {streamingThinking}
                </p>
              </div>
            )}
          </motion.div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div style={{ padding: '16px 32px 24px', borderTop: '1px solid #e0e0f0' }}>
        <div
          style={{
            display: 'flex',
            gap: 12,
            background: '#fff',
            border: '1px solid #e0e0f0',
            borderRadius: 12,
            padding: 4,
          }}
        >
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Tell me about your symptoms..."
            disabled={loading}
            style={{
              flex: 1,
              border: 'none',
              padding: '12px 16px',
              fontSize: 14,
              fontFamily: sansFont,
              resize: 'none',
              outline: 'none',
              background: 'transparent',
            }}
            rows={1}
          />
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleSend}
            disabled={!input.trim() || loading}
            style={{
              padding: '12px 24px',
              background: input.trim() && !loading ? BLUE : MUTED,
              border: 'none',
              borderRadius: 8,
              color: '#fff',
              fontFamily: monoFont,
              fontWeight: 700,
              fontSize: 11,
              letterSpacing: '0.1em',
              cursor: input.trim() && !loading ? 'pointer' : 'not-allowed',
            }}
          >
            SEND
          </motion.button>
        </div>
      </div>
    </div>
  )
}