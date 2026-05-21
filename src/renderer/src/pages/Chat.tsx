import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useProfile } from '../context/ProfileContext'

const BLUE = '#1A1AE8' 
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

interface Session {
  slug: string
  name: string
  createdAt: string
  messageCount: number
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontFamily: monoFont, fontSize: 11, letterSpacing: '0.14em', color: MUTED, textTransform: 'uppercase', marginBottom: 8 }}>
      {children}
    </p>
  )
}

export default function Chat() {
  const { profile } = useProfile()
  const [searchParams, setSearchParams] = useSearchParams()
  const sessionSlug = searchParams.get('session') || 'main'
  
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [streamingContent, setStreamingContent] = useState('')
  const [streamingThinking, setStreamingThinking] = useState('')
  const [sessions, setSessions] = useState<Session[]>([])
  const [showSessionDropdown, setShowSessionDropdown] = useState(false)
  const [showNewSessionModal, setShowNewSessionModal] = useState(false)
  const [newSessionName, setNewSessionName] = useState('')
  
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Load sessions for dropdown
  useEffect(() => {
    if (!profile) return
    
    const loadSessions = async () => {
      try {
        const list = await window.api.sessions.list(profile.id)
        setSessions(list)
      } catch (error) {
        console.error('Failed to load sessions:', error)
      }
    }
    
    loadSessions()
  }, [profile, sessionSlug])

  // Load messages for session
  useEffect(() => {
    if (!profile) return

    const loadMessages = async () => {
      try {
        const msgs = await window.api.sessions.loadMessages(profile.id, sessionSlug)
        setMessages(msgs)
      } catch (error) {
        console.error('Failed to load messages:', error)
      }
    }

    loadMessages()
  }, [profile, sessionSlug])

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

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowSessionDropdown(false)
      }
    }
    
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSessionChange = (slug: string) => {
    setSearchParams({ session: slug })
    setShowSessionDropdown(false)
  }

  const handleCreateSession = async () => {
    if (!newSessionName.trim() || !profile) return

    // Convert name to slug
    const slug = newSessionName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')

    try {
      await window.api.sessions.create(profile.id, slug)
      setNewSessionName('')
      setShowNewSessionModal(false)
      setShowSessionDropdown(false)
      
      // Refresh sessions list and navigate to new session
      const list = await window.api.sessions.list(profile.id)
      setSessions(list)
      setSearchParams({ session: slug })
    } catch (error) {
      console.error('Failed to create session:', error)
    }
  }

  const handleSend = async () => {
    if (!input.trim() || loading || !profile) return

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
      // Pass profile context for AI system prompt
      const profileContext = profile ? {
        name: profile.name,
        type: profile.type,
        age: profile.age,
        gender: profile.gender,
      } : undefined
      
      await window.api.ai.sendMessage(profile.id, sessionSlug, userMessage.content, history, profileContext)
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

  const currentSessionName = sessions.find(s => s.slug === sessionSlug)?.name || sessionSlug

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', fontFamily: sansFont }}>
      {/* Header */}
      <div style={{ padding: '24px 32px', borderBottom: '1px solid #e0e0f0' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <SectionLabel>Chat</SectionLabel>
            <h1 style={{ fontFamily: sansFont, fontSize: 28, fontWeight: 300, color: NAVY, margin: 0, lineHeight: 1.2 }}>
              <strong style={{ fontWeight: 500 }}>{currentSessionName}</strong>
            </h1>
          </div>
          
          {/* Session Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {/* New Session Button - Left of dropdown */}
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                setNewSessionName('')
                setShowNewSessionModal(true)
              }}
              style={{
                padding: '10px 16px',
                background: BLUE,
                border: 'none',
                borderRadius: 8,
                color: '#fff',
                fontFamily: monoFont,
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.06em',
                cursor: 'pointer',
              }}
            >
              + NEW SESSION
            </motion.button>
            
            {/* Session Dropdown */}
            <div ref={dropdownRef} style={{ position: 'relative' }}>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setShowSessionDropdown(!showSessionDropdown)}
                style={{
                  padding: '10px 16px',
                  background: '#fff',
                  border: '1px solid #e0e0f0',
                  borderRadius: 8,
                  color: NAVY,
                  fontFamily: monoFont,
                  fontSize: 11,
                  letterSpacing: '0.06em',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                SESSIONS
                <span style={{ fontSize: 10 }}>{showSessionDropdown ? '▲' : '▼'}</span>
              </motion.button>
              
              {showSessionDropdown && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  style={{
                    position: 'absolute',
                    top: '100%',
                    right: 0,
                    marginTop: 8,
                    background: '#fff',
                    border: '1px solid #e0e0f0',
                    borderRadius: 8,
                    minWidth: 220,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                    zIndex: 100,
                    overflow: 'hidden',
                  }}
                >
                  {/* Session List */}
                  {sessions.map((session) => (
                    <div
                      key={session.slug}
                      onClick={() => handleSessionChange(session.slug)}
                      style={{
                        padding: '12px 16px',
                        cursor: 'pointer',
                        background: session.slug === sessionSlug ? LIGHT_BLUE : 'transparent',
                        borderBottom: '1px solid #f0f0f0',
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = LIGHT_BLUE}
                      onMouseLeave={(e) => e.currentTarget.style.background = session.slug === sessionSlug ? LIGHT_BLUE : 'transparent'}
                    >
                      <span style={{ fontFamily: sansFont, fontSize: 13, color: NAVY }}>
                        {session.name}
                      </span>
                    </div>
                  ))}
                </motion.div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* New Session Modal */}
      {showNewSessionModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 200,
          }}
          onClick={() => setShowNewSessionModal(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#fff',
              borderRadius: 12,
              padding: 24,
              width: 360,
            }}
          >
            <h3 style={{ fontFamily: sansFont, fontSize: 18, fontWeight: 500, color: NAVY, margin: '0 0 16px 0' }}>
              New Session
            </h3>
            <input
              id="modal-session-input"
              type="text"
              value={newSessionName}
              onChange={(e) => setNewSessionName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreateSession()}
              placeholder="Session name"
              style={{
                width: '100%',
                padding: '12px 16px',
                border: '1px solid #e0e0f0',
                borderRadius: 8,
                fontSize: 14,
                fontFamily: sansFont,
                outline: 'none',
                marginBottom: 16,
              }}
            />
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowNewSessionModal(false)}
                style={{
                  padding: '10px 20px',
                  background: '#fff',
                  border: '1px solid #e0e0f0',
                  borderRadius: 8,
                  color: MUTED,
                  fontFamily: monoFont,
                  fontSize: 11,
                  cursor: 'pointer',
                }}
              >
                CANCEL
              </button>
              <button
                onClick={handleCreateSession}
                style={{
                  padding: '10px 20px',
                  background: newSessionName.trim() ? BLUE : MUTED,
                  border: 'none',
                  borderRadius: 8,
                  color: '#fff',
                  fontFamily: monoFont,
                  fontWeight: 700,
                  fontSize: 11,
                  cursor: newSessionName.trim() ? 'pointer' : 'not-allowed',
                }}
              >
                CREATE
              </button>
            </div>
          </div>
        </div>
      )}

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
            {/* Thinking box for assistant - ABOVE response */}
            {message.role === 'assistant' && message.thinking && (
              <div
                style={{
                  marginBottom: 8,
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
                <p style={{ margin: 0, fontSize: 12, whiteSpace: 'pre-wrap' }}>{message.thinking.trimStart()}</p>
              </div>
            )}
            
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
              <p style={{ margin: 0, fontSize: 14, whiteSpace: 'pre-wrap' }}>{message.content.trimStart()}</p>
            </div>
          </motion.div>
        ))}

        {/* Streaming response */}
        {loading && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            style={{ marginBottom: 24 }}
          >
            {/* Streaming thinking - ABOVE response */}
            {streamingThinking && (
              <div
                style={{
                  marginBottom: 8,
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
                  {streamingThinking.trimStart()}
                </p>
              </div>
            )}
            
            {/* Response content */}
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
                <p style={{ margin: 0, fontSize: 14, whiteSpace: 'pre-wrap' }}>{streamingContent.trimStart()}</p>
              ) : (
                <p style={{ margin: 0, fontSize: 14, color: MUTED }}>Thinking...</p>
              )}
            </div>
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