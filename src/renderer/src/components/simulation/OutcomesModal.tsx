import { useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { BLUE, MUTED, NAVY, TEAL, monoFont, sansFont } from '../../theme'
import type { OutcomeTone, SimOutcome } from '../../types/simulation'

interface OutcomesModalProps {
  outcomes: SimOutcome[] | null
  onClose: () => void
}

const TONE_TO_COLOR: Record<OutcomeTone, string> = {
  good: TEAL,
  neutral: MUTED,
  bad: BLUE,
}

const TONE_TO_LABEL: Record<OutcomeTone, string> = {
  good: 'Low risk',
  neutral: 'Moderate risk',
  bad: 'High risk',
}

/**
 * Centered modal dialog that previews every outcome enumerated from the
 * connection graph. Backdrop click and Esc both close. Each outcome
 * carries its full path (env → sub → expo → health → int) as a strip at
 * the top of the card, then the existing infection / severe / summary
 * block underneath.
 */
export default function OutcomesModal({ outcomes, onClose }: OutcomesModalProps) {
  const open = outcomes !== null

  // Esc closes — global listener while open.
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={onClose}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(10,10,92,0.45)',
            backdropFilter: 'blur(2px)',
            WebkitBackdropFilter: 'blur(2px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 48,
            zIndex: 200,
          }}
        >
          <motion.section
            initial={{ scale: 0.96, y: 8, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.98, y: 4, opacity: 0 }}
            transition={{ type: 'tween', duration: 0.2, ease: 'easeOut' }}
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '90%',
              maxWidth: 1080,
              maxHeight: '80vh',
              background: '#fff',
              borderRadius: 12,
              boxShadow: '0 20px 60px rgba(10,10,92,0.30)',
              display: 'flex',
              flexDirection: 'column',
              boxSizing: 'border-box',
              overflow: 'hidden',
            }}
          >
            <header
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '14px 20px',
                borderBottom: '1px solid #e0e0f0',
              }}
            >
              <span
                style={{
                  fontFamily: monoFont,
                  fontSize: 11,
                  letterSpacing: '0.16em',
                  color: MUTED,
                  textTransform: 'uppercase',
                }}
              >
                Predicted Outcomes
                {outcomes && outcomes.length > 0 ? ` · ${outcomes.length}` : ''}
              </span>
              <button
                type="button"
                onClick={onClose}
                title="Close"
                aria-label="Close outcomes"
                style={{
                  width: 28,
                  height: 28,
                  padding: 0,
                  background: 'transparent',
                  color: MUTED,
                  border: '1px solid #e0e0f0',
                  borderRadius: 4,
                  fontFamily: monoFont,
                  fontSize: 16,
                  lineHeight: 1,
                  cursor: 'pointer',
                }}
              >
                ×
              </button>
            </header>

            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                overflowX: 'hidden',
                padding: 20,
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                gap: 16,
                alignContent: 'start',
              }}
            >
              {outcomes &&
                outcomes.map((o, i) => <OutcomeCard key={o.id} outcome={o} index={i} />)}
            </div>
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function OutcomeCard({ outcome, index }: { outcome: SimOutcome; index: number }) {
  const accent = TONE_TO_COLOR[outcome.tone]
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, delay: Math.min(index * 0.03, 0.3) }}
      style={{
        background: '#fff',
        border: '1px solid #e0e0f0',
        borderLeft: '3px solid ' + accent,
        borderRadius: 8,
        padding: '14px 16px',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      <PathStrip labels={outcome.pathLabels} />

      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <span
          style={{
            fontFamily: sansFont,
            fontSize: 14,
            fontWeight: 600,
            color: NAVY,
          }}
        >
          {outcome.pathLabels.intervention}
        </span>
        <span
          style={{
            fontFamily: monoFont,
            fontSize: 9,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: accent,
            flexShrink: 0,
          }}
        >
          {TONE_TO_LABEL[outcome.tone]}
        </span>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 12,
        }}
      >
        <Metric label="Infection rate" value={outcome.infectionRate} color={accent} />
        <Metric label="Severe case rate" value={outcome.severeCaseRate} color={accent} />
      </div>

      <p
        style={{
          fontFamily: sansFont,
          fontSize: 12,
          color: NAVY,
          lineHeight: 1.5,
          margin: 0,
          opacity: 0.85,
        }}
      >
        {outcome.summary}
      </p>
    </motion.div>
  )
}

interface PathStripProps {
  labels: SimOutcome['pathLabels']
}

/**
 * Tiny breadcrumb-style strip showing the full causal path through the
 * graph for this outcome. Sits at the top of every outcome card so the
 * user can tell at a glance which combination of inputs the prediction
 * is keyed to.
 */
function PathStrip({ labels }: PathStripProps) {
  const segments: Array<{ tag: string; name: string }> = [
    { tag: 'ENV', name: labels.environment },
    { tag: 'SUBJ', name: labels.subject },
    { tag: 'EXPO', name: labels.exposure },
    { tag: 'HEAL', name: labels.healthState },
    { tag: 'INT', name: labels.intervention },
  ]
  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 4,
        fontFamily: monoFont,
        fontSize: 9,
        letterSpacing: '0.10em',
        textTransform: 'uppercase',
        color: MUTED,
        lineHeight: 1.4,
        paddingBottom: 8,
        borderBottom: '1px dashed #e8e8f0',
      }}
    >
      {segments.map((seg, i) => (
        <span key={seg.tag} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <span style={{ color: BLUE, fontWeight: 700 }}>{seg.tag}</span>
          <span style={{ color: NAVY, textTransform: 'none', letterSpacing: 0 }}>{seg.name}</span>
          {i < segments.length - 1 && <span style={{ color: '#c8c8e0' }}>→</span>}
        </span>
      ))}
    </div>
  )
}

function Metric({
  label,
  value,
  color,
}: {
  label: string
  value: number
  color: string
}) {
  return (
    <div>
      <div
        style={{
          fontFamily: monoFont,
          fontSize: 9,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: MUTED,
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: monoFont,
          fontSize: 18,
          fontWeight: 700,
          color,
          lineHeight: 1,
        }}
      >
        {value}
        <span style={{ fontSize: 12, marginLeft: 2 }}>%</span>
      </div>
    </div>
  )
}
