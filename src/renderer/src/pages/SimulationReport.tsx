import { useEffect, useState, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import PageWrapper from '../components/PageWrapper'
import { useProfile } from '../context/ProfileContext'
import { BLUE, MUTED, NAVY, TEAL, monoFont, sansFont } from '../theme'
import type { ParsedOutcomeReport } from '../../../shared/outcomeParser'
import type { ReportAggregate } from '../../../shared/outcomeReport'
import type { SimulationOutcome, SimulationParent, SimulationStatus } from '../../../preload/simulation'
import { MEDLIFESIM_DISCLAIMER } from '../../../shared/disclaimer'

interface ReportResponse {
  sim: SimulationParent
  outcomes: SimulationOutcome[]
  reports: Record<string, ParsedOutcomeReport | null>
  aggregate: ReportAggregate
}

const STATUS_COLOR: Record<SimulationStatus, string> = {
  queued: MUTED,
  processing: BLUE,
  completed: TEAL,
  partial: '#cc8a00',
  error: '#c83030',
}

const STATUS_LABEL: Record<SimulationStatus, string> = {
  queued: 'Queued',
  processing: 'Processing',
  completed: 'Completed',
  partial: 'Partial',
  error: 'Error',
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString()
}

function riskColor(risk: number | null): string {
  if (risk === null) return MUTED
  if (risk < 25) return TEAL
  if (risk < 50) return '#3ec480'
  if (risk < 75) return '#cc8a00'
  return '#c83030'
}

export default function SimulationReport() {
  const { simId } = useParams<{ simId: string }>()
  const navigate = useNavigate()
  const { profile } = useProfile()
  const [data, setData] = useState<ReportResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [modelName, setModelName] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!profile || !simId) return
      setLoading(true)
      setError(null)
      try {
        const r = await window.api.simulations.getReport(profile.id, simId)
        if (!cancelled) setData(r)
        // Fetch the model name in parallel for the report footer. We use the
        // model active at report-load time (matches the user's intent — the
        // footer reflects "what model was running when the user opened this
        // report", not the model that produced the outcomes).
        try {
          const status = await window.api.models.status()
          if (!cancelled) setModelName(status?.active?.name || null)
        } catch {
          if (!cancelled) setModelName(null)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err))
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [profile, simId])

  // Group outcomes by subject for the per-subject accordion.
  const outcomesBySubject = useMemo(() => {
    if (!data) return new Map<string, SimulationOutcome[]>()
    const m = new Map<string, SimulationOutcome[]>()
    for (const o of data.outcomes) {
      // Skip errored outcomes from the per-subject section — they have
      // no parsed data and would just show empty accordions.
      if (o.status !== 'done') continue
      // Group by subject title — unique within a single canvas in practice.
      const key = o.pathLabels.subject
      if (!m.has(key)) m.set(key, [])
      m.get(key)!.push(o)
    }
    return m
  }, [data])

  if (!profile) {
    return (
      <PageWrapper title="Report" category="Simulation">
        <div style={{ padding: 24, color: MUTED, fontFamily: sansFont }}>
          Select a profile to view this report.
        </div>
      </PageWrapper>
    )
  }

  return (
    <PageWrapper
      title="Simulation report"
      category="MedLifeSim"
      buttons={
        <button
          onClick={() => navigate('/recent-simulations')}
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
          ← Back to simulations
        </button>
      }
    >
      {loading && (
        <div
          style={{
            padding: 32,
            textAlign: 'center',
            color: MUTED,
            fontFamily: monoFont,
            fontSize: 12,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
          }}
        >
          Generating report…
        </div>
      )}
      {error && (
        <div
          style={{
            padding: 16,
            background: 'rgba(200,48,48,0.08)',
            border: '1px solid #f0c0c0',
            borderRadius: 6,
            color: '#a02020',
            fontFamily: sansFont,
            fontSize: 13,
          }}
        >
          {error}
        </div>
      )}
      {!loading && !error && !data && (
        <div
          style={{
            padding: 32,
            textAlign: 'center',
            color: MUTED,
            fontFamily: sansFont,
            fontSize: 13,
          }}
        >
          Simulation not found.
        </div>
      )}
      {data && <ReportBody data={data} outcomesBySubject={outcomesBySubject} modelName={modelName} />}
    </PageWrapper>
  )
}

function ReportBody({
  data,
  outcomesBySubject,
  modelName,
}: {
  data: ReportResponse
  outcomesBySubject: Map<string, SimulationOutcome[]>
  modelName: string | null
}) {
  const { sim, outcomes, reports, aggregate } = data
  const statusColor = STATUS_COLOR[sim.status]
  const statusLabel = STATUS_LABEL[sim.status]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header card */}
      <div
        style={{
          background: '#fff',
          border: '1px solid #e0e0f0',
          borderRadius: 8,
          padding: 20,
          boxShadow: '0 2px 8px rgba(10,10,92,0.04)',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: 16,
          }}
        >
          <div>
            <p
              style={{
                fontFamily: monoFont,
                fontSize: 9,
                letterSpacing: '0.14em',
                color: MUTED,
                textTransform: 'uppercase',
                margin: 0,
                marginBottom: 6,
              }}
            >
              {formatDate(sim.createdAt)}
            </p>
            <h2
              style={{
                fontFamily: sansFont,
                fontSize: 22,
                fontWeight: 400,
                color: '#1a1a2e',
                margin: 0,
              }}
            >
              {sim.name}
            </h2>
            {sim.description && (
              <p
                style={{
                  fontFamily: sansFont,
                  fontSize: 13,
                  color: NAVY,
                  margin: '8px 0 0 0',
                  lineHeight: 1.55,
                  maxWidth: 720,
                  whiteSpace: 'pre-wrap',
                }}
              >
                {sim.description}
              </p>
            )}
          </div>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-end',
              gap: 6,
            }}
          >
            <span
              style={{
                display: 'inline-block',
                padding: '3px 10px',
                background: statusColor + '22',
                color: statusColor,
                borderRadius: 999,
                fontFamily: monoFont,
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
              }}
            >
              {statusLabel}
            </span>
            <span
              style={{
                fontFamily: monoFont,
                fontSize: 11,
                color: MUTED,
                letterSpacing: '0.06em',
              }}
            >
              {sim.completedCount} / {sim.outcomeCount} complete
              {sim.errorCount > 0 && (
                <span style={{ color: '#c83030', marginLeft: 6 }}>
                  ({sim.errorCount} err)
                </span>
              )}
            </span>
          </div>
        </div>
      </div>

      {/* Section 1: Executive Summary */}
      <Section
        eyebrow="01"
        title="Executive Summary"
        caption="auto-derived from per-outcome reports"
      >
        <div
          style={{
            background: '#fff',
            border: '1px solid #e0e0f0',
            borderRadius: 8,
            padding: 20,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          {aggregate.bullets.map((line, i) => (
            <p
              key={i}
              style={{
                fontFamily: sansFont,
                fontSize: 14,
                color: NAVY,
                margin: 0,
                lineHeight: 1.5,
              }}
            >
              {line}
            </p>
          ))}
          {aggregate.bestIntervention && aggregate.worstIntervention && (
            <table
              style={{
                width: '100%',
                marginTop: 8,
                borderCollapse: 'collapse',
                fontFamily: sansFont,
                fontSize: 13,
              }}
            >
              <thead>
                <tr>
                  <th style={miniTh}>Intervention</th>
                  <th style={{ ...miniTh, textAlign: 'right' }}>Avg Risk</th>
                  <th style={{ ...miniTh, textAlign: 'right' }}>n</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={miniTd}>
                    <span style={{ color: TEAL, fontWeight: 600 }}>Best · </span>
                    {aggregate.bestIntervention.title}
                  </td>
                  <td style={{ ...miniTd, textAlign: 'right' }}>
                    {aggregate.bestIntervention.avgRisk}%
                  </td>
                  <td style={{ ...miniTd, textAlign: 'right' }}>
                    {aggregate.bestIntervention.sampleSize}
                  </td>
                </tr>
                <tr>
                  <td style={miniTd}>
                    <span style={{ color: '#c83030', fontWeight: 600 }}>Worst · </span>
                    {aggregate.worstIntervention.title}
                  </td>
                  <td style={{ ...miniTd, textAlign: 'right' }}>
                    {aggregate.worstIntervention.avgRisk}%
                  </td>
                  <td style={{ ...miniTd, textAlign: 'right' }}>
                    {aggregate.worstIntervention.sampleSize}
                  </td>
                </tr>
              </tbody>
            </table>
          )}
        </div>
      </Section>

      {/* Section 2: Comparison Dashboard */}
      <Section eyebrow="02" title="Comparison Dashboard">
        <div
          style={{
            background: '#fff',
            border: '1px solid #e0e0f0',
            borderRadius: 8,
            overflow: 'hidden',
          }}
        >
          <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: sansFont, fontSize: 13 }}>
            <thead>
              <tr>
                <th style={thStyle}>Subject</th>
                <th style={thStyle}>Exposure</th>
                <th style={thStyle}>Intervention</th>
                <th style={thStyle}>Risk %</th>
                <th style={thStyle}>Severe %</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {outcomes.map((o, i) => {
                const r = reports[o.id]
                const isDone = o.status === 'done'
                return (
                  <tr
                    key={o.id}
                    style={{ background: i % 2 === 0 ? '#fff' : '#fafaff' }}
                  >
                    <td style={tdStyle}>{o.pathLabels.subject}</td>
                    <td style={tdStyle}>{o.pathLabels.exposure}</td>
                    <td style={tdStyle}>{o.pathLabels.intervention}</td>
                    <td style={tdStyle}>
                      <RiskBar
                        value={isDone && r ? r.risk : null}
                        range={isDone && r ? r.riskRange : null}
                      />
                    </td>
                    <td style={tdStyle}>
                      <RiskBar
                        value={isDone && r ? r.severeCaseRate : null}
                        range={isDone && r ? r.severeCaseRateRange : null}
                      />
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>
                      {isDone ? (
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '2px 8px',
                            background: TEAL + '22',
                            color: TEAL,
                            borderRadius: 999,
                            fontFamily: monoFont,
                            fontSize: 9,
                            fontWeight: 700,
                            letterSpacing: '0.12em',
                            textTransform: 'uppercase',
                          }}
                        >
                          Done
                        </span>
                      ) : o.status === 'error' ? (
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '2px 8px',
                            background: '#c8303022',
                            color: '#c83030',
                            borderRadius: 999,
                            fontFamily: monoFont,
                            fontSize: 9,
                            fontWeight: 700,
                            letterSpacing: '0.12em',
                            textTransform: 'uppercase',
                          }}
                        >
                          Error
                        </span>
                      ) : (
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '2px 8px',
                            background: MUTED + '22',
                            color: MUTED,
                            borderRadius: 999,
                            fontFamily: monoFont,
                            fontSize: 9,
                            fontWeight: 700,
                            letterSpacing: '0.12em',
                            textTransform: 'uppercase',
                          }}
                        >
                          Awaiting AI
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Section>

      {/* Section 3: Risk Breakdown */}
      <Section eyebrow="03" title="Risk Breakdown">
        <div
          style={{
            background: '#fff',
            border: '1px solid #e0e0f0',
            borderRadius: 8,
            padding: 20,
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
          }}
        >
          <div>
            <p
              style={{
                fontFamily: monoFont,
                fontSize: 9,
                letterSpacing: '0.14em',
                color: MUTED,
                textTransform: 'uppercase',
                margin: 0,
                marginBottom: 8,
              }}
            >
              Average risk by intervention
            </p>
            {aggregate.perSubject.length === 0 && (
              <p style={{ fontFamily: sansFont, fontSize: 13, color: MUTED, margin: 0 }}>
                No parsed risk data yet.
              </p>
            )}
            {aggregate.bestIntervention && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {Array.from(
                  new Map(
                    outcomes
                      .filter((o) => o.status === 'done' && reports[o.id]?.risk !== null)
                      .map((o) => [
                        o.interventionId || o.pathLabels.intervention,
                        {
                          title: o.pathLabels.intervention,
                          risks: [] as number[],
                        },
                      ])
                  ).values()
                )
                  .map((group, idx) => {
                    // Recompute the bucket inline so we can show it.
                    const id = (outcomes.find(
                      (o) =>
                        o.status === 'done' &&
                        (o.interventionId || o.pathLabels.intervention) ===
                          // find the matching one (first hit)
                          (outcomes
                            .filter((x) => x.status === 'done' && reports[x.id]?.risk !== null)
                            .map((x) => x.interventionId || x.pathLabels.intervention)[idx] ?? '')
                    )?.interventionId) || group.title
                    const sameId = outcomes.filter(
                      (o) =>
                        o.status === 'done' &&
                        (o.interventionId || o.pathLabels.intervention) === id
                    )
                    const risks = sameId
                      .map((o) => reports[o.id]?.risk)
                      .filter((v): v is number => v !== null && v !== undefined)
                    if (risks.length === 0) return null
                    const avg = risks.reduce((a, b) => a + b, 0) / risks.length
                    return (
                      <div
                        key={id}
                        style={{ display: 'flex', alignItems: 'center', gap: 12 }}
                      >
                        <span
                          style={{
                            fontFamily: sansFont,
                            fontSize: 12,
                            color: NAVY,
                            minWidth: 160,
                          }}
                          title={group.title}
                        >
                          {group.title}
                        </span>
                        <div
                          style={{
                            flex: 1,
                            height: 12,
                            background: '#f0f0f8',
                            borderRadius: 6,
                            overflow: 'hidden',
                          }}
                        >
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${Math.min(100, Math.max(0, avg))}%` }}
                            transition={{ duration: 0.4 }}
                            style={{
                              height: '100%',
                              background: riskColor(avg),
                            }}
                          />
                        </div>
                        <span
                          style={{
                            fontFamily: monoFont,
                            fontSize: 11,
                            color: NAVY,
                            minWidth: 60,
                            textAlign: 'right',
                          }}
                        >
                          {avg.toFixed(0)}% (n={risks.length})
                        </span>
                      </div>
                    )
                  })}
              </div>
            )}
          </div>
          <div>
            <p
              style={{
                fontFamily: monoFont,
                fontSize: 9,
                letterSpacing: '0.14em',
                color: MUTED,
                textTransform: 'uppercase',
                margin: 0,
                marginBottom: 8,
              }}
            >
              Average risk by subject
            </p>
            {aggregate.perSubject.length === 0 ? (
              <p style={{ fontFamily: sansFont, fontSize: 13, color: MUTED, margin: 0 }}>
                No parsed risk data yet.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {aggregate.perSubject.map((s) => (
                  <div
                    key={s.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      fontFamily: sansFont,
                      fontSize: 12,
                    }}
                  >
                    <span style={{ minWidth: 160, color: NAVY }}>{s.title}</span>
                    <div
                      style={{
                        flex: 1,
                        height: 8,
                        background: '#f0f0f8',
                        borderRadius: 4,
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          width: `${s.avgRisk}%`,
                          height: '100%',
                          background: riskColor(s.avgRisk),
                        }}
                      />
                    </div>
                    <span
                      style={{
                        fontFamily: monoFont,
                        fontSize: 11,
                        color: MUTED,
                        minWidth: 60,
                        textAlign: 'right',
                      }}
                    >
                      {s.avgRisk}% (n={s.sampleSize})
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </Section>

      {/* Section 4: Individual Subject Response */}
      <Section eyebrow="04" title="Individual Subject Response">
        {outcomesBySubject.size === 0 ? (
          <div
            style={{
              padding: 24,
              background: '#fff',
              border: '1px solid #e0e0f0',
              borderRadius: 8,
              textAlign: 'center',
              color: MUTED,
              fontFamily: sansFont,
              fontSize: 13,
            }}
          >
            No completed outcomes yet — come back when the AI has finished.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {Array.from(outcomesBySubject.entries()).map(([subjKey, list]) => {
              const subjectTitle = list[0].pathLabels.subject
              return (
                <SubjectAccordion
                  key={subjKey}
                  subjectTitle={subjectTitle}
                  outcomes={list}
                  reports={reports}
                />
              )
            })}
          </div>
        )}
      </Section>

      {/* Footer: provenance + non-clinical-advice disclaimer. */}
      <footer
        style={{
          marginTop: 8,
          padding: '20px 22px',
          background: '#fff',
          border: '1px solid #e0e0f0',
          borderRadius: 8,
          boxShadow: '0 2px 8px rgba(10,10,92,0.04)',
        }}
      >
        <h4
          style={{
            margin: 0,
            fontFamily: monoFont,
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: NAVY,
          }}
        >
          {MEDLIFESIM_DISCLAIMER.title}
        </h4>
        <p
          style={{
            margin: '6px 0 0 0',
            fontFamily: sansFont,
            fontSize: 12,
            color: MUTED,
            lineHeight: 1.55,
          }}
        >
          {MEDLIFESIM_DISCLAIMER.body}
        </p>
        <p
          style={{
            margin: '14px 0 0 0',
            paddingTop: 12,
            borderTop: '1px solid #f0f0f8',
            fontFamily: monoFont,
            fontSize: 10,
            color: MUTED,
            letterSpacing: '0.10em',
            textTransform: 'uppercase',
          }}
        >
          Model: {modelName ?? 'Unknown'}
        </p>
      </footer>
    </div>
  )
}

function RiskBar({
  value,
  range,
}: {
  value: number | null
  /** [min, max] tuple when the AI used a range. The bar visualizes 0..max and the label shows "min-max%". */
  range?: [number, number] | null
}) {
  if (value === null) {
    return (
      <span
        style={{
          fontFamily: monoFont,
          fontSize: 10,
          color: MUTED,
        }}
      >
        —
      </span>
    )
  }
  // When a range is present, the bar fills to the upper bound (the worst
  // case) and the label renders the full range. This conveys both the
  // central estimate and the uncertainty width at a glance.
  const barMax = range ? range[1] : value
  const barColor = range ? riskColor(range[1]) : riskColor(value)
  const label = range ? `${range[0]}\u2013${range[1]}%` : `${value}%`
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div
        style={{
          width: 80,
          height: 6,
          background: '#f0f0f8',
          borderRadius: 3,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${barMax}%`,
            height: '100%',
            background: barColor,
          }}
        />
      </div>
      <span
        style={{
          fontFamily: monoFont,
          fontSize: 11,
          color: NAVY,
          minWidth: 38,
          textAlign: 'right',
        }}
      >
        {label}
      </span>
    </div>
  )
}

function Section({
  eyebrow,
  title,
  caption,
  children,
}: {
  eyebrow: string
  title: string
  caption?: string
  children: React.ReactNode
}) {
  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <header style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
        <span
          style={{
            fontFamily: monoFont,
            fontSize: 10,
            color: MUTED,
            letterSpacing: '0.18em',
          }}
        >
          {eyebrow}
        </span>
        <h3
          style={{
            fontFamily: sansFont,
            fontSize: 17,
            fontWeight: 500,
            color: '#1a1a2e',
            margin: 0,
          }}
        >
          {title}
        </h3>
        {caption && (
          <span
            style={{
              fontFamily: monoFont,
              fontSize: 9,
              color: MUTED,
              letterSpacing: '0.10em',
            }}
          >
            {caption}
          </span>
        )}
      </header>
      {children}
    </section>
  )
}

function SubjectAccordion({
  subjectTitle,
  outcomes,
  reports,
}: {
  subjectTitle: string
  outcomes: SimulationOutcome[]
  reports: Record<string, ParsedOutcomeReport | null>
}) {
  const [open, setOpen] = useState(true)
  return (
    <div
      style={{
        background: '#fff',
        border: '1px solid #e0e0f0',
        borderRadius: 8,
        overflow: 'hidden',
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          width: '100%',
          padding: '14px 18px',
          background: '#fafaff',
          border: 'none',
          borderBottom: open ? '1px solid #e0e0f0' : 'none',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          cursor: 'pointer',
          fontFamily: sansFont,
          fontSize: 14,
          color: NAVY,
          fontWeight: 500,
          textAlign: 'left',
        }}
      >
        <span>{subjectTitle}</span>
        <span
          style={{
            fontFamily: monoFont,
            fontSize: 10,
            color: MUTED,
            letterSpacing: '0.10em',
          }}
        >
          {open ? '▾' : '▸'} {outcomes.length} path
          {outcomes.length === 1 ? '' : 's'}
        </span>
      </button>
      {open && (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {outcomes.map((o) => {
            const r = reports[o.id]
            return (
              <div
                key={o.id}
                style={{
                  padding: '14px 18px',
                  borderTop: '1px solid #f0f0f8',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 8,
                  }}
                >
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span
                      style={{
                        display: 'inline-block',
                        padding: '2px 8px',
                        background: MUTED + '22',
                        color: NAVY,
                        borderRadius: 4,
                        fontSize: 11,
                        fontWeight: 600,
                        fontFamily: monoFont,
                      }}
                    >
                      {o.pathLabels.exposure}
                    </span>
                    <span style={{ color: MUTED, fontFamily: monoFont, fontSize: 10 }}>→</span>
                    <span
                      style={{
                        display: 'inline-block',
                        padding: '2px 8px',
                        background: TEAL + '22',
                        color: TEAL,
                        borderRadius: 4,
                        fontSize: 11,
                        fontWeight: 600,
                        fontFamily: monoFont,
                      }}
                    >
                      {o.pathLabels.intervention}
                    </span>
                  </div>
                  {r && r.risk !== null && (
                    <span
                      style={{
                        fontFamily: monoFont,
                        fontSize: 11,
                        color: r.riskRange ? riskColor(r.riskRange[1]) : riskColor(r.risk),
                        fontWeight: 600,
                      }}
                    >
                      Risk{' '}
                      {r.riskRange
                        ? `${r.riskRange[0]}\u2013${r.riskRange[1]}%`
                        : `${r.risk}%`}
                    </span>
                  )}
                </div>
                {r ? (
                  <>
                    {r.summary && (
                      <p
                        style={{
                          fontFamily: sansFont,
                          fontSize: 13,
                          color: NAVY,
                          lineHeight: 1.55,
                          margin: '0 0 8px 0',
                        }}
                      >
                        {r.summary}
                      </p>
                    )}
                    {r.keyDrivers.length > 0 && (
                      <div style={{ marginTop: 8 }}>
                        <p
                          style={{
                            fontFamily: monoFont,
                            fontSize: 9,
                            color: MUTED,
                            textTransform: 'uppercase',
                            letterSpacing: '0.14em',
                            margin: '0 0 4px 0',
                          }}
                        >
                          Key drivers
                        </p>
                        <ul
                          style={{
                            margin: 0,
                            paddingLeft: 18,
                            fontFamily: sansFont,
                            fontSize: 12,
                            color: NAVY,
                            lineHeight: 1.5,
                          }}
                        >
                          {r.keyDrivers.map((d, i) => (
                            <li key={i}>{d}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {r.recommendations.length > 0 && (
                      <div style={{ marginTop: 8 }}>
                        <p
                          style={{
                            fontFamily: monoFont,
                            fontSize: 9,
                            color: MUTED,
                            textTransform: 'uppercase',
                            letterSpacing: '0.14em',
                            margin: '0 0 4px 0',
                          }}
                        >
                          Recommendations
                        </p>
                        <ul
                          style={{
                            margin: 0,
                            paddingLeft: 18,
                            fontFamily: sansFont,
                            fontSize: 12,
                            color: NAVY,
                            lineHeight: 1.5,
                          }}
                        >
                          {r.recommendations.map((d, i) => (
                            <li key={i}>{d}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {r.uncertainty && (
                      <p
                        style={{
                          fontFamily: sansFont,
                          fontSize: 11,
                          color: MUTED,
                          fontStyle: 'italic',
                          margin: '8px 0 0 0',
                        }}
                      >
                        {r.uncertainty}
                      </p>
                    )}
                  </>
                ) : (
                  <p
                    style={{
                      fontFamily: sansFont,
                      fontSize: 12,
                      color: MUTED,
                      margin: 0,
                    }}
                  >
                    No parsed data.
                  </p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

const thStyle: React.CSSProperties = {
  padding: '10px 14px',
  textAlign: 'left',
  fontFamily: monoFont,
  fontSize: 9,
  fontWeight: 700,
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
  color: MUTED,
  background: '#f8f8fc',
  borderBottom: '1px solid #e0e0f0',
}

const tdStyle: React.CSSProperties = {
  padding: '10px 14px',
  color: NAVY,
  verticalAlign: 'middle',
  borderBottom: '1px solid #f0f0f8',
}

const miniTh: React.CSSProperties = {
  padding: '4px 8px',
  textAlign: 'left',
  fontFamily: monoFont,
  fontSize: 9,
  fontWeight: 700,
  letterSpacing: '0.10em',
  textTransform: 'uppercase',
  color: MUTED,
  borderBottom: '1px solid #e0e0f0',
}

const miniTd: React.CSSProperties = {
  padding: '4px 8px',
  color: NAVY,
  fontFamily: sansFont,
  fontSize: 12,
}
