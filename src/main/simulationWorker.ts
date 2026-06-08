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
import type { SimulationOutcome } from '../preload/simulation'

/**
 * Background worker that drains queued simulation outcomes one at a time
 * and feeds each to the AI via the existing `runCompletion` pipeline.
 *
 * The worker is intentionally conservative:
 *   - Polls every POLL_MS ms (default 1.5s) so a freed model is picked up
 *     quickly after the previous outcome finishes.
 *   - Concurrency is globally 1 — the local model can only stream one
 *     completion at a time, so any second concurrent request gets
 *     rejected by the registry's concurrency policy. The tick bails out
 *     immediately if any outcome is already in flight, and only the
 *     in-flight tick continues running the inner loop.
 *   - On startup it runs a recovery pass that flips any `processing`
 *     outcome back to `pending` (handles crashes that left the queue
 *     in a stuck state).
 *
 * No tools are attached — outcomes are produced by the model's own
 * reasoning over the structured prompt built by `buildOutcomePrompt`.
 */

const POLL_MS = 1500
let timer: NodeJS.Timeout | null = null
const inFlight = new Set<string>()

function outcomeKey(simId: string, outcomeId: string): string {
  return `${simId}::${outcomeId}`
}

// /** Build the user-turn prompt for a single outcome. */
// function buildOutcomePrompt(outcome: SimulationOutcome): string {
//   const p = outcome.pathLabels
//   return `You are analysing a public-health scenario for a clinician. Estimate the
// likely health outcome for the path below based on the environment,
// subject population, exposure, current health state, and proposed
// intervention. Use evidence-based reasoning and produce a structured
// response with these sections, in this order:

// 1. SUMMARY (2-3 sentences describing the projected outcome)
// 2. RISK (estimated 0-100 percentage of adverse events in this subgroup)
// 3. SEVERE_CASE_RATE (estimated 0-100 percentage of cases that become severe)
// 4. KEY_DRIVERS (3-5 bullet points explaining the most important factors)
// 5. RECOMMENDATIONS (2-4 actionable public-health recommendations)
// 6. UNCERTAINTY (1-2 sentences on what data would most change the estimate)

// Path:
// - Environment: ${p.environment}
// - Subject: ${p.subject}
// - Exposure: ${p.exposure}
// - Health State: ${p.healthState}
// - Intervention: ${p.intervention}

// Format the response in clear markdown with the section headings above as
// level-2 headings (## SUMMARY, ## RISK, etc.). Do not include any text
// before the SUMMARY section.`
// }

/** DEBUG: Simple prompt to test the worker flow without AI */
function buildOutcomePrompt(_outcome: SimulationOutcome): string {
  return 'hello'
}

async function processOutcome(
  profileSlug: string,
  simId: string,
  outcome: SimulationOutcome
): Promise<void> {
  const parentBefore = getSimulation(profileSlug, simId)
  const completedBefore = parentBefore?.completedCount ?? 0
  const errorCountBefore = parentBefore?.errorCount ?? 0
  const outcomeCount = parentBefore?.outcomeCount ?? 0

  // Provision the child chat session lazily — only the outcome currently
  // being processed should appear in the chat list.
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

  try {
     console.log(`[sim-worker] before runCompletion ${outcome.id}`)
    await runCompletion({
      profileSlug,
      sessionSlug: outcome.sessionSlug,
      userMessage: buildOutcomePrompt(outcome),
      history: [],
    }, {}, 'worker')
    console.log(`[sim-worker] outcome ${outcome.id} done`)
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

async function tickForProfile(profileSlug: string): Promise<void> {
  // If any outcome is already running we must not start a second one — the
  // model only allows one completion request at a time and would reject
  // the second one. Bail out so the next poll tick can pick this up.
  if (inFlight.size > 0) return

  // Defer when the chat IPC is mid-completion. runCompletion's withLock
  // would queue us behind chat, but the worker is allowed to skip the
  // tick and retry 1.5s later — chat is interactive, the worker's
  // outcomes can afford to wait. This also keeps the worker from
  // submitting a second concurrent request that the SDK's
  // oneAtATimePerModel policy would reject.
  if (shouldDefer()) {
    console.log('[sim-worker] tick deferred: completion in flight')
    return
  }

  const pending = listPendingOutcomes(profileSlug)
  for (const { simId, outcome } of pending) {
    const key = outcomeKey(simId, outcome.id)
    inFlight.add(key)
    try {
      await processOutcome(profileSlug, simId, outcome)
    } finally {
      inFlight.delete(key)
    }
    // One outcome per tick — stop after the first finishes so the next
    // tick (and the next profile in the rotation) gets a fair chance.
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
    // Run serially across profiles. tickForProfile is a no-op while any
    // outcome is in flight, so a long completion can't queue concurrent
    // requests that the model would reject.
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
