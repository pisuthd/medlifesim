import { forwardRef, useEffect, useRef, useState } from 'react'
import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { motion } from 'framer-motion'
import { BLUE, MUTED, NAVY, TEAL, monoFont, sansFont } from '../../theme'
import {
  CATEGORY_PREFIX,
  TONE_COLORS,
  cardHasInput,
  cardHasOutput,
} from '../../data/simulationCards'
import type { CanvasCard as CanvasCardType } from '../../types/simulation'

export type PortSide = 'in' | 'out'

export interface CanvasCardEdit {
  title: string
  subtitle: string
  badge: string
}

interface CanvasCardProps {
  card: CanvasCardType
  selected: boolean
  /** True when this card is the source of an in-flight connection. */
  isConnectSource: boolean
  /** True when this card is in inline-edit mode (title / subtitle / badge). */
  editing: boolean
  onSelect: (placementId: string) => void
  onDelete: (placementId: string) => void
  onToggleCollapse: (placementId: string) => void
  onPortClick: (placementId: string, side: PortSide) => void
  onRequestEdit: (placementId: string) => void
  onEdit: (placementId: string, updates: CanvasCardEdit) => void
  onEditCancel: (placementId: string) => void
}

/** Width of an expanded card — also used by CanvasLines for endpoint math. */
export const CARD_WIDTH = 220

/** Height of an expanded card. */
const EXPANDED_HEIGHT = 110

/** Height of a collapsed card (title only). */
const COLLAPSED_HEIGHT = 44

/** Height of a card in inline-edit mode (3 inputs + Save/Cancel row). */
const EDIT_HEIGHT = 196

/**
 * A single card on the free-form canvas. The card body is draggable
 * (dnd-kit). Clicking the body selects the card; clicking a port dot on
 * the left or right edge triggers the connect flow. The collapse and
 * delete icons stay in the top-right.
 */
const CanvasCard = forwardRef<HTMLDivElement, CanvasCardProps>(function CanvasCard({
  card,
  selected,
  isConnectSource,
  editing,
  onSelect,
  onDelete,
  onToggleCollapse,
  onPortClick,
  onRequestEdit,
  onEdit,
  onEditCancel,
}, _ref) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: 'card-' + card.placementId,
    data: { placementId: card.placementId, kind: 'canvas-card' },
    disabled: editing,
  })

  // Local draft state for inline edit. Mirrors the card's current values on
  // mount/edit-entry so the user can see and tweak them.
  const [draftTitle, setDraftTitle] = useState(card.title)
  const [draftSubtitle, setDraftSubtitle] = useState(card.subtitle)
  const [draftBadge, setDraftBadge] = useState(card.badge)

  // Whenever the card enters edit mode, seed the draft from the latest
  // card values (handles the case where the card's data changed externally
  // between mount and the user double-clicking).
  useEffect(() => {
    if (editing) {
      setDraftTitle(card.title)
      setDraftSubtitle(card.subtitle)
      setDraftBadge(card.badge)
    }
  }, [editing, card.title, card.subtitle, card.badge])

  function handleSave() {
    // Empty title would leave a card with no label — keep the previous
    // title in that case. Subtitle / badge may be empty.
    const nextTitle = draftTitle.trim() === '' ? card.title : draftTitle
    onEdit(card.placementId, {
      title: nextTitle,
      subtitle: draftSubtitle,
      badge: draftBadge,
    })
  }

  function handleBodyDoubleClick(e: React.MouseEvent) {
    if (editing) return
    // Don't enter edit mode if the user double-clicked an action button or port.
    if ((e.target as HTMLElement).closest('[data-card-action],[data-card-port]')) return
    e.stopPropagation()
    onRequestEdit(card.placementId)
  }

  function handleEditKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSave()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onEditCancel(card.placementId)
    }
  }

  const accent = TONE_COLORS[card.tone]
  const height = card.collapsed ? COLLAPSED_HEIGHT : EXPANDED_HEIGHT
  const hasInput = cardHasInput(card.category)
  const hasOutput = cardHasOutput(card.category)

  // The drag transform is the *delta*, not absolute position — we apply
  // it on top of the card's (x, y) via CSS translate, so onDragEnd
  // (which fires after the user releases) we get event.delta = transform
  // and can add it to (x, y).
  const style: React.CSSProperties = {
    position: 'absolute',
    left: card.x,
    top: card.y,
    width: CARD_WIDTH,
    minHeight: editing ? EDIT_HEIGHT : height,
    background: '#fff',
    border: '1px solid ' + (selected || isConnectSource || editing ? BLUE : '#e0e0f0'),
    borderLeft: '3px solid ' + accent,
    borderRadius: 8,
    boxShadow: isDragging
      ? '0 10px 24px rgba(10,10,92,0.18)'
      : selected || isConnectSource || editing
      ? '0 0 0 3px ' + 'rgba(26,26,232,0.12)'
      : '0 1px 2px rgba(10,10,92,0.04)',
    boxSizing: 'border-box',
    padding: editing ? '10px 12px 10px 14px' : card.collapsed ? '0 12px' : '10px 12px 10px 14px',
    cursor: editing ? 'default' : isDragging ? 'grabbing' : 'grab',
    transform: CSS.Translate.toString(transform),
    transition: isDragging ? 'none' : 'box-shadow 0.12s ease, border-color 0.12s ease',
    userSelect: editing ? 'text' : 'none',
    zIndex: isDragging ? 100 : selected || editing ? 5 : 1,
    // Ports sit outside the card's bounding box.
    overflow: 'visible',
  }

  function handleBodyClick(e: React.MouseEvent) {
    // Ignore clicks that bubbled up from the action buttons or ports.
    if ((e.target as HTMLElement).closest('[data-card-action],[data-card-port]')) return
    if (editing) return
    onSelect(card.placementId)
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={handleBodyClick}
      onDoubleClick={handleBodyDoubleClick}
      {...(editing ? {} : listeners)}
      {...attributes}
    >
      {editing ? (
        <EditForm
          title={draftTitle}
          subtitle={draftSubtitle}
          badge={draftBadge}
          onTitleChange={setDraftTitle}
          onSubtitleChange={setDraftSubtitle}
          onBadgeChange={setDraftBadge}
          onSave={handleSave}
          onCancel={() => onEditCancel(card.placementId)}
          onKeyDown={handleEditKeyDown}
        />
      ) : (
        <>
          <div
            style={{
              display: 'flex',
              alignItems: card.collapsed ? 'center' : 'flex-start',
              justifyContent: 'space-between',
              gap: 8,
            }}
          >
            <div style={{ minWidth: 0, flex: 1 }}>
              {card.collapsed ? (
                <span
                  style={{
                    fontFamily: sansFont,
                    fontSize: 13,
                    fontWeight: 600,
                    color: NAVY,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    display: 'block',
                    lineHeight: '24px',
                  }}
                >
                  {card.title}
                </span>
              ) : (
                <>
                  <div
                    style={{
                      fontFamily: monoFont,
                      fontSize: 9,
                      letterSpacing: '0.14em',
                      textTransform: 'uppercase',
                      color: MUTED,
                      marginBottom: 4,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <span
                      style={{
                        background: accent,
                        color: '#fff',
                        padding: '2px 6px',
                        borderRadius: 4,
                        fontSize: 8,
                        fontWeight: 700,
                        letterSpacing: '0.1em',
                      }}
                    >
                      {CATEGORY_PREFIX[card.category]}
                    </span>
                     {card.badge}
                  </div>
                  <div
                    style={{
                      fontFamily: sansFont,
                      fontSize: 13,
                      fontWeight: 600,
                      color: NAVY,
                      lineHeight: 1.25,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {card.title}
                  </div>
                  <div
                    style={{
                      fontFamily: monoFont,
                      fontSize: 10,
                      color: MUTED,
                      marginTop: 3,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {card.subtitle}
                  </div>
                </>
              )}
            </div>
            <div
              style={{
                display: 'flex',
                gap: 2,
                flexShrink: 0,
                alignSelf: 'flex-start',
              }}
            >
              <ActionButton
                label={card.collapsed ? 'Expand' : 'Collapse'}
                onClick={(e) => {
                  e.stopPropagation()
                  onToggleCollapse(card.placementId)
                }}
                iconOnly
              >
                {card.collapsed ? '+' : '−'}
              </ActionButton>
              <ActionButton
                label="Delete"
                onClick={(e) => {
                  e.stopPropagation()
                  onDelete(card.placementId)
                }}
                danger
                iconOnly
              >
                ×
              </ActionButton>
            </div>
          </div>

          {hasInput && (
            <Port
              side="in"
              active={isConnectSource}
              color={BLUE}
              onClick={() => onPortClick(card.placementId, 'in')}
            />
          )}
          {hasOutput && (
            <Port
              side="out"
              active={isConnectSource}
              color={TEAL}
              onClick={() => onPortClick(card.placementId, 'out')}
            />
          )}
        </>
      )}
    </div>
  )
})

export default CanvasCard

interface ActionButtonProps {
  label: string
  onClick: (e: React.MouseEvent) => void
  danger?: boolean
  iconOnly?: boolean
  children?: React.ReactNode
}

function ActionButton({ label, onClick, danger, iconOnly, children }: ActionButtonProps) {
  return (
    <button
      type="button"
      data-card-action="1"
      title={label}
      aria-label={label}
      onClick={onClick}
      onPointerDown={(e) => e.stopPropagation()}
      style={{
        width: iconOnly ? 22 : 'auto',
        height: 22,
        padding: iconOnly ? 0 : '0 8px',
        background: 'transparent',
        border: 'none',
        borderRadius: 4,
        color: danger ? '#c83030' : MUTED,
        fontFamily: monoFont,
        fontSize: 12,
        fontWeight: 700,
        lineHeight: 1,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {children}
    </button>
  )
}

interface PortProps {
  side: PortSide
  active: boolean
  color: string
  onClick: () => void
}

/**
 * Small circular dot on the left or right edge of the card. Clicking
 * the port triggers the connect flow (`onClick`). When this card is
 * the active source, the port pulses via framer-motion to invite the
 * user to click a target.
 */
function Port({ side, active, color, onClick }: PortProps) {
  const isIn = side === 'in'
  return (
    <motion.button
      type="button"
      data-card-port={side}
      title={isIn ? 'Input port — click to receive a connection' : 'Output port — click to start a connection'}
      aria-label={isIn ? 'Input port' : 'Output port'}
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      onPointerDown={(e) => e.stopPropagation()}
      // animate={active ? { scale: [1, 1.3, 1] } : { scale: 1 }}
      // transition={active ? { repeat: Infinity, duration: 1.2, ease: 'easeInOut' } : { duration: 0.12 }}
      // whileHover={{ scale: 1.3 }}
      style={{
        position: 'absolute',
        top: '50%',
        [isIn ? 'left' : 'right']: -7,
        // transform: 'translateY(-50%)',
        width: 14,
        height: 14,
        padding: 0,
        background: active ? color : '#fff',
        border: '1.5px solid ' + color,
        borderRadius: '50%',
        cursor: 'crosshair',
        // boxShadow: active ? '0 0 0 4px ' + color + '22' : 'none',
        zIndex: 2,
      }}
    />
  )
}

interface EditFormProps {
  title: string
  subtitle: string
  badge: string
  onTitleChange: (v: string) => void
  onSubtitleChange: (v: string) => void
  onBadgeChange: (v: string) => void
  onSave: () => void
  onCancel: () => void
  onKeyDown: (e: React.KeyboardEvent) => void
}

/**
 * Inline edit form for a canvas card. Three stacked inputs (badge, title,
 * subtitle) with Save / Cancel buttons below. Title is auto-focused on
 * mount. Enter saves, Escape cancels — both bubble through `onKeyDown`.
 *
 * Stopping pointer-down propagation on the inputs prevents the body's
 * dnd-kit listeners (or accidental drag) from firing while the user is
 * typing in them.
 */
function EditForm({
  title,
  subtitle,
  badge,
  onTitleChange,
  onSubtitleChange,
  onBadgeChange,
  onSave,
  onCancel,
  onKeyDown,
}: EditFormProps) {
  const titleInputRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    // Defer focus to next tick so the input is fully mounted and the
    // caret lands at the end of any pre-filled text.
    const t = setTimeout(() => {
      const el = titleInputRef.current
      if (!el) return
      el.focus()
      const len = el.value.length
      el.setSelectionRange(len, len)
    }, 0)
    return () => clearTimeout(t)
  }, [])

  const inputBase: React.CSSProperties = {
    width: '100%',
    border: '1px solid #d0d0e8',
    borderRadius: 4,
    fontFamily: sansFont,
    color: NAVY,
    outline: 'none',
    boxSizing: 'border-box',
  }

  return (
    <div
      data-card-edit="1"
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      style={{ display: 'flex', flexDirection: 'column', gap: 6 }}
    >
      <label
        style={{
          fontFamily: monoFont,
          fontSize: 8,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: MUTED,
        }}
      >
        Attribute
      </label>
      <input
        type="text"
        value={badge}
        onChange={(e) => onBadgeChange(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder="ENV-1"
        style={{ ...inputBase, padding: '4px 6px', fontSize: 11 }}
      />

      <label
        style={{
          fontFamily: monoFont,
          fontSize: 8,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: MUTED,
          marginTop: 2,
        }}
      >
        Title
      </label>
      <input
        ref={titleInputRef}
        type="text"
        value={title}
        onChange={(e) => onTitleChange(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder="Card title"
        style={{ ...inputBase, padding: '5px 6px', fontSize: 13, fontWeight: 600 }}
      />

      <label
        style={{
          fontFamily: monoFont,
          fontSize: 8,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: MUTED,
          marginTop: 2,
        }}
      >
        Note
      </label>
      <input
        type="text"
        value={subtitle}
        onChange={(e) => onSubtitleChange(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder="Optional note"
        style={{ ...inputBase, padding: '4px 6px', fontSize: 10 }}
      />

      <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
        <button
          type="button"
          data-card-action="1"
          onClick={(e) => {
            e.stopPropagation()
            onSave()
          }}
          onPointerDown={(e) => e.stopPropagation()}
          style={{
            flex: 1,
            height: 24,
            padding: 0,
            background: BLUE,
            border: 'none',
            borderRadius: 4,
            color: '#fff',
            fontFamily: monoFont,
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            cursor: 'pointer',
          }}
        >
          Save
        </button>
        <button
          type="button"
          data-card-action="1"
          onClick={(e) => {
            e.stopPropagation()
            onCancel()
          }}
          onPointerDown={(e) => e.stopPropagation()}
          style={{
            flex: 1,
            height: 24,
            padding: 0,
            background: '#fff',
            border: '1px solid #d0d0e8',
            borderRadius: 4,
            color: MUTED,
            fontFamily: monoFont,
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            cursor: 'pointer',
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
