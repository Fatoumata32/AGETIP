import { AlignmentType, Document, Footer, HeadingLevel, Packer, PageNumber, Paragraph, Table, TableCell, TableRow, TextRun, WidthType } from 'docx'
import JSZip from 'jszip'
import type { Incident } from './types'
import type { ReportPayload } from './reportTypes'
import { downloadBlob, safeFilename } from './fileUtils'

function makeWordTable(rows: string[][], header: string[]) {
  const borders = {
    top: { style: 'single' as const, size: 1, color: 'D9E1E8' },
    bottom: { style: 'single' as const, size: 1, color: 'D9E1E8' },
    left: { style: 'single' as const, size: 1, color: 'D9E1E8' },
    right: { style: 'single' as const, size: 1, color: 'D9E1E8' },
    insideHorizontal: { style: 'single' as const, size: 1, color: 'D9E1E8' },
    insideVertical: { style: 'single' as const, size: 1, color: 'D9E1E8' },
  }
  const cell = (value: string, isHeader = false) => new TableCell({
    width: { size: 100 / header.length, type: WidthType.PERCENTAGE },
    shading: isHeader ? { fill: '01592E' } : undefined,
    borders,
    children: [new Paragraph({ children: [new TextRun({ text: value || '—', bold: isHeader, color: isHeader ? 'FFFFFF' : '26384B', size: 19 })] })],
  })
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    columnWidths: Array.from({ length: header.length }, () => Math.floor(9000 / header.length)),
    rows: [new TableRow({ tableHeader: true, children: header.map(value => cell(value, true)) }), ...rows.map(row => new TableRow({ children: header.map((_, index) => cell(row[index] ?? '')) }))],
  })
}

export async function exportReportWord(report: ReportPayload) {
  const headers = Object.keys(report.data[0] ?? { Information: '' })
  const table = makeWordTable(report.data.map(row => headers.map(header => String(row[header] ?? ''))), headers)
  const children: (Paragraph | Table)[] = [
    new Paragraph({ children: [new TextRun({ text: 'AGETIP', bold: true, color: '01592E', size: 23 })], spacing: { after: 90 } }),
    new Paragraph({ text: report.title, heading: HeadingLevel.TITLE }),
    new Paragraph({ children: [new TextRun({ text: 'Période couverte : ', bold: true }), new TextRun(report.period)] }),
    new Paragraph({ children: [new TextRun({ text: 'Généré le : ', bold: true }), new TextRun(report.generatedAt)], spacing: { after: 250 } }),
  ]
  if (report.sections.includes('Indicateurs clés')) {
    children.push(new Paragraph({ text: 'Synthèse', heading: HeadingLevel.HEADING_1 }))
    const metrics = report.analysis.metrics.map(([label, value]) => `${label} : ${value}`).join('   |   ')
    children.push(new Paragraph(metrics || `${report.data.length} enregistrement(s) sur la période.`))
  }
  if (report.sections.includes('Graphiques') && report.analysis.chartData.length) {
    const distribution = report.analysis.chartData.map(([label, count]) => `${label} : ${count}`).join('   |   ')
    children.push(new Paragraph({ text: report.analysis.chartTitle, heading: HeadingLevel.HEADING_1 }))
    children.push(new Paragraph(distribution))
  }
  if (report.sections.includes('Répartitions détaillées')) {
    report.analysis.detailTables?.forEach(detail => {
      children.push(new Paragraph({ text: detail.title, heading: HeadingLevel.HEADING_1 }))
      children.push(makeWordTable(detail.rows, ['Élément', 'Valeur']))
    })
  }
  if (report.sections.includes('Conclusions')) {
    children.push(new Paragraph({ text: 'Conclusion', heading: HeadingLevel.HEADING_1 }))
    children.push(new Paragraph(report.analysis.conclusion))
    if (report.analysis.observations?.length) {
      children.push(new Paragraph({ text: 'Points de vigilance', heading: HeadingLevel.HEADING_2 }))
      report.analysis.observations.forEach(observation => children.push(new Paragraph({ text: observation, bullet: { level: 0 } })))
    }
  }
  children.push(new Paragraph({ children: [new TextRun({ text: report.dataSource, italics: true, color: '7A5A15', size: 16 })], spacing: { before: 220, after: 220 } }))
  if (report.sections.includes('Détail des enregistrements')) {
    children.push(new Paragraph({ text: 'Détail des données', heading: HeadingLevel.HEADING_1 }), table)
  }
  const document = new Document({
    sections: [{
      properties: { page: { margin: { top: 850, right: 850, bottom: 900, left: 850 } } },
      children,
      footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun('AGETIP — Informatique & technique · Page '), new TextRun({ children: [PageNumber.CURRENT] })] })] }) },
    }],
  })
  downloadBlob(await Packer.toBlob(document), `${safeFilename(report.title)}.docx`)
}

export async function exportIncidentWord(incident: Incident) {
  const response = await fetch('/templates/FICHE-D-INCIDENT.docx')
  if (!response.ok) throw new Error(`Le modèle Word officiel est indisponible (${response.status}).`)
  const archive = await JSZip.loadAsync(await response.arrayBuffer())
  const content = archive.file('word/document.xml')
  if (!content) throw new Error('Le modèle Word ne contient pas son document principal.')
  const xml = new DOMParser().parseFromString(await content.async('text'), 'application/xml')
  if (xml.querySelector('parsererror')) throw new Error('Le document Word officiel est illisible.')
  const ns = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
  const values = [
    ['Nom et Prénom de la personne qui a signalé l’incident', incident.reporter],
    ['Dateet heure de signalisation de l’incident', incident.reportedAt.replace('T', ' ')],
    ['Numéro d’identification assigné à l’incident', incident.id],
    ['Niveau de classification de l’incident', incident.classification],
    ['Type', incident.type],
    ['Descriptif de l’incident', incident.description],
    ['Cause', incident.cause],
    ['Responsable de l’enregistrement', incident.recordedBy],
    ['Responsable de la prise en charge', incident.assignee],
    ['Dateet heure de la prise en charge de l’incident', incident.takenAt.replace('T', ' ')],
    ['Traitements appliqués pour la résolution de l’incident', incident.treatments],
    ['Clôture de la prise en charge de l’incident', incident.closed ? 'Oui' : 'Non'],
    ['Date et heure de la clôture', incident.closedAt.replace('T', ' ')],
    ['Observations', incident.observations],
  ] as const
  const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('fr').replace(/[^a-z0-9]/g, '')
  const paragraphs = Array.from(xml.getElementsByTagNameNS(ns, 'p'))
  for (const [label, value] of values) {
    const paragraph = paragraphs.find(item => normalize(item.textContent ?? '').includes(normalize(label)))
    if (!paragraph) throw new Error(`Le champ « ${label} » est absent du modèle Word officiel.`)
    const run = xml.createElementNS(ns, 'w:r')
    const text = xml.createElementNS(ns, 'w:t')
    text.setAttributeNS('http://www.w3.org/XML/1998/namespace', 'xml:space', 'preserve')
    text.textContent = ` ${value || '—'}`
    run.appendChild(text)
    paragraph.appendChild(run)
  }
  archive.file('word/document.xml', new XMLSerializer().serializeToString(xml))
  const blob = await archive.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })
  downloadBlob(blob, `${safeFilename(incident.id)}-fiche-incident.docx`)
}
