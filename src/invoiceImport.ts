import officeParserBundleUrl from '@jose.espana/docstream/dist/officeparser.browser.js?url'

export const invoiceCategories = ['Fixe', 'Personnel', 'Passerelle', 'Africatip'] as const
export type InvoiceCategory = (typeof invoiceCategories)[number]

export type InvoiceImportCandidate = {
  id: string
  category: InvoiceCategory | ''
  period: string
  date: string
  amount: string
  sourceFile: string
  sourceSheet: string
  sourceExtract: string
  replaceExisting: boolean
}

export type InvoiceImportResult = {
  candidates: Omit<InvoiceImportCandidate, 'id' | 'replaceExisting'>[]
  warnings: string[]
}

const monthNames = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']
const monthAliases: Record<string, number> = {
  janvier: 1, janv: 1,
  fevrier: 2, fevr: 2,
  mars: 3,
  avril: 4, avr: 4,
  mai: 5,
  juin: 6,
  juillet: 7, juil: 7,
  aout: 8,
  septembre: 9, sept: 9,
  octobre: 10, oct: 10,
  novembre: 11, nov: 11,
  decembre: 12, dec: 12,
}

function normalize(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('fr-FR').trim()
}

export function parseInvoicePeriod(value: string): string {
  const normalized = normalize(value)
  const monthPattern = Object.keys(monthAliases).sort((a, b) => b.length - a.length).join('|')
  const match = normalized.match(new RegExp(`\\b(${monthPattern})\\b[^0-9]{0,8}(20\\d{2})\\b`))
  if (match) {
    const month = monthAliases[match[1]]
    return `${match[2]}-${String(month).padStart(2, '0')}`
  }
  const numeric = normalized.match(/\b(0?[1-9]|1[0-2])[\s._/-]+(20\d{2})\b/)
  if (numeric) return `${numeric[2]}-${String(Number(numeric[1])).padStart(2, '0')}`
  return ''
}

export function invoicePeriodKey(period: string | undefined, date: string | undefined): string {
  const fromPeriod = period ? parseInvoicePeriod(period) : ''
  if (fromPeriod) return fromPeriod
  return /^\d{4}-\d{2}/.test(date ?? '') ? (date as string).slice(0, 7) : ''
}

export function invoicePeriodLabel(period: string) {
  const match = period.match(/^(\d{4})-(\d{2})$/)
  if (!match) return period
  const month = Number(match[2])
  return month >= 1 && month <= 12 ? `${monthNames[month - 1][0].toLocaleUpperCase('fr-FR')}${monthNames[month - 1].slice(1)} ${match[1]}` : period
}

function amountValue(value: unknown): string {
  if (typeof value === 'number' && Number.isFinite(value)) return String(Math.round(value))
  if (typeof value !== 'string') return ''
  const digits = value.replace(/[^\d]/g, '')
  return digits || ''
}

function textValue(value: unknown) {
  return value == null ? '' : String(value).trim()
}

function findCellAmount(rows: unknown[][], matcher: (label: string, row: unknown[]) => boolean): string {
  for (const row of rows) {
    const label = normalize(row.map(textValue).join(' '))
    if (matcher(label, row)) {
      const amount = amountValue(row[2])
      if (amount) return amount
    }
  }
  return ''
}

function categoryTotals(rows: unknown[][]): Array<{ category: InvoiceCategory; amount: string; label: string }> {
  const definitions: Array<{ category: InvoiceCategory; matcher: (label: string, row: unknown[]) => boolean }> = [
    { category: 'Personnel', matcher: (label, row) => /total\s+personnel/.test(normalize(textValue(row[0]))) || normalize(textValue(row[1])) === 'personnel' },
    { category: 'Passerelle', matcher: (_label, row) => ['passerelle', 'passerelles'].includes(normalize(textValue(row[1]))) },
    { category: 'Africatip', matcher: (_label, row) => normalize(textValue(row[0])) === 'africatip' || normalize(textValue(row[1])) === 'africatip' },
    { category: 'Fixe', matcher: (label, row) => /total\s+fixe/.test(normalize(textValue(row[0]))) || normalize(textValue(row[1])) === 'fixe' },
  ]

  return definitions.flatMap(({ category, matcher }) => {
    const amount = findCellAmount(rows, matcher)
    return amount ? [{ category, amount, label: `${category} : ${Number(amount).toLocaleString('fr-FR')} FCFA` }] : []
  })
}

function wordCategory(filename: string, text: string): InvoiceCategory | '' {
  const value = normalize(`${filename} ${text}`)
  if (/\bafricatip\b/.test(value)) return 'Africatip'
  if (/\bpasserelles?\b/.test(value)) return 'Passerelle'
  if (/\bpersonnel\b/.test(value)) return 'Personnel'
  if (/\bfixe\b/.test(value)) return 'Fixe'
  return ''
}

function wordAmount(text: string): string {
  const normalized = normalize(text)
  const match = normalized.match(/(?:montant(?:\s+(?:total|ttc))?|total(?:\s+(?:facture|ttc|a\s+payer))?|net\s+a\s+payer)[^0-9]{0,30}([\d][\d\s.,\u00a0]*)/i)
  return match ? amountValue(match[1]) : ''
}

function monthStart(period: string) {
  return period ? `${period}-01` : ''
}

function headerPeriod(rows: unknown[][]) {
  for (const row of rows.slice(0, 8)) {
    const month = row.map(textValue).map(normalize).find(value => monthAliases[value] !== undefined)
    const year = row.map(textValue).find(value => /^20\d{2}$/.test(value))
    if (month && year) return `${year}-${String(monthAliases[month]).padStart(2, '0')}`
  }
  return parseInvoicePeriod(rows.slice(0, 8).flat().map(textValue).join(' '))
}

function spreadsheetCandidates(fileName: string, workbook: {
  SheetNames: string[]
  Sheets: Record<string, unknown>
}, xlsx: typeof import('xlsx')): InvoiceImportResult {
  const candidates: InvoiceImportResult['candidates'] = []
  const warnings: string[] = []

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName] as import('xlsx').WorkSheet
    const rows = xlsx.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: null, raw: true })
    const sheetPeriod = parseInvoicePeriod(sheetName)
    const headerText = rows.slice(0, 8).flat().map(textValue).join(' ')
    const headerPeriodValue = headerPeriod(rows)
    const headerPeriodTextValue = parseInvoicePeriod(headerText)
    const headerPeriodIsInconsistent = headerPeriodValue && headerPeriodTextValue && headerPeriodValue !== headerPeriodTextValue
    const period = sheetPeriod || headerPeriodValue
    if (!period) {
      warnings.push(`Onglet « ${sheetName} » ignoré : mois et année introuvables dans son nom ou son en-tête.`)
      continue
    }
    if (sheetPeriod && headerPeriodValue && sheetPeriod !== headerPeriodValue) {
      warnings.push(`Onglet « ${sheetName} » : l’en-tête structuré mentionne ${invoicePeriodLabel(headerPeriodValue)} ; la période de l’onglet (${invoicePeriodLabel(sheetPeriod)}) a été retenue.`)
    } else if (sheetPeriod && headerPeriodIsInconsistent) {
      warnings.push(`Onglet « ${sheetName} » : l’en-tête contient aussi une ancienne mention « ${invoicePeriodLabel(headerPeriodTextValue)} » ; la période de l’onglet a été retenue.`)
    }

    const totals = categoryTotals(rows)
    if (!totals.length) {
      warnings.push(`Onglet « ${sheetName} » ignoré : aucun total de catégorie exploitable n’a été trouvé.`)
      continue
    }

    for (const total of totals) {
      candidates.push({
        category: total.category,
        period,
        date: monthStart(period),
        amount: total.amount,
        sourceFile: fileName,
        sourceSheet: sheetName,
        sourceExtract: total.label,
      })
    }
  }

  return { candidates, warnings }
}

type BrowserOfficeParser = {
  parseOffice: (file: ArrayBuffer) => Promise<{ toText: () => string }>
}

declare global {
  interface Window {
    officeParser?: BrowserOfficeParser
  }
}

let officeParserReady: Promise<BrowserOfficeParser> | undefined

function loadOfficeParser(): Promise<BrowserOfficeParser> {
  if (window.officeParser?.parseOffice) return Promise.resolve(window.officeParser)
  if (officeParserReady) return officeParserReady

  officeParserReady = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = officeParserBundleUrl
    script.async = true
    script.onload = () => {
      if (window.officeParser?.parseOffice) resolve(window.officeParser)
      else reject(new Error('Le module de lecture Word s’est chargé sans exposer son API navigateur.'))
    }
    script.onerror = () => reject(new Error('Le module de lecture Word n’a pas pu être chargé.'))
    document.head.append(script)
  }).catch(error => {
    officeParserReady = undefined
    throw error
  })
  return officeParserReady
}

async function wordCandidate(file: File): Promise<InvoiceImportResult> {
  const parser = await loadOfficeParser()
  const ast = await parser.parseOffice(await file.arrayBuffer())
  const text = ast.toText()
  const period = parseInvoicePeriod(file.name) || parseInvoicePeriod(text)

  return {
    candidates: [{
      category: wordCategory(file.name, text),
      period,
      date: monthStart(period),
      amount: wordAmount(text),
      sourceFile: file.name,
      sourceSheet: '',
      sourceExtract: text.replace(/\s+/g, ' ').trim().slice(0, 600),
    }],
    warnings: [
      ...(!period ? [`${file.name} : mois et année introuvables ; complétez la période dans l’aperçu.`] : []),
      ...(!wordCategory(file.name, text) ? [`${file.name} : catégorie non reconnue ; sélectionnez-la dans l’aperçu.`] : []),
      ...(!wordAmount(text) ? [`${file.name} : aucun montant lisible n’a été trouvé ; saisissez-le dans l’aperçu.`] : []),
    ],
  }
}

export async function parseInvoiceFile(file: File): Promise<InvoiceImportResult> {
  const extension = file.name.split('.').pop()?.toLocaleLowerCase('fr-FR')
  if (extension === 'doc' || extension === 'docx') return wordCandidate(file)
  if (extension === 'xls' || extension === 'xlsx' || extension === 'csv') {
    const xlsx = await import('xlsx')
    const workbook = xlsx.read(await file.arrayBuffer(), { type: 'array', cellDates: false })
    return spreadsheetCandidates(file.name, workbook, xlsx)
  }
  throw new Error('Format non pris en charge. Utilisez un fichier .xls, .xlsx, .csv, .doc ou .docx.')
}
