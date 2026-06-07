import { useEffect, useMemo, useRef, useState } from 'react'
import { BLUE, MUTED, NAVY, monoFont, sansFont } from '../../theme'
import {
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  PALETTE_CARDS,
  TONE_COLORS,
} from '../../data/simulationCards'

const CATEGORY_DESCRIPTIONS: Record<string, string> = {
  environment: 'Where risk originates',
  subject: 'Who is affected',
  exposure: 'How they are exposed',
  'health-state': 'What condition they are in',
  intervention: 'What actions change outcome',
}
import type { SimCardTemplate } from '../../types/simulation'

interface AddCardPopoverProps {
  open: boolean
  onPick: (template: SimCardTemplate) => void
  onClose: () => void
}

/**
 * Floating panel that lists every palette card grouped by category. A
 * search input at the top filters all groups live. Click a tile to
 * pick — the parent closes the popover and drops the card on the
 * canvas.
 */
export default function AddCardPopover({ open, onPick, onClose }: AddCardPopoverProps) {
  const [query, setQuery] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Focus the search input when the popover opens.
  useEffect(() => {
    if (open) {
      // Slight delay so the panel finishes its mount transition.
      const t = setTimeout(() => inputRef.current?.focus(), 50)
      return () => clearTimeout(t)
    }
    setQuery('')
    return undefined
  }, [open])

  // Click-outside + Escape to close.
  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  const filteredByCategory = useMemo(() => {
    const q = query.trim().toLowerCase()
    const out: Record<string, SimCardTemplate[]> = {}
    for (const cat of CATEGORY_ORDER) {
      out[cat] = PALETTE_CARDS.filter(
        (c) =>
          c.category === cat &&
          (q === '' ||
            c.title.toLowerCase().includes(q) ||
            c.subtitle.toLowerCase().includes(q) ||
            c.badge.toLowerCase().includes(q)),
      )
    }
    return out
  }, [query])

  if (!open) return null

  return (
    <div
      ref={containerRef}
      style={{
        position: 'absolute',
        top: 64,
        left: 16,
        width: 360,
        maxHeight: 'calc(100vh - 96px)',
        background: '#fff',
        border: '1px solid #e0e0f0',
        borderRadius: 8,
        boxShadow: '0 12px 32px rgba(10,10,92,0.14)',
        zIndex: 200,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          padding: '10px 12px',
          borderBottom: '1px solid #e0e0f0',
          background: '#fafaff',
        }}
      >
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search cards…"
          style={{
            width: '100%',
            padding: '8px 10px',
            border: '1px solid #d0d0e8',
            borderRadius: 6,
            fontFamily: sansFont,
            fontSize: 13,
            color: NAVY,
            background: '#fff',
            outline: 'none',
            boxSizing: 'border-box',
          }}
        />
      </div>

      <div style={{ overflowY: 'auto', padding: '8px 12px 16px' }}>
        {CATEGORY_ORDER.map((cat) => {
          const items = filteredByCategory[cat]
          if (!items || items.length === 0) return null
          return (
            <section key={cat} style={{ marginTop: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <p
                  style={{
                    fontFamily: monoFont,
                    fontSize: 10,
                    letterSpacing: '0.14em',
                    color: MUTED,
                    textTransform: 'uppercase',
                    margin: 0,
                  }}
                >
                  {CATEGORY_LABELS[cat]}
                </p>
                <span style={{ color: '#d0d0e8', fontSize: 10 }}>·</span>
                <p
                  style={{
                    fontFamily: sansFont,
                    fontSize: 10,
                    color: '#b0b0cc',
                    margin: 0,
                  }}
                >
                  {CATEGORY_DESCRIPTIONS[cat]}
                </p>
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 6,
                }}
              >
                {items.map((c) => (
                  <PopoverTile
                    key={c.id}
                    template={c}
                    onClick={() => {
                      onPick(c)
                    }}
                  />
                ))}
              </div>
            </section>
          )
        })}

        {CATEGORY_ORDER.every((c) => (filteredByCategory[c] ?? []).length === 0) && (
          <p
            style={{
              fontFamily: sansFont,
              fontSize: 12,
              color: MUTED,
              textAlign: 'center',
              margin: '20px 0',
            }}
          >
            No cards match “{query}”.
          </p>
        )}
      </div>
    </div>
  )
}

function PopoverTile({
  template,
  onClick,
}: {
  template: SimCardTemplate
  onClick: () => void
}) {
  const accent = TONE_COLORS[template.tone]
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        background: '#fff',
        border: '1px solid #e0e0f0',
        borderLeft: '3px solid ' + accent,
        borderRadius: 6,
        padding: '8px 10px',
        textAlign: 'left',
        cursor: 'pointer',
        fontFamily: 'inherit',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        gap: 3,
      }}
    >
      <span
        style={{
          fontFamily: monoFont,
          fontSize: 8,
          letterSpacing: '0.12em',
          color: MUTED,
          textTransform: 'uppercase',
        }}
      >
        {template.badge}
      </span>
      <span
        style={{
          fontFamily: sansFont,
          fontSize: 12,
          fontWeight: 600,
          color: NAVY,
          lineHeight: 1.2,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {template.title}
      </span>
    </button>
  )
}

/** Inline reference to keep linter happy if `BLUE` is ever unused. */
export const _BLUE_REF = BLUE
