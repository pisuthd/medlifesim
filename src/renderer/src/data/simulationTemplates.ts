import { randomTone, toPlacedCard } from './simulationCards'
import { PALETTE_CARDS } from './simulationCards'
import type { CanvasCard, Connection, SimTemplate } from '../types/simulation'

/**
 * Pre-built full-canvas scenarios. Each template ships with pre-connected
 * cards laid out across a 3-column grid (x = 220 / 540 / 860,
 * y = 220 plus a small vertical offset per row). Templates are loaded
 * from the toolbar's "New Scenario ▾" dropdown.
 *
 * The 3-step pipeline is `subject → exposure → intervention`. The 4
 * environment cards from the old 5-column grid have been recategorized
 * to `exposure` and now sit in the same column as the original
 * exposure cards.
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

const X_SUBJ = 220
const X_EXPO = 540
const X_INTV = 860
const Y = 220

// ─── Template 1: High-Rise Office · Secondhand Smoke ──────────────────
// 2 subjects × 1 exposure × 2 interventions = 4 paths
const officeSmokeCards: CanvasCard[] = [
  cardAt('subj-non-smokers', '0', X_SUBJ, Y - 60),
  cardAt('subj-smokers', '0', X_SUBJ, Y + 60),
  cardAt('exp-indoor-smoking', '0', X_EXPO, Y),
  cardAt('int-no-intervention', '0', X_INTV, Y - 60),
  cardAt('int-no-smoking-policy', '0', X_INTV, Y + 60),
]
const officeSmokeConnections: Connection[] = [
  // each subject → exposure
  conn('conn-non-smoke', officeSmokeCards[0].placementId, officeSmokeCards[2].placementId),
  conn('conn-smk-smoke', officeSmokeCards[1].placementId, officeSmokeCards[2].placementId),
  // exposure → each intervention
  conn('conn-smoke-noint', officeSmokeCards[2].placementId, officeSmokeCards[3].placementId),
  conn('conn-smoke-policy', officeSmokeCards[2].placementId, officeSmokeCards[4].placementId),
]

// ─── Template 2: Community · Teen Drug Addiction ──────────────────────
// 1 subject × 2 exposures × 2 interventions = 4 paths
const teenDrugsCards: CanvasCard[] = [
  cardAt('subj-teens', '0', X_SUBJ, Y),
  cardAt('env-local-community', '0', X_EXPO, Y - 60),
  cardAt('exp-drug-social', '0', X_EXPO, Y + 60),
  cardAt('int-no-intervention', '0', X_INTV, Y - 60),
  cardAt('int-education-counseling', '0', X_INTV, Y + 60),
]
const teenDrugsConnections: Connection[] = [
  conn('conn-teen-community', teenDrugsCards[0].placementId, teenDrugsCards[1].placementId),
  conn('conn-teen-drugs', teenDrugsCards[0].placementId, teenDrugsCards[2].placementId),
  conn('conn-community-noint', teenDrugsCards[1].placementId, teenDrugsCards[3].placementId),
  conn('conn-community-edu', teenDrugsCards[1].placementId, teenDrugsCards[4].placementId),
  conn('conn-drugs-noint', teenDrugsCards[2].placementId, teenDrugsCards[3].placementId),
  conn('conn-drugs-edu', teenDrugsCards[2].placementId, teenDrugsCards[4].placementId),
]

// ─── Template 3: Family · Elderly Care ─────────────────────────────────
// 2 subjects × 2 exposures × 2 interventions = 8 paths
const elderCareCards: CanvasCard[] = [
  cardAt('subj-elderly', '0', X_SUBJ, Y - 60),
  cardAt('subj-caregivers', '0', X_SUBJ, Y + 60),
  cardAt('env-family-home', '0', X_EXPO, Y - 60),
  cardAt('exp-caregiving-load', '0', X_EXPO, Y + 60),
  cardAt('int-no-intervention', '0', X_INTV, Y - 60),
  cardAt('int-respite-care', '0', X_INTV, Y + 60),
]
const elderCareConnections: Connection[] = [
  conn('conn-elder-home', elderCareCards[0].placementId, elderCareCards[2].placementId),
  conn('conn-elder-care', elderCareCards[0].placementId, elderCareCards[3].placementId),
  conn('conn-caregiver-home', elderCareCards[1].placementId, elderCareCards[2].placementId),
  conn('conn-caregiver-care', elderCareCards[1].placementId, elderCareCards[3].placementId),
  conn('conn-home-noint', elderCareCards[2].placementId, elderCareCards[4].placementId),
  conn('conn-home-respite', elderCareCards[2].placementId, elderCareCards[5].placementId),
  conn('conn-care-noint', elderCareCards[3].placementId, elderCareCards[4].placementId),
  conn('conn-care-respite', elderCareCards[3].placementId, elderCareCards[5].placementId),
]

// ─── Template 4: School · Infectious Outbreak ──────────────────────────
// 1 subject × 2 exposures × 2 interventions = 4 paths
const schoolOutbreakCards: CanvasCard[] = [
  cardAt('subj-school-children', '0', X_SUBJ, Y),
  cardAt('exp-respiratory-outbreak', '0', X_EXPO, Y - 60),
  cardAt('exp-indoor-isolation', '0', X_EXPO, Y + 60),
  cardAt('int-no-intervention', '0', X_INTV, Y - 60),
  cardAt('int-vaccination', '0', X_INTV, Y + 60),
]
const schoolOutbreakConnections: Connection[] = [
  conn('conn-children-outbreak', schoolOutbreakCards[0].placementId, schoolOutbreakCards[1].placementId),
  conn('conn-children-isolation', schoolOutbreakCards[0].placementId, schoolOutbreakCards[2].placementId),
  conn('conn-outbreak-noint', schoolOutbreakCards[1].placementId, schoolOutbreakCards[3].placementId),
  conn('conn-outbreak-vaccine', schoolOutbreakCards[1].placementId, schoolOutbreakCards[4].placementId),
  conn('conn-isolation-noint', schoolOutbreakCards[2].placementId, schoolOutbreakCards[3].placementId),
  conn('conn-isolation-vaccine', schoolOutbreakCards[2].placementId, schoolOutbreakCards[4].placementId),
]

// ─── Template 5: Urban · Metabolic Decline ───────────────────────────
// 1 subject × 2 exposures × 2 interventions = 4 paths
const urbanMetabolicCards: CanvasCard[] = [
  cardAt('subj-non-smokers', '0', X_SUBJ, Y),
  cardAt('exp-sedentary-work', '0', X_EXPO, Y - 60),
  cardAt('exp-pm25-outdoor', '0', X_EXPO, Y + 60),
  cardAt('int-no-intervention', '0', X_INTV, Y - 60),
  cardAt('int-health-screening', '0', X_INTV, Y + 60),
]
const urbanMetabolicConnections: Connection[] = [
  conn('conn-worker-sedentary', urbanMetabolicCards[0].placementId, urbanMetabolicCards[1].placementId),
  conn('conn-worker-pm25', urbanMetabolicCards[0].placementId, urbanMetabolicCards[2].placementId),
  conn('conn-sedentary-noint', urbanMetabolicCards[1].placementId, urbanMetabolicCards[3].placementId),
  conn('conn-sedentary-screening', urbanMetabolicCards[1].placementId, urbanMetabolicCards[4].placementId),
  conn('conn-pm25-noint', urbanMetabolicCards[2].placementId, urbanMetabolicCards[3].placementId),
  conn('conn-pm25-screening', urbanMetabolicCards[2].placementId, urbanMetabolicCards[4].placementId),
]

// ─── Template 6: Maternal · Pregnancy Health ──────────────────────────
// 1 subject × 2 exposures × 2 interventions = 4 paths
const maternalHealthCards: CanvasCard[] = [
  cardAt('subj-pregnant', '0', X_SUBJ, Y),
  cardAt('exp-pm25-outdoor', '0', X_EXPO, Y - 60),
  cardAt('exp-respiratory-outbreak', '0', X_EXPO, Y + 60),
  cardAt('int-no-intervention', '0', X_INTV, Y - 60),
  cardAt('int-clean-air-policy', '0', X_INTV, Y + 60),
]
const maternalHealthConnections: Connection[] = [
  conn('conn-pregnant-pm25', maternalHealthCards[0].placementId, maternalHealthCards[1].placementId),
  conn('conn-pregnant-outbreak', maternalHealthCards[0].placementId, maternalHealthCards[2].placementId),
  conn('conn-pm25-noint', maternalHealthCards[1].placementId, maternalHealthCards[3].placementId),
  conn('conn-pm25-cleanair', maternalHealthCards[1].placementId, maternalHealthCards[4].placementId),
  conn('conn-outbreak-noint', maternalHealthCards[2].placementId, maternalHealthCards[3].placementId),
  conn('conn-outbreak-cleanair', maternalHealthCards[2].placementId, maternalHealthCards[4].placementId),
]

// Touch randomTone so the import isn't dead-code-eliminated (the helper is
// invoked through toPlacedCard).
void randomTone

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
  {
    id: 'school-outbreak',
    name: 'School · Infectious Outbreak',
    description:
      'School children facing respiratory outbreak waves and poor ventilation.',
    canvas: { cards: schoolOutbreakCards, connections: schoolOutbreakConnections },
  },
  {
    id: 'urban-metabolic',
    name: 'Urban · Metabolic Decline',
    description:
      'Office workers with sedentary lifestyle and outdoor air pollution exposure.',
    canvas: { cards: urbanMetabolicCards, connections: urbanMetabolicConnections },
  },
  {
    id: 'maternal-health',
    name: 'Maternal · Pregnancy Health',
    description:
      'Pregnant individuals at high sensitivity to pollution and infectious disease.',
    canvas: { cards: maternalHealthCards, connections: maternalHealthConnections },
  },
]