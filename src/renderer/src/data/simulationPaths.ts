import type {
  CanvasCard,
  CanvasState,
  Connection,
  SimCategory,
  SimPathPreview,
} from '../types/simulation'

/** A canvas with no cards and no connections. */
export const EMPTY_CANVAS: CanvasState = { cards: [], connections: [] }

/**
 * Pure logic for enumerating all valid env → subj → expo → health → intv
 * paths from a canvas. Returns path-only previews (no risk or summary
 * data) — those come from the AI after the user clicks Proceed in the
 * builder.
 *
 * Replaces the old `generateOutcomes` in simulationCards.ts which used
 * the hardcoded `INTERVENTION_BASELINES` table.
 */

function freshId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return 'outcome-' + crypto.randomUUID()
  }
  return 'outcome-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8)
}

/**
 * Enumerate all valid paths through the canvas's connection graph.
 * Each path is a 5-tuple (env, subj, expo, health, intv) of placed cards.
 */
export function enumeratePaths(
  cards: CanvasCard[],
  connections: Connection[]
): SimPathPreview[] {
  const byId = new Map(cards.map((c) => [c.placementId, c]))
  const outgoing = new Map<string, string[]>()

  for (const conn of connections) {
    if (!outgoing.has(conn.from)) outgoing.set(conn.from, [])
    outgoing.get(conn.from)!.push(conn.to)
  }

  const getChildren = (id: string, cat: SimCategory): CanvasCard[] =>
    (outgoing.get(id) ?? [])
      .map((toId) => byId.get(toId))
      .filter((c): c is CanvasCard => !!c && c.category === cat)

  const results: SimPathPreview[] = []
  const envs = cards.filter((c) => c.category === 'environment')

  for (const env of envs) {
    for (const subj of getChildren(env.placementId, 'subject')) {
      for (const expo of getChildren(subj.placementId, 'exposure')) {
        for (const health of getChildren(expo.placementId, 'health-state')) {
          for (const intv of getChildren(health.placementId, 'intervention')) {
            results.push({
              id: freshId(),
              interventionId: intv.id,
              pathLabels: {
                environment: env.title,
                subject: subj.title,
                exposure: expo.title,
                healthState: health.title,
                intervention: intv.title,
              },
              placementIds: {
                environment: env.placementId,
                subject: subj.placementId,
                exposure: expo.placementId,
                healthState: health.placementId,
                intervention: intv.placementId,
              },
              status: 'pending',
            })
          }
        }
      }
    }
  }

  return results
}

/** Returns true when the canvas has at least one valid path. */
export function canEnumerate(cards: CanvasCard[], connections: Connection[]): boolean {
  return enumeratePaths(cards, connections).length > 0
}
