import * as fs from 'fs'
import * as path from 'path'
import { app, BrowserWindow } from 'electron'
import { finetune, type FinetuneHandle, type FinetuneResult } from '@qvac/sdk'
import { getActiveModelId, getActiveEntry, setTrainingMode } from './qvac'
import {
  createTraining,
  getTraining,
  listTrainings,
  updateTraining,
  type TrainingRun,
  type TrainingRunOptions,
} from './trainingStore'
import { getDataset } from './datasetStore'
import { createLora, listLoras } from './loraStore'

/**
 * Fine-tune driver. One in-flight run at a time — the renderer
 * Training page surfaces this via `setTrainingMode(true)` flipping
 * `active.loaded = false` on the AI status, which already disables
 * chat input and the Model Selector's pick buttons (see Chat.tsx
 * and ModelSelector.tsx).
 *
 * The LoRA output is the adapter.gguf (or whatever the SDK names it)
 * inside `<userData>/loras/<runId>/`. On `done` we register it via
 * the LoRA store but DO NOT auto-apply it to the loaded model — the
 * user must explicitly pick it from the Model Selector.
 */

const inFlight = new Map<string, FinetuneHandle>()

/**
 * Pick the dataset file to feed the SDK's `trainDatasetDir` field.
 * The field is misnamed — it's actually a file path. The dataset may
 * have an SFT JSONL, a Causal plain-text file, or both (mixed). We
 * prefer the JSONL when present (SFT wins for mixed datasets), and
 * fall back to the plain-text file for Causal-only datasets.
 */
function pickTrainDatasetPath(
  dataset: { trainJsonlPath: string | null; trainTxtPath: string | null }
): string | null {
  if (dataset.trainJsonlPath && fs.existsSync(dataset.trainJsonlPath)) {
    return dataset.trainJsonlPath
  }
  if (dataset.trainTxtPath && fs.existsSync(dataset.trainTxtPath)) {
    return dataset.trainTxtPath
  }
  return null
}

function getMainWindow(): BrowserWindow | null {
  const all = BrowserWindow.getAllWindows()
  return all.find((w) => !w.isDestroyed()) ?? null
}

function send(channel: string, payload: unknown): void {
  const win = getMainWindow()
  if (win) win.webContents.send(channel, payload)
}

function pushTrainingProgress(run: TrainingRun, tick: {
  current_epoch: number
  current_batch: number
  total_batches: number
  global_steps: number
  loss: number | null
  eta_ms: number
}): void {
  send('trainings:progress', {
    runId: run.id,
    epoch: tick.current_epoch,
    step: tick.global_steps,
    totalSteps: tick.total_batches * tick.global_steps || 0,
    currentBatch: tick.current_batch,
    totalBatches: tick.total_batches,
    loss: tick.loss,
    eta: tick.eta_ms,
  })
}

function statusFromResult(r: FinetuneResult): TrainingRun['status'] {
  switch (r.status) {
    case 'COMPLETED':
      return 'done'
    case 'PAUSED':
      return 'paused'
    case 'CANCELLED':
      return 'canceled'
    case 'RUNNING':
      return 'running'
    case 'IDLE':
    default:
      return 'failed'
  }
}

export interface StartTrainingInput {
  name: string
  datasetId: string
  baseModelId: string
  options: TrainingRunOptions
}

export function startTraining(input: StartTrainingInput): TrainingRun {
  // 1. Verify the base model is the one currently loaded — fine-tuning
  //    runs in-process against the same model the chat uses.
  const modelId = getActiveModelId()
  const activeEntry = getActiveEntry()
  if (!modelId || !activeEntry) {
    throw new Error('No model is currently loaded. Pick a model from the Model Selector first.')
  }
  if (activeEntry.id !== input.baseModelId) {
    throw new Error('Base model is not the currently loaded model. Re-select it from the Model Selector.')
  }

  // 2. Verify the dataset exists and has samples.
  const dataset = getDataset(input.datasetId)
  if (!dataset) {
    throw new Error('Dataset not found')
  }
  if (dataset.sampleCount <= 0) {
    throw new Error('Dataset has no samples — add simulation data or custom data first.')
  }
  const trainPath = pickTrainDatasetPath(dataset)
  if (!trainPath) {
    throw new Error('Dataset file missing on disk. Re-create the dataset.')
  }

  // 3. Create the run record up-front so the renderer can render it.
  const run = createTraining(input)
  updateTraining(run.id, { status: 'running' })

  // 4. Flip the training lock so the chat / Model Selector disable.
  setTrainingMode(true)

  // 5. Output dir for the adapter.
  const outputDir = path.join(app.getPath('userData'), 'loras', run.id)
  fs.mkdirSync(outputDir, { recursive: true })

  // 6. Kick off the SDK.
  let handle: FinetuneHandle
  try {
    handle = finetune({
      modelId,
      options: {
        // The field is named `trainDatasetDir` but it's actually a file
        // path. Confirmed by the SDK's own schema:
        //   `z.string().min(1, "Training dataset path cannot be empty")`
        // and the validation counterpart uses a `path` field. Passing
        // the directory makes the addon error with
        // `Unable to open dataset file: <dirname>`.
        //
        // We feed the JSONL when available (SFT data), otherwise the
        // plain-text file (Causal data). See pickTrainDatasetPath.
        trainDatasetDir: trainPath,
        validation: { type: 'none' },
        outputParametersDir: outputDir,
        numberOfEpochs: input.options.numberOfEpochs,
        learningRate: input.options.learningRate,
        loraRank: input.options.loraRank,
        loraAlpha: input.options.loraAlpha,
        contextLength: input.options.contextLength,
        batchSize: input.options.batchSize,
        microBatchSize: input.options.microBatchSize,
        assistantLossOnly: input.options.assistantLossOnly,
      },
    })
  } catch (err) {
    updateTraining(run.id, {
      status: 'failed',
      error: err instanceof Error ? err.message : String(err),
    })
    setTrainingMode(false)
    throw err
  }

  inFlight.set(run.id, handle)

  // 7. Pump progress + resolve.
  //
  // The QVAC SDK exposes two terminators on a finetune run:
  //   - handle.progressStream (AsyncGenerator<FinetuneProgress>)
  //   - handle.result         (Promise<FinetuneResult>)
  //
  // In practice the progress stream does NOT naturally terminate when
  // the run completes — the generator stops yielding but the iterator's
  // `return()` is never called, so a `for await` will hang forever.
  // That used to leave the UI stuck on "running" and the LoRA never
  // registered, even though `handle.result` resolves correctly.
  //
  // The fix: race the result against the progress pump. As soon as the
  // result resolves (or fails) we flip a flag, break out of the pump,
  // and proceed to register the LoRA / update the run status.
  ;(async () => {
    try {
      let streamDone = false
      // Fire-and-forget pump. Stops on stream natural end, on a
      // `streamDone` flip from the result branch, or on its own error.
      const pump = (async () => {
        try {
          for await (const tick of handle.progressStream) {
            if (streamDone) break
            const updated = updateTraining(run.id, {
              progress: {
                epoch: tick.current_epoch,
                step: tick.global_steps,
                totalSteps: tick.total_batches * tick.global_steps || 0,
                loss: typeof tick.loss === 'number' ? tick.loss : null,
                eta: typeof tick.eta_ms === 'number' ? tick.eta_ms : null,
              },
            })
            if (updated) pushTrainingProgress(updated, tick)
          }
        } catch (e) {
          // Stream errors are informational — the result branch owns
          // the user-visible failure state.
          console.warn('[finetune] progress stream ended with error:', e)
        }
      })()

      // Wait for the SDK's terminal result.
      let result: FinetuneResult
      try {
        result = await handle.result
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        streamDone = true
        // Give the pump a brief window to flush any in-flight ticks
        // before we mark the run failed.
        await Promise.race([
          pump,
          new Promise((resolve) => setTimeout(resolve, 1000)),
        ])
        updateTraining(run.id, { status: 'failed', error: message })
        return
      }

      streamDone = true
      // Grace window for the pump to flush any final ticks.
      await Promise.race([
        pump,
        new Promise((resolve) => setTimeout(resolve, 1000)),
      ])

      let terminalStatus = statusFromResult(result)
      console.log(
        `[finetune] run=${run.id} result.status=${result.status} -> mapped=${terminalStatus}`,
      )

      // 8. Register the LoRA on successful completion.
      let loraId: string | null = run.loraId ?? null
      let outputLoraPath: string | null = run.outputLoraPath ?? null
      if (terminalStatus === 'done') {
        // The SDK writes the adapter into outputParametersDir. We try
        // the conventional name first, then fall back to scanning the
        // dir for any .gguf — different SDK versions / model backends
        // have used `adapter.gguf`, `lora.gguf`, and `model.gguf`.
        const candidate = path.join(outputDir, 'adapter.gguf')
        let found: string | null = null
        if (fs.existsSync(candidate)) {
          found = candidate
        } else if (fs.existsSync(outputDir)) {
          const ggufs = fs
            .readdirSync(outputDir)
            .filter((f) => f.toLowerCase().endsWith('.gguf'))
          if (ggufs.length > 0) {
            found = path.join(outputDir, ggufs[0])
          }
        }

        if (found) {
          outputLoraPath = found
          let sizeBytes: number | undefined
          try {
            sizeBytes = fs.statSync(found).size
          } catch {
            /* ignore */
          }
          // Avoid duplicating an existing LoRA with the same path.
          const existing = listLoras().find((l) => l.loraPath === found)
          if (existing) {
            loraId = existing.id
          } else {
            const lora = createLora({
              name: `${run.name} (LoRA)`,
              baseModelId: run.baseModelId,
              loraPath: found,
              source: 'training',
              trainingRunId: run.id,
              sizeBytes,
            })
            loraId = lora.id
          }
        } else {
          // The run reports COMPLETED but no adapter file was written.
          // Surface that explicitly so the user can re-run with a
          // non-empty dataset / non-zero epochs. Diagnostic: log
          // the output dir contents to help future debugging.
          try {
            const dirContents = fs.existsSync(outputDir)
              ? fs.readdirSync(outputDir).join(', ')
              : '(output dir missing)'
            console.warn(
              `[finetune] run=${run.id} COMPLETED with no adapter file in ${outputDir}; contents: ${dirContents}`,
            )
          } catch {
            /* ignore diagnostic failure */
          }
          terminalStatus = 'failed'
        }
      }
      updateTraining(run.id, {
        status: terminalStatus,
        outputLoraPath,
        loraId,
        error:
          terminalStatus === 'failed'
            ? 'Training reported COMPLETED but no .gguf adapter was written to the output directory.'
            : null,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      updateTraining(run.id, {
        status: 'failed',
        error: message,
      })
    } finally {
      inFlight.delete(run.id)
      setTrainingMode(false)
    }
  })()

  // Re-read so we return the latest record (status: 'running').
  return getTraining(run.id) ?? run
}

export function pauseTraining(id: string): boolean {
  const run = getTraining(id)
  if (!run) return false
  if (run.status !== 'running') return false
  const modelId = getActiveModelId()
  if (!modelId) return false
  // The SDK exposes pause as a stop-flavored op (no result handle).
  // Fire-and-forget the call and let the progress stream emit a
  // 'paused' status, which the SDK reports back via the result.
  finetune({ modelId, operation: 'pause' }).catch((err) => {
    console.warn('[finetune] pause failed', err)
  })
  updateTraining(id, { status: 'paused' })
  return true
}

export function resumeTraining(id: string): boolean {
  const run = getTraining(id)
  if (!run) return false
  if (run.status !== 'paused') return false
  const modelId = getActiveModelId()
  if (!modelId) return false
  // Re-run finetune() with the same parameters. The SDK treats this
  // as a resume when the same modelId+outputParametersDir are passed.
  if (!run.outputLoraPath) {
    // No output dir set yet — fall through to a fresh start.
  }
  const outputDir = run.outputLoraPath
    ? path.dirname(run.outputLoraPath)
    : path.join(app.getPath('userData'), 'loras', run.id)
  fs.mkdirSync(outputDir, { recursive: true })
  const dataset = getDataset(run.datasetId)
  if (!dataset) return false
  const trainPath = pickTrainDatasetPath(dataset)
  if (!trainPath) {
    updateTraining(id, {
      status: 'failed',
      error: 'Dataset file missing on disk. Re-create the dataset.',
    })
    return false
  }
  try {
    const handle = finetune({
      modelId,
      options: {
        // Same field-is-actually-a-file-path quirk as startTraining.
        // See pickTrainDatasetPath for the JSONL-vs-txt selection.
        trainDatasetDir: trainPath,
        validation: { type: 'none' },
        outputParametersDir: outputDir,
        numberOfEpochs: run.options.numberOfEpochs,
        learningRate: run.options.learningRate,
        loraRank: run.options.loraRank,
        loraAlpha: run.options.loraAlpha,
        contextLength: run.options.contextLength,
        batchSize: run.options.batchSize,
        microBatchSize: run.options.microBatchSize,
        assistantLossOnly: run.options.assistantLossOnly,
      },
      operation: 'resume',
    })
    inFlight.set(id, handle)
    updateTraining(id, { status: 'running' })
    setTrainingMode(true)
    // Same race pattern as startTraining: the progress stream does
    // not naturally terminate, so we run the pump concurrently with
    // the result-await and break out via a flag.
    ;(async () => {
      try {
        let streamDone = false
        const pump = (async () => {
          try {
            for await (const tick of handle.progressStream) {
              if (streamDone) break
              const updated = updateTraining(id, {
                progress: {
                  epoch: tick.current_epoch,
                  step: tick.global_steps,
                  totalSteps: tick.total_batches * tick.global_steps || 0,
                  loss: typeof tick.loss === 'number' ? tick.loss : null,
                  eta: typeof tick.eta_ms === 'number' ? tick.eta_ms : null,
                },
              })
              if (updated) pushTrainingProgress(updated, tick)
            }
          } catch (e) {
            console.warn('[finetune] resume progress stream ended with error:', e)
          }
        })()

        let result: FinetuneResult
        try {
          result = await handle.result
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err)
          streamDone = true
          await Promise.race([
            pump,
            new Promise((resolve) => setTimeout(resolve, 1000)),
          ])
          updateTraining(id, { status: 'failed', error: message })
          return
        }

        streamDone = true
        await Promise.race([
          pump,
          new Promise((resolve) => setTimeout(resolve, 1000)),
        ])

        const newStatus = statusFromResult(result)
        console.log(
          `[finetune] resume run=${id} result.status=${result.status} -> mapped=${newStatus}`,
        )
        let loraId: string | null = run.loraId ?? null
        let outputLoraPath: string | null = run.outputLoraPath ?? null
        if (newStatus === 'done') {
          const candidate = path.join(outputDir, 'adapter.gguf')
          if (fs.existsSync(candidate)) {
            outputLoraPath = candidate
            // LoRA entry is registered on first completion; subsequent
            // resumes shouldn't create a duplicate.
          } else if (fs.existsSync(outputDir)) {
            const ggufs = fs
              .readdirSync(outputDir)
              .filter((f) => f.toLowerCase().endsWith('.gguf'))
            if (ggufs.length > 0) {
              outputLoraPath = path.join(outputDir, ggufs[0])
            }
          }
        }
        updateTraining(id, {
          status: newStatus,
          outputLoraPath,
          loraId,
        })
      } catch (err) {
        updateTraining(id, {
          status: 'failed',
          error: err instanceof Error ? err.message : String(err),
        })
      } finally {
        inFlight.delete(id)
        // Only release the training lock when no other run is active.
        if (listTrainings().some((r) => r.status === 'running')) {
          // keep the lock
        } else {
          setTrainingMode(false)
        }
      }
    })()
    return true
  } catch (err) {
    console.error('[finetune] resume failed', err)
    updateTraining(id, {
      status: 'failed',
      error: err instanceof Error ? err.message : String(err),
    })
    return false
  }
}

export function cancelTraining(id: string): boolean {
  const run = getTraining(id)
  if (!run) return false
  const modelId = getActiveModelId()
  if (!modelId) return false
  finetune({ modelId, operation: 'cancel' }).catch((err) => {
    console.warn('[finetune] cancel failed', err)
  })
  updateTraining(id, { status: 'canceled', outputLoraPath: null, loraId: null })
  return true
}

export function listTrainingRuns() {
  return listTrainings()
}
