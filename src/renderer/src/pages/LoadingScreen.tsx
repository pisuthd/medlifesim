import { useState, useEffect } from 'react'

const BLUE = '#1A1AE8'
const TEAL = '#3EC4C0'
const NAVY = '#0a0a5c'
const MUTED = '#9999bb'

const monoFont = "'Space Mono', monospace"
const sansFont = "'DM Sans', sans-serif"

type LoadingState = 'checking' | 'loading' | 'ready'

interface AIStatus {
  isReady: boolean
  modelName: string
  uptime: number
  downloading: boolean
  downloadProgress: number
}

export default function LoadingScreen({ onComplete }: { onComplete: () => void }) {
  const [state, setState] = useState<LoadingState>('checking')
  const [progress, setProgress] = useState(0)
  const [statusText, setStatusText] = useState('Checking model...')

  useEffect(() => {
    let isMounted = true
    let pollInterval: NodeJS.Timeout | null = null

    const checkStatus = async () => {
      try {
        const status: AIStatus = await window.api.ai.getStatus()
        
        if (!isMounted) return
        
        // Update progress based on status
        if (status.isReady) {
          setProgress(100)
          setStatusText('Ready')
          setState('ready')
          
          // Cleanup
          if (pollInterval) clearInterval(pollInterval)
          
          // Complete after short delay
          setTimeout(() => {
            if (isMounted) onComplete()
          }, 400)
          return
        }
        
        // Model is loading
        if (state !== 'loading') {
          setState('loading')
        }
        
        // Calculate progress based on download or simulated loading
        let newProgress = 0
        if (status.downloading) {
          newProgress = status.downloadProgress
          setStatusText(`Downloading MedPsy 1.7B... ${status.downloadProgress}%`)
        } else {
          // Simulate gradual progress during model loading
          newProgress = Math.min(progress + Math.random() * 5, 90)
          setStatusText('Loading AI model...')
        }
        setProgress(newProgress)
        
      } catch (error) {
        if (isMounted) {
          setStatusText('Error checking status')
        }
      }
    }

    // Start polling
    checkStatus()
    pollInterval = setInterval(checkStatus, 500)

    return () => {
      isMounted = false
      if (pollInterval) clearInterval(pollInterval)
    }
  }, [onComplete, progress, state])

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#fff',
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        paddingLeft: '56px',
      }}
    >
      {/* Teal block — top-right, behind blue */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          right: '180px',
          width: '240px',
          height: '200px',
          background: TEAL,
          zIndex: 1,
        }}
      />

      {/* Small blue cap — top-right corner */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          width: '180px',
          height: '100px',
          background: BLUE,
          zIndex: 3,
        }}
      />

      {/* Large blue block — steps forward and down */}
      <div
        style={{
          position: 'absolute',
          top: '100px',
          right: 0,
          width: '360px',
          height: '280px',
          background: BLUE,
          zIndex: 2,
        }}
      />

      {/* Teal left-edge accent bar */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          width: '4px',
          height: '80px',
          background: TEAL,
          zIndex: 5,
        }}
      />

      {/* Content */}
      <div style={{ position: 'relative', zIndex: 10 }}>
        {/* Wordmark */}
        <p
          style={{
            fontFamily: monoFont,
            fontWeight: 700,
            fontSize: '28px',
            letterSpacing: '0.04em',
            color: BLUE,
            marginBottom: '48px',
          }}
        >
          <span style={{ color: NAVY }}>My</span>DoctorAI
        </p>

        {/* App label */}
        <p
          style={{
            fontSize: '11px',
            fontWeight: 500,
            letterSpacing: '0.18em',
            color: MUTED,
            textTransform: 'uppercase',
            marginBottom: '10px',
          }}
        >
          Private & On-Device AI
        </p>

        {/* App title */}
        <h1
          style={{
            fontSize: '32px',
            fontWeight: 300,
            color: NAVY,
            letterSpacing: '-0.02em',
            lineHeight: 1.15,
            marginBottom: '40px',
          }}
        >
          <strong style={{ fontWeight: 500 }}>Your Health Assistant</strong>
          <br />
          At Home
        </h1>

        {/* Progress bar */}
        <div style={{ width: '260px' }}>
          <div
            style={{
              width: '100%',
              height: '2px',
              background: '#e8e8f0',
              position: 'relative',
              marginBottom: '14px',
            }}
          >
            <div
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                height: '100%',
                width: `${Math.min(progress, 100)}%`,
                background: BLUE,
                transition: 'width 0.3s ease-out',
              }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span
              style={{
                fontSize: '12px',
                color: MUTED,
                letterSpacing: '0.06em',
              }}
            >
              {statusText}
            </span>
            <span
              style={{
                fontFamily: monoFont,
                fontSize: '13px',
                fontWeight: 700,
                color: BLUE,
              }}
            >
              {Math.round(Math.min(progress, 100))}%
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}