import pptxgen from 'pptxgenjs'
import type { ReportPayload } from './reportTypes'
import { safeFilename } from './fileUtils'

export async function exportReportPresentation(report: ReportPayload) {
  const deck = new pptxgen()
  deck.layout = 'LAYOUT_WIDE'
  deck.author = 'AGETIP'
  deck.subject = `Rapport d’activité — ${report.period}`
  deck.title = report.title
  deck.company = 'AGETIP'
  deck.theme = { headFontFace: 'Aptos Display', bodyFontFace: 'Aptos' }
  const navy = '01592E'
  const teal = '087743'
  const first = deck.addSlide()
  first.background = { color: 'F4F7FA' }
  first.addText('AGETIP  /  INFORMATIQUE & TECHNIQUE', { x: 0.7, y: 0.55, w: 8, h: 0.35, fontSize: 13, bold: true, color: teal, charSpacing: 1.4 })
  first.addText(report.title, { x: 0.7, y: 1.65, w: 10.5, h: 1.1, fontSize: 31, bold: true, color: navy, breakLine: false })
  first.addText(`Période couverte : ${report.period}`, { x: 0.75, y: 2.95, w: 9.5, h: 0.45, fontSize: 17, color: '566779' })
  first.addShape(deck.ShapeType.line, { x: 0.75, y: 3.65, w: 2.1, h: 0, line: { color: teal, width: 2.5 } })
  first.addText(`Généré le ${report.generatedAt}`, { x: 0.75, y: 6.65, w: 6, h: 0.35, fontSize: 11, color: '718091' })
  first.addText(report.dataSource, { x: 0.75, y: 7.02, w: 11.5, h: 0.25, fontSize: 8, color: '8A6B2D' })
  let slideNumber = 2
  if (report.sections.includes('Indicateurs clés')) {
    const overview = deck.addSlide()
    overview.addText('Synthèse de la période', { x: 0.6, y: 0.45, w: 11, h: 0.5, fontSize: 24, bold: true, color: navy })
    report.analysis.metrics.forEach(([label, value], index) => {
      const x = 0.7 + (index % 2) * 6.1
      const y = 1.15 + Math.floor(index / 2) * 1.3
      overview.addShape(deck.ShapeType.roundRect, { x, y, w: 5.6, h: 1.05, rectRadius: 0.08, fill: { color: 'F0F4F7' }, line: { color: 'DFE6EC', width: 0.8 } })
      overview.addText(label.toUpperCase(), { x: x + 0.22, y: y + 0.2, w: 5.1, h: 0.25, fontSize: 10, bold: true, color: '647588', charSpacing: 0.6 })
      overview.addText(value, { x: x + 0.22, y: y + 0.52, w: 5.1, h: 0.35, fontSize: value.length > 18 ? 14 : 22, bold: true, color: navy })
    })
    slideNumber++
  }
  if (report.sections.includes('Graphiques') && report.analysis.chartData.length) {
    const chart = deck.addSlide()
    chart.addText(report.analysis.chartTitle, { x: 0.6, y: 0.45, w: 11, h: 0.5, fontSize: 24, bold: true, color: navy })
    chart.addChart(deck.ChartType.bar, [{ name: 'Enregistrements', labels: report.analysis.chartData.map(([label]) => label), values: report.analysis.chartData.map(([, value]) => value) }], {
      x: 0.8, y: 1.3, w: 8.8, h: 4.8, catAxisLabelFontFace: 'Aptos', catAxisLabelFontSize: 12,
      valAxisLabelFontSize: 10, showLegend: false, showTitle: false, showValue: true,
      chartColors: [teal], valGridLine: { color: 'E4EAF0' },
    })
    chart.addText(report.analysis.conclusion, { x: 0.9, y: 6.25, w: 11.3, h: 0.6, fontSize: 12, color: navy, bold: true, breakLine: false })
    slideNumber++
  }
  if (report.sections.includes('Répartitions détaillées')) {
    report.analysis.detailTables?.forEach(table => {
      const detail = deck.addSlide()
      detail.addText(table.title, { x: 0.6, y: 0.45, w: 11.8, h: 0.55, fontSize: 23, bold: true, color: navy })
      const rows = table.rows.length ? table.rows : [['Aucun enregistrement', '—']]
      detail.addTable([
        [
          { text: 'Élément', options: { bold: true, color: 'FFFFFF', fill: { color: navy }, fontSize: 11 } },
          { text: 'Valeur', options: { bold: true, color: 'FFFFFF', fill: { color: navy }, fontSize: 11 } },
        ],
        ...rows.map(([label, value]) => [
          { text: label, options: { fontSize: 11, color: '33465A' } },
          { text: value, options: { fontSize: 11, color: '33465A' } },
        ]),
      ], { x: 0.8, y: 1.35, w: 11.6, h: 5.3, border: { type: 'solid', color: 'DDE4EA', pt: 0.6 }, rowH: 0.42, colW: [8, 3.6] })
      detail.addText(`AGETIP · ${report.period} · Page ${slideNumber}`, { x: 0.6, y: 7.12, w: 12, h: 0.2, fontSize: 9, color: '778596', align: 'center' })
      slideNumber++
    })
  }
  if (report.sections.includes('Détail des enregistrements')) {
    const detail = deck.addSlide()
    detail.addText('Données détaillées', { x: 0.6, y: 0.45, w: 11, h: 0.5, fontSize: 24, bold: true, color: navy })
    const columns = Object.keys(report.data[0] ?? { Information: '' }).slice(0, 6)
    detail.addTable([
      columns.map(column => ({ text: column, options: { bold: true, color: 'FFFFFF', fill: navy, fontSize: 10 } })),
      ...report.data.slice(0, 10).map(row => columns.map(column => ({ text: String(row[column] ?? ''), options: { fontSize: 9, color: '33465A' } }))),
    ], { x: 0.6, y: 1.2, w: 12, h: 5.3, border: { type: 'solid', color: 'DDE4EA', pt: 0.6 }, rowH: 0.42, colW: columns.map(() => 12 / columns.length) })
    if (report.data.length > 10) detail.addText('Synthèse : aperçu des 10 premières lignes.', { x: 0.6, y: 6.6, w: 12, h: 0.25, fontSize: 10, color: '68798A' })
    detail.addText(`AGETIP · ${report.period} · Page ${slideNumber}`, { x: 0.6, y: 7.12, w: 12, h: 0.2, fontSize: 9, color: '778596', align: 'center' })
    slideNumber++
  }
  if (report.sections.includes('Conclusions')) {
    const conclusion = deck.addSlide()
    conclusion.addText('Conclusions', { x: 0.6, y: 0.45, w: 11, h: 0.5, fontSize: 24, bold: true, color: navy })
    conclusion.addText(report.analysis.conclusion, { x: 0.8, y: 1.4, w: 10.8, h: 1.2, fontSize: 17, bold: true, color: navy, breakLine: false })
    if (report.analysis.observations?.length) {
      conclusion.addText('Points de vigilance', { x: 0.8, y: 3, w: 10.8, h: 0.35, fontSize: 15, bold: true, color: teal })
      report.analysis.observations.forEach((observation, index) => {
        conclusion.addText(`• ${observation}`, { x: 0.95, y: 3.5 + index * 0.72, w: 10.7, h: 0.6, fontSize: 13, color: '33465A', breakLine: false })
      })
    }
    conclusion.addText(`AGETIP · ${report.period} · Page ${slideNumber}`, { x: 0.6, y: 7.12, w: 12, h: 0.2, fontSize: 9, color: '778596', align: 'center' })
  }
  await deck.writeFile({ fileName: `${safeFilename(report.title)}.pptx` })
}
