/**
 * Process-wide single-flight lock for QVAC completion calls.
 *
 * The QVAC SDK's server-side request-registry enforces `oneAtATimePerModel`,
 * but the project has two callers of `completion()` — the chat IPC handler
 * (`ai:sendMessage` in src/main/index.ts) and the simulation worker
 * (src/main/simulationWorker.ts). Neither has a way to know the other is
 * running, so a second concurrent call ends up blocked waiting for a
 * stream that never produces events.
 *
 * This module gives both paths a shared mutex:
 *   - `withLock('worker' | 'chat', fn)` — acquires the lock, runs `fn`,
 *     releases. FIFO queue behind the current holder.
 *   - `shouldDefer()` — non-blocking check used by the worker tick to
 *     *skip* the current tick if chat is mid-flight. The next 1.5s poll
 *     will retry. The worker never queues behind chat (chat is
 *     interactive; the worker's outcomes can afford to wait).
 *
 * Chat callers naturally await via `withLock('chat', …)` — they queue
 * behind the worker and resume when the worker's outcome finishes.
 */

type Waiter = { resolve: () => void }
let holder: { kind: 'worker' | 'chat'; startedAt: number } | null = null
const waiters: Waiter[] = []

export function isLocked(): boolean {
  return holder !== null
}

export function shouldDefer(): boolean {
  return holder !== null
}

export async function withLock<T>(
  kind: 'worker' | 'chat',
  fn: () => Promise<T>
): Promise<T> {
  if (!holder) {
    holder = { kind, startedAt: Date.now() }
  } else {
    await new Promise<void>((resolve) => {
      waiters.push({ resolve })
    })
    holder = { kind, startedAt: Date.now() }
  }
  try {
    return await fn()
  } finally {
    holder = null
    const next = waiters.shift()
    if (next) next.resolve()
  }
}
