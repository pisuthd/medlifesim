/**
 * Pure markdown parser for the AI's per-outcome response.
 *
 * The worker prompts the model to return six `## HEADING` sections:
 *   SUMMARY, RISK, SEVERE_CASE_RATE, KEY_DRIVERS, RECOMMENDATIONS, UNCERTAINTY
 *
 * This module splits the body on those headings and returns a structured
 * object. Missing or malformed fields degrade gracefully to `null` /
 * empty arrays / empty strings so the report UI can render
 * "Awaiting AI" placeholders.
 *
 * Pure — no DOM, no IPC, no side effects. Safe to import from both the
 * main process (for the upcoming getReport handler) and the renderer.
 */

export type OutcomeSectionKey =
  | 'SUMMARY'
  | 'RISK'
  | 'SEVERE_CASE_RATE'
  | 'KEY_DRIVERS'
  | 'RECOMMENDATIONS'
  | 'UNCERTAINTY'

export interface ParsedOutcomeReport {
  summary: string
  /** Central estimate: mean of the range when one was detected, single integer otherwise. */
  risk: number | null
  severeCaseRate: number | null
  /** [min, max] tuple when the AI used a range like "30-45%"; null for single integers or no data. */
  riskRange: [number, number] | null
  severeCaseRateRange: [number, number] | null
  keyDrivers: string[]
  recommendations: string[]
  uncertainty: string
  /** Body with the six section headings stripped (for fallback rendering). */
  fullText: string
}

const HEADING_KEYS: OutcomeSectionKey[] = [
  'SUMMARY',
  'RISK',
  'SEVERE_CASE_RATE',
  'KEY_DRIVERS',
  'RECOMMENDATIONS',
  'UNCERTAINTY',
]

/** Clamp an integer to the 0..100 range. */
function clampPercent(n: number): number {
  if (n < 0) return 0
  if (n > 100) return 100
  return n
}

/**
 * Extract a percentage field as `{ value, range }` from a string.
 * - When a numeric range like "30-45%" is found, returns the **mean** as
 *   `value` and the clamped `[min, max]` tuple as `range`.
 * - When only a single integer is found, returns that integer as `value`
 *   and `null` for `range`.
 * - Returns `null` if no number is found.
 *
 * Supports `-` (hyphen), `–` (en-dash), and `—` (em-dash) as range
 * separators, with optional surrounding whitespace and a trailing `%`.
 * Both bounds are clamped to 0..100.
 */
function extractPercentField(
  text: string
): { value: number; range: [number, number] | null } | null {
  if (!text) return null
  // First, look for a range with a hyphen / en-dash / em-dash separator.
  const rangeMatch = text.match(/(\d{1,3})\s*[-–—]\s*(\d{1,3})\s*%?/)
  if (rangeMatch) {
    const lo = parseInt(rangeMatch[1], 10)
    const hi = parseInt(rangeMatch[2], 10)
    if (!Number.isNaN(lo) && !Number.isNaN(hi)) {
      const clampedLo = clampPercent(lo)
      const clampedHi = clampPercent(hi)
      return { value: (clampedLo + clampedHi) / 2, range: [clampedLo, clampedHi] }
    }
  }
  // Fall back to the first single integer.
  const singleMatch = text.match(/(\d{1,3})\s*%?/)
  if (!singleMatch) return null
  const n = parseInt(singleMatch[1], 10)
  if (Number.isNaN(n)) return null
  return { value: clampPercent(n), range: null }
}

/** Convert a chunk of text to a list of bullet points. */
function extractBullets(text: string): string[] {
  if (!text) return []
  return text
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*[-*•]\s+/, '').trim())
    .filter((line) => line.length > 0)
}

/** Trim and collapse whitespace, return the resulting string (or ''). */
function collapseParagraph(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

/**
 * Parse the AI's response markdown into a structured object.
 * Tolerant of missing/extra/mis-ordered sections.
 */
export function parseOutcomeReport(markdown: string): ParsedOutcomeReport {
  const empty: ParsedOutcomeReport = {
    summary: '',
    risk: null,
    severeCaseRate: null,
    riskRange: null,
    severeCaseRateRange: null,
    keyDrivers: [],
    recommendations: [],
    uncertainty: '',
    fullText: '',
  }
  if (!markdown) return empty

  // Find all heading positions in the order they appear.
  const matches: { key: OutcomeSectionKey; index: number; bodyStart: number }[] = []
  const re = new RegExp(
    `^##\\s+(${HEADING_KEYS.join('|')})\\s*$`,
    'gim'
  )
  let m: RegExpExecArray | null
  while ((m = re.exec(markdown)) !== null) {
    const key = m[1].toUpperCase() as OutcomeSectionKey
    matches.push({ key, index: m.index, bodyStart: m.index + m[0].length })
  }

  if (matches.length === 0) {
    // No recognised headings — dump everything into fullText for fallback.
    return { ...empty, fullText: markdown.trim() }
  }

  // Build a body slice for each heading.
  const slices: Record<OutcomeSectionKey, string> = {
    SUMMARY: '',
    RISK: '',
    SEVERE_CASE_RATE: '',
    KEY_DRIVERS: '',
    RECOMMENDATIONS: '',
    UNCERTAINTY: '',
  }

  for (let i = 0; i < matches.length; i++) {
    const cur = matches[i]
    const next = matches[i + 1]
    const end = next ? next.index : markdown.length
    slices[cur.key] = markdown.slice(cur.bodyStart, end)
  }

  // Strip headings from the full text.
  const fullText = markdown.replace(re, '').trim()

  const riskField = extractPercentField(slices.RISK)
  const severeField = extractPercentField(slices.SEVERE_CASE_RATE)

  return {
    summary: collapseParagraph(slices.SUMMARY),
    risk: riskField?.value ?? null,
    severeCaseRate: severeField?.value ?? null,
    riskRange: riskField?.range ?? null,
    severeCaseRateRange: severeField?.range ?? null,
    keyDrivers: extractBullets(slices.KEY_DRIVERS),
    recommendations: extractBullets(slices.RECOMMENDATIONS),
    uncertainty: collapseParagraph(slices.UNCERTAINTY),
    fullText,
  }
}
