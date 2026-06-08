import type {
  PlacedCard,
  SimCardTemplate,
  SimCategory,
  SimTone,
} from '../types/simulation'

/**
 * Pure placeholder data for the simulation builder.
 * Realistic scenarios for Thailand-focused pilots.
 *
 * Outcome computation lives in `simulationPaths.ts` and `simulationTemplates.ts`.
 * This file is intentionally limited to: card catalog, tone utilities, and
 * connection-rule helpers.
 */

export const CATEGORY_ORDER: SimCategory[] = [
  'environment',
  'subject',
  'exposure',
  'health-state',
  'intervention',
]

export const CATEGORY_LABELS: Record<SimCategory, string> = {
  environment: 'Environment',
  subject: 'Subject',
  exposure: 'Exposure',
  'health-state': 'Health State',
  intervention: 'Intervention',
}

export const CATEGORY_PREFIX: Record<SimCategory, string> = {
  environment: 'ENV',
  subject: 'SUBJ',
  exposure: 'EXPO',
  'health-state': 'HEAL',
  intervention: 'INT',
}

export const PALETTE_CARDS: SimCardTemplate[] = [
  // ── Environment ───────────────────────────────────────────────────────
  {
    id: 'env-urban-school-bkk',
    category: 'environment',
    title: 'Urban School',
    subtitle: 'Public school near main roads',
    badge: 'High traffic • AQI 160',
  },
  {
    id: 'env-office-highrise',
    category: 'environment',
    title: 'High-rise Office',
    subtitle: 'Open-plan bullpen',
    badge: '100 sq.m • AC',
  },
  {
    id: 'env-family-home',
    category: 'environment',
    title: 'Multi-gen Family Home',
    subtitle: 'Bangkok suburb',
    badge: '4–6 members',
  },
  {
    id: 'env-local-community',
    category: 'environment',
    title: 'Local Community',
    subtitle: 'Semi-urban Northeast',
    badge: 'Local gathering spots',
  },

  // ── Subject ───────────────────────────────────────────────────────────
  {
    id: 'subj-school-children',
    category: 'subject',
    title: 'School Children',
    subtitle: 'Primary students',
    badge: 'n=30 • Age 7–12',
  },
  {
    id: 'subj-non-smokers',
    category: 'subject',
    title: 'Non-Smokers',
    subtitle: 'Office workers',
    badge: 'n=15',
  },
  {
    id: 'subj-smokers',
    category: 'subject',
    title: 'Smokers',
    subtitle: 'Office workers',
    badge: 'n=5',
  },
  {
    id: 'subj-elderly',
    category: 'subject',
    title: 'Elderly Parents',
    subtitle: '65+ with chronic conditions',
    badge: 'Age 70+',
  },
  {
    id: 'subj-caregivers',
    category: 'subject',
    title: 'Family Caregivers',
    subtitle: 'Working-age children',
    badge: 'Age 35–55',
  },
  {
    id: 'subj-teens',
    category: 'subject',
    title: 'At-risk Teens',
    subtitle: '13–19 years',
    badge: 'Meth/cannabis exposure',
  },

  // ── Exposure ──────────────────────────────────────────────────────────
  {
    id: 'exp-pm25-outdoor',
    category: 'exposure',
    title: 'PM2.5 Outdoor',
    subtitle: 'Recess & sports',
    badge: 'Daily outdoor',
  },
  {
    id: 'exp-indoor-smoking',
    category: 'exposure',
    title: 'Indoor Secondhand Smoke',
    subtitle: 'Shared office air',
    badge: '8h daily',
  },
  {
    id: 'exp-caregiving-load',
    category: 'exposure',
    title: 'Daily Caregiving',
    subtitle: 'Physical + emotional',
    badge: 'Ongoing',
  },
  {
    id: 'exp-drug-social',
    category: 'exposure',
    title: 'Peer Drug Access',
    subtitle: 'Meth/cannabis',
    badge: 'High availability',
  },

  // ── Health State ──────────────────────────────────────────────────────
  {
    id: 'hs-respiratory-cough',
    category: 'health-state',
    title: 'Respiratory Irritation',
    subtitle: 'Cough, runny nose',
    badge: 'PM2.5 related',
  },
  {
    id: 'hs-burnout-stress',
    category: 'health-state',
    title: 'Caregiver Burnout',
    subtitle: 'Fatigue + depression',
    badge: 'Ongoing stress',
  },
  {
    id: 'hs-addiction-early',
    category: 'health-state',
    title: 'Early Substance Use',
    subtitle: 'Aggression, insomnia',
    badge: 'Meth/cannabis',
  },
  {
    id: 'hs-asymptomatic',
    category: 'health-state',
    title: 'Asymptomatic',
    subtitle: 'No visible issues',
    badge: 'Baseline',
  },

  // ── Intervention ──────────────────────────────────────────────────────
  {
    id: 'int-no-intervention',
    category: 'intervention',
    title: 'Do Nothing',
    subtitle: 'Baseline',
    badge: 'No change',
  },
  {
    id: 'int-air-purifiers-masks',
    category: 'intervention',
    title: 'Purifiers + Masks',
    subtitle: 'School policy',
    badge: 'Air quality',
  },
  {
    id: 'int-no-smoking-policy',
    category: 'intervention',
    title: 'No-Smoking Policy',
    subtitle: 'Indoor ban',
    badge: 'Workplace',
  },
  {
    id: 'int-respite-care',
    category: 'intervention',
    title: 'Respite + Support',
    subtitle: 'Hire help / day care',
    badge: 'Family',
  },
  {
    id: 'int-education-counseling',
    category: 'intervention',
    title: 'Education + Counseling',
    subtitle: 'School / community',
    badge: 'Substance prevention',
  },
]

export const TONE_COLORS: Record<SimTone, string> = {
  blue: '#1A1AE8',
  teal: '#3EC4C0',
  navy: '#0a0a5c',
  muted: '#9999bb',
}

const TONE_VALUES: SimTone[] = ['blue', 'teal', 'navy', 'muted']

export function randomTone(seed: string): SimTone {
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i)
    hash |= 0
  }
  return TONE_VALUES[Math.abs(hash) % TONE_VALUES.length]
}

export const TONE_TINT = (tone: SimTone): string => {
  const c = TONE_COLORS[tone]
  if (tone === 'teal') return 'rgba(62,196,192,0.16)'
  if (tone === 'muted') return 'rgba(153,153,187,0.14)'
  return c.length === 7 ? c + '12' : c
}

/** Connection rules (strict linear pipeline). */
const VALID_CONNECTIONS: Record<SimCategory, SimCategory[]> = {
  environment: ['subject'],
  subject: ['exposure'],
  exposure: ['health-state'],
  'health-state': ['intervention'],
  intervention: [],
}

export function canConnect(from: SimCategory, to: SimCategory): boolean {
  return VALID_CONNECTIONS[from]?.includes(to) ?? false
}

export function describeConnectionRule(target: SimCategory): string {
  const allowed = Object.entries(VALID_CONNECTIONS)
    .filter(([, targets]) => targets.includes(target))
    .map(([src]) => CATEGORY_LABELS[src as SimCategory])
  return allowed.length === 0
    ? `${CATEGORY_LABELS[target]} cannot accept connections.`
    : `${CATEGORY_LABELS[target]} can only accept connections from ${allowed.join(' or ')}.`
}

export function toPlacedCard(template: SimCardTemplate, placementId: string): PlacedCard {
  return { ...template, placementId, tone: randomTone(placementId) }
}

export function cardHasInput(category: SimCategory): boolean {
  return category !== 'environment'
}

export function cardHasOutput(category: SimCategory): boolean {
  return category !== 'intervention'
}
