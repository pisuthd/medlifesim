import * as fs from 'fs'
import * as path from 'path'
import { BrowserWindow, app } from 'electron'
import { MEDLIFESIM_DISCLAIMER } from '../shared/disclaimer'
import type {
  ParsedOutcomeReport,
} from '../shared/outcomeParser'
import type {
  ReportAggregate,
} from '../shared/outcomeReport'
import type {
  SimulationOutcome,
  SimulationParent,
} from '../preload/simulation'

/**
 * Export the report data assembled by the renderer-side `getReport` IPC
 * to JSON / Markdown / CSV / PDF.
 *
 * The four writers share a single shape: `{ sim, outcomes, reports, aggregate }`.
 * Only the PDF path needs the BrowserWindow reference (to call `printToPDF`).
 */

export interface ReportData {
  sim: SimulationParent
  outcomes: SimulationOutcome[]
  reports: Record<string, ParsedOutcomeReport | null>
  aggregate: ReportAggregate
}

export interface ExportResult {
  ok: boolean
  path?: string
  error?: string
  canceled?: boolean
}

// ─────────────────────────── helpers ──────────────────────────────────────

function safeFileNamePart(s: string): string {
  return s.replace(/[^a-z0-9-]+/gi, '-').replace(/^-+|-+$/g, '')
}

/** Quote a CSV cell — wrap in double-quotes if it has a comma, quote, or newline. */
function csvCell(v: unknown): string {
  if (v === null || v === undefined) return ''
  const s = String(v)
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return '"' + s.replace(/"/g, '""') + '"'
  }
  return s
}

function rangeStr(range: [number, number] | null | undefined): string {
  if (!range) return ''
  return `${range[0]}\u2013${range[1]}%`
}

// ─────────────────────────── JSON writer ──────────────────────────────────

export function writeJsonExport(targetPath: string, data: ReportData): ExportResult {
  try {
    fs.mkdirSync(path.dirname(targetPath), { recursive: true })
    // Atomic write (temp + rename) so an interrupted export doesn't
    // leave a half-written file the user picks up in their downloads.
    const tmp = targetPath + '.tmp-' + Date.now()
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf-8')
    fs.renameSync(tmp, targetPath)
    return { ok: true, path: targetPath }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

// ─────────────────────────── Markdown writer ─────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString()
}

function writeMarkdownLines(lines: string[]): string {
  return lines.join('\n') + '\n'
}

export function writeMarkdownExport(targetPath: string, data: ReportData): ExportResult {
  try {
    fs.mkdirSync(path.dirname(targetPath), { recursive: true })
    const { sim, outcomes, reports, aggregate } = data
    const lines: string[] = []
    lines.push(`# ${sim.name}`)
    lines.push('')
    lines.push(`> ${formatDate(sim.createdAt)}`)
    if (sim.description) {
      lines.push('')
      lines.push(sim.description)
    }
    lines.push('')
    lines.push(`**Status:** ${sim.status} · ${sim.completedCount} / ${sim.outcomeCount} complete${sim.errorCount > 0 ? ` (${sim.errorCount} err)` : ''}`)
    lines.push('')

    // Executive summary
    lines.push('## Executive summary')
    lines.push('')
    for (const b of aggregate.bullets) {
      lines.push(`- ${b}`)
    }
    lines.push('')

    if (aggregate.bestIntervention && aggregate.worstIntervention) {
      lines.push('### Best vs. worst intervention')
      lines.push('')
      lines.push('| Intervention | Avg risk | n |')
      lines.push('|---|---:|---:|')
      lines.push(`| Best · ${aggregate.bestIntervention.title} | ${aggregate.bestIntervention.avgRisk}% | ${aggregate.bestIntervention.sampleSize} |`)
      lines.push(`| Worst · ${aggregate.worstIntervention.title} | ${aggregate.worstIntervention.avgRisk}% | ${aggregate.worstIntervention.sampleSize} |`)
      lines.push('')
    }

    if (aggregate.perSubject.length > 0) {
      lines.push('### Average risk by subject')
      lines.push('')
      lines.push('| Subject | Avg risk | n |')
      lines.push('|---|---:|---:|')
      for (const s of aggregate.perSubject) {
        lines.push(`| ${s.title} | ${s.avgRisk}% | ${s.sampleSize} |`)
      }
      lines.push('')
    }

    // Per-outcome detail
    lines.push('## Per-outcome detail')
    lines.push('')
    for (const o of outcomes) {
      const r = reports[o.id]
      lines.push(`### ${o.pathLabels.subject} → ${o.pathLabels.exposure} → ${o.pathLabels.intervention}`)
      lines.push('')
      lines.push(`- **Status:** ${o.status}`)
      if (r?.risk !== null && r?.risk !== undefined) {
        lines.push(`- **Risk:** ${rangeStr(r.riskRange) || `${r.risk}%`}`)
      }
      if (r?.severeCaseRate !== null && r?.severeCaseRate !== undefined) {
        lines.push(`- **Severe case rate:** ${rangeStr(r.severeCaseRateRange) || `${r.severeCaseRate}%`}`)
      }
      if (r?.summary) {
        lines.push('')
        lines.push(r.summary)
      }
      if (r?.keyDrivers && r.keyDrivers.length > 0) {
        lines.push('')
        lines.push('**Key drivers**')
        for (const d of r.keyDrivers) lines.push(`- ${d}`)
      }
      if (r?.recommendations && r.recommendations.length > 0) {
        lines.push('')
        lines.push('**Recommendations**')
        for (const d of r.recommendations) lines.push(`- ${d}`)
      }
      if (r?.uncertainty) {
        lines.push('')
        lines.push(`> ${r.uncertainty}`)
      }
      lines.push('')
    }

    // Disclaimer footer
    lines.push('---')
    lines.push('')
    lines.push(`**${MEDLIFESIM_DISCLAIMER.title}**`)
    lines.push('')
    lines.push(MEDLIFESIM_DISCLAIMER.body)

    const tmp = targetPath + '.tmp-' + Date.now()
    fs.writeFileSync(tmp, writeMarkdownLines(lines), 'utf-8')
    fs.renameSync(tmp, targetPath)
    return { ok: true, path: targetPath }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

// ─────────────────────────── CSV writer ───────────────────────────────────

export function writeCsvExport(targetPath: string, data: ReportData): ExportResult {
  try {
    fs.mkdirSync(path.dirname(targetPath), { recursive: true })
    const { outcomes, reports } = data
    const header = [
      'outcomeId',
      'subject',
      'exposure',
      'intervention',
      'status',
      'risk',
      'riskLo',
      'riskHi',
      'severeCaseRate',
      'severeLo',
      'severeHi',
      'summary',
    ]
    const rows: string[] = [header.map(csvCell).join(',')]
    for (const o of outcomes) {
      const r = reports[o.id]
      const row = [
        o.id,
        o.pathLabels.subject,
        o.pathLabels.exposure,
        o.pathLabels.intervention,
        o.status,
        r?.risk ?? '',
        r?.riskRange?.[0] ?? '',
        r?.riskRange?.[1] ?? '',
        r?.severeCaseRate ?? '',
        r?.severeCaseRateRange?.[0] ?? '',
        r?.severeCaseRateRange?.[1] ?? '',
        r?.summary ?? '',
      ]
      rows.push(row.map(csvCell).join(','))
    }
    const tmp = targetPath + '.tmp-' + Date.now()
    fs.writeFileSync(tmp, rows.join('\n') + '\n', 'utf-8')
    fs.renameSync(tmp, targetPath)
    return { ok: true, path: targetPath }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

// ─────────────────────────── PDF writer ───────────────────────────────────

/**
 * Build the printable HTML the hidden BrowserWindow loads. Embeds the
 * report data directly so the hidden window doesn't need to round-trip
 * through IPC; the page just renders what we give it.
 *
 * Kept tiny: no React, no app chrome — just the report body in a
 * print-friendly structure. Hidden from the user (the BrowserWindow is
 * `show: false`) and torn down after `printToPDF` resolves.
 */
function buildPrintableHtml(data: ReportData): string {
  const { sim, outcomes, reports, aggregate } = data
  const fmtDate = formatDate(sim.createdAt)
  const disclaimerTitle = MEDLIFESIM_DISCLAIMER.title
  const disclaimerBody = MEDLIFESIM_DISCLAIMER.body

  const esc = (s: string): string => s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

  const renderRange = (r: ParsedOutcomeReport | null, kind: 'risk' | 'severe'): string => {
    if (!r) return '\u2014'
    if (kind === 'risk') {
      if (r.risk === null) return '\u2014'
      return r.riskRange ? `${r.riskRange[0]}\u2013${r.riskRange[1]}%` : `${r.risk}%`
    }
    if (r.severeCaseRate === null) return '\u2014'
    return r.severeCaseRateRange
      ? `${r.severeCaseRateRange[0]}\u2013${r.severeCaseRateRange[1]}%`
      : `${r.severeCaseRate}%`
  }

  const subjectRows = aggregate.perSubject.length > 0
    ? `<table>
        <thead>
          <tr><th>Subject</th><th>Avg risk</th><th>n</th></tr>
        </thead>
        <tbody>
          ${aggregate.perSubject.map((s) => `
            <tr>
              <td>${esc(s.title)}</td>
              <td>${s.avgRisk}%</td>
              <td>${s.sampleSize}</td>
            </tr>`).join('')}
        </tbody>
      </table>`
    : '<p class="muted">No parsed risk data yet.</p>'

  const outcomeBlocks = outcomes.map((o) => {
    const r = reports[o.id]
    return `
    <div class="outcome-block">
      <h2>${esc(o.pathLabels.subject)} \u2192 ${esc(o.pathLabels.exposure)} \u2192 ${esc(o.pathLabels.intervention)}</h2>
      <p class="meta">Status: <strong>${esc(o.status)}</strong> \u00b7 Risk: <strong>${esc(renderRange(r, 'risk'))}</strong> \u00b7 Severe: <strong>${esc(renderRange(r, 'severe'))}</strong></p>
      ${r?.summary ? `<p class="summary">${esc(r.summary)}</p>` : ''}
      ${r?.keyDrivers && r.keyDrivers.length > 0 ? `
        <h3>Key drivers</h3>
        <ul>${r.keyDrivers.map((d) => `<li>${esc(d)}</li>`).join('')}</ul>` : ''}
      ${r?.recommendations && r.recommendations.length > 0 ? `
        <h3>Recommendations</h3>
        <ul>${r.recommendations.map((d) => `<li>${esc(d)}</li>`).join('')}</ul>` : ''}
      ${r?.uncertainty ? `<p class="uncertainty">${esc(r.uncertainty)}</p>` : ''}
    </div>`
  }).join('')

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>${esc(sim.name)}</title>
<style>
  @page { size: A4; margin: 18mm 16mm; }
  * { box-sizing: border-box; }
  body {
    font-family: -apple-system, "Segoe UI", Roboto, sans-serif;
    color: #1a1a2e;
    line-height: 1.5;
    font-size: 11pt;
    margin: 0;
  }
  h1 { font-size: 22pt; font-weight: 500; margin: 0 0 4px 0; }
  h2 { font-size: 14pt; font-weight: 500; margin: 18px 0 6px 0; page-break-after: avoid; }
  h3 { font-size: 11pt; font-weight: 600; margin: 12px 0 4px 0; text-transform: uppercase; letter-spacing: 0.08em; color: #555; page-break-after: avoid; }
  .meta { color: #666; font-size: 9pt; margin: 4px 0 0 0; }
  .muted { color: #888; font-style: italic; }
  .summary { margin: 8px 0; }
  .uncertainty { font-style: italic; color: #555; margin-top: 8px; font-size: 10pt; }
  table { width: 100%; border-collapse: collapse; margin: 8px 0; font-size: 10pt; }
  th, td { text-align: left; padding: 6px 10px; border-bottom: 1px solid #e0e0f0; }
  th { background: #f7f7fc; text-transform: uppercase; letter-spacing: 0.08em; font-size: 9pt; color: #555; }
  td:nth-child(2), td:nth-child(3) { text-align: right; }
  ul { margin: 4px 0 4px 20px; padding: 0; }
  li { margin: 2px 0; }
  .header-card { border: 1px solid #e0e0f0; border-radius: 6px; padding: 12px 16px; margin-bottom: 16px; }
  .outcome-block { border: 1px solid #e0e0f0; border-radius: 6px; padding: 12px 16px; margin-bottom: 12px; page-break-inside: avoid; }
  .summary-card { border: 1px solid #e0e0f0; border-radius: 6px; padding: 12px 16px; margin-bottom: 12px; page-break-inside: avoid; }
  .disclaimer { margin-top: 20px; padding-top: 10px; border-top: 1px solid #e0e0f0; font-size: 9pt; color: #555; }
  @media print {
    .outcome-block, .summary-card, .header-card { page-break-inside: avoid; }
  }
</style>
</head>
<body>
  <div class="header-card">
    <p class="meta">${esc(fmtDate)}</p>
    <h1>${esc(sim.name)}</h1>
    ${sim.description ? `<p class="meta">${esc(sim.description)}</p>` : ''}
    <p class="meta">Status: <strong>${esc(sim.status)}</strong> \u00b7 ${sim.completedCount} / ${sim.outcomeCount} complete${sim.errorCount > 0 ? ` (${sim.errorCount} err)` : ''}</p>
  </div>

  <h2>Executive summary</h2>
  <div class="summary-card">
    ${aggregate.bullets.map((b) => `<p>${esc(b)}</p>`).join('')}
  </div>

  <h2>Average risk by subject</h2>
  <div class="summary-card">
    ${subjectRows}
  </div>

  <h2>Per-outcome detail</h2>
  ${outcomeBlocks}

  <div class="disclaimer">
    <p><strong>${esc(disclaimerTitle)}</strong></p>
    <p>${esc(disclaimerBody)}</p>
  </div>
</body>
</html>`
}

export async function writePdfExport(
  parentWin: BrowserWindow | null,
  targetPath: string,
  data: ReportData
): Promise<ExportResult> {
  if (!parentWin || parentWin.isDestroyed()) {
    return { ok: false, error: 'No window' }
  }
  const pdfWin = new BrowserWindow({
    show: false,
    webPreferences: { sandbox: true, contextIsolation: true },
    parent: parentWin,
  })
  try {
    const html = buildPrintableHtml(data)
    // Use a data: URL so the hidden window doesn't need to be served
    // from the file system or a local dev server.
    await pdfWin.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html))
    // Give the page a tick to finish layout. The HTML has no async
    // resources, but loadURL resolves before paint, so we wait one
    // frame so printToPDF sees the fully-styled DOM.
    await new Promise<void>((resolve) => setTimeout(resolve, 100))
    const pdfBuffer = await pdfWin.webContents.printToPDF({
      pageSize: 'A4',
      printBackground: true,
      margins: { top: 0.5, bottom: 0.5, left: 0.5, right: 0.5 } as never,
    })
    fs.mkdirSync(path.dirname(targetPath), { recursive: true })
    fs.writeFileSync(targetPath, pdfBuffer)
    return { ok: true, path: targetPath }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  } finally {
    if (!pdfWin.isDestroyed()) pdfWin.destroy()
  }
}

// ─────────────────────────── filename helper ──────────────────────────────

/**
 * Build a sane default filename for the save dialog. Combines the sim
 * name slug + an ISO timestamp (colons/dots replaced with dashes so the
 * filename is portable across Windows / macOS / Linux).
 */
export function defaultExportFileName(sim: SimulationParent, format: 'pdf' | 'json' | 'md' | 'csv'): string {
  const stamp = sim.createdAt.replace(/[:.]/g, '-')
  const slug = safeFileNamePart(sim.name) || 'report'
  return `medlifesim-${slug}-${stamp}.${format}`
}

// Re-export the user-data dir for callers that need it.
export function userDataDir(): string {
  return app.getPath('userData')
}
