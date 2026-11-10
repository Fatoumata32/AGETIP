import { supabase } from './supabase'
import { modules, type Incident, type ModuleName } from '../types'

export type EditableRecord = { reference: string; designation: string } & Record<string, string>
export type OperationalData = Record<ModuleName, EditableRecord[]>

type StoredRecord = {
  record_type: 'incident' | 'operational' | 'toner_movement' | 'personnel'
  record_key: string
  payload: Record<string, unknown>
}

export type PersonnelRecord = {
  id: string
  name: string
  email: string
  position: string
  department: string
}

export type UserRecordType = 'notification_preferences' | 'report_history' | 'assistant_chat'
export type ReferenceDocument = {
  name: string
  size: number
  type: string
  path: string
  textPath?: string
  uploadedAt: string
}

export type WorkspaceData = {
  incidents: Incident[]
  operationalRecords: OperationalData
  tonerMovements: EditableRecord[]
}

export const emptyOperationalData = (): OperationalData => ({
  'Factures SONATEL': [],
  Incidents: [],
  'Cartouches (stock)': [],
  'Parc informatique': [],
  Climatisation: [],
  Maintenances: [],
})

function requireSupabase() {
  if (!supabase) throw new Error('Supabase n’est pas configuré.')
  return supabase
}

function toEditableRecord(value: unknown): EditableRecord | null {
  if (!value || typeof value !== 'object') return null
  const record = value as Record<string, unknown>
  if (typeof record.reference !== 'string' || typeof record.designation !== 'string') return null
  return Object.fromEntries(
    Object.entries(record).filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
  ) as EditableRecord
}

export async function loadWorkspaceData(): Promise<WorkspaceData> {
  const client = requireSupabase()
  const { data, error } = await client
    .from('app_records')
    .select('record_type, record_key, payload')
    .order('updated_at', { ascending: false })

  if (error) throw error

  const incidents: Incident[] = []
  const operationalRecords = emptyOperationalData()
  const tonerMovements: EditableRecord[] = []

  for (const row of (data ?? []) as StoredRecord[]) {
    if (row.record_type === 'incident') {
      incidents.push(row.payload as unknown as Incident)
    } else if (row.record_type === 'toner_movement') {
      const record = toEditableRecord(row.payload)
      if (record) tonerMovements.push(record)
    } else {
      const module = row.payload.module
      const record = toEditableRecord(row.payload.record)
      if (typeof module === 'string' && module in operationalRecords && record) {
        operationalRecords[module as ModuleName].push(record)
      }
    }
  }

  return { incidents, operationalRecords, tonerMovements }
}

async function replaceRecords(
  type: StoredRecord['record_type'],
  records: Array<{ key: string; payload: Record<string, unknown> }>,
) {
  const client = requireSupabase()
  const { data: current, error: loadError } = await client
    .from('app_records')
    .select('record_key')
    .eq('record_type', type)

  if (loadError) throw loadError

  if (records.length) {
    const rows = records.map(record => ({
      record_type: type,
      record_key: record.key,
      payload: record.payload,
      updated_at: new Date().toISOString(),
    }))
    const { error } = await client
      .from('app_records')
      .upsert(rows, { onConflict: 'record_type,record_key' })
    if (error) throw error
  }

  const keep = new Set(records.map(record => record.key))
  const remove = (current ?? [])
    .map(row => row.record_key as string)
    .filter(key => !keep.has(key))

  if (remove.length) {
    const { error } = await client
      .from('app_records')
      .delete()
      .eq('record_type', type)
      .in('record_key', remove)
    if (error) throw error
  }
}

export function saveIncidents(records: Incident[]) {
  return replaceRecords('incident', records.map(record => ({
    key: record.id,
    payload: record as unknown as Record<string, unknown>,
  })))
}

export async function saveOperationalModule(module: ModuleName, records: EditableRecord[]) {
  const client = requireSupabase()
  const { data: current, error: loadError } = await client
    .from('app_records')
    .select('record_key')
    .eq('record_type', 'operational')
    .filter('payload->>module', 'eq', module)

  if (loadError) throw loadError

  if (records.length) {
    const rows = records.map(record => ({
      record_type: 'operational' as const,
      record_key: `${module}:${record.reference}`,
      payload: { module, record },
      updated_at: new Date().toISOString(),
    }))
    const { error } = await client
      .from('app_records')
      .upsert(rows, { onConflict: 'record_type,record_key' })
    if (error) throw error
  }

  const keep = new Set(records.map(record => `${module}:${record.reference}`))
  const remove = (current ?? [])
    .map(row => row.record_key as string)
    .filter(key => !keep.has(key))

  if (remove.length) {
    const { error } = await client
      .from('app_records')
      .delete()
      .eq('record_type', 'operational')
      .filter('payload->>module', 'eq', module)
      .in('record_key', remove)
    if (error) throw error
  }
}

export function saveTonerMovements(records: EditableRecord[]) {
  return replaceRecords('toner_movement', records.map(record => ({
    key: record.reference,
    payload: record,
  })))
}

export async function loadPersonnel(): Promise<PersonnelRecord[]> {
  const { data, error } = await requireSupabase()
    .from('app_records')
    .select('payload')
    .eq('record_type', 'personnel')

  if (error) throw error
  return (data ?? []).map(row => {
    const payload = row.payload as Partial<PersonnelRecord>
    if (
      typeof payload.id !== 'string' ||
      typeof payload.name !== 'string' ||
      typeof payload.email !== 'string' ||
      typeof payload.position !== 'string' ||
      typeof payload.department !== 'string'
    ) {
      throw new Error('Une fiche du personnel enregistrée dans Supabase est invalide.')
    }
    return payload as PersonnelRecord
  })
}

export async function savePersonnelRecord(record: PersonnelRecord) {
  const { error } = await requireSupabase()
    .from('app_records')
    .upsert({
      record_type: 'personnel',
      record_key: record.id,
      payload: record,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'record_type,record_key' })

  if (error) throw error
}

export async function deletePersonnelRecord(id: string) {
  const { error } = await requireSupabase()
    .from('app_records')
    .delete()
    .eq('record_type', 'personnel')
    .eq('record_key', id)

  if (error) throw error
}

export async function loadUserRecord<T>(type: UserRecordType, userId: string): Promise<T | null> {
  const { data, error } = await requireSupabase()
    .from('app_records')
    .select('payload')
    .eq('record_type', type)
    .eq('record_key', userId)
    .eq('created_by', userId)
    .maybeSingle()

  if (error) throw error
  return (data?.payload as T | undefined) ?? null
}

export async function saveUserRecord(
  type: UserRecordType,
  userId: string,
  payload: Record<string, unknown>,
) {
  const { error } = await requireSupabase()
    .from('app_records')
    .upsert({
      record_type: type,
      record_key: userId,
      created_by: userId,
      payload,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'record_type,record_key' })

  if (error) throw error
}

export async function loadReferenceDocuments(): Promise<ReferenceDocument[]> {
  const { data, error } = await requireSupabase()
    .from('app_records')
    .select('payload')
    .eq('record_type', 'document')
    .order('updated_at', { ascending: false })

  if (error) throw error
  return (data ?? [])
    .map(row => row.payload as ReferenceDocument)
    .filter(document => typeof document.path === 'string' && typeof document.name === 'string')
}

export async function uploadReferenceDocument(file: File, userId: string, extractedText?: string): Promise<ReferenceDocument> {
  if (file.size > 20 * 1024 * 1024) throw new Error('Chaque document doit faire 20 Mo ou moins.')
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const extension = file.name.split('.').pop()?.toLocaleLowerCase('fr-FR')
  const contentType = file.type || ({
    pdf: 'application/pdf',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    txt: 'text/plain',
  }[extension ?? ''] ?? 'application/octet-stream')
  const path = `${userId}/${crypto.randomUUID()}-${safeName}`
  const textPath = extractedText ? `${path}.txt` : undefined
  const client = requireSupabase()
  const { error: uploadError } = await client.storage
    .from('agetip-documents')
    .upload(path, file, { contentType, upsert: false })

  if (uploadError) throw uploadError

  if (textPath && extractedText !== undefined) {
    const { error: textUploadError } = await client.storage
      .from('agetip-documents')
      .upload(textPath, new Blob([extractedText], { type: 'text/plain' }), { contentType: 'text/plain', upsert: false })
    if (textUploadError) {
      const { error: cleanupError } = await client.storage.from('agetip-documents').remove([path])
      if (cleanupError) console.error('Le document sans index texte n’a pas pu être supprimé.', cleanupError)
      throw textUploadError
    }
  }

  const metadata: ReferenceDocument = {
    name: file.name,
    size: file.size,
    type: contentType,
    path,
    textPath,
    uploadedAt: new Date().toISOString(),
  }
  const { error: metadataError } = await client
    .from('app_records')
    .insert({
      record_type: 'document',
      record_key: path,
      payload: metadata,
      created_by: userId,
    })

  if (metadataError) {
    const { error: cleanupError } = await client.storage.from('agetip-documents').remove(textPath ? [path, textPath] : [path])
    if (cleanupError) console.error('Le fichier chargé sans métadonnées n’a pas pu être supprimé.', cleanupError)
    throw metadataError
  }

  return metadata
}

export async function deleteReferenceDocument(document: ReferenceDocument) {
  const client = requireSupabase()
  const { error: storageError } = await client.storage.from('agetip-documents')
    .remove(document.textPath ? [document.path, document.textPath] : [document.path])
  if (storageError) throw storageError

  const { error: metadataError } = await client
    .from('app_records')
    .delete()
    .eq('record_type', 'document')
    .eq('record_key', document.path)

  if (metadataError) throw metadataError
}

export async function findDocumentContext(documents: ReferenceDocument[], question: string) {
  const client = requireSupabase()
  const terms = [...new Set(question.toLocaleLowerCase('fr-FR').match(/[\p{L}\p{N}]{3,}/gu) ?? [])]
  if (!terms.length) return { context: '', sources: [] as string[] }

  const extracts = await Promise.all(documents.filter(document => document.textPath).map(async document => {
    const { data, error } = await client.storage.from('agetip-documents').createSignedUrl(document.textPath!, 60)
    if (error) throw error
    const response = await fetch(data.signedUrl)
    if (!response.ok) throw new Error(`Impossible de lire l’index texte de ${document.name}.`)
    const text = await response.text()
    const paragraphs = text.match(/[\s\S]{1,900}(?:\s|$)/g) ?? []
    return paragraphs.map(paragraph => ({
      name: document.name,
      paragraph: paragraph.trim(),
      score: terms.reduce((score, term) => score + (paragraph.toLocaleLowerCase('fr-FR').includes(term) ? 1 : 0), 0),
    }))
  }))

  const ranked = extracts.flat()
    .filter(extract => extract.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, 5)

  return {
    context: ranked.map((extract, index) => `[${index + 1}] ${extract.name}\n${extract.paragraph}`).join('\n\n'),
    sources: [...new Set(ranked.map(extract => extract.name))],
  }
}

function readLocalArray(key: string): unknown[] {
  try {
    const value = JSON.parse(localStorage.getItem(key) ?? 'null') as unknown
    return Array.isArray(value) ? value : []
  } catch (error) {
    console.error(`Données locales illisibles (${key}).`, error)
    return []
  }
}

function toIncident(value: unknown): Incident | null {
  if (!value || typeof value !== 'object') return null
  const record = value as Record<string, unknown>
  const stringFields: Array<keyof Omit<Incident, 'closed'>> = [
    'id', 'reportedAt', 'reporter', 'classification', 'type', 'equipment', 'description',
    'cause', 'recordedBy', 'assignee', 'takenAt', 'treatments', 'closedAt', 'observations',
  ]
  if (!stringFields.every(field => typeof record[field] === 'string')) return null
  if (typeof record.closed !== 'boolean') return null
  if (!['Critique', 'Majeur', 'Mineur'].includes(String(record.classification))) return null
  return value as Incident
}

export async function importLocalWorkspaceData(userId: string) {
  const client = requireSupabase()
  const toImport: Array<{ record_type: string; record_key: string; payload: Record<string, unknown> }> = []

  for (const value of readLocalArray('agetip-incidents')) {
    const incident = toIncident(value)
    if (incident) {
      toImport.push({
        record_type: 'incident',
        record_key: incident.id,
        payload: incident as unknown as Record<string, unknown>,
      })
    }
  }

  try {
    const localOperational = JSON.parse(localStorage.getItem('agetip-operational-records') ?? '{}') as Partial<OperationalData>
    for (const [module, records] of Object.entries(localOperational)) {
      if (!modules.includes(module as ModuleName) || !Array.isArray(records)) continue
      for (const record of records) {
        const valid = toEditableRecord(record)
        if (!valid) continue
        toImport.push({
          record_type: 'operational',
          record_key: `${module}:${valid.reference}`,
          payload: { module, record: valid },
        })
      }
    }
  } catch (error) {
    console.error('Les enregistrements opérationnels locaux ne sont pas lisibles.', error)
  }

  for (const record of readLocalArray('agetip-toner-movements')) {
    const valid = toEditableRecord(record)
    if (valid) toImport.push({ record_type: 'toner_movement', record_key: valid.reference, payload: valid })
  }

  const existingKeys = new Set<string>()
  for (const type of ['incident', 'operational', 'toner_movement']) {
    const { data, error } = await client.from('app_records').select('record_key').eq('record_type', type)
    if (error) throw error
    for (const row of data ?? []) existingKeys.add(`${type}:${row.record_key}`)
  }

  const uniqueRecords = [...new Map(toImport.map(record => [`${record.record_type}:${record.record_key}`, record])).values()]
  const missingRows = uniqueRecords.filter(record => !existingKeys.has(`${record.record_type}:${record.record_key}`))
  if (missingRows.length) {
    const { error } = await client.from('app_records').insert(missingRows)
    if (error) throw error
  }

  const preferences = readLocalArray('agetip-seen-notifications')
  const reportHistory = readLocalArray('agetip-report-history')
  const assistantMessages = readLocalArray('agetip-assistant-chat')
  let personalRecordsImported = 0
  for (const [type, payload] of [
    ['notification_preferences', { seen: preferences }],
    ['report_history', { entries: reportHistory }],
    ['assistant_chat', { messages: assistantMessages }],
  ] as const) {
    const hasLocalData = type === 'notification_preferences'
      ? preferences.length > 0
      : type === 'report_history'
        ? reportHistory.length > 0
        : assistantMessages.length > 0
    if (!hasLocalData) continue
    const { data, error } = await client
      .from('app_records')
      .select('record_key')
      .eq('record_type', type)
      .eq('record_key', userId)
      .maybeSingle()
    if (error) throw error
    if (data) continue

    const { error: saveError } = await client.from('app_records').insert({
      record_type: type,
      record_key: userId,
      created_by: userId,
      payload,
    })
    if (saveError) throw saveError
    personalRecordsImported += 1
  }

  return {
    imported: missingRows.length,
    skipped: uniqueRecords.length - missingRows.length,
    personalRecordsImported,
  }
}
