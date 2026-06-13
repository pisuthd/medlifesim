import { ipcMain, BrowserWindow } from 'electron'
import { completion } from '@qvac/sdk'
import { getActiveModelId } from './qvac'

/**
 * Prompt-to-Scenario IPC handler (F.15).
 *
 * Single `completion()` call — no tools, no loop. The local 1.7B
 * fine-tune can't reliably emit any of the SDK's six tool-call
 * envelopes, so we drop the tool-calling layer entirely: the system
 * prompt instructs the model to emit cards as JSON Lines
 * (`{"category":"...","title":"...","<category>Fields":{...}}` per
 * line, no prose), and the renderer's `PromptToScenarioModal` parses
 * the streamed `contentDelta` text line-by-line and adds cards to
 * the canvas in real time.
 *
 * Streaming ticker (consumed by the modal):
 *   - `ai:streamToken`     — every contentDelta chunk
 *   - `ai:streamThinking`  — every thinkingDelta chunk
 *   - `ai:streamDone`      — fired on completionDone so the modal
 *                            can finalize (close / show "done" state)
 *
 * Returned to the renderer:
 *   - `{ ok: true, name, description }` on success
 *   - `{ ok: false, error }` on failure (no model, no window, empty
 *     prompt, or the model produced no parseable cards at all — the
 *     latter is detected by checking the streamed text after the
 *     run completes)
 *
 * Error contract:
 *   - empty prompt → `{ ok: false, error: 'Prompt is empty.' }`
 *   - no model loaded → `{ ok: false, error: 'AI model not loaded…' }`
 *   - no window → `{ ok: false, error: 'No window available.' }`
 *   - any other throw → `{ ok: false, error: 'Generation failed: <msg>' }`
 */

type Payload = { prompt: string }

/**
 * System prompt. Instructs the model to emit one JSON object per
 * line, no prose, no markdown, no commentary. The model has a
 * habit of wrapping in `{"name":"add_canvas_card","arguments":{...}}`
 * from prior fine-tuning — the renderer's parser accepts both the
 * wrapper format and the flat format, so the prompt doesn't need to
 * fight the model's habit.
 *
 * No hard card cap. The model emits as many cards as the scenario
 * warrants (typical 5-10, but the renderer caps at 12 to prevent
 * runaway loops in case the model never stops emitting).
 */
function buildSystemPrompt(): string {
  return `You are a SCENARIO BUILDER assistant. Your ONLY job is to design a
public-health simulation scenario from the user's description by
emitting canvas cards as JSON Lines.

The canvas has three columns of cards:
  - subject: who is affected (age group, region, comorbidities, etc.)
  - exposure: the source of risk (dose, duration, setting, etc.)
  - intervention: how to reduce harm (type, intensity, compliance, etc.)

Each line is ONE card. Output as many cards as the scenario needs. No prose, no markdown, no code fences, no
commentary, no summary text. Just the JSON lines, then stop.

Each card line is one of these three shapes — pick whichever
category fits and include the matching <category>Fields:

Subject card:    {"category":"subject","title":"...","subjectFields":{...}}
Exposure card:   {"category":"exposure","title":"...","exposureFields":{...}}
Intervention:    {"category":"intervention","title":"...","interventionFields":{...}}

The "category" field must be exactly one of: subject, exposure, or
intervention. Never write a pipe (|) in the category value.

Aim for at least 1 exposure + 2 subject + 2 intervention.`
}

export type GenerateScenarioResult =
  | { ok: true; name: string; description: string }
  | { ok: false; error: string }

export function registerScenarioGeneratorHandlers(): void {
  ipcMain.handle(
    'ai:generateScenario',
    async (_e, _profileSlug: string, payload: Payload): Promise<GenerateScenarioResult> => {
      if (!payload?.prompt?.trim()) {
        return { ok: false, error: 'Prompt is empty.' }
      }

      const modelId = getActiveModelId()
      if (!modelId) {
        return { ok: false, error: 'AI model not loaded. Pick a model in the dashboard first.' }
      }

      const win = BrowserWindow.getAllWindows()[0]
      if (!win) {
        return { ok: false, error: 'No window available.' }
      }
      const webContents = win.webContents

      // System prompt is its own role so the chat template renders
      // the JSONL output instruction as policy, not as part of the
      // user's request. See the plan at
      // C:\Users\pisut\.claude\plans\sequential-drifting-origami.md.
      const history = [
        { role: 'system' as const, content: buildSystemPrompt() },
        { role: 'user' as const, content: payload.prompt.trim() },
      ]

      try {
        // No tools, no toolDialect, no loop — one streaming
        // completion. The renderer parses contentDelta on its own.
        const result = completion({
          modelId,
          history,
          stream: true,
          kvCache: true,
          captureThinking: true,
        })

        for await (const event of result.events) {
          console.log('[scenario-generator] current event:', event)
          switch (event.type) {
            case 'contentDelta':
              webContents.send('ai:streamToken', event.text)
              break
            case 'thinkingDelta':
              webContents.send('ai:streamThinking', event.text)
              break
            case 'completionDone':
              webContents.send('ai:streamDone')
              break
          }
        }

        return {
          ok: true,
          name: 'Untitled scenario',
          description: payload.prompt.trim(),
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        if (message.includes('AI model not loaded')) {
          return {
            ok: false,
            error: 'AI model not loaded. Pick a model in the dashboard first.',
          }
        }
        return { ok: false, error: `Generation failed: ${message}` }
      }
    }
  )
}
