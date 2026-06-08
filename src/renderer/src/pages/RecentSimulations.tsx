import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import PageWrapper from '../components/PageWrapper'
import RecentSimulationRow from '../components/simulation/RecentSimulationRow'
import { useProfile } from '../context/ProfileContext'
import { MUTED, TEAL, monoFont, sansFont } from '../theme'
import type {
  SimulationOutcome,
  SimulationParent,
  SimulationProgressEvent,
} from '../../../preload/simulation'

export default function RecentSimulations() {
  const navigate = useNavigate()
  const { profile } = useProfile()
  const [sims, setSims] = useState<SimulationParent[]>([])
  const [outcomesBySim, setOutcomesBySim] = useState<Record<string, SimulationOutcome[]>>({})
  const [outcomesLoading, setOutcomesLoading] = useState<Record<string, boolean>>({})
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)

  const loadSims = useCallback(async () => {
    if (!profile) return
    try {
      const list = await window.api.simulations.list(profile.id)
      setSims(list)
    } catch (err) {
      console.error('Failed to load simulations:', err)
    } finally {
      setLoading(false)
    }
  }, [profile])

  const loadOutcomes = useCallback(
    async (simId: string) => {
      if (!profile) return
      setOutcomesLoading((m) => ({ ...m, [simId]: true }))
      try {
        const list = await window.api.simulations.listOutcomes(profile.id, simId)
        setOutcomesBySim((m) => ({ ...m, [simId]: list }))
      } catch (err) {
        console.error('Failed to load outcomes for', simId, err)
      } finally {
        setOutcomesLoading((m) => ({ ...m, [simId]: false }))
      }
    },
    [profile]
  )

  useEffect(() => {
    loadSims()
  }, [loadSims])

  // Subscribe to worker progress events and patch the matching row + outcome.
  useEffect(() => {
    if (!profile) return
    const unsubscribe = window.api.simulations.onProgress(
      (event: SimulationProgressEvent) => {
        setSims((prev) =>
          prev.map((s) =>
            s.id === event.simId
              ? {
                  ...s,
                  completedCount: event.completedCount,
                  outcomeCount: event.outcomeCount,
                  status: deriveStatus(event),
                  updatedAt: new Date().toISOString(),
                }
              : s
          )
        )
        setOutcomesBySim((prev) => {
          const list = prev[event.simId]
          if (!list) return prev
          return {
            ...prev,
            [event.simId]: list.map((o) =>
              o.id === event.outcomeId
                ? { ...o, status: event.status, error: event.error }
                : o
            ),
          }
        })
      }
    )
    return unsubscribe
  }, [profile])

  async function handleToggle(simId: string) {
    const isOpen = expanded.has(simId)
    const next = new Set(expanded)
    if (isOpen) {
      next.delete(simId)
    } else {
      next.add(simId)
      if (!outcomesBySim[simId] && !outcomesLoading[simId]) {
        await loadOutcomes(simId)
      }
    }
    setExpanded(next)
  }

  function handleOpenOutcome(sessionSlug: string) {
    navigate(`/chat?session=${sessionSlug}`)
  }

  async function handleRequeueOutcome(simId: string, outcomeId: string) {
    if (!profile) return
    try {
      await window.api.simulations.requeue(profile.id, simId, outcomeId)
      // Optimistic local update — the worker will re-emit progress.
      setOutcomesBySim((prev) => {
        const list = prev[simId]
        if (!list) return prev
        return {
          ...prev,
          [simId]: list.map((o) =>
            o.id === outcomeId ? { ...o, status: 'pending', error: undefined } : o
          ),
        }
      })
    } catch (err) {
      console.error('Failed to requeue outcome:', err)
    }
  }

  async function handleRequeueAll(simId: string) {
    if (!profile) return
    try {
      await window.api.simulations.requeue(profile.id, simId)
      await loadOutcomes(simId)
    } catch (err) {
      console.error('Failed to requeue all:', err)
    }
  }

  async function handleDelete(sim: SimulationParent) {
    if (!profile) return
    const confirmed = window.confirm(
      `Delete "${sim.name}"? This will also remove all child chat sessions.`
    )
    if (!confirmed) return
    try {
      await window.api.simulations.delete(profile.id, sim.id)
      setSims((prev) => prev.filter((s) => s.id !== sim.id))
      setOutcomesBySim((prev) => {
        const { [sim.id]: _removed, ...rest } = prev
        void _removed
        return rest
      })
      const next = new Set(expanded)
      next.delete(sim.id)
      setExpanded(next)
    } catch (err) {
      console.error('Failed to delete sim:', err)
    }
  }

  async function handleRefresh() {
    setLoading(true)
    await loadSims()
    // Reload outcomes for expanded sims
    for (const simId of expanded) {
      await loadOutcomes(simId)
    }
  }

  return (
    <PageWrapper
      title="Recent simulations"
      category="Account"
      buttons={
        <button
          onClick={handleRefresh}
          style={{
            padding: '8px 14px',
            background: '#fff',
            color: MUTED,
            border: '1px solid #e0e0f0',
            borderRadius: 6,
            fontFamily: monoFont,
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            cursor: 'pointer',
          }}
        >
          Refresh
        </button>
      }
    >
      <div
        style={{
          background: '#fff',
          border: '1px solid #e0e0f0',
          borderRadius: 8,
          overflow: 'hidden',
        }}
      >
        <div style={{ height: 3, background: TEAL }} />

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 140px 140px 120px 100px',
            padding: '12px 16px',
            background: '#f7f7fc',
            borderBottom: '1px solid #e0e0f0',
          }}
        >
          <span style={thStyle}>Name</span>
          <span style={thStyle}>Created</span>
          <span style={thStyle}>Outcomes</span>
          <span style={thStyle}>Status</span>
          <span style={{ ...thStyle, textAlign: 'right' }}>Actions</span>
        </div>

        {loading ? (
          <div
            style={{
              padding: 24,
              textAlign: 'center',
              color: MUTED,
              fontFamily: monoFont,
              fontSize: 11,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
            }}
          >
            Loading…
          </div>
        ) : sims.length === 0 ? (
          <div
            style={{
              padding: 32,
              textAlign: 'center',
              color: MUTED,
              fontFamily: sansFont,
              fontSize: 13,
            }}
          >
            No simulations yet. Build a scenario to get started.
          </div>
        ) : (
          sims.map((sim) => (
            <RecentSimulationRow
              key={sim.id}
              sim={sim}
              expanded={expanded.has(sim.id)}
              outcomes={outcomesBySim[sim.id] ?? []}
              outcomesLoading={!!outcomesLoading[sim.id]}
              onToggle={() => handleToggle(sim.id)}
              onOpenOutcome={handleOpenOutcome}
              onRequeueOutcome={(oid) => handleRequeueOutcome(sim.id, oid)}
              onRequeueAll={() => handleRequeueAll(sim.id)}
              onDelete={() => handleDelete(sim)}
            />
          ))
        )}
      </div>
    </PageWrapper>
  )
}

const thStyle: React.CSSProperties = {
  fontFamily: monoFont,
  fontSize: 10,
  letterSpacing: '0.12em',
  color: MUTED,
  textTransform: 'uppercase',
}

function deriveStatus(e: SimulationProgressEvent): SimulationParent['status'] {
  if (e.status === 'error') {
    return e.completedCount + e.outcomeCount > 0 && e.completedCount >= e.outcomeCount
      ? 'partial'
      : 'processing'
  }
  if (e.completedCount >= e.outcomeCount && e.outcomeCount > 0) return 'completed'
  if (e.completedCount > 0) return 'processing'
  return 'queued'
}
