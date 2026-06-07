import { motion } from 'framer-motion'
import { BLUE, MUTED, NAVY, monoFont, sansFont } from '../../theme'

interface CanvasToolbarProps {
  cardCount: number
  addOpen: boolean
  onToggleAdd: () => void
  onClear: () => void
}

/**
 * Floating top-left toolbar — the only "header" on the page. Contains
 * the title, the `+ Add Card` toggle, and the `Clear All` button.
 * The `Generate Outcomes` button is its own floating pill in the
 * bottom-right of the page (see `StartSimulation.tsx`).
 */
export default function CanvasToolbar({
  cardCount,
  addOpen,
  onToggleAdd,
  onClear,
}: CanvasToolbarProps) {
  return (
    <div
      style={{
        position: 'absolute',
        top: 16,
        left: 16,
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 12px',
        background: 'rgba(255,255,255,0.92)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        border: '1px solid #e0e0f0',
        borderRadius: 8,
        boxShadow: '0 4px 14px rgba(10,10,92,0.06)',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.15, paddingRight: 8 }}>
        <span
          style={{
            fontFamily: monoFont,
            fontSize: 9,
            letterSpacing: '0.18em',
            color: MUTED,
            textTransform: 'uppercase',
          }}
        >
          Scenario Builder
        </span>
        <span
          style={{
            fontFamily: sansFont,
            fontSize: 14,
            fontWeight: 700,
            color: NAVY,
            letterSpacing: '0.02em',
          }}
        >
          MedLifeSim
        </span>
      </div>

      <Divider />

      <motion.button
        type="button"
        onClick={onToggleAdd}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        style={{
          height: 30,
          padding: '0 12px',
          background: addOpen ? BLUE : 'transparent',
          color: addOpen ? '#fff' : BLUE,
          border: '1.5px solid ' + BLUE,
          borderRadius: 6,
          fontFamily: monoFont,
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        <span style={{ fontSize: 14, lineHeight: 1, marginTop: -1 }}>+</span>
        {addOpen ? 'Close' : 'Add Card'}
      </motion.button>

      <motion.button
        type="button"
        onClick={onClear}
        disabled={cardCount === 0}
        whileHover={cardCount > 0 ? { scale: 1.05 } : undefined}
        whileTap={cardCount > 0 ? { scale: 0.95 } : undefined}
        title="Clear all cards"
        aria-label="Clear all cards"
        style={{
          height: 30,
          width: 30,
          padding: 0,
          background: 'transparent',
          color: cardCount === 0 ? '#d0d0e8' : MUTED,
          border: '1px solid ' + (cardCount === 0 ? '#e8e8f0' : '#e0e0f0'),
          borderRadius: 6,
          fontFamily: monoFont,
          fontSize: 16,
          lineHeight: 1,
          cursor: cardCount > 0 ? 'pointer' : 'not-allowed',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        ×
      </motion.button>
    </div>
  )
}

function Divider() {
  return <div style={{ width: 1, height: 24, background: '#e0e0f0' }} />
}
