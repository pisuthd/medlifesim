import { profileStore } from './profileStore'
import { runCompletion } from './index'
import { shouldDefer } from './completionLock'
import {
  bumpCompleted,
  broadcastProgress,
  getSimulation,
  listPendingOutcomes,
  recoveryPass,
  updateOutcome,
} from './simulations'
import { createSession, sessionExists } from './sessions'
import { getAnalysisPlan, setAnalysisPlan } from './planCache'
import type { SimulationOutcome } from '../preload/simulation'
import type { AnalysisPlan } from '../preload/simulation'

/**
 * Background worker that drains queued simulation outcomes.
 *
 * Pipeline (post-redesign, 2 steps):
 *
 *   Step 1 — Planning pass
 *     For a simulation with ≥2 pending outcomes, run one completion
 *     over a 1–2-outcome sample. The model emits an `AnalysisPlan`
 *     (summary, comparisons, dimensions, hypotheses) which is cached
 *     in `planCache` (in-memory only) for the rest of the run. There
 *     is no retry — if the model returns invalid JSON, we cache
 *     `null` and per-outcome still proceeds without a plan.
 *
 *   Step 2 — Per-outcome analysis
 *     Each pending outcome is analysed with a system prompt that
 *     instructs JSON output and a user prompt that embeds the
 *     cached plan (or omits it if step 1 failed). The response is
 *     parsed with the brace-counted `parseOutcomeJson` and stored
 *     on the outcome. If parsing fails, the outcome is marked
 *     `error`; the user can retry from the recent-simulation page.
 *
 * The worker is intentionally conservative: globally 1 concurrent
 * completion (the model can't stream two at once), polls every
 * `POLL_MS`, defers to chat when a chat completion is in flight,
 * and runs a recovery pass on startup that flips `processing`
 * outcomes back to `pending`.
 */

const POLL_MS = 1500
let timer: NodeJS.Timeout | null = null
const inFlight = new Set<string>()

/**
 * Per-profile "modal open" flag. When a profile's value is `true` the
 * worker's `tickForProfile` early-bails — the user is reviewing the
 * pre-submit OutcomesModal in the builder and we shouldn't race them
 * by streaming outcomes. The renderer signals the open/close transition
 * via the `simulations:setModalOpen` IPC.
 */
const modalOpenByProfile = new Map<string, boolean>()

export function setProfileModalOpen(profileSlug: string, isOpen: boolean): void {
  if (isOpen) modalOpenByProfile.set(profileSlug, true)
  else modalOpenByProfile.delete(profileSlug)
}

function outcomeKey(simId: string, outcomeId: string): string {
  return `${simId}::${outcomeId}`
}

// ─────────────────────────────────────────────────────────────────────────
// Step 1 — planning pass
// ─────────────────────────────────────────────────────────────────────────

/**
 * Step 1 system prompt — for the PLANNING pass only. Tells the model
 * to emit a single JSON object describing what the per-outcome step
 * should focus on. Do NOT use this for per-outcome analyses; the
 * field list here is intentionally different (summary /
 * comparisons / dimensions / hypotheses) so the model doesn't
 * confuse the two prompts.
 */
function buildPlanningSystemPrompt(): string {
  return `You are a senior public-health analyst planning a multi-outcome
simulation analysis. Produce a single JSON object (no prose, no
markdown, no code fences) describing what the per-outcome step
should focus on.

The JSON must have exactly these four fields:

1. "summary" (string): one sentence describing the overall comparison
   this analysis aims to make. This is shown to the user as the
   plan's headline.

2. "comparisons" (array of { "outcomes": [idA, idB], "focus": string }):
   1–3 pairs of outcome ids the per-outcome step should produce
   comparison deltas for. The "focus" string is a short instruction
   the model should respect (e.g. "compare risk between low and high
   exposure dose"). Use outcome ids exactly as provided.

3. "dimensions" (array of strings): the list of fields every
   per-outcome JSON must populate. Default to
   ["summary", "risk", "severeCaseRate", "keyDrivers",
    "recommendations", "uncertainty"] unless the sample outcomes
   clearly warrant fewer or more.

4. "hypotheses" (array of strings): 2–3 short claims the per-outcome
   step should test. Each is a one-sentence hypothesis, e.g. "Higher
   exposure dose correlates with higher risk."

Output the JSON object, then stop. No commentary.`
}

/**
 * Step 2 system prompt — for the PER-OUTCOME analysis. The SINGLE
 * source of truth for role, task, plan guidance, output schema, and
 * format rule. The user prompt deliberately carries none of these
 * so the model doesn't get conflicting instructions.
 *
 * - The plan (when present) is framed as *analytical guidance*, not
 *   as a list of output fields. The 1.7B previously echoed the
 *   planning-pass field names ("dimensions", "hypotheses") as JSON
 *   keys when the user prompt listed them as fields to populate.
 * - The 7th schema field, "comparisons", is included ONLY when this
 *   outcome is part of at least one comparison pair. The current
 *   contract keeps that conditional logic (see the legacy
 *   `buildPerOutcomeUserPrompt` line 410-412).
 */
function buildPerOutcomeSystemPrompt(
  plan: AnalysisPlan | null,
  outcomeId: string
): string {
  const inAnyPair =
    plan?.comparisons.some((p) => p.outcomes.includes(outcomeId)) ?? false

  // Frame the plan as GUIDANCE, not output. Summarise, hypothesise,
  // and (when relevant) call out the comparison pair the model
  // should produce a per-pair delta for.
  const planBlock = plan
    ? `Background context (this is GUIDANCE for the analysis — it is
NOT a list of output fields; do not echo these as JSON keys):

- Overall framing of this simulation: ${plan.summary}
- Hypotheses the analyst wants tested: ${plan.hypotheses.join(' | ')}
${
  inAnyPair
    ? `- Comparison pairs involving the path described by the user
  (you should include a "comparisons" entry for each pair that
  references this outcome's id, per the schema below):
${plan.comparisons
  .filter((p) => p.outcomes.includes(outcomeId))
  .map((p) => `  * ${p.outcomes.join(' ↔ ')} — focus: ${p.focus}`)
  .join('\n')}
`
    : ''
}`
    : ''

  return `You are a senior public-health analyst. The user will describe
a single path (subject + exposure + intervention) below. Estimate
the likely health outcome for that path based on the subject
population, exposure (including the setting where risk originates),
and proposed intervention. Use evidence-based reasoning.

${planBlock}
Output a single JSON object (no prose, no markdown, no code fences,
no commentary). The object must have exactly these fields:

1. "summary" (string): 2–3 sentences describing the projected
   outcome for this specific path.

2. "risk" (number or [min, max] tuple of two numbers): estimated
   0–100 percentage of adverse events in this subgroup.

3. "severeCaseRate" (number or [min, max] tuple of two numbers):
   estimated 0–100 percentage of cases that become severe.

4. "keyDrivers" (array of 3–5 strings): the most important factors
   driving this outcome.

5. "recommendations" (array of 2–4 strings): actionable
   public-health recommendations.

6. "uncertainty" (string): 1–2 sentences on what data would most
   change the estimate.
${
  inAnyPair
    ? `
7. "comparisons" (array of { "with": "<outcome-id>", "delta": "<short comparison>" }): one entry per comparison pair above that this outcome is part of.`
    : ''
}

Output the JSON object, then stop.`
}

/**
 * User prompt for the planning pass. Asks the model to produce the
 * plan based on a 1–2 outcome sample and the canvas summary.
 */
function buildPlanningUserPrompt(
  sampleOutcomes: SimulationOutcome[],
  subjectList: string
): string {
  const sampleBlock = sampleOutcomes
    .map(
      (o, i) =>
        `Sample outcome ${i + 1} (id: ${o.id}):\n` +
        `  Subject: ${o.pathLabels.subject}\n` +
        `  Exposure: ${o.pathLabels.exposure}\n` +
        `  Intervention: ${o.pathLabels.intervention}`
    )
    .join('\n\n')

  return `You are planning the analysis for a public-health simulation
with ${sampleOutcomes.length} sampled outcomes. The full simulation
covers a canvas with the following subjects:

${subjectList}

Sampled outcomes:

${sampleBlock}

Produce the analysis plan JSON (summary, comparisons, dimensions,
hypotheses) following the system prompt. Use the outcome ids above
verbatim in the "comparisons" array.`
}

/**
 * Brace-counted extractor for a single JSON object. Mirrors the
 * shape used by the renderer's `PromptToScenarioModal` — works
 * against a streaming 1.7B model that has a habit of wrapping JSON
 * in stray prose.
 */
function tryParseJsonObject(text: string): any | null {
  if (!text) return null
  const trimmed = text.trim()
  let candidate: string | null = null
  for (let i = 0; i < trimmed.length; i++) {
    if (trimmed[i] !== '{') continue
    let depth = 0
    let endIdx = -1
    for (let j = i; j < trimmed.length; j++) {
      if (trimmed[j] === '{') depth++
      else if (trimmed[j] === '}') {
        depth--
        if (depth === 0) {
          endIdx = j + 1
          break
        }
      }
    }
    if (endIdx === -1) continue
    candidate = trimmed.slice(i, endIdx)
    break
  }
  if (!candidate) return null
  try {
    return JSON.parse(candidate)
  } catch {
    return null
  }
}

/**
 * Validate that a parsed object looks like an `AnalysisPlan`. Tolerant
 * of missing optional fields (returns the value if absent, since the
 * per-outcome step handles a missing plan gracefully).
 */
function validateAnalysisPlan(raw: unknown): AnalysisPlan | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  if (typeof r.summary !== 'string') return null
  if (!Array.isArray(r.comparisons)) return null
  if (!Array.isArray(r.dimensions)) return null
  if (!Array.isArray(r.hypotheses)) return null
  // `comparisons` is `Array<{outcomes: string[]; focus: string}>`
  const comparisons = r.comparisons
    .map((c: any) => ({
      outcomes: Array.isArray(c?.outcomes) ? c.outcomes.map(String) : [],
      focus: typeof c?.focus === 'string' ? c.focus : '',
    }))
    .filter((c) => c.outcomes.length > 0)
  return {
    summary: r.summary,
    comparisons,
    dimensions: (r.dimensions as unknown[]).map(String),
    hypotheses: (r.hypotheses as unknown[]).map(String),
  }
}

/**
 * Run the Step 1 planning pass for a simulation. On any failure
 * (model error, invalid JSON, validation failure) we cache `null`
 * so the per-outcome step knows step 1 didn't yield a plan.
 */
async function runPlanningPass(
  profileSlug: string,
  simId: string,
  sampleOutcomes: SimulationOutcome[],
  subjectList: string
): Promise<void> {
  const systemPrompt = buildPlanningSystemPrompt()
  const userPrompt = buildPlanningUserPrompt(sampleOutcomes, subjectList)

  try {
    const { content } = await runCompletion(
      {
        profileSlug,
        // The plan doesn't get persisted to a session — it lives in
        // memory only. Use a fake sessionSlug so runCompletion can
        // still persist the assistant turn to messages.json without
        // it surfacing anywhere in the chat list.
        sessionSlug: `__plan__${simId}`,
        systemPrompt,
        userMessage: userPrompt,
        history: [],
        // No profile context prompt — the planning prompt is the
        // whole system prompt.
      },
      {},
      'worker'
    )

    const parsed = tryParseJsonObject(content)
    const plan = validateAnalysisPlan(parsed)
    if (!plan) {
      console.warn(`[sim-worker] planning pass returned invalid JSON for sim ${simId}; caching null`)
      setAnalysisPlan(profileSlug, simId, null)
      return
    }
    console.log(
      `[sim-worker] planning pass for sim ${simId} cached:`,
      JSON.stringify(plan.summary)
    )
    setAnalysisPlan(profileSlug, simId, plan)
  } catch (err) {
    console.warn(`[sim-worker] planning pass failed for sim ${simId}:`, err)
    setAnalysisPlan(profileSlug, simId, null)
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Step 2 — per-outcome analysis
// ─────────────────────────────────────────────────────────────────────────

/**
 * User prompt for a single outcome. Carries ONLY the per-outcome
 * data: the canvas's subject disambiguation block (F.14 trick) and
 * the typed Subject / Exposure / Intervention path block. No role,
 * no JSON schema, no format rule — those live entirely in the
 * system prompt.
 */
function buildPerOutcomeUserPrompt(
  outcome: SimulationOutcome,
  allSubjects: { id: string; title: string }[]
): string {
  const d = outcome.details ?? {
    subject: {},
    exposure: {},
    intervention: {},
  } as NonNullable<SimulationOutcome['details']>
  const sC = (d.subject.comorbidities || []).join(', ') || '—'
  const doseUnit = [d.exposure.dose, d.exposure.unit].filter(Boolean).join(' ') || '—'

  // F.14: when the canvas has multiple subjects, the 1.7B model can
  // pattern-match "smoking + secondhand smoke" → "non-smoker secondhand
  // smoker" and drop the leading subject constraint. Front-load the
  // subject list with a STUDYING marker so the population is unambiguous
  // before the exposure is read.
  const pathSubjectTitle = outcome.pathLabels.subject
  const orderedSubjects = [
    ...allSubjects.filter((s) => s.title === pathSubjectTitle),
    ...allSubjects.filter((s) => s.title !== pathSubjectTitle),
  ]
  const subjectsBlock =
    orderedSubjects.length > 1
      ? `Subjects in this scenario (the canvas has multiple subject
cards; analyse ONLY the one marked ← STUDYING THIS SUBJECT — do not
substitute a different population based on the exposure or
intervention):

${orderedSubjects
  .map(
    (s) =>
      `- ${s.title}${s.title === pathSubjectTitle ? ' ← STUDYING THIS SUBJECT' : ''}`
  )
  .join('\n')}

`
      : ''

  return `${subjectsBlock}Path:
- Subject: ${outcome.pathLabels.subject}
  - Age range: ${d.subject.ageRange || '—'}
  - Sample size: ${d.subject.sampleSize || '—'}
  - Region: ${d.subject.region || '—'}
  - Comorbidities: ${sC}
  - Context: ${d.subject.context || '—'}
- Exposure: ${outcome.pathLabels.exposure}
  - Dose / unit: ${doseUnit}
  - Duration: ${d.exposure.duration || '—'}
  - Frequency: ${d.exposure.frequency || '—'}
  - Setting: ${d.exposure.setting || '—'}
  - Context: ${d.exposure.context || '—'}
- Intervention: ${outcome.pathLabels.intervention}
  - Type: ${d.intervention.type || '—'}
  - Intensity: ${d.intervention.intensity || '—'}
  - Compliance: ${d.intervention.compliance || '—'}
  - Context: ${d.intervention.context || '—'}`
}

/**
 * Process a single outcome through Step 2. The completion either
 * succeeds and we mark the outcome `done` (the assistant turn is
 * already persisted to messages.json by `runCompletion`), or it
 * fails (model error or non-JSON response) and we mark it `error`.
 *
 * No retries — the recent-simulation page has a Retry button that
 * calls `simulations:requeue` for explicit manual recovery.
 */
async function processOutcome(
  profileSlug: string,
  simId: string,
  outcome: SimulationOutcome
): Promise<void> {
  const parentBefore = getSimulation(profileSlug, simId)
  const completedBefore = parentBefore?.completedCount ?? 0
  const errorCountBefore = parentBefore?.errorCount ?? 0
  const outcomeCount = parentBefore?.outcomeCount ?? 0

  // Lazily create the child chat session so only the outcome
  // currently being processed appears in the chat list.
  if (!sessionExists(profileSlug, outcome.sessionSlug)) {
    try {
      createSession(profileSlug, outcome.sessionSlug)
    } catch (err) {
      console.warn(
        `[sim-worker] createSession failed for ${outcome.sessionSlug}:`,
        err
      )
    }
  }

  // Mark as processing + push progress.
  updateOutcome(profileSlug, simId, outcome.id, {
    status: 'processing',
    error: undefined,
  })
  broadcastProgress({
    simId,
    outcomeId: outcome.id,
    status: 'processing',
    completedCount: completedBefore,
    outcomeCount,
  })
  console.log(
    `[sim-worker] starting outcome ${outcome.id} (sim ${simId}, ${outcomeCount - completedBefore} remaining)`
  )

  // Read the plan from the in-memory cache. `undefined` means step 1
  // was skipped (1 outcome only); `null` means step 1 failed (per-
  // outcome runs without comparison context); an `AnalysisPlan`
  // means embed it in the prompt.
  const plan = getAnalysisPlan(profileSlug, simId) ?? null

  const allSubjects =
    parentBefore?.canvas.cards
      .filter((c) => c.category === 'subject')
      .map((c) => ({ id: c.id, title: c.title })) ?? []

  const systemPrompt = buildPerOutcomeSystemPrompt(plan, outcome.id)
  const userPrompt = buildPerOutcomeUserPrompt(outcome, allSubjects)

  try {
    const { content, thinking } = await runCompletion(
      {
        profileSlug,
        sessionSlug: outcome.sessionSlug,
        systemPrompt,
        userMessage: userPrompt,
        history: [],
      },
      {},
      'worker'
    )

    // Validate the response is parseable JSON in the expected shape.
    // If not, fall through to the error path — no retry, the user
    // can hit the Retry button on the recent-simulation page.
    const parsed = tryParseJsonObject(content)
    if (!parsed || typeof parsed !== 'object') {
      throw new Error('Per-outcome response was not a parseable JSON object')
    }
    void thinking // available on the persisted assistant turn if we ever want to expose it

    updateOutcome(profileSlug, simId, outcome.id, {
      status: 'done',
      error: undefined,
    })
    bumpCompleted(profileSlug, simId, +1, 0)
    broadcastProgress({
      simId,
      outcomeId: outcome.id,
      status: 'done',
      completedCount: completedBefore + 1,
      outcomeCount,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`[sim-worker] outcome ${outcome.id} failed:`, message)
    updateOutcome(profileSlug, simId, outcome.id, {
      status: 'error',
      error: message,
    })
    bumpCompleted(profileSlug, simId, +1, +1)
    broadcastProgress({
      simId,
      outcomeId: outcome.id,
      status: 'error',
      error: message,
      completedCount: completedBefore + 1,
      outcomeCount,
    })
  }
  // Touch errorCountBefore so the compiler doesn't complain.
  void errorCountBefore
}

// ─────────────────────────────────────────────────────────────────────────
// Tick loop
// ─────────────────────────────────────────────────────────────────────────

/**
 * Build the subject-list string for the planning pass. Falls back
 * to a generic prompt if the canvas has no subjects.
 */
function subjectListForPlanning(allSubjects: { id: string; title: string }[]): string {
  if (allSubjects.length === 0) return '(no subjects on canvas)'
  return allSubjects.map((s) => `- ${s.title}`).join('\n')
}

async function tickForProfile(profileSlug: string): Promise<void> {
  // One concurrent completion globally.
  if (inFlight.size > 0) return

  // Defer when the chat IPC is mid-completion. The worker can skip
  // this tick and retry next poll.
  if (shouldDefer()) {
    console.log('[sim-worker] tick deferred: completion in flight')
    return
  }

  // Skip the tick while the builder's pre-submit OutcomesModal is open.
  if (modalOpenByProfile.get(profileSlug) === true) return

  const pending = listPendingOutcomes(profileSlug)
  if (pending.length === 0) return

  // Step 1: run the planning pass for any sim with ≥2 pending
  // outcomes and no plan cached yet. Run synchronously (one
  // completion at a time) so per-outcome steps don't start until
  // step 1 is done. Failures are non-fatal — per-outcome still runs.
  const bySim = new Map<string, SimulationOutcome[]>()
  for (const { simId, outcome } of pending) {
    if (!bySim.has(simId)) bySim.set(simId, [])
    bySim.get(simId)!.push(outcome)
  }
  for (const [simId, simOutcomes] of bySim.entries()) {
    if (simOutcomes.length < 2) continue
    if (getAnalysisPlan(profileSlug, simId) !== undefined) continue
    const sample = simOutcomes.slice(0, 2)
    const parent = getSimulation(profileSlug, simId)
    const allSubjects =
      parent?.canvas.cards
        .filter((c) => c.category === 'subject')
        .map((c) => ({ id: c.id, title: c.title })) ?? []
    await runPlanningPass(
      profileSlug,
      simId,
      sample,
      subjectListForPlanning(allSubjects)
    )
  }

  // Step 2: process one outcome. The next tick picks up the rest.
  for (const { simId, outcome } of pending) {
    const key = outcomeKey(simId, outcome.id)
    inFlight.add(key)
    try {
      await processOutcome(profileSlug, simId, outcome)
    } catch (err) {
      console.error('[sim-worker] tick failed for', profileSlug, err)
    } finally {
      inFlight.delete(key)
    }
    return
  }
}

/**
 * Idempotent — calling more than once is a no-op. Call once from
 * `app.whenReady().then(...)` after the simulations store is initialised.
 */
export function startSimulationWorker(): void {
  if (timer) return

  // First-pass recovery: reset any in-flight outcomes from a prior crash.
  for (const profile of profileStore.getAll()) {
    try {
      recoveryPass(profile.id)
    } catch (err) {
      console.error('[sim-worker] recoveryPass failed for', profile.id, err)
    }
  }

  timer = setInterval(() => {
    const profiles = profileStore.getAll()
    ;(async () => {
      for (const profile of profiles) {
        try {
          await tickForProfile(profile.id)
        } catch (err) {
          console.error('[sim-worker] tick failed for', profile.id, err)
        }
      }
    })()
  }, POLL_MS)

  console.log('[sim-worker] started; poll interval', POLL_MS, 'ms')
}

/** Stop the worker. Useful for tests; not called in production. */
export function stopSimulationWorker(): void {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
}
