import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useProfile } from '../context/ProfileContext'
import { useAI } from '../context/AIContext'
import PageWrapper from '../components/PageWrapper'
import { BLUE, NAVY, MUTED, LIGHT_BLUE, monoFont, sansFont } from '../theme'

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

export default function Chat() {
  const { profile } = useProfile()
  const { isReady, progress } = useAI()
  const [searchParams, setSearchParams] = useSearchParams()
  const sessionSlug = searchParams.get('session') || 'main'
  
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [streamingContent, setStreamingContent] = useState('')
  const [streamingThinking, setStreamingThinking] = useState('')
  const [sessions, setSessions] = useState<Session[]>([])
  const [showSessionDropdown, setShowSessionDropdown] = useState(false)
  
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

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

  useEffect(() => {
    const unsubToken = window.api.ai.onStreamToken((token) => {
      setStreamingContent((prev) => prev + token)
    })

    const unsubThinking = window.api.ai.onStreamThinking((thinking) => {
      setStreamingThinking((prev) => prev + thinking)
    })

    const unsubDone = window.api.ai.onStreamDone(() => {
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

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingContent])

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
    if (!profile) return

    const slug = `session-${Math.floor(Date.now() / 1000)}`

    try {
      await window.api.sessions.create(profile.id, slug)
      setShowSessionDropdown(false)
      
      const list = await window.api.sessions.list(profile.id)
      setSessions(list)
      setSearchParams({ session: slug })
    } catch (error) {
      console.error('Failed to create session:', error)
    }
  }

  const handleSend = async () => {
    if (!input.trim() || loading || !profile || !isReady) return

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

    const history = messages.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      timestamp: m.timestamp,
    }))

    try {
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

  const buttons = (
    <>
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={() => { void handleCreateSession() }}
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
    </>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', fontFamily: sansFont }}>
      <PageWrapper title={currentSessionName} category="Chat" buttons={buttons}>
        {/* Messages */}
        <div style={{ flex: 1, overflow: 'auto', padding: '24px 0' , borderTop: '1px solid #e0e0f0'}}>
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

          {loading && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              style={{ marginBottom: 24 }}
            >
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
        <div style={{ padding: '16px 0 0', borderTop: '1px solid #e0e0f0' }}>
          {!isReady && (
            <p
              style={{
                fontFamily: monoFont,
                fontSize: 11,
                color: MUTED,
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                textAlign: 'center',
                marginBottom: 8,
              }}
            >
              {progress
                ? `${progress.phase === 'downloading' ? 'Downloading' : 'Loading'} model… ${Math.round(progress.percentage)}%`
                : 'Model not ready — pick one from the model screen.'}
            </p>
          )}
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
              placeholder={isReady ? 'Tell me about your symptoms...' : 'Waiting for model to load…'}
              disabled={loading || !isReady}
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
              disabled={!input.trim() || loading || !isReady}
              style={{
                padding: '12px 24px',
                background: input.trim() && !loading && isReady ? BLUE : MUTED,
                border: 'none',
                borderRadius: 8,
                color: '#fff',
                fontFamily: monoFont,
                fontWeight: 700,
                fontSize: 11,
                letterSpacing: '0.1em',
                cursor: input.trim() && !loading && isReady ? 'pointer' : 'not-allowed',
              }}
            >
              SEND
            </motion.button>
          </div>
        </div>
      </PageWrapper>
    </div>
  )
}
