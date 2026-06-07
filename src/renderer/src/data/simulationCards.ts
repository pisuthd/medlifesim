import type {
  CanvasCard,
  Connection,
  PlacedCard,
  SimCardTemplate,
  SimCategory,
  SimOutcome,
  SimTone,
} from '../types/simulation'

/**
 * Pure placeholder data for the simulation builder. No AI, no I/O — the
 * goal is to populate the UI with realistic-looking scenarios so the
 * drag-and-drop flow can be exercised end-to-end.
 */

/** Pipeline order — drives the left-to-right layout of the canvas stages. */
export const CATEGORY_ORDER: SimCategory[] = [
  'environment',
  'subject',
  'exposure',
  'health-state',
  'intervention',
]

/** Short uppercase labels for the palette section headers and stage headers. */
export const CATEGORY_LABELS: Record<SimCategory, string> = {
  environment: 'Environment',
  subject: 'Subject',
  exposure: 'Exposure',
  'health-state': 'Health State',
  intervention: 'Intervention',
}

/** Tag shown on each card in the form `CATEGORY • BADGE`. */
export const CATEGORY_PREFIX: Record<SimCategory, string> = {
  environment: 'ENV',
  subject: 'SUBJ',
  exposure: 'EXPO',
  'health-state': 'HEAL',
  intervention: 'INT',
}

/** Hand-tuned palette. Each card keeps an explicit `tone` for the left border. */
export const PALETTE_CARDS: SimCardTemplate[] = [
  // ── Environment ───────────────────────────────────────────────────────
  {
    id: 'env-urban-school',
    category: 'environment',
    title: 'Urban School',
    subtitle: 'City center district',
    badge: 'AQI 120–180',
    tone: 'blue',
  },
  {
    id: 'env-rural-school',
    category: 'environment',
    title: 'Rural School',
    subtitle: 'Low-traffic village',
    badge: 'AQI 20–40',
    tone: 'teal',
  },
  {
    id: 'env-industrial-warehouse',
    category: 'environment',
    title: 'Industrial Warehouse',
    subtitle: 'Factory adjacent',
    badge: 'AQI 180–250',
    tone: 'navy',
  },

  // ── Subject ───────────────────────────────────────────────────────────
  {
    id: 'subj-child-a',
    category: 'subject',
    title: 'Child A',
    subtitle: '7-year-old boy',
    badge: 'Age 7 • M',
    tone: 'teal',
  },
  {
    id: 'subj-child-b',
    category: 'subject',
    title: 'Child B',
    subtitle: '9-year-old boy',
    badge: 'Age 9 • M',
    tone: 'teal',
  },
  {
    id: 'subj-smoker-group',
    category: 'subject',
    title: 'Group A',
    subtitle: '10 smoking employees',
    badge: 'n=10 • Smokers',
    tone: 'navy',
  },
  {
    id: 'subj-nonsmoker-group',
    category: 'subject',
    title: 'Group B',
    subtitle: '90 non-smoking employees',
    badge: 'n=90 • Non-smokers',
    tone: 'muted',
  },

  // ── Exposure ──────────────────────────────────────────────────────────
  {
    id: 'exp-outdoor-activity',
    category: 'exposure',
    title: 'Outdoor Activity',
    subtitle: '2h recess daily',
    badge: '2h • Outdoor',
    tone: 'blue',
  },
  {
    id: 'exp-indoor-shared',
    category: 'exposure',
    title: 'Indoor Shared Workspace',
    subtitle: 'Smoking allowed freely',
    badge: '8h • Indoor',
    tone: 'navy',
  },
  {
    id: 'exp-ventilated-classroom',
    category: 'exposure',
    title: 'Ventilated Classroom',
    subtitle: 'HVAC + open windows',
    badge: '6h • Indoor',
    tone: 'teal',
  },

  // ── Health state ──────────────────────────────────────────────────────
  {
    id: 'hs-mild-symptoms',
    category: 'health-state',
    title: 'Mild Cough',
    subtitle: 'No fever, productive cough',
    badge: 'Day 1–3',
    tone: 'muted',
  },
  {
    id: 'hs-severe-symptoms',
    category: 'health-state',
    title: 'Severe Respiratory',
    subtitle: 'Fever, dyspnea, hypoxia',
    badge: 'Day 3–7',
    tone: 'navy',
  },
  {
    id: 'hs-asymptomatic',
    category: 'health-state',
    title: 'Asymptomatic',
    subtitle: 'No visible symptoms',
    badge: 'No onset',
    tone: 'teal',
  },

  // ── Intervention ──────────────────────────────────────────────────────
  {
    id: 'int-no-intervention',
    category: 'intervention',
    title: 'No Intervention',
    subtitle: 'Continue current practices',
    badge: 'Baseline',
    tone: 'muted',
  },
  {
    id: 'int-infection-care',
    category: 'intervention',
    title: 'Infection-Focused Care',
    subtitle: 'Testing + isolation protocols',
    badge: 'Tier 1',
    tone: 'blue',
  },
  {
    id: 'int-air-quality',
    category: 'intervention',
    title: 'Air Quality Mitigation',
    subtitle: 'Purifiers + mask mandate',
    badge: 'Tier 2',
    tone: 'teal',
  },
  {
    id: 'int-policy-change',
    category: 'intervention',
    title: 'Policy Change',
    subtitle: 'Smoking ban + remote work',
    badge: 'Tier 3',
    tone: 'navy',
  },
]

/** Hand-tuned baseline numbers per intervention. Higher tier → lower risk. */
const INTERVENTION_BASELINES: Record<string, { infection: number; severe: number; summary: string }> = {
  'int-no-intervention': {
    infection: 30,
    severe: 8,
    summary:
      'Without any mitigation the baseline cohort is expected to see a moderate infection rate with a small severe-case tail.',
  },
  'int-infection-care': {
    infection: 18,
    severe: 4,
    summary:
      'Targeted testing and isolation cuts spread by roughly 40%, with a proportional drop in severe cases that follow exposure.',
  },
  'int-air-quality': {
    infection: 12,
    severe: 3,
    summary:
      'Indoor air purification and masking reduces airborne transmission sharply; severe cases fall below typical cohort baselines.',
  },
  'int-policy-change': {
    infection: 6,
    severe: 1,
    summary:
      'Eliminating shared smoking exposure and shifting to remote work yields the strongest projected drop in both infection and severity.',
  },
}

/** Fallback when an unknown intervention id slips in. */
const UNKNOWN_INTERVENTION = {
  infection: 20,
  severe: 5,
  summary: 'Generic intervention profile — numbers are placeholders pending a real model.',
}

/** Map tone to a hex color so components don't need to know the palette mapping. */
export const TONE_COLORS: Record<SimTone, string> = {
  blue: '#1A1AE8',
  teal: '#3EC4C0',
  navy: '#0a0a5c',
  muted: '#9999bb',
}

/** 12% alpha tint of the tone color, used as the stage column header background. */
export const TONE_TINT = (tone: SimTone): string => {
  const c = TONE_COLORS[tone]
  // Hex → rgba. Slightly higher alpha for teal so it stays visible on the white stage.
  if (tone === 'teal') return 'rgba(62,196,192,0.16)'
  if (tone === 'muted') return 'rgba(153,153,187,0.14)'
  // blue / navy
  if (c.length === 7) return c + '12'
  return c
}

/**
 * Per-target connection rules. Each entry lists the source categories
 * that are allowed to flow INTO the keyed target. The shape of the DAG
 * is a strict linear chain:
 *
 *   env → subject → exposure → health-state → intervention
 *
 * Every link must be present for a complete outcome.
 */
const VALID_CONNECTIONS: Record<SimCategory, SimCategory[]> = {
  environment: ['subject'],
  subject: ['exposure'],
  exposure: ['health-state'],
  'health-state': ['intervention'],
  intervention: [],
}

/** True when an output-port of `from` is allowed to feed an input-port of `to`. */
export function canConnect(from: SimCategory, to: SimCategory): boolean {
  return VALID_CONNECTIONS[from]?.includes(to) ?? false
}

/**
 * Human-readable explanation of which sources a target accepts. Used as
 * the warning toast text when the user attempts an invalid connection.
 */
export function describeConnectionRule(target: SimCategory): string {
  const allowed = (Object.entries(VALID_CONNECTIONS) as [SimCategory, SimCategory[]][])
    .filter(([, targets]) => targets.includes(target))
    .map(([src]) => CATEGORY_LABELS[src])
  if (allowed.length === 0) {
    return `${CATEGORY_LABELS[target]} cannot accept connections.`
  }
  return `${CATEGORY_LABELS[target]} can only accept connections from ${allowed.join(' or ')}.`
}

/**
 * Enumerate every outcome reachable through the connection graph. Walks
 * the linear chain
 *   env → subject → exposure → health-state → intervention
 * via the directed edges in `connections`. Each fully-resolved tuple
 * (env, sub, expo, health, int) produces one outcome.
 *
 * For the example "1 env, 2 sub, 1 expo, 1 health, 2 int, all-to-all
 * connected" this yields 1×2×1×1×2 = 4 outcomes.
 */
export function generateOutcomes(
  cards: CanvasCard[],
  connections: Connection[],
): SimOutcome[] {
  const byId = new Map(cards.map((c) => [c.placementId, c]))
  const out = new Map<string, string[]>()
  for (const c of connections) {
    if (!out.has(c.from)) out.set(c.from, [])
    out.get(c.from)!.push(c.to)
  }
  function childrenOfCat(id: string, cat: SimCategory): CanvasCard[] {
    return (out.get(id) ?? [])
      .map((toId) => byId.get(toId))
      .filter((c): c is CanvasCard => !!c && c.category === cat)
  }

  // AQI shift is per-env, so compute once per env loop iteration.
  function aqiShiftFor(env: CanvasCard): number {
    const match = env.badge.match(/(\d+)/)
    if (!match) return 0
    const aqi = parseInt(match[1], 10)
    return Math.max(-10, Math.min(10, (aqi - 100) / 5))
  }

  const envs = cards.filter((c) => c.category === 'environment')
  const results: SimOutcome[] = []
  let idx = 0
  for (const env of envs) {
    const aqiShift = aqiShiftFor(env)
    for (const sub of childrenOfCat(env.placementId, 'subject')) {
      for (const expo of childrenOfCat(sub.placementId, 'exposure')) {
        for (const health of childrenOfCat(expo.placementId, 'health-state')) {
          for (const int of childrenOfCat(health.placementId, 'intervention')) {
            const baseline = INTERVENTION_BASELINES[int.id] ?? UNKNOWN_INTERVENTION
            const infection = Math.max(0, Math.min(100, Math.round(baseline.infection + aqiShift)))
            const severe = Math.max(0, Math.min(100, Math.round(baseline.severe + aqiShift / 2)))
            const tone: SimOutcome['tone'] =
              infection < 15 ? 'good' : infection >= 25 ? 'bad' : 'neutral'
            results.push({
              id: `outcome-${idx++}-${env.placementId}-${sub.placementId}-${expo.placementId}-${health.placementId}-${int.placementId}`,
              pathLabels: {
                environment: env.title,
                subject: sub.title,
                exposure: expo.title,
                healthState: health.title,
                intervention: int.title,
              },
              interventionId: int.id,
              infectionRate: infection,
              severeCaseRate: severe,
              summary: baseline.summary,
              tone,
            })
          }
        }
      }
    }
  }
  return results
}

/**
 * True when the canvas has at least one complete path through the DAG
 * (env → sub → expo → health → int). Equivalent to "at least one
 * outcome would be generated", so we just delegate.
 */
export function canGenerate(cards: CanvasCard[], connections: Connection[]): boolean {
  return generateOutcomes(cards, connections).length > 0
}

/** Convert a freshly-dropped template into a PlacedCard. */
export function toPlacedCard(template: SimCardTemplate, placementId: string): PlacedCard {
  return { ...template, placementId }
}

/** True when cards of this category expose a left-edge input port. */
export function cardHasInput(category: SimCategory): boolean {
  return category !== 'environment'
}

/** True when cards of this category expose a right-edge output port. */
export function cardHasOutput(category: SimCategory): boolean {
  return category !== 'intervention'
}
