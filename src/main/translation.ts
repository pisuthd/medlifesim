import { loadModel, translate as sdkTranslate, unloadModel } from '@qvac/sdk'
import {
  BERGAMOT_EN_AR,
  BERGAMOT_EN_DE,
  BERGAMOT_EN_EL,
  BERGAMOT_EN_ES,
  BERGAMOT_EN_FR,
  BERGAMOT_EN_HE,
  BERGAMOT_EN_HI,
  BERGAMOT_EN_IT,
  BERGAMOT_EN_JA,
  BERGAMOT_EN_KO,
  BERGAMOT_EN_NL,
  BERGAMOT_EN_PL,
  BERGAMOT_EN_PT,
  BERGAMOT_EN_RU,
  BERGAMOT_EN_SV,
  BERGAMOT_EN_TR,
  BERGAMOT_EN_VI,
  BERGAMOT_EN_ZH,
} from '@qvac/sdk'
import type { ReportData } from './reportExport'

/**
 * Translation runtime — owns the lifecycle of **one** Bergamot
 * translation model at a time (English → one target). Used by the
 * on-screen report translation flow (see `translateReportData` and
 * the `reports:translate` IPC handler).
 *
 * Lifecycle:
 *  - The app does **not** auto-load a translation model on boot.
 *  - The first time the user picks a target language on the
 *    report page, the renderer calls `reports:translate` which
 *    triggers `ensureTranslationModelLoaded` and translates the
 *    data in place.
 *  - Subsequent translations in the same language reuse the
 *    cached modelId. Switching languages unloads the previous
 *    one (the SDK holds one nmt model at a time per slot).
 *
 * 18 target languages are exposed in the UI. The SDK supports 53;
 * the constraint is UI surface, not the SDK. To add more, append
 * to `SUPPORTED_LANGUAGES` and import the matching `BERGAMOT_EN_*`
 * constant.
 */

export type SupportedTargetLang =
  | 'es' | 'fr' | 'de' | 'it' | 'pt'
  | 'ru' | 'zh' | 'ja' | 'ko'
  | 'ar' | 'hi'
  | 'nl' | 'pl' | 'tr' | 'sv' | 'vi'
  | 'el' | 'he'

interface LanguageDescriptor {
  code: SupportedTargetLang
  /** ISO language name in its own language — shown in the picker. */
  label: string
  /** Full Bergamot model constant for this pair. */
  modelConstant: { src: string }
}

const SUPPORTED_LANGUAGES: readonly LanguageDescriptor[] = [
  // Western Europe
  { code: 'es', label: 'Español', modelConstant: BERGAMOT_EN_ES },
  { code: 'fr', label: 'Français', modelConstant: BERGAMOT_EN_FR },
  { code: 'de', label: 'Deutsch', modelConstant: BERGAMOT_EN_DE },
  { code: 'it', label: 'Italiano', modelConstant: BERGAMOT_EN_IT },
  { code: 'pt', label: 'Português', modelConstant: BERGAMOT_EN_PT },
  { code: 'nl', label: 'Nederlands', modelConstant: BERGAMOT_EN_NL },
  // Eastern Europe
  { code: 'ru', label: 'Русский', modelConstant: BERGAMOT_EN_RU },
  { code: 'pl', label: 'Polski', modelConstant: BERGAMOT_EN_PL },
  { code: 'el', label: 'Ελληνικά', modelConstant: BERGAMOT_EN_EL },
  // East Asia
  { code: 'zh', label: '中文', modelConstant: BERGAMOT_EN_ZH },
  { code: 'ja', label: '日本語', modelConstant: BERGAMOT_EN_JA },
  { code: 'ko', label: '한국어', modelConstant: BERGAMOT_EN_KO },
  // South Asia
  { code: 'hi', label: 'हिन्दी', modelConstant: BERGAMOT_EN_HI },
  // Southeast Asia
  { code: 'vi', label: 'Tiếng Việt', modelConstant: BERGAMOT_EN_VI },
  // MENA
  { code: 'ar', label: 'العربية', modelConstant: BERGAMOT_EN_AR },
  { code: 'he', label: 'עברית', modelConstant: BERGAMOT_EN_HE },
  { code: 'tr', label: 'Türkçe', modelConstant: BERGAMOT_EN_TR },
  // Other Europe
  { code: 'sv', label: 'Svenska', modelConstant: BERGAMOT_EN_SV },
] as const

const BERGAMOT_BY_CODE: Record<SupportedTargetLang, LanguageDescriptor> =
  SUPPORTED_LANGUAGES.reduce(
    (acc, l) => {
      acc[l.code] = l
      return acc
    },
    {} as Record<SupportedTargetLang, LanguageDescriptor>,
  )

// ────────────────────────────── module state ──────────────────────────────

let currentTargetLang: SupportedTargetLang | null = null
let currentModelId: string | null = null
let loadingPromise: Promise<string> | null = null
let lastError: string | null = null

// ─────────────────────────────── public API ───────────────────────────────

export interface TranslationStatus {
  loaded: boolean
  targetLang: SupportedTargetLang | null
  /** Display label for the currently loaded language (e.g. "Español"). */
  targetLabel: string | null
  loading: boolean
  error: string | null
}

export function getTranslationStatus(): TranslationStatus {
  return {
    loaded: currentModelId !== null,
    targetLang: currentTargetLang,
    targetLabel: currentTargetLang
      ? BERGAMOT_BY_CODE[currentTargetLang].label
      : null,
    loading: loadingPromise !== null,
    error: lastError,
  }
}

export function getSupportedLanguages(): Array<{
  code: SupportedTargetLang
  label: string
}> {
  return SUPPORTED_LANGUAGES.map((l) => ({ code: l.code, label: l.label }))
}

/**
 * Idempotent. If a model for `targetLang` is already loaded, returns
 * the cached modelId. Otherwise loads the Bergamot model for that
 * pair, replacing any previously-loaded translation model. Safe to
 * call concurrently — concurrent calls share the same in-flight
 * `loadModel` promise.
 */
export async function ensureTranslationModelLoaded(
  targetLang: SupportedTargetLang,
): Promise<{ success: boolean; modelId?: string; error?: string }> {
  lastError = null
  if (currentModelId && currentTargetLang === targetLang) {
    return { success: true, modelId: currentModelId }
  }
  if (loadingPromise) {
    try {
      const modelId = await loadingPromise
      return { success: true, modelId }
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      }
    }
  }
  const lang = BERGAMOT_BY_CODE[targetLang]
  if (!lang) {
    lastError = `Unsupported target language: ${targetLang}`
    return { success: false, error: lastError }
  }
  loadingPromise = (async () => {
    // Unload the previous translation model (if any) before loading
    // the new one. The SDK holds one nmt model per slot; loading a
    // second one without unloading can fail or leak memory.
    if (currentModelId) {
      try {
        await unloadModel({ modelId: currentModelId, clearStorage: false })
      } catch (err) {
        console.warn(
          '[translation] unload of previous model failed:',
          err instanceof Error ? err.message : err,
        )
      }
      currentModelId = null
      currentTargetLang = null
    }
    const modelId = await loadModel({
      modelSrc: lang.modelConstant.src as unknown as string,
      modelType: 'nmt',
      modelConfig: {
        engine: 'Bergamot',
        from: 'en',
        to: targetLang,
      },
    })
    currentModelId = modelId
    currentTargetLang = targetLang
    return modelId
  })()
  try {
    const modelId = await loadingPromise
    return { success: true, modelId }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    lastError = message
    return { success: false, error: message }
  } finally {
    loadingPromise = null
  }
}

export async function unloadTranslationModel(): Promise<{ success: boolean; error?: string }> {
  if (!currentModelId) {
    return { success: true }
  }
  try {
    await unloadModel({ modelId: currentModelId, clearStorage: false })
    currentModelId = null
    currentTargetLang = null
    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    lastError = message
    return { success: false, error: message }
  }
}

// ────────────────────────── report content translation ────────────────────

/**
 * Translate a `ReportData`'s user-visible *content* fields to the
 * target language. The HTML chrome (eyebrow numbers, status labels,
 * column headers, the disclaimer) stays English — only the prose
 * that the AI generated and the user supplied is translated.
 *
 * Implemented as a single batched `translate([...])` call to
 * minimise round-trips: a 10-outcome report translates all
 * summaries, key drivers, recommendations, uncertainties, and path
 * labels in one API call (~1–2 s end-to-end with the model
 * resident).
 */
export async function translateReportData(
  data: ReportData,
  targetLang: SupportedTargetLang,
): Promise<ReportData> {
  const ensure = await ensureTranslationModelLoaded(targetLang)
  if (!ensure.success || !ensure.modelId) {
    throw new Error(
      `Failed to load translation model: ${ensure.error ?? 'unknown error'}`,
    )
  }
  const modelId = ensure.modelId

  // ── Gather every translatable string in a single flat array.
  //    Each entry is paired with a "slot" tag so we can write it
  //    back into the right place after the batch returns. We also
  //    skip empty strings to avoid sending blank entries through
  //    the translator (which can return them as `null` / empty).
  type Slot =
    | { kind: 'sim.name' }
    | { kind: 'sim.description' }
    | { kind: 'aggregate.bullet'; index: number }
    | { kind: 'aggregate.bestIntervention.title' }
    | { kind: 'aggregate.worstIntervention.title' }
    | { kind: 'aggregate.perSubject.title'; index: number }
    | { kind: 'outcome.path.subject'; outcomeId: string }
    | { kind: 'outcome.path.exposure'; outcomeId: string }
    | { kind: 'outcome.path.intervention'; outcomeId: string }
    | { kind: 'report.summary'; outcomeId: string }
    | { kind: 'report.keyDriver'; outcomeId: string; index: number }
    | { kind: 'report.recommendation'; outcomeId: string; index: number }
    | { kind: 'report.uncertainty'; outcomeId: string }

  const slots: Slot[] = []
  const inputs: string[] = []

  const push = (text: string, slot: Slot): void => {
    if (text && text.trim().length > 0) {
      inputs.push(text)
      slots.push(slot)
    }
  }

  push(data.sim.name, { kind: 'sim.name' })
  if (data.sim.description) {
    push(data.sim.description, { kind: 'sim.description' })
  }
  data.aggregate.bullets.forEach((b, i) => {
    push(b, { kind: 'aggregate.bullet', index: i })
  })
  if (data.aggregate.bestIntervention) {
    push(data.aggregate.bestIntervention.title, {
      kind: 'aggregate.bestIntervention.title',
    })
  }
  if (data.aggregate.worstIntervention) {
    push(data.aggregate.worstIntervention.title, {
      kind: 'aggregate.worstIntervention.title',
    })
  }
  data.aggregate.perSubject.forEach((s, i) => {
    push(s.title, { kind: 'aggregate.perSubject.title', index: i })
  })
  for (const o of data.outcomes) {
    push(o.pathLabels.subject, { kind: 'outcome.path.subject', outcomeId: o.id })
    push(o.pathLabels.exposure, { kind: 'outcome.path.exposure', outcomeId: o.id })
    push(o.pathLabels.intervention, {
      kind: 'outcome.path.intervention',
      outcomeId: o.id,
    })
    const r = data.reports[o.id]
    if (r) {
      if (r.summary) push(r.summary, { kind: 'report.summary', outcomeId: o.id })
      r.keyDrivers?.forEach((d, i) =>
        push(d, { kind: 'report.keyDriver', outcomeId: o.id, index: i }),
      )
      r.recommendations?.forEach((d, i) =>
        push(d, {
          kind: 'report.recommendation',
          outcomeId: o.id,
          index: i,
        }),
      )
      if (r.uncertainty) {
        push(r.uncertainty, { kind: 'report.uncertainty', outcomeId: o.id })
      }
    }
  }

  if (inputs.length === 0) {
    return data
  }

  const result = await sdkTranslate({
    modelId,
    text: inputs,
    modelType: 'nmt',
    stream: false,
  })
  const translated = await result.text
  // The QVAC NMT server-side `translate` yields each batched
  // translation as a separate token, joined with a single '\n'
  // separator (see `@qvac/sdk/.../server/bare/ops/translate.js`,
  // the `runBatch` branch). The client concatenates those tokens
  // into a single `buffer` string. A single-element `translate` call
  // (non-batch) returns the raw string with no separator.
  //
  // The previous code wrapped the buffer in `[out]` as if it were
  // an array — that dumps the entire concatenated translation into
  // slot[0] (`sim.name`) and leaves every other slot on its original
  // English fallback, which is why only the report's first two
  // strings appeared translated.
  //
  // Split on '\n' to recover the per-slot translations. The
  // `?? inputs[i]` fallback below handles the two failure modes:
  //   (a) the split is shorter than `inputs` (model truncated or
  //       merged neighbouring lines) — those slots revert to the
  //       original English instead of `undefined`;
  //   (b) a translation contains a literal '\n' (folded into the
  //       wrong slot) — better to leak a stray newline than to
  //       silently merge two strings.
  let out: string[] | string = translated
  if (typeof out === 'string') {
    out = out.split('\n')
  }

  // Write the translations back into a clone of the report data.
  // We treat the response as ordered parallel to `inputs`.
  const cloned: ReportData = {
    sim: { ...data.sim },
    outcomes: data.outcomes.map((o) => ({
      ...o,
      pathLabels: { ...o.pathLabels },
    })),
    reports: Object.fromEntries(
      Object.entries(data.reports).map(([k, v]): [string, typeof v] => [
        k,
        v
          ? {
              ...v,
              keyDrivers: v.keyDrivers ? [...v.keyDrivers] : v.keyDrivers,
              recommendations: v.recommendations ? [...v.recommendations] : v.recommendations,
            }
          : v,
      ]),
    ),
    aggregate: {
      ...data.aggregate,
      bullets: [...data.aggregate.bullets],
      perSubject: data.aggregate.perSubject.map((s) => ({ ...s })),
    },
  }

  // Re-bind the typed fields — TS loses the type through the spread.
  const simOut = cloned.sim
  const outcomesOut = cloned.outcomes
  const reportsOut = cloned.reports
  const aggOut = cloned.aggregate

  // Build the outcome-id → outcome lookup once. The slot kinds that
  // touch outcomes (`outcome.path.*`) used to do a linear
  // `outcomesOut.find(...)` per slot, which is O(n) per slot and
  // O(n²) overall for a report with N outcomes × 3 path-label
  // strings per outcome. A 10-outcome report is 30 wasted scans;
  // a 100-outcome report is 300. Hoisting the Map turns the loop
  // into O(n) total.
  const outcomesById = new Map(outcomesOut.map((o) => [o.id, o]))

  for (let i = 0; i < slots.length; i++) {
    const t = (out as string[])[i] ?? inputs[i]
    const slot = slots[i]
    switch (slot.kind) {
      case 'sim.name':
        simOut.name = t
        break
      case 'sim.description':
        simOut.description = t
        break
      case 'aggregate.bullet':
        aggOut.bullets[slot.index] = t
        break
      case 'aggregate.bestIntervention.title':
        if (aggOut.bestIntervention) aggOut.bestIntervention.title = t
        break
      case 'aggregate.worstIntervention.title':
        if (aggOut.worstIntervention) aggOut.worstIntervention.title = t
        break
      case 'aggregate.perSubject.title':
        aggOut.perSubject[slot.index].title = t
        break
      case 'outcome.path.subject': {
        const o = outcomesById.get(slot.outcomeId)
        if (o) o.pathLabels.subject = t
        break
      }
      case 'outcome.path.exposure': {
        const o = outcomesById.get(slot.outcomeId)
        if (o) o.pathLabels.exposure = t
        break
      }
      case 'outcome.path.intervention': {
        const o = outcomesById.get(slot.outcomeId)
        if (o) o.pathLabels.intervention = t
        break
      }
      case 'report.summary': {
        const r = reportsOut[slot.outcomeId]
        if (r) r.summary = t
        break
      }
      case 'report.keyDriver': {
        const r = reportsOut[slot.outcomeId]
        if (r?.keyDrivers) r.keyDrivers[slot.index] = t
        break
      }
      case 'report.recommendation': {
        const r = reportsOut[slot.outcomeId]
        if (r?.recommendations) r.recommendations[slot.index] = t
        break
      }
      case 'report.uncertainty': {
        const r = reportsOut[slot.outcomeId]
        if (r) r.uncertainty = t
        break
      }
    }
  }

  return cloned
}
