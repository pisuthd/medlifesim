import { motion } from 'framer-motion'
import { BLUE, MUTED, NAVY, TEAL, monoFont, sansFont } from '../theme'
import type { ModelEntry } from '../../../preload/index.d'
import {
  deriveAbbreviation,
  deriveMetaLine,
  type EntryStatus,
} from '../utils/modelDisplay'

interface ModelCardProps {
  entry: ModelEntry
  isLastSelected: boolean
  status: EntryStatus
  submitting: boolean
  onSelect: () => void
  onCancel: () => void
  onRemove?: () => void
}

/**
 * A single row in the model registry list. Renders an avatar, name, meta
 * line, and a status indicator. The status dot/label flips to
 * "Downloading X%" / "Loading X%" when the entry is the in-flight selection;
 * a CANCEL button replaces the status dot in that state so the user can
 * abort the download from the list.
 *
 * The card itself does not draw a progress fill — the App transitions to
 * the full LoadingScreen once a model is picked, so the per-row bar is
 * unnecessary chrome.
 */
export function ModelCard({
  entry,
  isLastSelected,
  status,
  submitting,
  onSelect,
  onCancel,
  onRemove,
}: ModelCardProps) {
  const isInflight = status.tone === 'inflight'
  return (
    <div
      style={{
        position: 'relative',
        background: isLastSelected ? '#f0fafa' : '#f7f7fc',
        border: '1px solid #e0e0f0',
        borderLeft: isLastSelected ? `3px solid ${TEAL}` : '1px solid #e0e0f0',
        borderRadius: 6,
      }}
    >
      <motion.button
        whileHover={{ x: 4 }}
        whileTap={{ scale: 0.98 }}
        onClick={onSelect}
        disabled={isInflight || submitting}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          padding: '12px 14px',
          background: 'transparent',
          border: 'none',
          cursor: isInflight || submitting ? 'wait' : 'pointer',
          textAlign: 'left',
          width: '100%',
        }}
      >
        <div
          style={{
            width: 34,
            height: 34,
            background: BLUE,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: monoFont,
            fontWeight: 700,
            fontSize: 11,
            color: '#fff',
            flexShrink: 0,
          }}
        >
          {deriveAbbreviation(entry)}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <span
            style={{
              display: 'block',
              fontFamily: sansFont,
              fontSize: 14,
              fontWeight: 500,
              color: NAVY,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {entry.name}
          </span>
          <span
            style={{
              display: 'block',
              fontFamily: monoFont,
              fontSize: 10,
              color: MUTED,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              marginTop: 2,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {deriveMetaLine(entry)}
          </span>
        </div>
        {isInflight ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onCancel()
            }}
            style={{
              background: 'none',
              border: 'none',
              color: BLUE,
              fontFamily: monoFont,
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.1em',
              cursor: 'pointer',
              padding: '4px 6px',
            }}
          >
            CANCEL
          </button>
        ) : (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              flexShrink: 0,
            }}
          >
            <span
              style={{
                fontFamily: monoFont,
                fontSize: 9,
                color: status.color,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
              }}
            >
              {status.label}
            </span>
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: '50%',
                background: status.color,
                flexShrink: 0,
              }}
            />
          </div>
        )}
      </motion.button>
      {!entry.builtin && onRemove && (
        <button
          type="button"
          onClick={onRemove}
          style={{
            position: 'absolute',
            top: 6,
            right: 6,
            background: 'none',
            border: 'none',
            color: MUTED,
            fontFamily: monoFont,
            fontSize: 14,
            cursor: 'pointer',
            padding: '0 6px',
            lineHeight: 1,
          }}
          title="Remove model"
          aria-label="Remove model"
        >
          ×
        </button>
      )}
    </div>
  )
}
