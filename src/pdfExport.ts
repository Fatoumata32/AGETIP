import jsPDF from 'jspdf'
import type { ReportPayload } from './reportTypes'
import { safeFilename } from './fileUtils'

export function exportReportPDF(report: ReportPayload) {
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const margin = 15
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  let page = 1
  const addFooter = () => {
    pdf.setFontSize(8)
    pdf.setTextColor(110, 125, 139)
    pdf.text(`AGETIP — Informatique & technique · ${report.period}`, margin, pageHeight - 8)
    pdf.text(`Page ${page}`, pageWidth - margin, pageHeight - 8, { align: 'right' })
  }
  pdf.setTextColor(1, 89, 46)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(11)
  pdf.text('AGETIP  /  INFORMATIQUE & TECHNIQUE', margin, 16)
  pdf.setTextColor(1, 89, 46)
  pdf.setFontSize(23)
  pdf.text(report.title, margin, 29)
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(10)
  pdf.setTextColor(85, 101, 119)
  pdf.text(`Période couverte : ${report.period}     ·     Généré le ${report.generatedAt}`, margin, 37)
  pdf.setDrawColor(222, 230, 236)
  pdf.line(margin, 42, pageWidth - margin, 42)
  let y = 50
  if (report.sections.includes('Indicateurs clés')) {
    pdf.setTextColor(1, 89, 46)
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(12)
    pdf.text('Synthèse', margin, y)
    report.analysis.metrics.forEach(([label, value], index) => {
      const column = index % 2
      const row = Math.floor(index / 2)
      const x = margin + column * (pageWidth - margin * 2) / 2
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(8)
      pdf.setTextColor(75, 91, 106)
      pdf.text(`${label} :`, x, y + 8 + row * 8)
      pdf.setFont('helvetica', 'normal')
      pdf.setTextColor(35, 55, 71)
      pdf.text(value, x + 45, y + 8 + row * 8, { maxWidth: (pageWidth - margin * 2) / 2 - 48 })
    })
    y += 12 + Math.ceil(report.analysis.metrics.length / 2) * 8
  }
  if (report.sections.includes('Conclusions')) {
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(9)
    pdf.setTextColor(1, 89, 46)
    pdf.text('Conclusion', margin, y)
    pdf.setFont('helvetica', 'normal')
    pdf.setTextColor(65, 78, 91)
    const conclusion = pdf.splitTextToSize(report.analysis.conclusion, pageWidth - margin * 2)
    pdf.text(conclusion, margin, y + 5)
    y += conclusion.length * 4 + 9
  }
  if (report.sections.includes('Graphiques') && report.analysis.chartData.length) {
    const counts = Object.fromEntries(report.analysis.chartData)
    const maxCount = Math.max(...Object.values(counts))
    const chartHeight = 22
    const slotWidth = Math.min(42, (pageWidth - margin * 2) / Object.keys(counts).length)
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(10)
    pdf.setTextColor(1, 89, 46)
    pdf.text(report.analysis.chartTitle, margin, y)
    y += 4
    Object.entries(counts).forEach(([type, count], index) => {
      const x = margin + index * slotWidth + 2
      const barWidth = Math.min(15, slotWidth - 8)
      const barHeight = chartHeight * count / maxCount
      pdf.setFillColor(1, 89, 46)
      pdf.rect(x, y + chartHeight - barHeight, barWidth, barHeight, 'F')
      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(7)
      pdf.setTextColor(75, 91, 106)
      pdf.text(type, x, y + chartHeight + 5, { maxWidth: slotWidth - 3 })
      pdf.text(String(count), x, y + chartHeight - barHeight - 2)
    })
    y += chartHeight + 12
  }
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(8)
  pdf.setTextColor(113, 90, 35)
  pdf.text(report.dataSource, margin, Math.min(y, pageHeight - 18), { maxWidth: pageWidth - margin * 2 })
  y = Math.max(y + 6, 60)
  const headers = Object.keys(report.data[0] ?? { Information: '' })
  const values = report.data.map(row => headers.map(header => String(row[header] ?? '')))
  const availableWidth = pageWidth - margin * 2
  const colWidth = availableWidth / Math.max(headers.length, 1)
  const drawRow = (cells: string[], isHeader: boolean) => {
    const wrapped = cells.map(cell => pdf.splitTextToSize(String(cell || '—'), Math.max(15, colWidth - 3)) as string[])
    const height = Math.max(8, ...wrapped.map(lines => lines.length * 4)) + 2
    if (y + height > pageHeight - 15) {
      addFooter()
      pdf.addPage()
      page++
      y = 18
    }
    if (isHeader) pdf.setFillColor(1, 89, 46)
    else pdf.setFillColor(245, 248, 250)
    pdf.setDrawColor(224, 231, 236)
    let x = margin
    cells.forEach((_, index) => {
      pdf.rect(x, y, colWidth, height, 'FD')
      pdf.setFont('helvetica', isHeader ? 'bold' : 'normal')
      pdf.setFontSize(isHeader ? 7.5 : 7)
      if (isHeader) pdf.setTextColor(255, 255, 255)
      else pdf.setTextColor(42, 59, 76)
      pdf.text(wrapped[index], x + 1.5, y + 5)
      x += colWidth
    })
    y += height
  }
  if (report.sections.includes('Détail des enregistrements') && values.length) {
    drawRow(headers, true)
    values.forEach(row => drawRow(row, false))
  } else if (report.sections.includes('Détail des enregistrements')) {
    pdf.setFontSize(10)
    pdf.setTextColor(100, 112, 126)
    pdf.text('Aucun enregistrement sur cette période.', margin, y)
  }
  const ensureSpace = (height: number) => {
    if (y + height <= pageHeight - 15) return
    addFooter()
    pdf.addPage()
    page++
    y = 18
  }
  if (report.sections.includes('Répartitions détaillées')) {
    report.analysis.detailTables?.forEach(table => {
      ensureSpace(12)
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(10)
      pdf.setTextColor(1, 89, 46)
      pdf.text(table.title, margin, y)
      y += 6
      table.rows.forEach(([label, value]) => {
        const text = pdf.splitTextToSize(`${label} : ${value}`, pageWidth - margin * 2)
        const height = text.length * 4 + 2
        ensureSpace(height)
        pdf.setFont('helvetica', 'normal')
        pdf.setFontSize(8)
        pdf.setTextColor(55, 70, 83)
        pdf.text(text, margin + 2, y)
        y += height
      })
      y += 3
    })
  }
  if (report.sections.includes('Conclusions') && report.analysis.observations?.length) {
    ensureSpace(12)
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(10)
    pdf.setTextColor(1, 89, 46)
    pdf.text('Points de vigilance', margin, y)
    y += 6
    report.analysis.observations.forEach(observation => {
      const text = pdf.splitTextToSize(`• ${observation}`, pageWidth - margin * 2)
      const height = text.length * 4 + 2
      ensureSpace(height)
      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(8)
      pdf.setTextColor(55, 70, 83)
      pdf.text(text, margin + 2, y)
      y += height
    })
  }
  addFooter()
  pdf.save(`${safeFilename(report.title)}.pdf`)
}
