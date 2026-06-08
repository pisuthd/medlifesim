import { randomTone, toPlacedCard } from './simulationCards'
import { PALETTE_CARDS } from './simulationCards'
import type { CanvasCard, Connection, SimTemplate } from '../types/simulation'

/**
 * Pre-built full-canvas scenarios. Each template ships with pre-connected
 * cards laid out across a 5-column grid (x = 160 / 380 / 600 / 820 / 1040,
 * y = 220 plus a small vertical offset per row). Templates are loaded
 * from the toolbar's "MedLifeSim ▾" dropdown.
 *
 * Connection ids follow the convention `conn-<from>-<to>` for stability.
 */

function lookupTemplate(id: string) {
  const t = PALETTE_CARDS.find((c) => c.id === id)
  if (!t) throw new Error(`Unknown template card id: ${id}`)
  return t
}

function cardAt(templateId: string, placementSuffix: string, x: number, y: number): CanvasCard {
  const t = lookupTemplate(templateId)
  const placementId = `${templateId}-${placementSuffix}`
  return {
    ...toPlacedCard(t, placementId),
    x,
    y,
    collapsed: false,
  }
}

function conn(id: string, from: string, to: string): Connection {
  return { id, from, to }
}

const X_ENV = 160
const X_SUBJ = 380
const X_EXPO = 600
const X_HEAL = 820
const X_INTV = 1040
const Y = 220
const Y_BRANCH = 340

// ─── Template 1: High-Rise Office · Secondhand Smoke ──────────────────
const officeSmokeCards: CanvasCard[] = [
  cardAt('env-office-highrise', '0', X_ENV, Y),
  cardAt('subj-non-smokers', '0', X_SUBJ, Y - 60),
  cardAt('subj-smokers', '0', X_SUBJ, Y + 60),
  cardAt('exp-indoor-smoking', '0', X_EXPO, Y),
  cardAt('hs-respiratory-cough', '0', X_HEAL, Y - 60),
  cardAt('hs-asymptomatic', '0', X_HEAL, Y + 60),
  cardAt('int-no-intervention', '0', X_INTV, Y - 60),
  cardAt('int-no-smoking-policy', '0', X_INTV, Y + 60),
]
const officeSmokeConnections: Connection[] = [
  // env → each subject
  conn('conn-env-non', officeSmokeCards[0].placementId, officeSmokeCards[1].placementId),
  conn('conn-env-smk', officeSmokeCards[0].placementId, officeSmokeCards[2].placementId),
  // each subject → exposure
  conn('conn-non-expo', officeSmokeCards[1].placementId, officeSmokeCards[3].placementId),
  conn('conn-smk-expo', officeSmokeCards[2].placementId, officeSmokeCards[3].placementId),
  // exposure → each health state
  conn('conn-expo-cough', officeSmokeCards[3].placementId, officeSmokeCards[4].placementId),
  conn('conn-expo-asymp', officeSmokeCards[3].placementId, officeSmokeCards[5].placementId),
  // each health state → each intervention (full cartesian)
  conn('conn-cough-noint', officeSmokeCards[4].placementId, officeSmokeCards[6].placementId),
  conn('conn-cough-policy', officeSmokeCards[4].placementId, officeSmokeCards[7].placementId),
  conn('conn-asymp-noint', officeSmokeCards[5].placementId, officeSmokeCards[6].placementId),
  conn('conn-asymp-policy', officeSmokeCards[5].placementId, officeSmokeCards[7].placementId),
]

// ─── Template 2: Community · Teen Drug Addiction ──────────────────────
const teenDrugsCards: CanvasCard[] = [
  cardAt('env-local-community', '0', X_ENV, Y),
  cardAt('subj-teens', '0', X_SUBJ, Y),
  cardAt('exp-drug-social', '0', X_EXPO, Y),
  cardAt('hs-addiction-early', '0', X_HEAL, Y - 60),
  cardAt('hs-asymptomatic', '0', X_HEAL, Y + 60),
  cardAt('int-no-intervention', '0', X_INTV, Y - 60),
  cardAt('int-education-counseling', '0', X_INTV, Y + 60),
]
const teenDrugsConnections: Connection[] = [
  conn('conn-env-teen', teenDrugsCards[0].placementId, teenDrugsCards[1].placementId),
  conn('conn-teen-expo', teenDrugsCards[1].placementId, teenDrugsCards[2].placementId),
  conn('conn-expo-addict', teenDrugsCards[2].placementId, teenDrugsCards[3].placementId),
  conn('conn-expo-asymp', teenDrugsCards[2].placementId, teenDrugsCards[4].placementId),
  conn('conn-addict-noint', teenDrugsCards[3].placementId, teenDrugsCards[5].placementId),
  conn('conn-addict-edu', teenDrugsCards[3].placementId, teenDrugsCards[6].placementId),
  conn('conn-asymp-noint', teenDrugsCards[4].placementId, teenDrugsCards[5].placementId),
  conn('conn-asymp-edu', teenDrugsCards[4].placementId, teenDrugsCards[6].placementId),
]

// ─── Template 3: Family · Elderly Care ─────────────────────────────────
const elderCareCards: CanvasCard[] = [
  cardAt('env-family-home', '0', X_ENV, Y),
  cardAt('subj-elderly', '0', X_SUBJ, Y - 60),
  cardAt('subj-caregivers', '0', X_SUBJ, Y + 60),
  cardAt('exp-caregiving-load', '0', X_EXPO, Y),
  cardAt('hs-burnout-stress', '0', X_HEAL, Y - 60),
  cardAt('hs-asymptomatic', '0', X_HEAL, Y + 60),
  cardAt('int-no-intervention', '0', X_INTV, Y - 60),
  cardAt('int-respite-care', '0', X_INTV, Y + 60),
]
const elderCareConnections: Connection[] = [
  conn('conn-env-elder', elderCareCards[0].placementId, elderCareCards[1].placementId),
  conn('conn-env-care', elderCareCards[0].placementId, elderCareCards[2].placementId),
  conn('conn-elder-care', elderCareCards[1].placementId, elderCareCards[3].placementId),
  conn('conn-caregiver-care', elderCareCards[2].placementId, elderCareCards[3].placementId),
  conn('conn-care-burnout', elderCareCards[3].placementId, elderCareCards[4].placementId),
  conn('conn-care-asymp', elderCareCards[3].placementId, elderCareCards[5].placementId),
  conn('conn-burnout-noint', elderCareCards[4].placementId, elderCareCards[6].placementId),
  conn('conn-burnout-respite', elderCareCards[4].placementId, elderCareCards[7].placementId),
  conn('conn-asymp-noint', elderCareCards[5].placementId, elderCareCards[6].placementId),
  conn('conn-asymp-respite', elderCareCards[5].placementId, elderCareCards[7].placementId),
]

// Touch randomTone so the import isn't dead-code-eliminated (the helper is
// invoked through toPlacedCard). Mark the constant for clarity.
void randomTone
void Y_BRANCH

export const SIM_TEMPLATES: SimTemplate[] = [
  {
    id: 'office-smoke',
    name: 'Office · Secondhand Smoke',
    description:
      'High-rise office with mixed smoker / non-smoker staff and indoor exposure.',
    canvas: { cards: officeSmokeCards, connections: officeSmokeConnections },
  },
  {
    id: 'teen-drugs',
    name: 'Community · Teen Drug Addiction',
    description:
      'Semi-urban community with at-risk teens exposed to peer drug access.',
    canvas: { cards: teenDrugsCards, connections: teenDrugsConnections },
  },
  {
    id: 'elder-care',
    name: 'Family · Elderly Care',
    description:
      'Multi-generation home with elderly parents and family caregivers under daily strain.',
    canvas: { cards: elderCareCards, connections: elderCareConnections },
  },
]
