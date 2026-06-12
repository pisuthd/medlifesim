import { profileStore } from './profileStore'
import { runCompletion } from './index'
import { shouldDefer } from './completionLock'
import { getActiveOutcomeModelId, getActiveModelId } from './qvac'
import {
  bumpCompleted,
  broadcastProgress,
  getSimulation,
  listPendingOutcomes,
  recoveryPass,
  updateOutcome,
} from './simulations'
import { createSession, sessionExists } from './sessions'
import type { SimulationOutcome } from '../preload/simulation'

/**
 * Background worker that drains queued simulation outcomes.
 *
 * Each pending outcome is processed by `processOutcome`: it asks
 * the model to return a structured JSON for the per-outcome
 * analysis, parses the result with the brace-counted
 * `tryParseJsonObject` (which strips `//` line comments the 1.7B
 * model sometimes adds), and either marks the outcome `done` or
 * `error` based on whether the response is parseable. No retries —
 * the recent-simulation page has a Retry button that calls
 * `simulations:requeue` for explicit manual recovery.
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
// Per-outcome analysis
// ─────────────────────────────────────────────────────────────────────────

/**
 * System prompt for a single per-outcome analysis. The SINGLE
 * source of truth for role, task, output schema, and format rule.
 * The user prompt deliberately carries none of these so the model
 * doesn't get conflicting instructions.
 *
 * Exported so the dataset store can re-emit identical
 * system+user+assistant triples as SFT JSONL when assembling
 * fine-tuning data from completed outcomes.
 */
export function buildPerOutcomeSystemPrompt(): string {
  return `You are a senior public-health analyst. The user will describe
a single path (subject + exposure + intervention) below. Estimate
the likely health outcome for that path based on the subject
population, exposure (including the setting where risk originates),
and proposed intervention. Use evidence-based reasoning.

Output a single JSON object (no prose, no markdown, no code fences,
no commentary). The object must have exactly these fields:

1. "summary" (string): 2–3 sentences describing the projected
   outcome for this specific path.

2. "risk" (number or [lo, hi] tuple of two numbers, where lo is
   the LOWER bound and hi is the UPPER bound — e.g. [10, 25] not
   [25, 10]): estimated 0–100 percentage of adverse events in
   this subgroup.

3. "severeCaseRate" (same shape as risk — number or [lo, hi]
   tuple with lo first, hi second): estimated 0–100 percentage
   of cases that become severe.

4. "keyDrivers" (array of 3–5 strings): the most important factors
   driving this outcome.

5. "recommendations" (array of 2–4 strings): actionable
   public-health recommendations.

6. "uncertainty" (string): 1–2 sentences on what data would most
   change the estimate.

Output the JSON object, then stop.`
}

/**
 * Brace-counted extractor for a single JSON object. Mirrors the
 * shape used by the renderer's `PromptToScenarioModal` — works
 * against a streaming 1.7B model that has a habit of wrapping JSON
 * in stray prose. Strips `//` line comments before `JSON.parse`
 * because the 1.7B model sometimes annotates its JSON.
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
  // Strip // line comments — the 1.7B model sometimes annotates its
  // JSON with comments that strict JSON.parse rejects. We only touch
  // // ... up to a newline, leaving string contents alone.
  const stripped = candidate.replace(/\/\/[^\n"\\]*(?:\n|$)/g, (m) =>
    m.endsWith('\n') ? '\n' : ''
  )
  try {
    return JSON.parse(stripped)
  } catch {
    return null
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Per-outcome analysis
// ─────────────────────────────────────────────────────────────────────────

/**
 * User prompt for a single outcome. Carries ONLY the per-outcome
 * data: the canvas's subject disambiguation block (F.14 trick) and
 * the typed Subject / Exposure / Intervention path block. No role,
 * no JSON schema, no format rule — those live entirely in the
 * system prompt.
 *
 * Exported alongside `buildPerOutcomeSystemPrompt` so the dataset
 * store can re-render identical prompts when assembling SFT
 * training data from completed outcomes.
 */
export function buildPerOutcomeUserPrompt(
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

  const allSubjects =
    parentBefore?.canvas.cards
      .filter((c) => c.category === 'subject')
      .map((c) => ({ id: c.id, title: c.title })) ?? []

  const systemPrompt = buildPerOutcomeSystemPrompt()
  const userPrompt = buildPerOutcomeUserPrompt(outcome, allSubjects)

  // Outcomes slot first — this is the model id backing the worker,
  // which is local by default but can be a P2P-delegated model when
  // the consumer has connected to a peer. Fall back to the chat slot
  // for backwards compatibility (the worker's old behaviour).
  const outcomeModelId = getActiveOutcomeModelId() ?? getActiveModelId()
  if (!outcomeModelId) {
    // No model available. Mark errored, push progress, and let the
    // next tick retry. The chat boot gate will load a model on first
    // launch; the consumer toggles the outcomes slot in Settings.
    updateOutcome(profileSlug, simId, outcome.id, {
      status: 'error',
      error: 'No outcomes model loaded. Load a base model, or connect a P2P peer.',
    })
    bumpCompleted(profileSlug, simId, 0, +1)
    broadcastProgress({
      simId,
      outcomeId: outcome.id,
      status: 'error',
      error: 'No outcomes model loaded',
      completedCount: completedBefore + 1,
      outcomeCount,
    })
    return
  }

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
      'worker',
      outcomeModelId
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
    bumpCompleted(profileSlug, simId, 0, +1)
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

  // Process one outcome per tick. The next tick picks up the rest.
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
