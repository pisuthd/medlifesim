import { useState, useEffect } from 'react'

export default function LoadingScreen({ onComplete }: { onComplete: () => void }) {
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval)
          setTimeout(onComplete, 400)
          return 100
        }
        return prev + Math.random() * 15
      })
    }, 200)
    return () => clearInterval(interval)
  }, [onComplete])

  const statusLabel =
    progress < 40 ? 'Initializing 1.0.0-beta.1' : progress < 80 ? 'Loading QVAC MedPsy' : 'Ready'

  return (
    <div
      className="min-h-screen bg-white relative overflow-hidden flex items-center"
      style={{ paddingLeft: '56px' }}
    >
      {/* Teal block — top-right, behind blue */}
      <div
        className="absolute"
        style={{
          top: 0,
          right: '180px',
          width: '240px',
          height: '200px',
          backgroundColor: '#3EC4C0',
          zIndex: 1,
        }}
      />

      {/* Small blue cap — top-right corner */}
      <div
        className="absolute"
        style={{
          top: 0,
          right: 0,
          width: '180px',
          height: '100px',
          backgroundColor: '#1A1AE8',
          zIndex: 3,
        }}
      />

      {/* Large blue block — steps forward and down */}
      <div
        className="absolute"
        style={{
          top: '100px',
          right: 0,
          width: '360px',
          height: '280px',
          backgroundColor: '#1A1AE8',
          zIndex: 2,
        }}
      />

      {/* Teal left-edge accent bar */}
      <div
        className="absolute bottom-0 left-0"
        style={{ width: '4px', height: '80px', backgroundColor: '#3EC4C0', zIndex: 5 }}
      />

      {/* ── Content ── */}
      <div className="relative" style={{ zIndex: 10 }}>
        {/* Wordmark */}
        <p
          style={{
            fontFamily: "'Space Mono', monospace",
            fontWeight: 700,
            fontSize: '28px',
            letterSpacing: '0.04em',
            color: '#1A1AE8',
            marginBottom: '48px',
          }}
        >
          <span style={{ color: '#0a0a5c' }}>My</span>DoctorAI
        </p>

        {/* App label */}
        <p
          style={{
            fontSize: '11px',
            fontWeight: 500,
            letterSpacing: '0.18em',
            color: '#9999bb',
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
            color: '#0a0a5c',
            letterSpacing: '-0.02em',
            lineHeight: 1.15,
            marginBottom: '40px',
          }}
        >
          <strong style={{ fontWeight: 500 }}>Your Health Assitant</strong>
          <br />
          At Home
        </h1>

        {/* Progress bar */}
        <div style={{ width: '260px' }}>
          <div
            style={{
              width: '100%',
              height: '2px',
              backgroundColor: '#e8e8f0',
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
                backgroundColor: '#1A1AE8',
                transition: 'width 0.3s ease-out',
              }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span
              style={{
                fontSize: '12px',
                color: '#9999bb',
                letterSpacing: '0.06em',
              }}
            >
              {statusLabel}
            </span>
            <span
              style={{
                fontFamily: "'Space Mono', monospace",
                fontSize: '13px',
                fontWeight: 700,
                color: '#1A1AE8',
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