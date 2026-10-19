import ExcelJS from 'exceljs'
import type { ReportPayload } from './reportTypes'
import { downloadBlob, safeFilename } from './fileUtils'

export async function exportReportExcel(report: ReportPayload) {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'AGETIP'
  workbook.created = new Date()
  const summary = workbook.addWorksheet('Synthèse')
  summary.addRows([
    ['AGETIP — Rapport', report.title],
    ['Période couverte', report.period],
    ['Généré le', report.generatedAt],
    ['Nombre d’enregistrements', report.data.length],
    ['Source', report.dataSource],
  ])
  summary.columns = [{ width: 28 }, { width: 54 }]
  summary.getRow(1).font = { bold: true, color: { argb: 'FF01592E' } }
  if (report.sections.includes('Indicateurs clés')) {
    summary.addRow([])
    summary.addRow(['Indicateur', 'Valeur'])
    report.analysis.metrics.forEach(([label, value]) => summary.addRow([label, value]))
  }
  if (report.sections.includes('Graphiques')) {
    summary.addRow([])
    summary.addRow([report.analysis.chartTitle, 'Nombre'])
    report.analysis.chartData.forEach(([label, count]) => summary.addRow([label, count]))
  }
  if (report.sections.includes('Répartitions détaillées')) {
    report.analysis.detailTables?.forEach(table => {
      summary.addRow([])
      summary.addRow([table.title, 'Valeur'])
      table.rows.forEach(([label, value]) => summary.addRow([label, value]))
    })
  }
  if (report.sections.includes('Conclusions')) {
    summary.addRow([])
    summary.addRow(['Conclusion', report.analysis.conclusion])
    report.analysis.observations?.forEach((observation, index) => summary.addRow([`Point de vigilance ${index + 1}`, observation]))
  }
  summary.getColumn(1).width = 34
  summary.getColumn(2).width = 72
  const worksheet = workbook.addWorksheet('Données')
  const columns = Object.keys(report.data[0] ?? { Information: '' })
  worksheet.columns = columns.map(header => ({ header, key: header, width: Math.min(32, Math.max(header.length + 2, 16)) }))
  worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
  worksheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF01592E' } }
  worksheet.addRows(report.data)
  const content = await workbook.xlsx.writeBuffer()
  downloadBlob(new Blob([content]), `${safeFilename(report.title)}.xlsx`)
}
