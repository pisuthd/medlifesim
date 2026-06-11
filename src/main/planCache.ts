/**
 * In-memory cache for the simulation worker's analysis plan.
 *
 * The worker generates a one-shot plan per simulation (Step 1 of the
 * redesigned pipeline) and holds it here for the rest of the run. The
 * IPC handler `simulations:getReport` reads from this cache so the
 * renderer can show comparison groups and hypotheses alongside the
 * per-outcome JSONs.
 *
 * **No persistence.** The plan is intentionally NOT saved to
 * `simulation.json` — the user said "generate during the process,
 * then forget." If the worker is restarted, the cache is empty and
 * `getReport` returns `null` for the plan. The per-outcome JSONs
 * (which ARE persisted to disk) are still returned, so the report
 * page still has data to render — it just lacks the comparison
 * structure until the worker runs again.
 */
import type { AnalysisPlan } from '../preload/simulation'

const plans = new Map<string, AnalysisPlan | null>()

function key(profileSlug: string, simId: string): string {
  return `${profileSlug}::${simId}`
}

/**
 * Record the worker's plan (or its absence) for a simulation.
 * `null` means the worker tried to plan but the model returned
 * unusable output; the renderer treats that the same as "no plan".
 */
export function setAnalysisPlan(
  profileSlug: string,
  simId: string,
  plan: AnalysisPlan | null
): void {
  plans.set(key(profileSlug, simId), plan)
}

/**
 * Read the cached plan for a simulation.
 * - `undefined` → the worker hasn't run a planning pass for this sim yet
 * - `null`      → the worker tried and failed; per-outcome still ran without a plan
 * - `AnalysisPlan` → the plan to render alongside the per-outcome JSONs
 */
export function getAnalysisPlan(
  profileSlug: string,
  simId: string
): AnalysisPlan | null | undefined {
  return plans.get(key(profileSlug, simId))
}
