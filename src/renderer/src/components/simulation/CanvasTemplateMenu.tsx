import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { BLUE, MUTED, NAVY, monoFont, sansFont } from '../../theme'
import { SIM_TEMPLATES } from '../../data/simulationTemplates'
import type { SimTemplate } from '../../types/simulation'

interface CanvasTemplateMenuProps {
  /** Fires when the user picks a template (after the parent's confirm). */
  onPick: (template: SimTemplate) => void
  /** Fires when the user picks "Blank Canvas". */
  onBlank: () => void
}

// Group templates by category
type TemplateCategory = 'Community' | 'Workplace' | 'Hospital'

const TEMPLATE_CATEGORIES: Record<TemplateCategory, SimTemplate[]> = {
  Community: SIM_TEMPLATES.filter(t =>
    ['teen-drugs', 'school-outbreak', 'urban-metabolic'].includes(t.id)
  ),
  Workplace: SIM_TEMPLATES.filter(t => t.id === 'office-smoke'),
  Hospital: SIM_TEMPLATES.filter(t => t.id === 'emergency-transfusion'),
}

const CATEGORY_LABELS: Record<TemplateCategory, string> = {
  Community: 'Community',
  Workplace: 'Workplace',
  Hospital: 'Hospital',
}

/**
 * Small dropdown menu anchored to the toolbar's "New Scenario ▾" button.
 * Exposes "Blank Canvas" plus every entry in `SIM_TEMPLATES` grouped by category.
 * The parent owns the confirm-and-apply flow — this component only reports
 * the user's choice.
 */
export default function CanvasTemplateMenu({ onPick, onBlank }: CanvasTemplateMenuProps) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  // Close on outside click.
  useEffect(() => {
    if (!open) return
    function onDocPointer(e: PointerEvent) {
      if (!wrapRef.current) return
      if (!wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onDocPointer)
    return () => document.removeEventListener('pointerdown', onDocPointer)
  }, [open])

  // Close on Esc.
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        setOpen(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <div
      ref={wrapRef}
      style={{ display: 'flex', alignItems: 'center', gap: 4, position: 'relative' }}
    >
      <motion.button
        type="button"
        onClick={() => setOpen((v) => !v)}
        onPointerDown={(e) => e.stopPropagation()}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        aria-haspopup="menu"
        aria-expanded={open}
        style={{
          height: 30,
          padding: '0 12px',
          background: 'transparent',
          color: BLUE,
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
        New
        <span style={{ fontSize: 9, marginTop: -1, opacity: 0.8 }}>▾</span>
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            key="menu"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.12 }}
            role="menu"
            style={{
              position: 'absolute',
              top: 36,
              left: 0,
              minWidth: 280,
              background: '#fff',
              border: '1px solid #e0e0f0',
              borderRadius: 8,
              boxShadow: '0 12px 32px rgba(10,10,92,0.18)',
              padding: 6,
              zIndex: 110,
            }}
          >
            <MenuItem
              label="Blank Canvas"
              description="Start with an empty stage."
              onClick={() => {
                onBlank()
                setOpen(false)
              }}
            />
            <div style={{ height: 1, background: '#eeeef8', margin: '4px 6px' }} />

            {/* Template categories */}
            {(Object.keys(TEMPLATE_CATEGORIES) as TemplateCategory[]).map((category) => (
              <div key={category}>
                <div
                  style={{
                    padding: '6px 10px 2px',
                    fontFamily: monoFont,
                    fontSize: 10,
                    fontWeight: 700,
                    color: MUTED,
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                  }}
                >
                  {CATEGORY_LABELS[category]}
                </div>
                {TEMPLATE_CATEGORIES[category].map((t) => (
                  <MenuItem
                    key={t.id}
                    label={t.name}
                    description={t.description}
                    onClick={() => {
                      onPick(t)
                      setOpen(false)
                    }}
                  />
                ))}
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

interface MenuItemProps {
  label: string
  description: string
  onClick: () => void
}

function MenuItem({ label, description, onClick }: MenuItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      role="menuitem"
      style={{
        display: 'block',
        width: '100%',
        textAlign: 'left',
        padding: '8px 10px',
        background: 'transparent',
        border: 'none',
        borderRadius: 6,
        cursor: 'pointer',
        fontFamily: sansFont,
        color: NAVY,
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = '#f7f7fc')}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
    >
      <span
        style={{
          display: 'block',
          fontSize: 13,
          fontWeight: 600,
        }}
      >
        {label}
      </span>
      <span
        style={{
          display: 'block',
          fontSize: 11,
          color: MUTED,
          marginTop: 2,
        }}
      >
        {description}
      </span>
    </button>
  )
}