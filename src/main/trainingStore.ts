import * as fs from 'fs'
import * as path from 'path'
import { app } from 'electron'

/**
 * On-disk registry of training runs. Each `TrainingRun` is a single
 * fine-tune job (one base model + one dataset + a hyperparameter set).
 * The `progress` field is updated from the SDK's
 * `FinetuneHandle.progressStream`. Output LoRA path + registered
 * LoRA id are filled in by the trainer when the run completes.
 */

export type TrainingRunStatus =
  | 'queued'
  | 'running'
  | 'paused'
  | 'done'
  | 'failed'
  | 'canceled'

export interface TrainingRunOptions {
  numberOfEpochs: number
  learningRate: number
  loraRank: number
  loraAlpha: number
  contextLength: number
  batchSize: number
  microBatchSize: number
  assistantLossOnly: boolean
}

export interface TrainingRunProgress {
  epoch: number
  step: number
  totalSteps: number
  loss: number | null
  eta: number | null
}

export interface TrainingRun {
  id: string
  name: string
  createdAt: string
  updatedAt: string
  datasetId: string
  baseModelId: string
  options: TrainingRunOptions
  status: TrainingRunStatus
  progress: TrainingRunProgress
  outputLoraPath: string | null
  loraId: string | null
  error: string | null
}

const REGISTRY_PATH = 'trainings.json'

function registryPath(): string {
  return path.join(app.getPath('userData'), REGISTRY_PATH)
}

function readRegistry(): TrainingRun[] {
  const p = registryPath()
  if (!fs.existsSync(p)) return []
  try {
    return JSON.parse(fs.readFileSync(p, 'utf-8')) as TrainingRun[]
  } catch {
    return []
  }
}

function writeRegistry(list: TrainingRun[]): void {
  const p = registryPath()
  fs.mkdirSync(path.dirname(p), { recursive: true })
  const tmp = p + '.tmp-' + Date.now()
  fs.writeFileSync(tmp, JSON.stringify(list, null, 2), 'utf-8')
  fs.renameSync(tmp, p)
}

function newId(): string {
  return (
    'run_' +
    Date.now().toString(36) +
    '_' +
    Math.random().toString(36).slice(2, 8)
  )
}

function nowIso(): string {
  return new Date().toISOString()
}

export function listTrainings(): TrainingRun[] {
  return readRegistry().sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  )
}

export function getTraining(id: string): TrainingRun | null {
  return readRegistry().find((r) => r.id === id) ?? null
}

export interface CreateTrainingInput {
  name: string
  datasetId: string
  baseModelId: string
  options: TrainingRunOptions
}

export function createTraining(input: CreateTrainingInput): TrainingRun {
  const id = newId()
  const now = nowIso()
  const run: TrainingRun = {
    id,
    name: input.name.trim() || `Run · ${now}`,
    createdAt: now,
    updatedAt: now,
    datasetId: input.datasetId,
    baseModelId: input.baseModelId,
    options: input.options,
    status: 'queued',
    progress: { epoch: 0, step: 0, totalSteps: 0, loss: null, eta: null },
    outputLoraPath: null,
    loraId: null,
    error: null,
  }
  const list = readRegistry()
  list.push(run)
  writeRegistry(list)
  return run
}

export function updateTraining(
  id: string,
  patch: Partial<Omit<TrainingRun, 'id' | 'createdAt'>>
): TrainingRun | null {
  const list = readRegistry()
  const idx = list.findIndex((r) => r.id === id)
  if (idx === -1) return null
  const next: TrainingRun = {
    ...list[idx],
    ...patch,
    updatedAt: nowIso(),
  }
  list[idx] = next
  writeRegistry(list)
  return next
}

export function deleteTraining(id: string): boolean {
  const list = readRegistry()
  const next = list.filter((r) => r.id !== id)
  if (next.length === list.length) return false
  writeRegistry(next)
  return true
}
