import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { DndContext, type DragEndEvent } from '@dnd-kit/core'
import {
  AddCardPopover,
  Canvas,
  CanvasToolbar,
  ConfirmModal,
  EditScenarioModal,
  OutcomesModal,
} from '../components/simulation'
import type { PortSide } from '../components/simulation/CanvasCard'
import {
  canConnect,
  describeConnectionRule,
  toPlacedCard,
} from '../data/simulationCards'
import { canEnumerate, enumeratePaths } from '../data/simulationPaths'
import { useProfile } from '../context/ProfileContext'
import { BLUE, MUTED, monoFont } from '../theme'
import {
  EMPTY_CANVAS,
  type CanvasCard,
  type CanvasState,
  type SimCardExposureFields,
  type SimCardInterventionFields,
  type SimCardSubjectFields,
  type SimCardTemplate,
  type SimPathPreview,
  type SimTemplate,
} from '../types/simulation'

/**
 * Free-form simulation builder page. No `PageWrapper` — the canvas
 * fills the entire main content area. Owns:
 *   - the canvas state (cards + connections)
 *   - the popover visibility
 *   - the in-flight connect-source id (which card, on which side)
 *   - the selected card id
 *   - the last-generated outcomes
 *
 * The Generate Outcomes button is rendered as its own floating pill in
 * the bottom-right of the page so the toolbar can stay focused on
 * building the graph.
 */
export default function StartSimulation() {
  const navigate = useNavigate()
  const { profile } = useProfile()
  const [canvas, setCanvas] = useState<CanvasState>(EMPTY_CANVAS)
  const [paths, setPaths] = useState<SimPathPreview[] | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [connectFrom, setConnectFrom] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [warning, setWarning] = useState<string | null>(null)
  // Reset confirm flow — true while the user is being asked to confirm a
  // destructive clear of the canvas.
  const [resetOpen, setResetOpen] = useState(false)
  // Template replacement confirm — when set, the matching template is
  // queued to load once the user confirms discarding the current canvas.
  const [pendingTemplate, setPendingTemplate] = useState<SimTemplate | null>(null)
  // Inline edit — when set, the matching card is in edit mode and the
  // canvas's other interactions (drag, port clicks) are suppressed.
  const [editingId, setEditingId] = useState<string | null>(null)
  // Submission flow
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  // Toast shown after a successful submission
  const [successToast, setSuccessToast] = useState<{ simId: string; count: number } | null>(null)
  // Scenario name — editable via the toolbar title click.
  const [scenarioName, setScenarioName] = useState<string>(defaultName())
  // Scenario description — pre-filled from the chosen template (if any),
  // editable in the OutcomesModal, saved onto the persisted sim, and
  // rendered as the lead paragraph in the report.
  const [description, setDescription] = useState<string>('')
  // Edit scenario modal open state.
  const [editScenarioOpen, setEditScenarioOpen] = useState(false)

  // Warning toast auto-dismiss: any new warning replaces the old timer.
  useEffect(() => {
    if (!warning) return
    const t = setTimeout(() => setWarning(null), 3000)
    return () => clearTimeout(t)
  }, [warning])

  // Worker pause gate: while the pre-submit OutcomesModal is open
  // (`paths !== null`), tell the background worker to skip its ticks for
  // this profile. Close + unmount both clear the flag so the worker
  // resumes on its next 1.5s poll.
  useEffect(() => {
    if (!profile) return
    window.api.simulations.setModalOpen(profile.id, paths !== null)
    return () => {
      // Best-effort cleanup if the page unmounts while the modal is open.
      window.api.simulations.setModalOpen(profile.id, false)
    }
  }, [profile, paths])

  function handleDragEnd(event: DragEndEvent) {
    const data = event.active.data.current as
      | { placementId?: string; kind?: string }
      | undefined
    if (!data || data.kind !== 'canvas-card' || !data.placementId) return
    const id = data.placementId
    setCanvas((prev) => {
      const card = prev.cards.find((c) => c.placementId === id)
      if (!card) return prev
      const moved: CanvasCard = {
        ...card,
        x: Math.max(0, card.x + event.delta.x),
        y: Math.max(0, card.y + event.delta.y),
      }
      return {
        ...prev,
        cards: prev.cards.map((c) => (c.placementId === id ? moved : c)),
      }
    })
  }

  function handleAddTemplate(template: SimCardTemplate) {
    const id = freshId('card')
    // Drop near the centre of the viewport with a small jitter so
    // back-to-back adds don't stack perfectly.
    const jitterX = Math.round((Math.random() - 0.5) * 80)
    const jitterY = Math.round((Math.random() - 0.5) * 60)
    const newCard: CanvasCard = {
      ...toPlacedCard(template, id),
      x: 360 + jitterX,
      y: 220 + jitterY,
      collapsed: false,
    }
    setCanvas((prev) => ({ ...prev, cards: [...prev.cards, newCard] }))
    setSelectedId(id)
    setAddOpen(false)
  }

  /** Persist the edited text and typed fields for a card and exit edit mode. */
  function handleEditCard(
    id: string,
    updates: {
      title: string 
      subjectFields?: SimCardSubjectFields
      exposureFields?: SimCardExposureFields
      interventionFields?: SimCardInterventionFields
    },
  ) {
    setCanvas((prev) => ({
      ...prev,
      cards: prev.cards.map((c) =>
        c.placementId === id ? { ...c, ...updates } : c,
      ),
    }))
    setEditingId(null)
  }

  /** Enter edit mode for `id` (typically called from CanvasCard's dblclick). */
  function handleRequestEdit(id: string) {
    setEditingId(id)
  }

  /** Exit edit mode without saving. */
  function handleEditCancel(_id: string): void {
    void _id
    setEditingId(null)
  }

  function handleSelectCard(id: string | null) {
    // Port clicks drive the connect flow directly, so a generic body
    // click just sets the selection (or clears it on canvas click).
    setSelectedId(id)
  }

  function handlePortClick(placementId: string, side: PortSide) {
    if (side === 'out') {
      // Output port: always (re)set this card as the source. Clicking
      // the same source again toggles it off.
      setConnectFrom((prev) => (prev === placementId ? null : placementId))
      return
    }
    // side === 'in'
    if (!connectFrom) return // nothing to connect to
    if (connectFrom === placementId) return // self-loop is a no-op
    const fromCard = canvas.cards.find((c) => c.placementId === connectFrom)
    const toCard = canvas.cards.find((c) => c.placementId === placementId)
    if (!fromCard || !toCard) return
    if (!canConnect(fromCard.category, toCard.category)) {
      // Keep the source selected so the user can immediately try a
      // different target. Auto-dismiss happens via the warning effect.
      setWarning(describeConnectionRule(toCard.category))
      return
    }
    const connId = freshId('conn')
    setCanvas((prev) => ({
      ...prev,
      connections: [
        ...prev.connections,
        { id: connId, from: connectFrom, to: placementId },
      ],
    }))
    setConnectFrom(null)
  }

  function handleDeleteCard(id: string) {
    setCanvas((prev) => ({
      cards: prev.cards.filter((c) => c.placementId !== id),
      connections: prev.connections.filter((c) => c.from !== id && c.to !== id),
    }))
    if (selectedId === id) setSelectedId(null)
    if (connectFrom === id) setConnectFrom(null)
  }

  function handleToggleCollapse(id: string) {
    setCanvas((prev) => ({
      ...prev,
      cards: prev.cards.map((c) =>
        c.placementId === id ? { ...c, collapsed: !c.collapsed } : c
      ),
    }))
  }

  function handleDeleteConnection(id: string) {
    setCanvas((prev) => ({
      ...prev,
      connections: prev.connections.filter((c) => c.id !== id),
    }))
  }

  function handleGenerate() {
    const computed = enumeratePaths(canvas.cards, canvas.connections)
    if (computed.length === 0) return
    setPaths(computed)
  }

  function handleClearAll() {
    setCanvas(EMPTY_CANVAS)
    setPaths(null)
    setSelectedId(null)
    setConnectFrom(null)
    setScenarioName(defaultName())
    setDescription('')
  }

  /**
   * User picked a template (or "Blank Canvas") from the toolbar dropdown.
   * If the current canvas is non-empty we ask them to confirm replacing
   * it; otherwise we apply immediately.
   */
  function handleLoadTemplate(template: SimTemplate) {
    if (canvas.cards.length === 0) {
      applyTemplate(template)
      return
    }
    setPendingTemplate(template)
  }

  function applyTemplate(template: SimTemplate) {
    setCanvas(template.canvas)
    setPaths(null)
    setSelectedId(null)
    setConnectFrom(null)
    setEditingId(null)
    // Inherit the template's description as a starting point — the user
    // can still edit it in the OutcomesModal before submitting.
    setDescription(template.description ?? '')
  }

  function cancelTemplateLoad() {
    setPendingTemplate(null)
  }

  async function handleProceed(name: string, description: string) {
    if (!profile) {
      setSubmitError('No profile selected.')
      return
    }
    setSubmitting(true)
    setSubmitError(null)
    try {
      const result = await window.api.simulations.create(
        profile.id,
        name,
        description,
        canvas
      )
      const count = result?.outcomeCount ?? paths?.length ?? 0
      const simId = result?.id ?? ''
      setPaths(null)
      setDescription('')
      setSuccessToast({ simId, count })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Submission failed'
      setSubmitError(message)
    } finally {
      setSubmitting(false)
    }
  }

  function closeSuccessToast() {
    setSuccessToast(null)
  }

  // Auto-dismiss the success toast after 6s.
  useEffect(() => {
    if (!successToast) return
    const t = setTimeout(() => setSuccessToast(null), 6000)
    return () => clearTimeout(t)
  }, [successToast])

  const canGen = canEnumerate(canvas.cards, canvas.connections)

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: '100vh',
        overflow: 'hidden',
        background: '#f7f7fc',
      }}
    >
      <DndContext onDragEnd={handleDragEnd}>
        <Canvas
          state={canvas}
          selectedId={selectedId}
          connectFrom={connectFrom}
          editingId={editingId}
          onSelectCard={handleSelectCard}
          onDeleteCard={handleDeleteCard}
          onToggleCollapse={handleToggleCollapse}
          onPortClick={handlePortClick}
          onDeleteConnection={handleDeleteConnection}
          onCancelConnect={() => setConnectFrom(null)}
          onRequestEdit={handleRequestEdit}
          onEditCard={handleEditCard}
          onEditCancel={handleEditCancel}
        />
      </DndContext>

      <CanvasToolbar
        cardCount={canvas.cards.length}
        addOpen={addOpen}
        scenarioName={scenarioName || undefined}
        onToggleAdd={() => setAddOpen((v) => !v)}
        onRequestReset={() => setResetOpen(true)}
        onPickTemplate={handleLoadTemplate}
        onPickBlank={() => handleLoadTemplate({ canvas: EMPTY_CANVAS } as SimTemplate)}
        onEditScenario={() => setEditScenarioOpen(true)}
      />

      <AddCardPopover
        open={addOpen}
        onPick={handleAddTemplate}
        onClose={() => setAddOpen(false)}
      />

      <ConfirmModal
        open={resetOpen}
        title="Reset canvas?"
        message="All cards and connections will be removed. This can't be undone."
        confirmLabel="Reset"
        destructive
        onConfirm={() => {
          handleClearAll()
          setResetOpen(false)
          setEditingId(null)
        }}
        onCancel={() => setResetOpen(false)}
      />

      <ConfirmModal
        open={pendingTemplate !== null}
        title="Load template?"
        message={
          pendingTemplate
            ? `Loading "${pendingTemplate.name}" will replace all ${canvas.cards.length} current card(s) and ${canvas.connections.length} connection(s). This can't be undone.`
            : ''
        }
        confirmLabel="Replace"
        destructive
        onConfirm={() => {
          if (pendingTemplate) applyTemplate(pendingTemplate)
          setPendingTemplate(null)
        }}
        onCancel={cancelTemplateLoad}
      />

      {/* Floating Generate button — bottom-right. The Outcomes drawer
          slides over it when it opens, which is fine. */}
      <motion.button
        type="button"
        onClick={handleGenerate}
        disabled={!canGen}
        whileHover={canGen ? { scale: 1.03 } : undefined}
        whileTap={canGen ? { scale: 0.97 } : undefined}
        style={{
          position: 'absolute',
          right: 24,
          bottom: 24,
          zIndex: 90,
          height: 44,
          padding: '0 20px',
          background: canGen ? BLUE : MUTED,
          color: '#fff',
          border: 'none',
          borderRadius: 8,
          fontFamily: monoFont,
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          cursor: canGen ? 'pointer' : 'not-allowed',
          opacity: canGen ? 1 : 0.55,
          boxShadow: canGen ? '0 6px 18px rgba(26,26,232,0.22)' : 'none',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <span aria-hidden style={{ fontSize: 14, lineHeight: 1, marginTop: -1 }}>▶</span>
        Preview
      </motion.button>

      <OutcomesModal
        paths={paths}
        initialName={scenarioName || undefined}
        initialDescription={description}
        onDescriptionChange={setDescription}
        onClose={() => {
          setPaths(null)
          setSubmitError(null)
        }}
        onProceed={handleProceed}
        submitting={submitting}
        submitError={submitError}
      />

      <EditScenarioModal
        open={editScenarioOpen}
        name={scenarioName}
        description={description}
        onNameChange={setScenarioName}
        onDescriptionChange={setDescription}
        onClose={() => setEditScenarioOpen(false)}
        onSave={() => setEditScenarioOpen(false)}
      />

      <AnimatePresence>
        {warning && (
          <motion.div
            key="warning-toast"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
            style={{
              position: 'absolute',
              top: 16,
              left: '50%',
              transform: 'translateX(-50%)',
              padding: '0 18px',
              height: 32,
              background: 'rgba(200,48,48,0.10)',
              border: '1px solid #c83030',
              borderRadius: 16,
              color: '#c83030',
              fontFamily: monoFont,
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: '0.10em',
              textTransform: 'uppercase',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 110,
              pointerEvents: 'none',
              whiteSpace: 'nowrap',
              maxWidth: '80%',
            }}
          >
            {warning}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {successToast && (
          <motion.div
            key="success-toast"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            style={{
              position: 'absolute',
              top: 16,
              left: '50%',
              transform: 'translateX(-50%)',
              padding: '0 14px 0 18px',
              height: 40,
              background: '#fff',
              border: '1px solid #cfeae5',
              borderRadius: 20,
              boxShadow: '0 6px 18px rgba(10,10,92,0.10)',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              zIndex: 110,
              maxWidth: '90%',
            }}
          >
            <span
              style={{
                fontFamily: monoFont,
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.10em',
                textTransform: 'uppercase',
                color: MUTED,
              }}
            >
              Submitted · {successToast.count} outcomes queued
            </span>
            <motion.button
              type="button"
              onClick={() => navigate('/recent-simulations')}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              style={{
                height: 26,
                padding: '0 12px',
                background: BLUE,
                color: '#fff',
                border: 'none',
                borderRadius: 6,
                fontFamily: monoFont,
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                cursor: 'pointer',
              }}
            >
              Track
            </motion.button>
            <motion.button
              type="button"
              onClick={closeSuccessToast}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              style={{
                width: 22,
                height: 22,
                padding: 0,
                background: 'transparent',
                color: MUTED,
                border: 'none',
                fontFamily: monoFont,
                fontSize: 14,
                lineHeight: 1,
                cursor: 'pointer',
              }}
            >
              ×
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function freshId(prefix: string): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return prefix + '-' + crypto.randomUUID()
  }
  return prefix + '-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8)
}

function defaultName(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `Scenario · ${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
