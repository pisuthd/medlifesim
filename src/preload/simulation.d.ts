/**
 * Shared simulation types — included in both the renderer (tsconfig.web)
 * and the main process (tsconfig.node) tsconfigs. The renderer re-exports
 * these from `src/renderer/src/types/simulation.ts`; the main process
 * imports them directly from this file.
 */

export type SimCategory =
  | 'environment'
  | 'subject'
  | 'exposure'
  | 'health-state'
  | 'intervention'

export type SimTone = 'blue' | 'teal' | 'navy' | 'muted'

export interface SimCardTemplate {
  id: string
  category: SimCategory
  title: string
  subtitle: string
  badge: string
  tone?: SimTone
}

export interface PlacedCard extends SimCardTemplate {
  placementId: string
}

export interface CanvasCard extends PlacedCard {
  x: number
  y: number
  collapsed: boolean
}

export interface Connection {
  id: string
  from: string
  to: string
}

export interface CanvasState {
  cards: CanvasCard[]
  connections: Connection[]
}

// ─────────────────────────────────────────────────────────────────────────
// AI-driven outcome pipeline
// ─────────────────────────────────────────────────────────────────────────

export type PathStatus = 'pending' | 'processing' | 'done' | 'error'

export interface SimPathPreview {
  id: string
  interventionId: string
  pathLabels: {
    environment: string
    subject: string
    exposure: string
    healthState: string
    intervention: string
  }
  placementIds: {
    environment: string
    subject: string
    exposure: string
    healthState: string
    intervention: string
  }
  status: PathStatus
}

export type SimulationStatus =
  | 'queued'
  | 'processing'
  | 'completed'
  | 'partial'
  | 'error'

export interface SimulationParent {
  id: string
  profileSlug: string
  name: string
  createdAt: string
  updatedAt: string
  status: SimulationStatus
  canvas: CanvasState
  outcomeCount: number
  completedCount: number
  errorCount: number
}

export interface SimulationOutcome {
  id: string
  simId: string
  sessionSlug: string
  interventionId: string
  pathLabels: SimPathPreview['pathLabels']
  status: PathStatus
  createdAt: string
  updatedAt: string
  error?: string
}

export interface SimulationProgressEvent {
  simId: string
  outcomeId: string
  status: PathStatus
  error?: string
  completedCount: number
  outcomeCount: number
}

export interface SimTemplate {
  id: string
  name: string
  description: string
  canvas: CanvasState
}
