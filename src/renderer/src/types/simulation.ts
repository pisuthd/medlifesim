/**
 * Domain types for the drag-and-drop simulation builder. Kept in a
 * dedicated module so the placeholder data and the components can both
 * depend on the same shape without circular imports.
 */

export type SimCategory =
  | 'environment'
  | 'subject'
  | 'exposure'
  | 'health-state'
  | 'intervention'

export type SimTone = 'blue' | 'teal' | 'navy' | 'muted'

export interface SimCardTemplate {
  /** Stable id used by DnD and by generateOutcomes. e.g. 'env-urban-school'. */
  id: string
  category: SimCategory
  /** Short name shown on the card. e.g. 'Urban School'. */
  title: string
  /** Secondary descriptive line. e.g. 'City center district'. */
  subtitle: string
  /** Compact uppercase stat shown above the title. e.g. 'AQI 120–180'. */
  badge: string
  tone?: SimTone
}

/**
 * A card the user has dropped onto a stage. Same shape as the template so
 * the placed card carries forward its colors / badge — but with a fresh
 * `placementId` so the same template can be placed multiple times in the
 * same stage.
 */
export interface PlacedCard extends SimCardTemplate {
  placementId: string
}

export type OutcomeTone = 'good' | 'neutral' | 'bad'

export interface SimOutcome {
  id: string
  /** Display labels for each card in the path. */
  pathLabels: {
    environment: string
    subject: string
    exposure: string
    healthState: string
    intervention: string
  }
  /** The intervention this outcome is keyed to. */
  interventionId: string
  /** 0–100. */
  infectionRate: number
  /** 0–100. */
  severeCaseRate: number
  /** One-sentence placeholder summary. */
  summary: string
  tone: OutcomeTone
}

/**
 * Free-form canvas extensions. A `CanvasCard` is a `PlacedCard` with
 * canvas-space coordinates and a `collapsed` flag for the compressed
 * pill view.
 */
export interface CanvasCard extends PlacedCard {
  /** Canvas-space x of the top-left corner, in px. */
  x: number
  /** Canvas-space y of the top-left corner, in px. */
  y: number
  collapsed: boolean
}

/** A directed connection line between two cards on the canvas. */
export interface Connection {
  id: string
  /** Source `placementId`. */
  from: string
  /** Target `placementId`. */
  to: string
}

/** Top-level canvas state. */
export interface CanvasState {
  cards: CanvasCard[]
  connections: Connection[]
}

export const EMPTY_CANVAS: CanvasState = { cards: [], connections: [] }
