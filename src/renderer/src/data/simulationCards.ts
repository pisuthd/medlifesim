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
  'subject',
  'exposure',
  'intervention',
]

export const CATEGORY_LABELS: Record<SimCategory, string> = {
  subject: 'Subject',
  exposure: 'Exposure',
  intervention: 'Intervention',
}

export const CATEGORY_PREFIX: Record<SimCategory, string> = {
  subject: 'SUBJ',
  exposure: 'EXPO',
  intervention: 'INT',
}

export const PALETTE_CARDS: SimCardTemplate[] = [
  // ── Exposure (context: where risk originates) ─────────────────────────
  {
    id: 'env-urban-school-bkk',
    category: 'exposure',
    title: 'Urban School',
    subtitle: 'Public school near main roads',
    badge: 'High traffic • AQI 160',
    exposureFields: {
      dose: '35',
      unit: 'PM2.5 µg/m³ (avg)',
      duration: '6h school day',
      frequency: 'daily',
      setting: 'outdoor recess + unfiltered classrooms',
      context: 'Bangkok roadside primary; peak-hour traffic exposure',
    },
  },
  {
    id: 'env-office-highrise',
    category: 'exposure',
    title: 'High-rise Office',
    subtitle: 'Open-plan bullpen',
    badge: '100 sq.m • AC',
    exposureFields: {
      dose: '~30',
      unit: 'm³ per person recirculated',
      duration: '8h',
      frequency: 'daily weekday',
      setting: 'indoor shared office, recirculated AC',
      context: 'Open-plan bullpen with shared ventilation',
    },
  },
  {
    id: 'env-family-home',
    category: 'exposure',
    title: 'Multi-gen Family Home',
    subtitle: 'Bangkok suburb',
    badge: '4–6 members',
    exposureFields: {
      dose: 'variable',
      unit: '—',
      duration: 'continuous',
      frequency: 'daily',
      setting: 'multi-generational suburban home',
      context: 'Bangkok suburb; elderly + working-age cohabitants',
    },
  },
  {
    id: 'env-local-community',
    category: 'exposure',
    title: 'Local Community',
    subtitle: 'Semi-urban Northeast',
    badge: 'Local gathering spots',
    exposureFields: {
      dose: 'social access',
      unit: '—',
      duration: 'after-school + weekend',
      frequency: 'weekly',
      setting: 'semi-urban Northeast Thailand',
      context: 'Temple fairs, market stalls, after-school hangouts',
    },
  },

  // ── Subject ───────────────────────────────────────────────────────────
  {
    id: 'subj-school-children',
    category: 'subject',
    title: 'School Children',
    subtitle: 'Primary students',
    badge: 'n=30 • Age 7–12',
    subjectFields: {
      ageRange: '7-12',
      sampleSize: 'n=30',
      region: 'Bangkok metropolitan',
      comorbidities: [],
      context: 'Healthy primary school cohort; baseline low risk',
    },
  },
  {
    id: 'subj-non-smokers',
    category: 'subject',
    title: 'Non-Smokers',
    subtitle: 'Office workers',
    badge: 'n=15',
    subjectFields: {
      ageRange: '25-45',
      sampleSize: 'n=15',
      region: 'Bangkok CBD',
      comorbidities: ['mild asthma (2/15)'],
      context: 'No personal tobacco use; passive exposure only',
    },
  },
  {
    id: 'subj-smokers',
    category: 'subject',
    title: 'Smokers',
    subtitle: 'Office workers',
    badge: 'n=5',
    subjectFields: {
      ageRange: '25-45',
      sampleSize: 'n=5',
      region: 'Bangkok CBD',
      comorbidities: [],
      context: 'Active smokers; ~10 cigarettes/day baseline',
    },
  },
  {
    id: 'subj-elderly',
    category: 'subject',
    title: 'Elderly Parents',
    subtitle: '65+ with chronic conditions',
    badge: 'Age 70+',
    subjectFields: {
      ageRange: '70+',
      sampleSize: '—',
      region: 'Bangkok suburb',
      comorbidities: ['hypertension', 'type 2 diabetes', 'mild COPD'],
      context: 'Living with adult children; high baseline vulnerability',
    },
  },
  {
    id: 'subj-caregivers',
    category: 'subject',
    title: 'Family Caregivers',
    subtitle: 'Working-age children',
    badge: 'Age 35–55',
    subjectFields: {
      ageRange: '35-55',
      sampleSize: '—',
      region: 'Bangkok suburb',
      comorbidities: [],
      context: 'Working full-time while providing daily eldercare',
    },
  },
  {
    id: 'subj-teens',
    category: 'subject',
    title: 'At-risk Teens',
    subtitle: '13–19 years',
    badge: 'Meth/cannabis exposure',
    subjectFields: {
      ageRange: '13-19',
      sampleSize: '—',
      region: 'Northeast Thailand',
      comorbidities: [],
      context: 'School-attending; peer-network risk factors',
    },
  },

  // ── Exposure ──────────────────────────────────────────────────────────
  {
    id: 'exp-pm25-outdoor',
    category: 'exposure',
    title: 'PM2.5 Outdoor',
    subtitle: 'Recess & sports',
    badge: 'Daily outdoor',
    exposureFields: {
      dose: '50-120',
      unit: 'PM2.5 µg/m³',
      duration: '2h recess + sport',
      frequency: 'daily',
      setting: 'outdoor school grounds',
      context: 'Bangkok burning season exposure pattern',
    },
  },
  {
    id: 'exp-indoor-smoking',
    category: 'exposure',
    title: 'Indoor Secondhand Smoke',
    subtitle: 'Shared office air',
    badge: '8h daily',
    exposureFields: {
      dose: '5 colleagues',
      unit: 'cigarettes/day equivalent',
      duration: '8h',
      frequency: 'daily weekday',
      setting: 'indoor shared office',
      context: 'Unventilated shared airspace with active smokers',
    },
  },
  {
    id: 'exp-caregiving-load',
    category: 'exposure',
    title: 'Daily Caregiving',
    subtitle: 'Physical + emotional',
    badge: 'Ongoing',
    exposureFields: {
      dose: '3-5h/day',
      unit: 'hands-on care',
      duration: 'continuous',
      frequency: 'daily',
      setting: 'family home',
      context: 'Medication, bathing, mobility assistance, emotional support',
    },
  },
  {
    id: 'exp-drug-social',
    category: 'exposure',
    title: 'Peer Drug Access',
    subtitle: 'Meth/cannabis',
    badge: 'High availability',
    exposureFields: {
      dose: 'social',
      unit: '—',
      duration: 'after-school + weekends',
      frequency: 'weekly',
      setting: 'community gathering spots',
      context: 'Easy peer access; no current use',
    },
  },

  // ── Health State ──────────────────────────────────────────────────────
  // Removed: health-state is now an implicit property of each Subject card
  // (baseline context lives in the subject's badge/subtitle). The Exposure
  // column absorbs the previous Environment column to keep a 3-step
  // pipeline: Subject → Exposure → Intervention.
  // ── Intervention ──────────────────────────────────────────────────────
  {
    id: 'int-no-intervention',
    category: 'intervention',
    title: 'Do Nothing',
    subtitle: 'Baseline',
    badge: 'No change',
    interventionFields: {
      type: 'baseline',
      intensity: '—',
      compliance: '—',
      context: 'No policy or behaviour change',
    },
  },
  {
    id: 'int-air-purifiers-masks',
    category: 'intervention',
    title: 'Purifiers + Masks',
    subtitle: 'School policy',
    badge: 'Air quality',
    interventionFields: {
      type: 'device + policy',
      intensity: 'school-wide',
      compliance: 'moderate',
      context: 'HEPA purifiers in classrooms + N95 on high-AQI days',
    },
  },
  {
    id: 'int-no-smoking-policy',
    category: 'intervention',
    title: 'No-Smoking Policy',
    subtitle: 'Indoor ban',
    badge: 'Workplace',
    interventionFields: {
      type: 'policy',
      intensity: 'workplace-wide',
      compliance: 'high',
      context: 'Indoor smoking ban with designated outdoor area',
    },
  },
  {
    id: 'int-respite-care',
    category: 'intervention',
    title: 'Respite + Support',
    subtitle: 'Hire help / day care',
    badge: 'Family',
    interventionFields: {
      type: 'service',
      intensity: 'family-level',
      compliance: 'moderate',
      context: '2x weekly day care + weekly in-home aide',
    },
  },
  {
    id: 'int-education-counseling',
    category: 'intervention',
    title: 'Education + Counseling',
    subtitle: 'School / community',
    badge: 'Substance prevention',
    interventionFields: {
      type: 'education',
      intensity: 'school-wide + community',
      compliance: 'moderate',
      context: 'Curriculum + counsellor office hours + parent workshops',
    },
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

  if (seed === "intervention") {
    return "navy"
  }

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
  subject: ['exposure'],
  exposure: ['intervention'],
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
  return { ...template, placementId, tone: randomTone(template.category) }
}

export function cardHasInput(category: SimCategory): boolean {
  return category !== 'subject'
}

export function cardHasOutput(category: SimCategory): boolean {
  return category !== 'intervention'
}
