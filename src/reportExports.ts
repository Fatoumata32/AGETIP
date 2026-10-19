import type { Incident, ReportFormat } from './types'
import type { ReportPayload } from './reportTypes'

export async function exportIncidentWord(incident: Incident) {
  const { exportIncidentWord: exportWord } = await import('./wordExport')
  await exportWord(incident)
}

export async function exportReport(format: ReportFormat, report: ReportPayload, preview: HTMLElement | null) {
  if (format === 'PDF') {
    const { exportReportPDF } = await import('./pdfExport')
    return exportReportPDF(report)
  }
  if (format === 'Word (.docx)') {
    const { exportReportWord } = await import('./wordExport')
    return exportReportWord(report)
  }
  if (format === 'Excel (.xlsx)') {
    const { exportReportExcel } = await import('./excelExport')
    return exportReportExcel(report)
  }
  if (format === 'PowerPoint (.pptx)') {
    const { exportReportPresentation } = await import('./presentationExport')
    return exportReportPresentation(report)
  }
  const { exportReportImage } = await import('./imageExport')
  return exportReportImage(format, preview)
}
