import { motion } from 'framer-motion'
import { BLUE, MUTED, NAVY, monoFont, sansFont } from '../../theme'
import CanvasTemplateMenu from './CanvasTemplateMenu'
import type { SimTemplate } from '../../types/simulation'

interface CanvasToolbarProps {
  cardCount: number
  addOpen: boolean
  /** Display name for the scenario (used in the clickable title). */
  scenarioName?: string
  onToggleAdd: () => void
  /** Fires when the user clicks Reset — the parent owns the confirm flow. */
  onRequestReset: () => void
  /** Fires when the user picks a template from the MedLifeSim dropdown. */
  onPickTemplate: (template: SimTemplate) => void
  /** Fires when the user picks "Blank Canvas" from the MedLifeSim dropdown. */
  onPickBlank: () => void
  /** Fires when the user clicks the scenario title (opens edit modal). */
  onEditScenario?: () => void
}

/**
 * Floating top-left toolbar — the only "header" on the page. Contains
 * the title, the MedLifeSim template dropdown, the `+ Add Card` toggle,
 * and the `Clear All` button. The `Generate Outcomes` button is its
 * own floating pill in the bottom-right of the page (see
 * `StartSimulation.tsx`).
 */
export default function CanvasToolbar({
  cardCount,
  addOpen,
  scenarioName,
  onToggleAdd,
  onRequestReset,
  onPickTemplate,
  onPickBlank,
  onEditScenario,
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
      <button
        type="button"
        onClick={onEditScenario}
        style={{
          display: 'flex',
          flexDirection: 'column',
          lineHeight: 1.15,
          paddingRight: 8,
          background: 'none',
          border: 'none',
          cursor: onEditScenario ? 'pointer' : 'default',
          textAlign: 'left',
        }}
      >
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
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <span
            style={{
              fontFamily: sansFont,
              fontSize: 14,
              fontWeight: 700,
              color: NAVY,
              letterSpacing: '0.02em',
            }}
          >
            {scenarioName && scenarioName.trim() ? scenarioName : 'MedLifeSim'}
          </span>
          {onEditScenario && (
            <span
              style={{
                fontFamily: monoFont,
                fontSize: 10,
                color: MUTED,
              }}
            >
              ▾
            </span>
          )}
        </span>
      </button>

      <CanvasTemplateMenu onPick={onPickTemplate} onBlank={onPickBlank} />

      <Divider />

      <motion.button
        type="button"
        onClick={onToggleAdd}
        // Stop pointerdown from reaching the window: the AddCardPopover
        // listens for window mousedown to close itself, and pointerdown
        // fires before mousedown — without this, clicking "Close" would
        // close the popover via the window listener and then the button's
        // own onClick would toggle it right back open.
        onPointerDown={(e) => e.stopPropagation()}
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
        Add
      </motion.button>

      <motion.button
        type="button"
        onClick={onRequestReset}
        disabled={cardCount === 0}
        whileHover={cardCount > 0 ? { scale: 1.05 } : undefined}
        whileTap={cardCount > 0 ? { scale: 0.95 } : undefined}
        title="Reset canvas"
        aria-label="Reset canvas"
        style={{
          height: 30,
          padding: '0 12px',
          background: 'transparent',
          color: cardCount === 0 ? '#d0d0e8' : MUTED,
          border: '1px solid ' + (cardCount === 0 ? '#e8e8f0' : '#e0e0f0'),
          borderRadius: 6,
          fontFamily: monoFont,
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          cursor: cardCount > 0 ? 'pointer' : 'not-allowed',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        Reset
      </motion.button>
    </div>
  )
}

function Divider() {
  return <div style={{ width: 1, height: 24, background: '#e0e0f0' }} />
}
