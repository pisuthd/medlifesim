import { randomBytes } from 'crypto'
import { BrowserWindow } from 'electron'
import {
  startQVACProvider,
  stopQVACProvider,
} from '@qvac/sdk'
import { settingsStore, type P2PPeer } from './toolsStore'
import { modelStore, type ModelEntry } from './modelStore'
import {
  getActiveEntry,
  loadOutcomeModel,
  unloadOutcomeModel,
  setPendingOutcomeDelegate,
} from './qvac'

/**
 * P2P resource-sharing runtime.
 *
 * Two roles, both opt-in:
 *
 *   - **Provider** — exposes this machine's GPU to a remote peer over a
 *     Hyperswarm DHT (`startQVACProvider`). Identity is a 32-byte seed
 *     persisted in `settings.json` so the public key is stable across
 *     restarts. The seed is set as `QVAC_HYPERSWARM_SEED` before the
 *     SDK touches the swarm, since the SDK reads the env var at
 *     swarm construction time.
 *
 *   - **Consumer** — binds the simulation outcome worker to a remote
 *     provider's public key. The next `loadModel` for the OUTCOMES slot
 *     threads `delegate: { providerPublicKey, fallbackToLocal: true }`
 *     through, so the worker's `completion` calls route to the peer.
 *     Chat and scenario generation are unaffected — they use the chat
 *     slot which is always local.
 *
 * State is split: the QVAC SDK owns the swarm, the settings store owns
 * the persisted identity + peer list, and this module owns the
 * runtime "is the provider currently running?" snapshot. The Settings
 * UI subscribes to the `p2p:status` push channel for live updates.
 */

let mainWindowRef: BrowserWindow | null = null

// ──────────────────────────── module state ──────────────────────────────

let providerStarting = false
let providerPublicKey: string | null = null
let providerError: string | null = null

let consumerError: string | null = null
let consumerDelegatedTo: { publicKey: string; peerName: string } | null = null

// ──────────────────────────── main window ───────────────────────────────

export function setMainWindow(window: BrowserWindow | null): void {
  mainWindowRef = window
}

function send(channel: string, payload: unknown): void {
  if (mainWindowRef && !mainWindowRef.isDestroyed()) {
    mainWindowRef.webContents.send(channel, payload)
  }
}

// ──────────────────────────── status snapshot ────────────────────────────

export interface P2PStatus {
  provider: {
    enabled: boolean
    running: boolean
    starting: boolean
    publicKey: string | null
    seedExists: boolean
    error: string | null
  }
  consumer: {
    enabled: boolean
    activePeerId: string | null
    activePeer: P2PPeer | null
    peers: P2PPeer[]
    outcomeModelLoaded: boolean
    delegatedTo: { publicKey: string; peerName: string } | null
    error: string | null
  }
}

export function getStatus(): P2PStatus {
  const activeId = settingsStore.getP2pActiveConsumerPeerId()
  const peer = activeId
    ? settingsStore.getP2pConsumerPeers().find((p) => p.id === activeId) ?? null
    : null
  return {
    provider: {
      enabled: settingsStore.getP2pProviderEnabled(),
      running: providerPublicKey !== null,
      starting: providerStarting,
      publicKey: providerPublicKey,
      seedExists: settingsStore.getP2pProviderSeed() !== null,
      error: providerError,
    },
    consumer: {
      enabled: settingsStore.getP2pConsumerEnabled(),
      activePeerId: activeId,
      activePeer: peer,
      peers: settingsStore.getP2pConsumerPeers(),
      outcomeModelLoaded: consumerDelegatedTo !== null || settingsStore.getP2pConsumerEnabled() === false,
      delegatedTo: consumerDelegatedTo,
      error: consumerError,
    },
  }
}

function broadcastStatus(): void {
  send('p2p:status', getStatus())
}

// Exported so the `p2p:consumerSetEnabled` IPC handler can refresh
// the renderer after a no-op (no active peer to connect to).
export { broadcastStatus }

// ──────────────────────────── provider ──────────────────────────────────

/**
 * Generate a 32-byte Hyperswarm seed, hex-encode it, persist it, and
 * set the SDK's `QVAC_HYPERSWARM_SEED` env var. Idempotent: returns
 * the existing seed if one is already persisted.
 */
function ensureProviderSeed(): string {
  let seed = settingsStore.getP2pProviderSeed()
  if (seed && /^[0-9a-fA-F]{64}$/.test(seed)) return seed
  seed = randomBytes(32).toString('hex')
  settingsStore.setP2pProviderSeed(seed)
  return seed
}

/**
 * Start the QVAC provider. Idempotent — calling while already running
 * is a no-op and returns the existing public key. The first call
 * generates and persists a Hyperswarm seed so the public key is
 * stable across restarts.
 */
export async function startProvider(): Promise<{ success: boolean; publicKey?: string; error?: string }> {
  if (providerPublicKey) return { success: true, publicKey: providerPublicKey }
  if (providerStarting) return { success: false, error: 'Provider is already starting' }
  providerStarting = true
  providerError = null
  broadcastStatus()
  try {
    const seed = ensureProviderSeed()
    // The SDK reads QVAC_HYPERSWARM_SEED at swarm construction time, so
    // the env var must be set BEFORE startQVACProvider() is called.
    // It also has to be set before any earlier `loadModel` in this
    // process so the swarm is constructed with our seed (the swarm is
    // a process-singleton). `index.ts` calls ensureHyperswarmSeed()
    // before the first loadModel to cover that case.
    process.env.QVAC_HYPERSWARM_SEED = seed
    const response = await startQVACProvider({})
    if (!response.success) {
      providerError = response.error ?? 'Provider failed to start'
      return { success: false, error: providerError }
    }
    providerPublicKey = response.publicKey ?? null
    return { success: true, publicKey: providerPublicKey ?? undefined }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    providerError = message
    return { success: false, error: message }
  } finally {
    providerStarting = false
    broadcastStatus()
  }
}

/**
 * Stop the QVAC provider. Idempotent. Per the SDK this is a soft-stop
 * — the swarm's keyPair stays bound on the DHT, but the RPC server
 * stops accepting new requests.
 */
export async function stopProvider(): Promise<{ success: boolean; error?: string }> {
  if (!providerPublicKey && !providerStarting) {
    return { success: true }
  }
  try {
    await stopQVACProvider()
    providerPublicKey = null
    providerError = null
    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    providerError = message
    return { success: false, error: message }
  } finally {
    broadcastStatus()
  }
}

// ──────────────────────────── consumer ──────────────────────────────────

/**
 * Connect to a saved peer: bind the outcomes slot to their public key
 * via `delegate: { providerPublicKey }`. Falls back to the local model
 * if the peer is unreachable (set in the SDK's `fallbackToLocal`).
 *
 * Requires a local base model to be selected. If none is loaded the
 * call is a no-op and `consumer.error` is set to a hint the UI can
 * show.
 */
export async function connectToPeer(peer: P2PPeer): Promise<{ success: boolean; error?: string }> {
  consumerError = null
  const baseEntry: ModelEntry | null = getActiveEntry() ?? modelStore.getLastSelected()
  if (!baseEntry) {
    consumerError = 'Load a base model first (chat boot gate or model picker).'
    broadcastStatus()
    return { success: false, error: consumerError }
  }
  try {
    setPendingOutcomeDelegate(peer.publicKey)
    await loadOutcomeModel(baseEntry)
    consumerDelegatedTo = { publicKey: peer.publicKey, peerName: peer.name }
    settingsStore.setP2pActiveConsumerPeerId(peer.id)
    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    consumerError = message
    consumerDelegatedTo = null
    return { success: false, error: message }
  } finally {
    broadcastStatus()
  }
}

/**
 * Disconnect from the active peer. Re-loads the outcomes slot against
 * the local model (no delegate). If no local model is loaded, the
 * outcomes slot becomes null and the worker pauses — same as the
 * "no model" baseline.
 */
export async function disconnectFromPeer(): Promise<{ success: boolean; error?: string }> {
  consumerError = null
  try {
    setPendingOutcomeDelegate(null)
    const baseEntry: ModelEntry | null = getActiveEntry() ?? modelStore.getLastSelected()
    if (baseEntry) {
      await loadOutcomeModel(baseEntry)
    } else {
      await unloadOutcomeModel()
    }
    consumerDelegatedTo = null
    settingsStore.setP2pActiveConsumerPeerId(null)
    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    consumerError = message
    return { success: false, error: message }
  } finally {
    broadcastStatus()
  }
}

/**
 * Called when the chat slot's base model changes (e.g. user picks a
 * new model in the Model Selector). If the consumer is connected, we
 * need to reload the outcomes slot against the new base entry so it
 * follows the user's selection.
 */
export async function onChatBaseModelChanged(): Promise<void> {
  if (!settingsStore.getP2pConsumerEnabled()) return
  const activeId = settingsStore.getP2pActiveConsumerPeerId()
  if (!activeId) return
  const peer = settingsStore.getP2pConsumerPeers().find((p) => p.id === activeId)
  if (!peer) return
  const baseEntry = getActiveEntry() ?? modelStore.getLastSelected()
  if (!baseEntry) return
  try {
    setPendingOutcomeDelegate(peer.publicKey)
    await loadOutcomeModel(baseEntry)
    consumerDelegatedTo = { publicKey: peer.publicKey, peerName: peer.name }
  } catch (err) {
    consumerError = err instanceof Error ? err.message : String(err)
    consumerDelegatedTo = null
  } finally {
    broadcastStatus()
  }
}

// ──────────────────────────── public peer list ──────────────────────────

export function getPeers(): P2PPeer[] {
  return settingsStore.getP2pConsumerPeers()
}

export function addPeer(input: { name: string; publicKey: string }): { success: boolean; peer?: P2PPeer; error?: string } {
  const name = input.name.trim()
  const publicKey = input.publicKey.trim().toLowerCase()
  if (!name) return { success: false, error: 'Name is required' }
  if (!/^[0-9a-f]{64}$/.test(publicKey)) {
    return { success: false, error: 'Public key must be a 64-character hex string' }
  }
  const peers = settingsStore.getP2pConsumerPeers()
  if (peers.some((p) => p.publicKey === publicKey)) {
    return { success: false, error: 'A peer with this public key is already saved' }
  }
  const peer: P2PPeer = {
    id: 'peer_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8),
    name,
    publicKey,
    createdAt: new Date().toISOString(),
  }
  settingsStore.setP2pConsumerPeers([...peers, peer])
  broadcastStatus()
  return { success: true, peer }
}

export async function removePeer(id: string): Promise<{ success: boolean; error?: string }> {
  const peers = settingsStore.getP2pConsumerPeers()
  if (!peers.some((p) => p.id === id)) {
    return { success: false, error: 'Unknown peer id' }
  }
  // If removing the active peer, disconnect first.
  if (settingsStore.getP2pActiveConsumerPeerId() === id) {
    await disconnectFromPeer()
  }
  settingsStore.setP2pConsumerPeers(peers.filter((p) => p.id !== id))
  broadcastStatus()
  return { success: true }
}

// ──────────────────────────── boot-time seed ────────────────────────────

/**
 * Set `QVAC_HYPERSWARM_SEED` from the persisted seed before any SDK
 * call touches the swarm. The swarm is a process singleton — once it's
 * constructed without a seed, setting the env var later has no
 * effect. Must be called before `ensureQvacConfig()` triggers any
 * `loadModel` / `startQVACProvider`.
 */
export function ensureHyperswarmSeed(): void {
  const seed = settingsStore.getP2pProviderSeed()
  if (seed && /^[0-9a-fA-F]{64}$/.test(seed)) {
    if (process.env.QVAC_HYPERSWARM_SEED !== seed) {
      process.env.QVAC_HYPERSWARM_SEED = seed
    }
  }
}
