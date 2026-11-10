import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react'
import {
  AirVent, AlertTriangle, ArrowDownToLine, Bell, BookOpenText, Boxes, CalendarDays,
  Check, CheckCheck, ChevronDown, ChevronRight, CloudUpload, Computer, FileChartColumn, FileText,
  Filter, Home, LogOut, Menu, Monitor, Pencil, Plus, Printer, Search, Settings, ShieldCheck, UserRound, UsersRound,
  Snowflake, Sparkles, Upload, Wrench, X,
} from 'lucide-react'
import { initialIncidents, incidentTypes, modules, type Incident, type ModuleName, type ReportFormat } from './types'
import { apiRequest, askLocalAssistant, getApiBaseUrl } from './lib/persistence'
import { supabase } from './lib/supabase'
import {
  deleteReferenceDocument,
  emptyOperationalData,
  findDocumentContext,
  importLocalWorkspaceData,
  loadReferenceDocuments,
  loadWorkspaceData,
  loadUserRecord,
  saveUserRecord,
  saveIncidents as saveIncidentsToSupabase,
  saveOperationalModule as saveOperationalModuleToSupabase,
  saveTonerMovements as saveTonerMovementsToSupabase,
  uploadReferenceDocument,
  type ReferenceDocument,
} from './lib/supabaseData'
import { extractReferenceText } from './lib/documentText'
import type { Session } from '@supabase/supabase-js'
import type { ReportSection } from './reportTypes'
import { analyzeReport, type ReportAnalysis } from './reportAnalysis'
import { printIncidentSheet } from './incidentPrint'
import InvoiceImportDialog from './InvoiceImportDialog'
import { invoicePeriodKey, invoicePeriodLabel, type InvoiceImportCandidate } from './invoiceImport'
import PersonnelDirectory from './PersonnelDirectory'

type Section = 'Tableau de bord' | ModuleName | 'Personnel' | 'Rapports' | 'Assistant IA' | 'Documents et outils' | 'Paramètres'
type ReportType = 'Rapport général' | 'Factures SONATEL' | 'Incidents' | 'Cartouches (stock)' | 'Parc informatique' | 'Climatiseurs' | 'Maintenances' | 'Rapport consolidé'
type Frequency = 'Journalier' | 'Hebdomadaire' | 'Mensuel' | 'Trimestriel' | 'Semestriel' | 'Annuel' | 'Période personnalisée'
type EditableRecord = { reference: string; designation: string } & Record<string, string>
type RecordEditorState = { module: ModuleName; collection: 'module' | 'movements'; record: EditableRecord; originalReference?: string }
type UserProfile = { name: string; email: string; jobTitle: string }
type AppNotification = { id: string; module: ModuleName; title: string; detail: string; tone: 'warning' | 'danger' | 'info' }
const defaultProfile: UserProfile = { name: 'Administrateur AGETIP', email: 'admin@agetip.sn', jobTitle: 'Administrateur' }

const startRecords = [
  { reference: 'CF259A', designation: 'Toner HP 59A noir', compatibility: 'HP LaserJet M404', stock: '6', status: 'OK' },
  { reference: 'CE505A', designation: 'Toner HP 05A noir', compatibility: 'HP LaserJet P2035', stock: '6', status: 'OK' },
  { reference: 'TN-2420', designation: 'Toner Brother', compatibility: 'Brother HL-L2350', stock: '6', status: 'OK' },
  { reference: 'CF410X', designation: 'Toner HP 410X noir', compatibility: 'HP Color M452', stock: '6', status: 'OK' },
]
const devices = [
  { reference: 'INV-023', designation: 'Écran Dell P2422H', holder: 'Service informatique', status: 'En service' },
  { reference: 'INV-014', designation: 'HP ProBook 450 G8', holder: 'A. Diop', status: 'En service' },
  { reference: 'INV-008', designation: 'Dell OptiPlex 7090', holder: 'M. Diallo', status: 'En panne' },
  { reference: 'INV-031', designation: 'Imprimante HP LaserJet', holder: 'Comptabilité', status: 'En service' },
]
const airConditioners = [
  { reference: 'CLIM-01', designation: 'Bureau Direction', capacity: '18 000 BTU', status: 'Opérationnel' },
  { reference: 'CLIM-05', designation: 'Salle serveur 5', capacity: '24 000 BTU', status: 'À traiter' },
  { reference: 'CLIM-08', designation: 'Salle de réunion', capacity: '18 000 BTU', status: 'Opérationnel' },
  { reference: 'CLIM-09', designation: 'Bureau informatique', capacity: '12 000 BTU', status: 'Opérationnel' },
]
const maintenanceRecords = [
  { reference: 'MAI-2026-041', designation: 'Maintenance préventive — CLIM-05', date: '24/10/2026', status: 'Planifiée' },
  { reference: 'MAI-2026-038', designation: 'Entretien climatisation — CLIM-01', date: '20/10/2026', status: 'À venir' },
  { reference: 'MAI-2026-035', designation: 'Révision parc informatique', date: '16/10/2026', status: 'Terminée' },
  { reference: 'MAI-2026-032', designation: 'Contrôle onduleur salle serveur', date: '12/10/2026', status: 'Terminée' },
]
const invoices = [
  { reference: 'SON-2026-018', designation: 'Facture téléphonie fixe — siège', date: '2026-10-17', period: 'Septembre 2026', amount: 128000, category: 'Téléphonie fixe', status: 'À valider' },
  { reference: 'SON-2026-017', designation: 'Facture internet — liaison principale', date: '2026-10-14', period: 'Septembre 2026', amount: 45500, category: 'Internet', status: 'Traitée' },
  { reference: 'SON-2026-016', designation: 'Facture mobile — flotte professionnelle', date: '2026-10-09', period: 'Septembre 2026', amount: 299500, category: 'Téléphonie mobile', status: 'Traitée' },
  { reference: 'SON-2026-015', designation: 'Facture téléphonie fixe — siège', date: '2026-09-14', period: 'Août 2026', amount: 121000, category: 'Téléphonie fixe', status: 'Traitée' },
  { reference: 'SON-2026-014', designation: 'Facture internet — liaison principale', date: '2026-09-12', period: 'Août 2026', amount: 45500, category: 'Internet', status: 'Traitée' },
  { reference: 'SON-2026-013', designation: 'Facture mobile — flotte professionnelle', date: '2026-09-08', period: 'Août 2026', amount: 286000, category: 'Téléphonie mobile', status: 'Traitée' },
]
const initialOperationalRecords: Record<ModuleName, EditableRecord[]> = {
  'Factures SONATEL': invoices.map(item => ({ reference: item.reference, designation: item.designation, date: item.date, period: item.period, amount: String(item.amount), category: item.category, status: item.status })),
  'Incidents': [],
  'Cartouches (stock)': startRecords.map(item => ({ reference: item.reference, designation: item.designation, compatibility: item.compatibility, stock: item.stock, minimumStock: '2', status: item.status })),
  'Parc informatique': devices.map(item => ({ reference: item.reference, designation: item.designation, holder: item.holder, status: item.status })),
  'Climatisation': airConditioners.map(item => ({ reference: item.reference, designation: item.designation, capacity: item.capacity, status: item.status })),
  'Maintenances': maintenanceRecords.map(item => {
    const [day, month, year] = item.date.split('/')
    return { reference: item.reference, designation: item.designation, date: `${year}-${month}-${day}`, status: item.status }
  }),
}
const initialTonerMovements: EditableRecord[] = [
  { reference: 'MVT-2026-014', designation: 'Sortie — Toner HP 59A noir', movement: 'Sortie', reason: 'Service comptabilité', quantity: '1', date: '2026-10-14' },
  { reference: 'MVT-2026-013', designation: 'Entrée — Toner Brother', movement: 'Entrée', reason: 'Commande fournisseur', quantity: '4', date: '2026-10-10' },
  { reference: 'MVT-2026-012', designation: 'Sortie — Toner HP 05A noir', movement: 'Sortie', reason: 'Direction générale', quantity: '1', date: '2026-10-07' },
]
const recordLabels: Record<string, string> = {
  reference: 'Référence', designation: 'Désignation', date: 'Date', period: 'Période facturée', amount: 'Montant (FCFA)',
  category: 'Catégorie', status: 'Statut / état', compatibility: 'Compatibilité', stock: 'Quantité en stock',
  minimumStock: 'Seuil minimum', holder: 'Affectation', capacity: 'Capacité', movement: 'Type de mouvement',
  reason: 'Motif / bénéficiaire', quantity: 'Quantité',
}

function localDateTimeValue(date = new Date()) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
}

function localDateValue(date = new Date()) {
  return localDateTimeValue(date).slice(0, 10)
}

const navGroups = [
  { label: '', items: [{ name: 'Tableau de bord' as Section, icon: Home }] },
  { label: 'Modules', items: [
    { name: 'Personnel' as Section, icon: UsersRound },
    { name: 'Factures SONATEL' as Section, icon: FileText },
    { name: 'Incidents' as Section, icon: AlertTriangle },
    { name: 'Cartouches (stock)' as Section, icon: Boxes },
    { name: 'Parc informatique' as Section, icon: Monitor },
    { name: 'Climatisation' as Section, icon: Snowflake },
    { name: 'Maintenances' as Section, icon: Wrench },
  ] },
  { label: 'Outils', items: [
    { name: 'Rapports' as Section, icon: FileChartColumn },
    { name: 'Assistant IA' as Section, icon: Sparkles },
    { name: 'Documents et outils' as Section, icon: BookOpenText },
  ] },
]

const reportTypes: ReportType[] = ['Rapport général', 'Factures SONATEL', 'Incidents', 'Cartouches (stock)', 'Parc informatique', 'Climatiseurs', 'Maintenances', 'Rapport consolidé']
const frequencies: Frequency[] = ['Journalier', 'Hebdomadaire', 'Mensuel', 'Trimestriel', 'Semestriel', 'Annuel', 'Période personnalisée']
const reportsModules = [...modules]
const emptyIncident = (): Incident => ({
  id: `INC-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`,
  reportedAt: localDateTimeValue(),
  reporter: '',
  classification: 'Mineur',
  type: 'Réseau',
  equipment: '',
  description: '',
  cause: '',
  recordedBy: 'Service informatique',
  assignee: '',
  takenAt: '',
  treatments: '',
  closed: false,
  closedAt: '',
  observations: '',
})
function readStoredIncidents(): Incident[] {
  try {
    const saved = localStorage.getItem('agetip-incidents')
    return saved ? JSON.parse(saved) as Incident[] : initialIncidents
  } catch (error) {
    console.error('Les incidents enregistrés localement sont illisibles.', error)
    return initialIncidents
  }
}

function readStoredOperationalRecords(): Record<ModuleName, EditableRecord[]> {
  try {
    const saved = localStorage.getItem('agetip-operational-records')
    if (!saved) return initialOperationalRecords
    const parsed = JSON.parse(saved) as Partial<Record<ModuleName, unknown>>
    return Object.fromEntries(modules.map(name => {
      const rows = parsed[name]
      const valid = Array.isArray(rows) && rows.every(row => row && typeof row === 'object' && typeof row.reference === 'string' && typeof row.designation === 'string' && Object.values(row).every(value => typeof value === 'string'))
      return [name, valid ? rows : initialOperationalRecords[name]]
    })) as Record<ModuleName, EditableRecord[]>
  } catch (error) {
    console.error('Les enregistrements opérationnels locaux sont illisibles.', error)
    return initialOperationalRecords
  }
}

function readStoredTonerMovements(): EditableRecord[] {
  try {
    const saved = localStorage.getItem('agetip-toner-movements')
    if (!saved) return initialTonerMovements
    const rows = JSON.parse(saved) as unknown
    return Array.isArray(rows) && rows.every(row => row && typeof row === 'object' && typeof row.reference === 'string' && typeof row.designation === 'string' && Object.values(row).every(value => typeof value === 'string'))
      ? rows
      : initialTonerMovements
  } catch (error) {
    console.error('Les mouvements de cartouches locaux sont illisibles.', error)
    return initialTonerMovements
  }
}

function readStoredProfile(): UserProfile {
  try {
    const saved = localStorage.getItem('agetip-profile')
    if (!saved) return defaultProfile
    const profile = JSON.parse(saved) as Partial<UserProfile>
    return {
      name: typeof profile.name === 'string' ? profile.name : defaultProfile.name,
      email: typeof profile.email === 'string' ? profile.email : defaultProfile.email,
      jobTitle: typeof profile.jobTitle === 'string' ? profile.jobTitle : defaultProfile.jobTitle,
    }
  } catch (error) {
    console.error('Le profil local est illisible.', error)
    return defaultProfile
  }
}

function readSeenNotifications(): string[] {
  try {
    const saved = JSON.parse(localStorage.getItem('agetip-seen-notifications') ?? '[]') as unknown
    return Array.isArray(saved) && saved.every(item => typeof item === 'string') ? saved : []
  } catch (error) {
    console.error('Les préférences locales de notifications sont illisibles.', error)
    return []
  }
}

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map(part => part[0]?.toLocaleUpperCase('fr-FR') ?? '').join('') || 'AG'
}

function dateLabel(date: Date) {
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
}

function periodRange(frequency: Frequency, reference: string, customStart: string, customEnd: string) {
  const date = new Date(`${reference}T12:00:00`)
  const start = new Date(date)
  const end = new Date(date)
  if (frequency === 'Période personnalisée') return { start: customStart, end: customEnd }
  if (frequency === 'Journalier') return { start: reference, end: reference }
  if (frequency === 'Hebdomadaire') {
    const mondayOffset = (date.getDay() + 6) % 7
    start.setDate(date.getDate() - mondayOffset)
    end.setDate(start.getDate() + 6)
  } else if (frequency === 'Mensuel') {
    start.setDate(1)
    end.setMonth(date.getMonth() + 1, 0)
  } else if (frequency === 'Trimestriel') {
    const quarter = Math.floor(date.getMonth() / 3)
    start.setMonth(quarter * 3, 1)
    end.setMonth(quarter * 3 + 3, 0)
  } else if (frequency === 'Semestriel') {
    const half = date.getMonth() < 6 ? 0 : 1
    start.setMonth(half * 6, 1)
    end.setMonth(half * 6 + 6, 0)
  } else {
    start.setMonth(0, 1)
    end.setMonth(11, 31)
  }
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) }
}

function Workspace({ session }: { session: Session | null }) {
  const isRemote = Boolean(session && supabase)
  const [dataReady, setDataReady] = useState(!isRemote)
  const [section, setSection] = useState<Section>('Tableau de bord')
  const [incidents, setIncidents] = useState<Incident[]>(readStoredIncidents)
  const [operationalRecords, setOperationalRecords] = useState<Record<ModuleName, EditableRecord[]>>(readStoredOperationalRecords)
  const [tonerMovements, setTonerMovements] = useState<EditableRecord[]>(readStoredTonerMovements)
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null)
  const [recordEditor, setRecordEditor] = useState<RecordEditorState | null>(null)
  const [invoiceImportOpen, setInvoiceImportOpen] = useState(false)
  const [profile, setProfile] = useState<UserProfile>(() => session
    ? {
        name: String(session.user.user_metadata.display_name ?? session.user.email ?? defaultProfile.name),
        email: session.user.email ?? '',
        jobTitle: 'Utilisateur connecté',
      }
    : readStoredProfile())
  const [profileDraft, setProfileDraft] = useState<UserProfile>(() => session
    ? {
        name: String(session.user.user_metadata.display_name ?? session.user.email ?? defaultProfile.name),
        email: session.user.email ?? '',
        jobTitle: 'Utilisateur connecté',
      }
    : readStoredProfile())
  const [profileOpen, setProfileOpen] = useState(false)
  const [logoutConfirm, setLogoutConfirm] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [seenNotifications, setSeenNotifications] = useState<string[]>(readSeenNotifications)
  const [incidentSearch, setIncidentSearch] = useState('')
  const [incidentStatus, setIncidentStatus] = useState('Tous les statuts')
  const [incidentType, setIncidentType] = useState('Tous les types')
  const [incidentStart, setIncidentStart] = useState('')
  const [incidentEnd, setIncidentEnd] = useState('')
  const [reportType, setReportType] = useState<ReportType>('Rapport général')
  const [frequency, setFrequency] = useState<Frequency>('Mensuel')
  const [referenceDate, setReferenceDate] = useState(localDateValue)
  const [customStart, setCustomStart] = useState(() => `${localDateValue().slice(0, 7)}-01`)
  const [customEnd, setCustomEnd] = useState(localDateValue)
  const [chosenModules, setChosenModules] = useState<ModuleName[]>(reportsModules)
  const [includedSections, setIncludedSections] = useState<ReportSection[]>(['Indicateurs clés', 'Graphiques', 'Répartitions détaillées', 'Détail des enregistrements', 'Conclusions'])
  const [previewReady, setPreviewReady] = useState(false)
  const [reportFormat, setReportFormat] = useState<ReportFormat>('PDF')
  const [search, setSearch] = useState('')
  const [notice, setNotice] = useState('')
  const [localMigrationRunning, setLocalMigrationRunning] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [stockTab, setStockTab] = useState<'Stock' | 'Mouvements de cartouches'>('Stock')
  const [chat, setChat] = useState<{ role: 'assistant' | 'user'; text: string; sources?: string[] }[]>([
    { role: 'assistant', text: 'Bonjour ! Je suis l’assistant AGETIP. Posez une question sur les documents de référence chargés ou demandez une aide générale.' },
  ])
  const [chatInput, setChatInput] = useState('')
  const [assistantLoading, setAssistantLoading] = useState(false)
  const [assistantStatus, setAssistantStatus] = useState('Vérification du serveur…')

  useEffect(() => {
    let active = true
    void fetch(`${getApiBaseUrl()}/assistant/health`)
      .then(async response => {
        const result = await response.json() as { payload?: { message?: string } }
        if (active) setAssistantStatus(result.payload?.message ?? (response.ok ? 'Ollama prêt.' : 'Ollama indisponible.'))
      })
      .catch(error => {
        console.warn('Le service local de l’assistant est inaccessible.', error)
        if (active) setAssistantStatus('Backend assistant inaccessible.')
      })
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (!isRemote || !session) return
    let active = true
    void supabase!.from('user_profiles')
      .select('display_name, role')
      .eq('id', session.user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!active) return
        if (error) {
          console.error('Impossible de charger le profil Supabase.', error)
          showNotice('Impossible de charger votre rôle Supabase.')
          return
        }
        const roleLabels: Record<string, string> = {
          admin: 'Administrateur',
          technician: 'Technicien',
          finance: 'Finance',
          reader: 'Lecture seule',
        }
        const updated = {
          name: data?.display_name || String(session.user.user_metadata.display_name ?? session.user.email ?? defaultProfile.name),
          email: session.user.email ?? '',
          jobTitle: roleLabels[data?.role ?? 'reader'] ?? 'Lecture seule',
        }
        setProfile(updated)
        setProfileDraft(updated)
      })
    return () => { active = false }
  }, [isRemote, session])

  useEffect(() => {
    if (!isRemote || !session) return
    let active = true
    void loadUserRecord<{ seen?: string[] }>('notification_preferences', session.user.id)
      .then(record => {
        if (active && Array.isArray(record?.seen)) setSeenNotifications(record.seen)
      })
      .catch(error => {
        console.error('Impossible de charger les préférences de notifications.', error)
        if (active) showNotice('Impossible de charger les notifications mémorisées.')
      })
    return () => { active = false }
  }, [isRemote, session?.user.id])

  useEffect(() => {
    if (isRemote) return
    try {
      const saved = JSON.parse(localStorage.getItem('agetip-assistant-chat') ?? '[]') as unknown
      if (Array.isArray(saved) && saved.every(item => item && typeof item === 'object' && typeof item.text === 'string')) {
        if (saved.length) setChat(saved as typeof chat)
      }
    } catch (error) {
      console.error('L’historique local de l’assistant est illisible.', error)
    }
  }, [isRemote])

  useEffect(() => {
    if (!isRemote || !session) return
    let active = true
    void loadUserRecord<{ messages?: Array<{ role: 'assistant' | 'user'; text: string; sources?: string[] }> }>(
      'assistant_chat',
      session.user.id,
    ).then(record => {
      if (active && Array.isArray(record?.messages) && record.messages.length) setChat(record.messages)
    }).catch(error => {
      console.error('Impossible de charger l’historique de l’assistant.', error)
      if (active) showNotice('Impossible de charger l’historique de l’assistant.')
    })
    return () => { active = false }
  }, [isRemote, session?.user.id])

  useEffect(() => {
    let active = true
    const hydrateWorkspace = async () => {
      if (isRemote) {
        try {
          const workspace = await loadWorkspaceData()
          if (!active) return
          setIncidents(workspace.incidents)
          setOperationalRecords(workspace.operationalRecords)
          setTonerMovements(workspace.tonerMovements)
          setDataReady(true)
          return
        } catch (error) {
          console.error('Impossible de charger les données depuis Supabase.', error)
          if (active) {
            setIncidents([])
            setOperationalRecords(emptyOperationalData())
            setTonerMovements([])
            setDataReady(true)
            showNotice('Impossible de charger les données Supabase. Vérifiez votre rôle et la migration app_records.')
          }
          return
        }
      }

      const [backendIncidents, backendRecords, backendMovements] = await Promise.all([
        apiRequest<Incident[]>('/incidents'),
        apiRequest<Record<ModuleName, EditableRecord[]>>('/operational-records'),
        apiRequest<EditableRecord[]>('/toner-movements'),
      ])

      if (active && backendIncidents) {
        setIncidents(backendIncidents)
        localStorage.setItem('agetip-incidents', JSON.stringify(backendIncidents))
      }

      if (active && backendRecords) {
        setOperationalRecords(backendRecords)
        localStorage.setItem('agetip-operational-records', JSON.stringify(backendRecords))
      }

      if (active && backendMovements) {
        setTonerMovements(backendMovements)
        localStorage.setItem('agetip-toner-movements', JSON.stringify(backendMovements))
      }
    }

    void hydrateWorkspace()
    return () => { active = false }
  }, [isRemote, session?.user.id])

  useEffect(() => {
    const dismissOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      if (logoutConfirm) setLogoutConfirm(false)
      else if (profileOpen) setProfileOpen(false)
      else if (invoiceImportOpen) setInvoiceImportOpen(false)
      else if (notificationsOpen) setNotificationsOpen(false)
      else if (recordEditor) setRecordEditor(null)
      else if (selectedIncident) setSelectedIncident(null)
      else if (drawerOpen) setDrawerOpen(false)
    }
    window.addEventListener('keydown', dismissOnEscape)
    return () => window.removeEventListener('keydown', dismissOnEscape)
  }, [drawerOpen, invoiceImportOpen, logoutConfirm, notificationsOpen, profileOpen, recordEditor, selectedIncident])

  const openIncidents = incidents.filter(incident => !incident.closed).length
  const notifications = useMemo<AppNotification[]>(() => {
    const alerts: AppNotification[] = []
    if (openIncidents) alerts.push({ id: `open-incidents-${incidents.filter(item => !item.closed).map(item => item.id).sort().join(',')}`, module: 'Incidents', title: `${openIncidents} incident(s) à traiter`, detail: 'Consulter les incidents encore ouverts.', tone: 'danger' })
    const lowStock = operationalRecords['Cartouches (stock)'].filter(item => Number(item.stock) <= Number(item.minimumStock))
    if (lowStock.length) alerts.push({ id: `low-stock-${lowStock.map(item => item.reference).sort().join(',')}`, module: 'Cartouches (stock)', title: `${lowStock.length} référence(s) de cartouches sous le seuil`, detail: lowStock.map(item => item.designation).join(', '), tone: 'warning' })
    const broken = operationalRecords['Parc informatique'].filter(item => item.status === 'En panne')
    if (broken.length) alerts.push({ id: `equipment-out-${broken.map(item => item.reference).sort().join(',')}`, module: 'Parc informatique', title: `${broken.length} équipement(s) informatique(s) en panne`, detail: broken.map(item => item.designation).join(', '), tone: 'danger' })
    const pendingInvoices = operationalRecords['Factures SONATEL'].filter(item => item.status === 'À valider')
    if (pendingInvoices.length) alerts.push({ id: `pending-invoices-${pendingInvoices.map(item => item.reference).sort().join(',')}`, module: 'Factures SONATEL', title: `${pendingInvoices.length} facture(s) SONATEL à valider`, detail: pendingInvoices.map(item => item.reference).join(', '), tone: 'info' })
    const today = localDateValue()
    const dueSoon = new Date(`${today}T12:00:00`)
    dueSoon.setDate(dueSoon.getDate() + 30)
    const upcoming = operationalRecords.Maintenances.filter(item => item.date >= today && item.date <= localDateValue(dueSoon) && item.status !== 'Terminée')
    if (upcoming.length) alerts.push({ id: `upcoming-maintenance-${upcoming.map(item => item.reference).sort().join(',')}`, module: 'Maintenances', title: `${upcoming.length} maintenance(s) prévue(s) sous 30 jours`, detail: upcoming.slice(0, 3).map(item => item.designation).join(', '), tone: 'warning' })
    return alerts
  }, [incidents, operationalRecords])
  const unreadCount = notifications.filter(item => !seenNotifications.includes(item.id)).length
  const filteredIncidents = useMemo(() => incidents.filter(incident => {
    const query = incidentSearch.trim().toLowerCase()
    const matchesSearch = !query || [incident.id, incident.reporter, incident.type, incident.equipment, incident.description].some(value => value.toLowerCase().includes(query))
    const day = incident.reportedAt.slice(0, 10)
    const matchesStatus = incidentStatus === 'Tous les statuts' || (incidentStatus === 'Ouvert' ? !incident.closed : incident.closed)
    const matchesType = incidentType === 'Tous les types' || incident.type === incidentType
    const matchesStart = !incidentStart || day >= incidentStart
    const matchesEnd = !incidentEnd || day <= incidentEnd
    return matchesSearch && matchesStatus && matchesType && matchesStart && matchesEnd
  }), [incidents, incidentSearch, incidentStatus, incidentType, incidentStart, incidentEnd])

  const reportPeriod = periodRange(frequency, referenceDate, customStart, customEnd)
  const validReportPeriod = Boolean(reportPeriod.start && reportPeriod.end && reportPeriod.start <= reportPeriod.end)
  const reportIncidents = incidents.filter(incident => {
    const day = incident.reportedAt.slice(0, 10)
    return day >= reportPeriod.start && day <= reportPeriod.end
  })
  const monthInvoices = operationalRecords['Factures SONATEL'].filter(invoice => invoice.date.slice(0, 7) === localDateValue().slice(0, 7))
  const reportRangeLabel = validReportPeriod ? `${dateLabel(new Date(`${reportPeriod.start}T12:00:00`))} – ${dateLabel(new Date(`${reportPeriod.end}T12:00:00`))}` : 'Période invalide'

  function showNotice(message: string) {
    setNotice(message)
    window.setTimeout(() => setNotice(''), 3500)
  }

  async function markNotificationsSeen(ids: string[]) {
    const updated = [...new Set([...seenNotifications, ...ids])]
    if (isRemote && session) {
      try {
        await saveUserRecord('notification_preferences', session.user.id, { seen: updated })
      } catch (error) {
        console.error('Impossible d’enregistrer les préférences Supabase de notifications.', error)
        showNotice('Impossible de mémoriser les notifications comme lues.')
        return
      }
    }

    try {
      localStorage.setItem('agetip-seen-notifications', JSON.stringify(updated))
    } catch (error) {
      console.error('Impossible d’enregistrer les préférences de notifications.', error)
    }
    setSeenNotifications(updated)
  }

  async function migrateLocalData() {
    if (!session || localMigrationRunning) return
    setLocalMigrationRunning(true)
    try {
      const result = await importLocalWorkspaceData(session.user.id)
      const workspace = await loadWorkspaceData()
      setIncidents(workspace.incidents)
      setOperationalRecords(workspace.operationalRecords)
      setTonerMovements(workspace.tonerMovements)
      showNotice(`${result.imported} enregistrement(s) transféré(s), ${result.skipped} déjà présent(s) conservé(s), ${result.personalRecordsImported} historique(s)/préférence(s) ajouté(s). Les données locales restent intactes.`)
    } catch (error) {
      console.error('Le transfert des données locales a échoué.', error)
      showNotice('Échec du transfert. Les données locales n’ont pas été supprimées ; vérifiez les droits Supabase et réessayez.')
    } finally {
      setLocalMigrationRunning(false)
    }
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const updated = { ...profileDraft, name: profileDraft.name.trim(), email: profileDraft.email.trim() }
    try {
      if (isRemote) {
        const { error } = await supabase!.auth.updateUser({
          email: updated.email,
          data: { display_name: updated.name },
        })
        if (error) throw error
      }
      localStorage.setItem('agetip-profile', JSON.stringify(updated))
      setProfile(updated)
      setProfileDraft(updated)
      setProfileOpen(false)
      showNotice(isRemote ? 'Le profil a été mis à jour.' : 'Le profil a été mis à jour sur cet appareil.')
    } catch (error) {
      console.error('Impossible d’enregistrer le profil.', error)
      showNotice('Échec de la mise à jour du profil. Vérifiez les informations saisies et vos droits.')
    }
  }

  function openProfile() {
    setProfileDraft(profile)
    setLogoutConfirm(false)
    setProfileOpen(true)
  }

  function openRecordEditor(module: ModuleName, record?: EditableRecord, collection: RecordEditorState['collection'] = 'module') {
    const defaults: EditableRecord = module === 'Factures SONATEL'
      ? { reference: '', designation: '', date: localDateValue(), period: '', amount: '', category: '', status: 'À valider' }
      : module === 'Cartouches (stock)' && collection === 'movements'
        ? { reference: '', designation: '', movement: 'Sortie', reason: '', quantity: '1', date: localDateValue() }
        : module === 'Cartouches (stock)'
          ? { reference: '', designation: '', compatibility: '', stock: '0', minimumStock: '0', status: 'OK' }
          : module === 'Parc informatique'
            ? { reference: '', designation: '', holder: '', status: 'En service' }
            : module === 'Climatisation'
              ? { reference: '', designation: '', capacity: '', status: 'Opérationnel' }
              : { reference: '', designation: '', date: localDateValue(), status: 'Planifiée' }
    setRecordEditor({ module, collection, record: record ? { ...record } : defaults, originalReference: record?.reference })
  }

  async function saveImportedInvoices(candidates: InvoiceImportCandidate[]) {
    try {
      const rows = [...operationalRecords['Factures SONATEL']]
      let added = 0
      let updated = 0
      const categoryCodes: Record<string, string> = { Fixe: 'FIX', Personnel: 'PER', Passerelle: 'PAS', Africatip: 'AFR' }

      for (const candidate of candidates) {
        const periodLabel = invoicePeriodLabel(candidate.period)
        const designation = `Facture SONATEL — ${candidate.category} — ${periodLabel}`
        const duplicateIndex = rows.findIndex(row =>
          row.category === candidate.category &&
          invoicePeriodKey(row.period, row.date) === candidate.period,
        )
        const importedFields: EditableRecord = {
          reference: duplicateIndex >= 0 ? rows[duplicateIndex].reference : `SON-${candidate.period.replace('-', '')}-${categoryCodes[candidate.category]}`,
          designation,
          date: candidate.date || `${candidate.period}-01`,
          period: periodLabel,
          amount: String(Math.round(Number(candidate.amount))),
          category: candidate.category,
          status: 'À valider',
          sourceFile: candidate.sourceFile,
          sourceSheet: candidate.sourceSheet,
        }

        if (duplicateIndex >= 0) {
          if (!candidate.replaceExisting) continue
          rows[duplicateIndex] = importedFields
          updated += 1
        } else {
          rows.unshift(importedFields)
          added += 1
        }
      }

      const next = { ...operationalRecords, 'Factures SONATEL': rows }
      if (isRemote) await saveOperationalModuleToSupabase('Factures SONATEL', rows)
      localStorage.setItem('agetip-operational-records', JSON.stringify(next))
      setOperationalRecords(next)
      setInvoiceImportOpen(false)
      showNotice(`${added} facture(s) importée(s)${updated ? `, ${updated} mise(s) à jour` : ''}.`)
    } catch (error) {
      console.error('Impossible d’enregistrer les factures importées.', error)
      showNotice('Échec de l’enregistrement des factures. Vérifiez votre rôle Supabase et réessayez.')
    }
  }

  async function saveOperationalRecord(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!recordEditor) return
    const cleaned = Object.fromEntries(Object.entries(recordEditor.record).map(([key, value]) => [key, value.trim()])) as EditableRecord
    if (!cleaned.reference || !cleaned.designation) {
      showNotice('La référence et la désignation sont obligatoires.')
      return
    }
    if (recordEditor.module === 'Factures SONATEL' && (!Number.isFinite(Number(cleaned.amount)) || Number(cleaned.amount) < 0)) {
      showNotice('Saisissez un montant de facture valide, égal ou supérieur à zéro.')
      return
    }
    if (recordEditor.collection === 'movements' && (!Number.isInteger(Number(cleaned.quantity)) || Number(cleaned.quantity) < 1)) {
      showNotice('La quantité du mouvement doit être un entier supérieur à zéro.')
      return
    }

    try {
      if (recordEditor.collection === 'movements') {
        const next = [...tonerMovements]
        const index = recordEditor.originalReference ? next.findIndex(row => row.reference === recordEditor.originalReference) : -1
        if (next.some((row, rowIndex) => row.reference === cleaned.reference && rowIndex !== index)) {
          showNotice('Cette référence existe déjà. Choisissez une référence unique.')
          return
        }
        if (index < 0) next.unshift(cleaned)
        else next[index] = cleaned
        if (isRemote) await saveTonerMovementsToSupabase(next)
        localStorage.setItem('agetip-toner-movements', JSON.stringify(next))
        setTonerMovements(next)
      } else {
        const next = { ...operationalRecords }
        const rows = [...next[recordEditor.module]]
        const index = recordEditor.originalReference ? rows.findIndex(row => row.reference === recordEditor.originalReference) : -1
        if (rows.some((row, rowIndex) => row.reference === cleaned.reference && rowIndex !== index)) {
          showNotice('Cette référence existe déjà. Choisissez une référence unique.')
          return
        }
        if (index < 0) rows.unshift(cleaned)
        else rows[index] = cleaned
        next[recordEditor.module] = rows
        if (isRemote) await saveOperationalModuleToSupabase(recordEditor.module, rows)
        localStorage.setItem('agetip-operational-records', JSON.stringify(next))
        setOperationalRecords(next)
      }
      setRecordEditor(null)
      showNotice(recordEditor.originalReference ? 'Les modifications ont été enregistrées.' : 'Le nouvel enregistrement a été ajouté.')
    } catch (error) {
      console.error('Impossible d’enregistrer les modifications.', error)
      showNotice('Échec de l’enregistrement. Vérifiez votre rôle Supabase et réessayez.')
    }
  }

  async function saveIncident(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedIncident) return
    const exists = incidents.some(incident => incident.id === selectedIncident.id)
    const updated = exists
      ? incidents.map(incident => incident.id === selectedIncident.id ? selectedIncident : incident)
      : [selectedIncident, ...incidents]
    try {
      if (isRemote) await saveIncidentsToSupabase(updated)
      localStorage.setItem('agetip-incidents', JSON.stringify(updated))
      setIncidents(updated)
    } catch (error) {
      console.error('Impossible d’enregistrer l’incident.', error)
      showNotice('Échec de l’enregistrement de l’incident. Vérifiez votre rôle Supabase et réessayez.')
      return
    }
    setSelectedIncident(null)
    showNotice(exists ? 'La fiche d’incident a été mise à jour.' : 'La fiche d’incident a été enregistrée.')
  }

  async function deleteIncident() {
    if (!selectedIncident) return
    const updated = incidents.filter(item => item.id !== selectedIncident.id)
    try {
      if (isRemote) await saveIncidentsToSupabase(updated)
      localStorage.setItem('agetip-incidents', JSON.stringify(updated))
      setIncidents(updated)
      setSelectedIncident(null)
      showNotice('La fiche d’incident a été supprimée.')
    } catch (error) {
      console.error('Impossible de supprimer l’incident.', error)
      showNotice('Échec de la suppression. Vérifiez votre rôle Supabase et réessayez.')
    }
  }

  async function downloadReport() {
    try {
      const data = getReportData(reportType, reportIncidents)
      const report = {
        title: reportType,
        period: reportRangeLabel,
        generatedAt: new Date().toLocaleString('fr-FR'),
        incidents: reportIncidents,
        modules: chosenModules,
        sections: includedSections,
        data,
        analysis: analyzeReport(reportType, reportIncidents, data),
        dataSource: 'Données de démonstration — à remplacer par les données Supabase avant tout usage opérationnel.',
      }
      const { exportReport } = await import('./reportExports')
      await exportReport(reportFormat, report, document.getElementById('report-preview'))
      showNotice(`Rapport exporté au format ${reportFormat}.`)
    } catch (error) {
      console.error('Échec de l’export du rapport', error)
      showNotice('L’export a échoué. Veuillez réessayer.')
    }
  }

  function getReportData(type: ReportType, matchingIncidents: Incident[]) {
    const incidentRows = matchingIncidents.map(incident => ({
      Module: 'Incidents',
      Référence: incident.id,
      Date: incident.reportedAt.replace('T', ' '),
      'Signalé par': incident.reporter,
      Classification: incident.classification,
      Catégorie: incident.type,
      Équipement: incident.equipment || 'Non renseigné',
      Désignation: incident.description,
      Cause: incident.cause || 'Non renseignée',
      'Responsable de prise en charge': incident.assignee || 'Non assigné',
      Traitements: incident.treatments || 'En attente',
      'Prise en charge': incident.takenAt.replace('T', ' ') || 'En attente',
      Statut: incident.closed ? 'Clôturé' : 'Ouvert',
      'Date de clôture': incident.closedAt.replace('T', ' ') || '—',
    }))
    if (type === 'Incidents') return incidentRows
    if (type === 'Rapport général' || type === 'Rapport consolidé') {
      const rows: Record<string, string>[] = []
      if (chosenModules.includes('Incidents')) rows.push(...incidentRows)
      if (chosenModules.includes('Factures SONATEL')) rows.push(...operationalRecords['Factures SONATEL'].filter(item => item.date >= reportPeriod.start && item.date <= reportPeriod.end).map(item => ({ Module: 'Factures SONATEL', Référence: item.reference, Date: item.date, Période: item.period, Catégorie: item.category, Désignation: item.designation, 'Montant (FCFA)': item.amount, Statut: item.status })))
      if (chosenModules.includes('Cartouches (stock)')) {
        rows.push(...operationalRecords['Cartouches (stock)'].map(item => ({ Module: 'Stock de cartouches', Référence: item.reference, Désignation: item.designation, 'Imprimante compatible': item.compatibility, Stock: item.stock, 'Seuil minimum': item.minimumStock, État: item.status, 'État observé le': localDateValue() })))
        rows.push(...tonerMovements.filter(item => item.date >= reportPeriod.start && item.date <= reportPeriod.end).map(item => ({ Module: 'Cartouches (stock)', Nature: 'Mouvement', Référence: item.reference, Date: item.date, Mouvement: item.movement, Motif: item.reason, Désignation: item.designation, Quantité: item.quantity })))
      }
      if (chosenModules.includes('Parc informatique')) rows.push(...operationalRecords['Parc informatique'].map(item => ({ Module: 'Parc informatique', Référence: item.reference, Désignation: item.designation, Affectation: item.holder, État: item.status, 'État observé le': localDateValue() })))
      if (chosenModules.includes('Climatisation')) rows.push(...operationalRecords.Climatisation.map(item => {
        const linkedMaintenance = operationalRecords.Maintenances.filter(maintenance => maintenance.designation.includes(item.reference))
        const completed = linkedMaintenance.filter(maintenance => maintenance.status === 'Terminée' && maintenance.date <= localDateValue()).sort((a, b) => b.date.localeCompare(a.date))[0]
        const upcoming = linkedMaintenance.filter(maintenance => maintenance.status !== 'Terminée' && maintenance.date >= localDateValue()).sort((a, b) => a.date.localeCompare(b.date))[0]
        return { Module: 'Climatisation', Référence: item.reference, Désignation: item.designation, Capacité: item.capacity, 'Dernière maintenance terminée': completed?.date ?? 'Non renseignée', 'Prochaine maintenance': upcoming?.date ?? 'À planifier', État: item.status, 'État observé le': localDateValue() }
      }))
      if (chosenModules.includes('Maintenances')) rows.push(...operationalRecords.Maintenances.filter(item => item.date >= reportPeriod.start && item.date <= reportPeriod.end).map(item => ({ Module: 'Maintenances', Référence: item.reference, Date: item.date, Désignation: item.designation, Statut: item.status })))
      return rows
    }

    if (type === 'Factures SONATEL') return operationalRecords['Factures SONATEL'].filter(item => item.date >= reportPeriod.start && item.date <= reportPeriod.end).map(item => ({ 'N° facture SONATEL': item.reference, Date: item.date, 'Période facturée': item.period, Catégorie: item.category, Désignation: item.designation, 'Montant (FCFA)': item.amount, Statut: item.status }))
    if (type === 'Cartouches (stock)') return [
      ...operationalRecords['Cartouches (stock)'].map(item => ({ Module: 'Stock de cartouches', Référence: item.reference, Désignation: item.designation, Compatibilité: item.compatibility, Stock: item.stock, 'Seuil minimum': item.minimumStock, État: item.status, 'État observé le': localDateValue() })),
      ...tonerMovements.filter(item => item.date >= reportPeriod.start && item.date <= reportPeriod.end).map(item => ({ Module: 'Cartouches (stock)', Nature: 'Mouvement', Référence: item.reference, Date: item.date, Mouvement: item.movement, Motif: item.reason, Désignation: item.designation, Quantité: item.quantity })),
    ]
    if (type === 'Parc informatique') return operationalRecords['Parc informatique'].map(item => ({ Référence: item.reference, Désignation: item.designation, Affectation: item.holder, État: item.status, 'État observé le': localDateValue() }))
    if (type === 'Climatiseurs') return operationalRecords.Climatisation.map(item => {
      const linkedMaintenance = operationalRecords.Maintenances.filter(maintenance => maintenance.designation.includes(item.reference))
      const completed = linkedMaintenance.filter(maintenance => maintenance.status === 'Terminée' && maintenance.date <= localDateValue()).sort((a, b) => b.date.localeCompare(a.date))[0]
      const upcoming = linkedMaintenance.filter(maintenance => maintenance.status !== 'Terminée' && maintenance.date >= localDateValue()).sort((a, b) => a.date.localeCompare(b.date))[0]
      return { Référence: item.reference, Désignation: item.designation, Capacité: item.capacity, 'Dernière maintenance terminée': completed?.date ?? 'Non renseignée', 'Prochaine maintenance': upcoming?.date ?? 'À planifier', État: item.status, 'État observé le': localDateValue() }
    })
    return operationalRecords.Maintenances.filter(item => item.date >= reportPeriod.start && item.date <= reportPeriod.end).map(item => ({ Référence: item.reference, Intervention: item.designation, Date: item.date, Statut: item.status }))
  }

  const reportData = getReportData(reportType, reportIncidents)
  const reportAnalysis = analyzeReport(reportType, reportIncidents, reportData)

  function renderIncidentTable() {
    return <div className="table-wrap"><table><thead><tr><th>N° d’identification</th><th>Date et heure de signalisation</th><th>Personne qui a signalé</th><th>Niveau de classification</th><th>Type</th><th>Descriptif</th><th>Statut</th></tr></thead>
      <tbody>{filteredIncidents.map(incident => <tr key={incident.id} onClick={() => setSelectedIncident(incident)} className="clickable">
        <td className="strong">{incident.id}</td><td>{new Date(incident.reportedAt).toLocaleString('fr-FR')}</td><td>{incident.reporter}</td>
        <td><span className={`badge ${incident.classification.toLowerCase()}`}>{incident.classification}</span></td><td>{incident.type}</td>
        <td>{incident.description}</td><td><span className={`badge ${incident.closed ? 'closed' : 'open'}`}>{incident.closed ? 'Clôturé' : 'Ouvert'}</span></td>
      </tr>)}</tbody></table>{filteredIncidents.length === 0 && <div className="empty-state">Aucun incident ne correspond à votre recherche.</div>}</div>
  }

  function renderModuleTable() {
    if (section === 'Incidents') return renderIncidentTable()
    const moduleName = section as ModuleName
    const isInvoices = section === 'Factures SONATEL'
    const isStock = section === 'Cartouches (stock)'
    const isMovements = isStock && stockTab === 'Mouvements de cartouches'
    const records = isMovements ? tonerMovements : operationalRecords[moduleName]
    const keys = isInvoices ? ['reference', 'designation', 'period', 'category', 'date', 'amount', 'status']
      : isMovements ? ['reference', 'movement', 'reason', 'quantity', 'date']
      : isStock ? ['reference', 'designation', 'compatibility', 'stock', 'minimumStock', 'status']
      : section === 'Parc informatique' ? ['reference', 'designation', 'holder', 'status']
      : section === 'Climatisation' ? ['reference', 'designation', 'capacity', 'status']
      : ['reference', 'designation', 'date', 'status']
    const matching = records.filter(record => Object.values(record).some(value => String(value).toLowerCase().includes(search.toLowerCase())))
    return <div className="table-wrap"><table><thead><tr>{keys.map(key => <th key={key}>{isInvoices && key === 'reference' ? 'N° facture SONATEL' : recordLabels[key] ?? key}</th>)}<th>Actions</th></tr></thead>
      <tbody>{matching.map(record => <tr key={record.reference}>
        {keys.map((key, column) => <td key={key} className={column === 0 ? 'strong' : ''}>{key === 'status' ? <span className={`badge ${record[key].toLowerCase().replaceAll(' ', '-')}`}>{record[key]}</span> : key === 'amount' ? `${Number(record[key] || 0).toLocaleString('fr-FR')} FCFA` : key === 'date' ? new Date(`${record[key]}T12:00:00`).toLocaleDateString('fr-FR') : record[key]}</td>)}
        <td><button className="button light small-button" onClick={() => openRecordEditor(moduleName, record, isMovements ? 'movements' : 'module')}><Pencil size={13}/>Modifier</button></td>
      </tr>)}</tbody></table>{matching.length === 0 && <div className="empty-state">Aucun résultat.</div>}</div>
  }

  async function sendChat(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const question = chatInput.trim()
    if (!question || assistantLoading) return
    const userMessage = { role: 'user' as const, text: question }
    const pendingMessages = [...chat, userMessage]
    setChat(pendingMessages)
    setChatInput('')
    setAssistantLoading(true)
    try {
      let context = ''
      let sources: string[] = []
      if (isRemote) {
        const documents = await loadReferenceDocuments()
        const retrieval = await findDocumentContext(documents, question)
        context = retrieval.context
        sources = retrieval.sources
      }

      const answer = await askLocalAssistant(
        pendingMessages.slice(-12).map(message => ({ role: message.role, content: message.text })),
        context,
        session?.access_token,
      )
      const completedMessages = [...pendingMessages, { role: 'assistant' as const, text: answer, sources }]
      setChat(completedMessages)
      try {
        if (isRemote && session) {
          await saveUserRecord('assistant_chat', session.user.id, { messages: completedMessages.slice(-40) })
        } else {
          localStorage.setItem('agetip-assistant-chat', JSON.stringify(completedMessages.slice(-40)))
        }
      } catch (error) {
        console.error('La réponse est disponible, mais son historique n’a pas pu être enregistré.', error)
        showNotice('Réponse reçue, mais historique non enregistré.')
      }
    } catch (error) {
      console.error('La réponse de l’assistant local a échoué.', error)
      showNotice(error instanceof Error ? error.message : 'Impossible de joindre Ollama. Vérifiez le serveur et son modèle.')
      setChat(current => current.filter((message, index) => !(index === current.length - 1 && message === userMessage)))
    } finally {
      setAssistantLoading(false)
    }
  }

  const now = new Date()
  const greetingDate = dateLabel(now)
  const isReport = section === 'Rapports'
  const sectionTitle = section === 'Tableau de bord' ? `Bonjour ${profile.name.split(' ')[0]}` : section

  if (isRemote && !dataReady) {
    return <main className="auth-page"><section className="auth-card"><strong>AGETIP</strong><p>Chargement sécurisé des données depuis Supabase…</p></section></main>
  }

  return <div className="app-shell">
    <aside className={`sidebar ${drawerOpen ? 'sidebar-open' : ''}`}>
      <div className="brand"><div className="brand-mark"><img src="/assets/logo-agetip.png" alt="Logo AGETIP"/></div><div><strong>AGETIP</strong><small>Informatique & technique</small></div><button className="mobile-close icon-button" onClick={() => setDrawerOpen(false)} aria-label="Fermer le menu"><X size={18}/></button></div>
      <nav>{navGroups.map(group => <div className="nav-group" key={group.label || 'home'}>{group.label && <div className="nav-label">{group.label}</div>}
        {group.items.map(item => <button key={item.name} className={`nav-item ${section === item.name ? 'active' : ''}`} onClick={() => { setSection(item.name); setDrawerOpen(false) }}><item.icon size={16}/><span>{item.name}</span></button>)}
      </div>)}</nav>
      <div className="sidebar-bottom">
        <button className={`nav-item ${section === 'Paramètres' ? 'active' : ''}`} onClick={() => setSection('Paramètres')}><Settings size={16}/><span>Paramètres</span></button>
        <button className="nav-item" onClick={openProfile}><UserRound size={16}/><span>Mon profil</span></button>
        <button className="nav-item" onClick={() => { openProfile(); setLogoutConfirm(true) }}><LogOut size={16}/><span>Déconnexion</span></button>
        <button className="user-profile" onClick={openProfile}><div className="avatar">{initials(profile.name)}</div><div><strong>{profile.name}</strong><small>{profile.jobTitle}</small></div><ChevronDown size={15}/></button>
      </div>
    </aside>
    {drawerOpen && <button className="sidebar-scrim" onClick={() => setDrawerOpen(false)} aria-label="Fermer le menu"/>}
    <main className="main-area">
      <header className="topbar">
        <button className="mobile-menu icon-button" onClick={() => setDrawerOpen(true)} aria-label="Ouvrir le menu"><Menu size={20}/></button>
        <div className="breadcrumb">AGETIP <ChevronRight size={14}/><span>{section}</span></div>
        <div className="top-actions">
          <div className="notification-wrap">
            <button className={`icon-button notification ${notificationsOpen ? 'is-open' : ''}`} onClick={() => setNotificationsOpen(!notificationsOpen)} aria-label={`Notifications : ${unreadCount} non lue(s)`} aria-expanded={notificationsOpen}>
              <Bell size={18}/>{unreadCount > 0 && <span className="notification-count">{unreadCount > 9 ? '9+' : unreadCount}</span>}
            </button>
            {notificationsOpen && <>
              <button className="popover-scrim" onClick={() => setNotificationsOpen(false)} aria-label="Fermer les notifications"/>
              <section className="notification-panel" aria-label="Notifications">
                <div className="notification-heading"><div><h2>Notifications</h2><span>{unreadCount ? `${unreadCount} nouvelle(s)` : 'Tout est à jour'}</span></div>{unreadCount > 0 && <button className="text-link" onClick={() => { void markNotificationsSeen(notifications.map(item => item.id)) }}><CheckCheck size={14}/>Tout lire</button>}</div>
                <div className="notification-list">{notifications.length ? notifications.map(item => {
                  const isUnread = !seenNotifications.includes(item.id)
                  return <button className={`notification-item ${isUnread ? 'unread' : ''}`} key={item.id} onClick={() => { void markNotificationsSeen([item.id]); setSection(item.module); setNotificationsOpen(false) }}>
                    <span className={`notification-symbol ${item.tone}`}><Bell size={14}/></span><span className="notification-copy"><strong>{item.title}</strong><small>{item.detail}</small></span>{isUnread && <span className="unread-indicator" aria-label="Non lue"/>}
                  </button>
                }) : <div className="notification-empty"><Check size={18}/><strong>Aucune alerte opérationnelle</strong><span>Les alertes apparaîtront ici.</span></div>}</div>
                <div className="notification-footer">Les alertes sont calculées à partir des données enregistrées{isRemote ? ' dans Supabase.' : ' localement.'}</div>
              </section>
            </>}
          </div>
          <button className="profile-trigger" onClick={openProfile} aria-label={`Ouvrir le profil de ${profile.name}`}><span className="top-avatar">{initials(profile.name)}</span><span className="profile-trigger-name">{profile.name}</span><ChevronDown size={14}/></button>
        </div>
      </header>
      <div className="page-content">
        <div className="page-heading"><div><h1>{sectionTitle}</h1>{section === 'Tableau de bord' ? <p>Situation au {greetingDate}.</p> : section === 'Incidents' ? <p>Enregistrez et suivez les signalements informatiques et techniques.</p> : section === 'Personnel' ? <p>Répertoire des collaborateurs et de leurs adresses e-mail AGETIP.</p> : null}</div>
          {section === 'Incidents' && <button className="button primary" onClick={() => setSelectedIncident(emptyIncident())}><Plus size={16}/>Nouvel incident</button>}
        </div>
        {section === 'Tableau de bord' && <Dashboard incidents={incidents} records={operationalRecords} invoiceCount={monthInvoices.length} invoiceTotal={monthInvoices.reduce((total, item) => total + (Number(item.amount) || 0), 0)} setSection={setSection} openIncident={setSelectedIncident} />}
        {section === 'Personnel' && <PersonnelDirectory isRemote={isRemote} canManage={!isRemote || profile.jobTitle === 'Administrateur'} />}
        {section === 'Incidents' && <section className="panel module-panel">
          <div className="filter-row"><label className="search-box"><Search size={16}/><input value={incidentSearch} onChange={event => setIncidentSearch(event.target.value)} placeholder="Rechercher..." /></label>
            <label className="select-box"><Filter size={14}/><select value={incidentStatus} onChange={event => setIncidentStatus(event.target.value)}><option>Tous les statuts</option><option>Ouvert</option><option>Clôturé</option></select></label>
            <label className="select-box"><select value={incidentType} onChange={event => setIncidentType(event.target.value)}><option>Tous les types</option>{incidentTypes.map(type => <option key={type}>{type}</option>)}</select></label>
            <label className="date-filter"><CalendarDays size={14}/><input type="date" aria-label="Filtrer depuis la date" value={incidentStart} onChange={event => setIncidentStart(event.target.value)} /></label><span className="filter-separator">au</span><label className="date-filter"><input type="date" aria-label="Filtrer jusqu’à la date" value={incidentEnd} onChange={event => setIncidentEnd(event.target.value)} /></label>
          </div>
          {renderIncidentTable()}<div className="table-footer">{filteredIncidents.length} enregistrement(s)</div>
        </section>}
        {(modules as readonly string[]).filter(name => name !== 'Incidents').includes(section) && <section className="panel module-panel">
          <div className="module-toolbar">{section === 'Cartouches (stock)' && <div className="tabs">{(['Stock', 'Mouvements de cartouches'] as const).map(tab => <button onClick={() => setStockTab(tab)} className={stockTab === tab ? 'tab active-tab' : 'tab'} key={tab}>{tab}</button>)}</div>}
            <div className="toolbar-actions"><label className="search-box compact-search"><Search size={15}/><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Rechercher..." /></label>
              {section === 'Factures SONATEL' && <><button className="button light" onClick={() => showNotice('Le fichier Excel est prêt à être exporté depuis le module Rapports.')}><ArrowDownToLine size={15}/>Excel</button><button className="button light" onClick={() => setInvoiceImportOpen(true)}><Upload size={15}/>Importer</button></>}
              {section === 'Cartouches (stock)' && <button className="button light" onClick={() => showNotice('Import Excel indisponible dans ce prototype : aucune donnée n’a été modifiée.')}><Upload size={15}/>Importer</button>}
              <button className="button primary" onClick={() => openRecordEditor(section as ModuleName, undefined, section === 'Cartouches (stock)' && stockTab === 'Mouvements de cartouches' ? 'movements' : 'module')}><Plus size={15} />Nouveau</button>
            </div>
          </div>{renderModuleTable()}<div className="table-footer">{(section === 'Cartouches (stock)' && stockTab === 'Mouvements de cartouches' ? tonerMovements : operationalRecords[section as ModuleName]).length} enregistrement(s){isRemote ? ' synchronisé(s) avec Supabase' : ' conservé(s) dans ce navigateur'}</div>
        </section>}
        {recordEditor && <OperationalRecordEditor editor={recordEditor} onChange={updatedEditor => setRecordEditor(updatedEditor)} onSave={saveOperationalRecord} onClose={() => setRecordEditor(null)} />}
        {isReport && <ReportsPanel
          session={session} isRemote={isRemote} showNotice={showNotice}
          reportType={reportType} setReportType={setReportType} frequency={frequency} setFrequency={value => { setFrequency(value); setPreviewReady(false) }}
          referenceDate={referenceDate} setReferenceDate={value => { setReferenceDate(value); setPreviewReady(false) }}
          customStart={customStart} setCustomStart={value => { setCustomStart(value); setPreviewReady(false) }} customEnd={customEnd} setCustomEnd={value => { setCustomEnd(value); setPreviewReady(false) }}
          chosenModules={chosenModules} setChosenModules={setChosenModules} previewReady={previewReady} setPreviewReady={setPreviewReady}
          includedSections={includedSections} setIncludedSections={setIncludedSections} validReportPeriod={validReportPeriod}
          reportFormat={reportFormat} setReportFormat={setReportFormat} reportPeriod={reportRangeLabel} reportIncidents={reportIncidents}
          reportData={reportData} reportAnalysis={reportAnalysis} onExport={downloadReport} onPrint={() => window.print()} />
        }
        {section === 'Assistant IA' && <section className="panel assistant-panel"><div className="assistant-head"><div className="assistant-logo"><Sparkles size={21}/></div><div><h2>Assistant AGETIP</h2><p>Recherche documentaire locale · Ollama</p></div><span className="status-pill"><span/>{assistantStatus}</span></div>
          <div className="chat-history">{chat.map((message, index) => <div key={index} className={`chat-message ${message.role}`}><div className="chat-avatar">{message.role === 'assistant' ? <Sparkles size={15}/> : 'AD'}</div><div className="chat-bubble">{message.text}{message.sources?.length ? <div className="source-note"><BookOpenText size={13}/> Sources : {message.sources.join(', ')}</div> : null}</div></div>)}{assistantLoading && <div className="chat-message assistant"><div className="chat-avatar"><Sparkles size={15}/></div><div className="chat-bubble">Ollama prépare une réponse…</div></div>}</div>
          <form className="chat-form" onSubmit={event => { void sendChat(event) }}><input value={chatInput} onChange={event => setChatInput(event.target.value)} placeholder="Posez une question sur les procédures ou les équipements…" /><button className="button primary" disabled={assistantLoading || !chatInput.trim()} type="submit"><ArrowDownToLine className="send-icon" size={16}/>{assistantLoading ? 'Réponse…' : 'Envoyer'}</button></form>
          <div className="assistant-note"><ShieldCheck size={15}/>Les messages et extraits documentaires sont transmis uniquement au serveur Ollama configuré. {isRemote ? 'L’historique est enregistré dans votre compte.' : 'L’historique reste dans ce navigateur.'}</div>
        </section>}
        {section === 'Documents et outils' && <DocumentsPanel showNotice={showNotice} session={session} isRemote={isRemote} canManage={isRemote && ['Administrateur', 'Technicien'].includes(profile.jobTitle)} />}
        {section === 'Paramètres' && <section className="panel settings-panel"><h2>Paramètres de l’espace</h2><p className="muted">Préférences et informations de configuration de la plateforme.</p><div className="settings-grid"><div className="setting-item"><strong>Organisation</strong><span>AGETIP</span></div><div className="setting-item"><strong>Langue</strong><span>Français</span></div><div className="setting-item"><strong>Stockage des incidents</strong><span>{isRemote ? 'Supabase (authentifié)' : 'Navigateur local / API locale'}</span></div><div className="setting-item"><strong>Assistant IA</strong><span>Ollama local · serveur à démarrer</span></div></div>{isRemote && profile.jobTitle === 'Administrateur' && <div><p className="muted">Transfert non destructif : seules les données locales absentes de Supabase sont ajoutées. Les données locales ne sont pas supprimées.</p><button className="button primary" disabled={localMigrationRunning} onClick={() => { void migrateLocalData() }}>{localMigrationRunning ? 'Transfert en cours…' : 'Transférer les données locales'}</button></div>}{isRemote && profile.jobTitle !== 'Administrateur' && <p className="muted">Le transfert des données locales est réservé aux administrateurs.</p>}{!isRemote && <button className="button light" onClick={() => { localStorage.removeItem('agetip-incidents'); localStorage.removeItem('agetip-operational-records'); localStorage.removeItem('agetip-toner-movements'); setIncidents(initialIncidents); setOperationalRecords(initialOperationalRecords); setTonerMovements(initialTonerMovements); showNotice('Les données locales ont été restaurées depuis les exemples.') }}>Restaurer les données de démonstration</button>}</section>}
      </div>
    </main>
    {invoiceImportOpen && <InvoiceImportDialog existingRecords={operationalRecords['Factures SONATEL']} onClose={() => setInvoiceImportOpen(false)} onConfirm={saveImportedInvoices} />}
    {selectedIncident && <IncidentDrawer incident={selectedIncident} devices={operationalRecords['Parc informatique']} airConditioners={operationalRecords.Climatisation} isExisting={incidents.some(item => item.id === selectedIncident.id)} setIncident={setSelectedIncident} onClose={() => setSelectedIncident(null)} onSave={saveIncident} onDelete={() => { void deleteIncident() }} onPrint={() => { try { printIncidentSheet(selectedIncident) } catch (error) { console.error(error); showNotice('Impossible d’ouvrir la fenêtre d’impression.') } }} onWord={async () => { try { const { exportIncidentWord } = await import('./reportExports'); await exportIncidentWord(selectedIncident); showNotice('La fiche officielle d’incident Word a été générée.') } catch (error) { console.error(error); showNotice('Impossible de générer le document Word officiel.') } }} />}
    {profileOpen && <div className="modal-overlay" onMouseDown={event => { if (event.target === event.currentTarget) { setProfileOpen(false); setLogoutConfirm(false) } }}>
      <section className="profile-modal" role="dialog" aria-modal="true" aria-labelledby="profile-title">
        <div className="profile-modal-heading"><div className="profile-modal-avatar">{initials(profile.name)}</div><div><h2 id="profile-title">Mon profil</h2><p>Informations de votre compte AGETIP</p></div><button className="icon-button" onClick={() => { setProfileOpen(false); setLogoutConfirm(false) }} aria-label="Fermer le profil"><X size={18}/></button></div>
        {!logoutConfirm ? <form className="profile-form" onSubmit={saveProfile}>
          <label className="field-label">Nom et prénom<input required maxLength={80} value={profileDraft.name} onChange={event => setProfileDraft({ ...profileDraft, name: event.target.value })}/></label>
          <label className="field-label">Adresse e-mail<input type="email" required maxLength={120} value={profileDraft.email} onChange={event => setProfileDraft({ ...profileDraft, email: event.target.value })}/></label>
          <div className="profile-readonly"><span>Fonction</span><strong>{profile.jobTitle}</strong></div>
          <div className="profile-security"><ShieldCheck size={16}/><span>{isRemote ? `Compte Supabase authentifié · rôle : ${profile.jobTitle}.` : 'Les informations du profil sont conservées localement dans ce prototype.'}</span></div>
          <div className="profile-modal-actions"><button type="button" className="button light" onClick={() => { setProfileOpen(false); setSection('Paramètres') }}>Paramètres</button><div/><button type="button" className="button danger-outline" onClick={() => setLogoutConfirm(true)}><LogOut size={14}/>Déconnexion</button><button type="submit" className="button primary"><Check size={14}/>Enregistrer</button></div>
        </form> : <div className="logout-confirm"><div className="logout-icon"><LogOut size={20}/></div><h3>Se déconnecter ?</h3><p>{isRemote ? 'Vous serez déconnecté de votre compte AGETIP.' : 'Voulez-vous fermer cette session de démonstration ?'}</p><div className="profile-modal-actions"><button className="button light" onClick={() => setLogoutConfirm(false)}>Annuler</button><div/><button className="button danger-outline" onClick={async () => { if (isRemote) { const { error } = await supabase!.auth.signOut(); if (error) { console.error('Échec de la déconnexion Supabase.', error); showNotice('Impossible de vous déconnecter. Réessayez.'); return } } setProfileOpen(false); setLogoutConfirm(false); if (!isRemote) showNotice('Session de démonstration fermée.') }}><LogOut size={14}/>Confirmer</button></div></div>}
      </section>
    </div>}
    {notice && <div className="toast" role="status"><Check size={16}/>{notice}<button className="icon-button" onClick={() => setNotice('')} aria-label="Fermer"><X size={15}/></button></div>}
  </div>
}

function Dashboard({ incidents, records, invoiceCount, invoiceTotal, setSection, openIncident }: { incidents: Incident[]; records: Record<ModuleName, EditableRecord[]>; invoiceCount: number; invoiceTotal: number; setSection: (section: Section) => void; openIncident: (incident: Incident) => void }) {
  const open = incidents.filter(incident => !incident.closed)
  const today = localDateValue()
  const nextMonth = new Date(`${today}T12:00:00`)
  nextMonth.setDate(nextMonth.getDate() + 30)
  const maintenanceUpcoming = records.Maintenances.filter(item => item.date >= today && item.date <= localDateValue(nextMonth) && item.status !== 'Terminée')
  const stockAlerts = records['Cartouches (stock)'].filter(item => Number(item.stock) <= Number(item.minimumStock)).length
  const brokenEquipment = records['Parc informatique'].filter(item => item.status === 'En panne').length
  const pendingAirConditioners = records.Climatisation.filter(item => item.status === 'À traiter').length
  const statCards = [
    { title: 'Incidents ouverts', value: String(open.length), tone: 'amber', icon: AlertTriangle, action: () => setSection('Incidents') },
    { title: 'Factures SONATEL du mois', value: String(invoiceCount), sub: `${invoiceTotal.toLocaleString('fr-FR')} FCFA`, tone: 'green', icon: FileText, action: () => setSection('Factures SONATEL') },
    { title: 'Cartouches en alerte', value: String(stockAlerts), tone: 'green', icon: Boxes, action: () => setSection('Cartouches (stock)') },
    { title: 'Équipements en panne', value: String(brokenEquipment), sub: `sur ${records['Parc informatique'].length}`, tone: 'amber', icon: Computer, action: () => setSection('Parc informatique') },
    { title: 'Climatiseurs à traiter', value: String(pendingAirConditioners), sub: `sur ${records.Climatisation.length}`, tone: 'amber', icon: AirVent, action: () => setSection('Climatisation') },
    { title: 'Échéances (30 jours)', value: String(maintenanceUpcoming.length), tone: 'blue', icon: CalendarDays, action: () => setSection('Maintenances') },
  ]
  return <>
    <div className="stats-grid">{statCards.map(card => <button className={`stat-card ${card.tone}`} key={card.title} onClick={card.action}><span className="stat-title">{card.title}</span><strong>{card.value}</strong>{card.sub && <small>{card.sub}</small>}<card.icon className="stat-icon" size={16}/></button>)}</div>
    <div className="dashboard-grid"><section className="panel incidents-panel"><div className="panel-heading"><h2>Incidents à traiter</h2><button className="text-link" onClick={() => setSection('Incidents')}>Voir tout <ChevronRight size={14}/></button></div>
      {open.slice(0, 6).map(incident => <button className="incident-row" key={incident.id} onClick={() => openIncident(incident)}><div><strong>{incident.id}</strong><span className={`badge ${incident.classification.toLowerCase()}`}>{incident.classification}</span><span className="badge open">Ouvert</span></div><small>{incident.type} · {new Date(incident.reportedAt).toLocaleString('fr-FR')} · {incident.description}</small></button>)}
    </section>
    <section className="panel chart-panel"><div className="panel-heading"><h2>Incidents des 6 derniers mois</h2><button className="icon-button" aria-label="Options du graphique"><ChevronDown size={16}/></button></div><div className="bar-chart" role="img" aria-label="Graphique des incidents par mois"><div className="chart-scale"><span>10</span><span>5</span><span>0</span></div><div className="chart-plot"><div className="gridline one"/><div className="gridline two"/><div className="gridline three"/>{[['mai', 0], ['juin', 7], ['juil.', 5], ['août', 6], ['sept.', 10], ['oct.', 2]].map(([month, value]) => <div className="chart-column" key={month}><span className="bar-value">{value}</span><div className="bar" style={{ height: `${Number(value) * 10}%` }}/><small>{month}</small></div>)}</div></div></section>
    <section className="panel upcoming-panel"><div className="panel-heading"><h2>Maintenances à venir</h2><button className="text-link" onClick={() => setSection('Maintenances')}>Voir tout <ChevronRight size={14}/></button></div>{maintenanceUpcoming.slice(0, 3).map(item => <button className="maintenance-row" key={item.reference} onClick={() => setSection('Maintenances')}><CalendarDays size={17}/><span><strong>{new Date(`${item.date}T12:00:00`).toLocaleDateString('fr-FR')} · {item.designation}</strong><small>{item.reference} · {item.status}</small></span></button>)}</section>
    <section className="panel quick-panel"><div className="panel-heading"><h2>Accès rapides</h2></div><div className="quick-links"><button onClick={() => setSection('Incidents')}><Plus size={16}/>Signaler un incident</button><button onClick={() => setSection('Rapports')}><FileChartColumn size={16}/>Générer un rapport</button><button onClick={() => setSection('Cartouches (stock)')}><Boxes size={16}/>Consulter le stock</button></div></section></div>
  </>
}

function OperationalRecordEditor({ editor, onChange, onSave, onClose }: {
  editor: RecordEditorState
  onChange: (editor: RecordEditorState) => void
  onSave: (event: FormEvent<HTMLFormElement>) => void
  onClose: () => void
}) {
  const statusOptions = editor.collection === 'movements'
    ? ['Entrée', 'Sortie', 'Ajustement']
    : editor.module === 'Factures SONATEL'
      ? ['À valider', 'Traitée', 'Rejetée']
      : editor.module === 'Cartouches (stock)'
        ? ['OK', 'À commander', 'Rupture']
        : editor.module === 'Parc informatique'
          ? ['En service', 'En panne', 'En maintenance', 'Réformé']
          : editor.module === 'Climatisation'
            ? ['Opérationnel', 'À traiter', 'En panne', 'Hors service']
            : ['Planifiée', 'À venir', 'Terminée', 'Annulée']
  const updateField = (key: string, value: string) => onChange({ ...editor, record: { ...editor.record, [key]: value } })
  const title = editor.originalReference ? 'Modifier un enregistrement' : 'Nouvel enregistrement'
  return <div className="drawer-overlay" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
    <aside className="incident-drawer">
      <div className="drawer-heading"><div><h2>{title}</h2><p>{editor.module}{editor.collection === 'movements' ? ' · mouvements de cartouches' : ''}</p></div><button className="icon-button" onClick={onClose} aria-label="Fermer"><X size={19}/></button></div>
      <form className="incident-form" onSubmit={onSave}>
        <div className="field-grid">{Object.entries(editor.record).map(([key, value]) => {
          const label = recordLabels[key] ?? key
          const required = key === 'reference' || key === 'designation'
          const inputType = key === 'date' ? 'date' : key === 'amount' || key === 'stock' || key === 'minimumStock' || key === 'quantity' ? 'number' : 'text'
          if (key === 'status' || key === 'movement') {
            return <label className="field-label" key={key}>{label}{required && <b> *</b>}<select required={required} value={value} onChange={event => updateField(key, event.target.value)}>{statusOptions.map(option => <option key={option}>{option}</option>)}</select></label>
          }
          return <label className="field-label" key={key}>{label}{required && <b> *</b>}<input type={inputType} min={key === 'quantity' ? '1' : inputType === 'number' ? '0' : undefined} step={key === 'amount' ? '0.01' : key === 'stock' || key === 'minimumStock' || key === 'quantity' ? '1' : undefined} required={required || key === 'date' || key === 'amount'} value={value} onChange={event => updateField(key, event.target.value)}/></label>
        })}</div>
        <div className="drawer-footer"><div/><button type="button" className="button light" onClick={onClose}>Annuler</button><button type="submit" className="button primary"><Check size={15}/>Enregistrer</button></div>
      </form>
    </aside>
  </div>
}

function ReportsPanel(props: {
  session: Session | null; isRemote: boolean; showNotice: (message: string) => void
  reportType: ReportType; setReportType: (value: ReportType) => void; frequency: Frequency; setFrequency: (value: Frequency) => void
  referenceDate: string; setReferenceDate: (value: string) => void; customStart: string; setCustomStart: (value: string) => void
  customEnd: string; setCustomEnd: (value: string) => void; chosenModules: ModuleName[]; setChosenModules: (value: ModuleName[]) => void
  includedSections: ReportSection[]; setIncludedSections: (value: ReportSection[]) => void; validReportPeriod: boolean
  previewReady: boolean; setPreviewReady: (value: boolean) => void; reportFormat: ReportFormat; setReportFormat: (value: ReportFormat) => void
  reportPeriod: string; reportIncidents: Incident[]; reportData: Record<string, string>[]; reportAnalysis: ReportAnalysis; onExport: () => void; onPrint: () => void
}) {
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [history, setHistory] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('agetip-report-history') ?? '[]') as string[]
    } catch (error) {
      console.error('L’historique local des rapports est illisible.', error)
      return []
    }
  })
  useEffect(() => {
    if (!props.isRemote || !props.session) return
    let active = true
    void loadUserRecord<{ entries?: string[] }>('report_history', props.session.user.id)
      .then(record => {
        if (active && Array.isArray(record?.entries)) setHistory(record.entries)
      })
      .catch(error => {
        console.error('Impossible de charger l’historique des rapports.', error)
        if (active) props.showNotice('Impossible de charger l’historique des rapports.')
      })
    return () => { active = false }
  }, [props.isRemote, props.session?.user.id])
  const formats: ReportFormat[] = ['PDF', 'Word (.docx)', 'Excel (.xlsx)', 'PowerPoint (.pptx)', 'Image PNG', 'Image JPG']
  const toggleModule = (name: ModuleName) => props.setChosenModules(props.chosenModules.includes(name) ? props.chosenModules.filter(item => item !== name) : [...props.chosenModules, name])
  const sectionOptions: ReportSection[] = ['Indicateurs clés', 'Graphiques', 'Répartitions détaillées', 'Détail des enregistrements', 'Conclusions']
  const toggleSection = (name: ReportSection) => props.setIncludedSections(props.includedSections.includes(name) ? props.includedSections.filter(item => item !== name) : [...props.includedSections, name])
  async function preparePreview() {
    if (!props.validReportPeriod) return
    props.setPreviewReady(true)
    const entry = `${props.reportType} · ${props.reportPeriod} · ${new Date().toLocaleDateString('fr-FR')}`
    const nextHistory = [entry, ...history].slice(0, 10)
    setHistory(nextHistory)
    try {
      localStorage.setItem('agetip-report-history', JSON.stringify(nextHistory))
    } catch (error) {
      console.error('Impossible d’enregistrer l’historique local des rapports.', error)
    }
    if (props.isRemote && props.session) {
      try {
        await saveUserRecord('report_history', props.session.user.id, { entries: nextHistory })
      } catch (error) {
        console.error('Impossible d’enregistrer l’historique Supabase des rapports.', error)
        props.showNotice('Aperçu généré, mais son historique n’a pas pu être synchronisé.')
      }
    }
  }
  const periodTitle = props.frequency === 'Mensuel' ? new Date(`${props.referenceDate}T12:00:00`).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }) : props.reportPeriod
  return <div className="reports-layout">
    <section className="panel report-controls"><h2>Configurer le rapport</h2>
      <div className="form-step"><label className="step-label"><span>1</span>Type de rapport</label><select className="form-control" value={props.reportType} onChange={event => { props.setReportType(event.target.value as ReportType); props.setPreviewReady(false) }}>{reportTypes.map(type => <option key={type}>{type}</option>)}</select>
        {props.reportType === 'Rapport général' || props.reportType === 'Rapport consolidé' ? <div className="check-list">{reportsModules.map(name => <label key={name}><input type="checkbox" checked={props.chosenModules.includes(name)} onChange={() => toggleModule(name)} />{name}</label>)}</div> : null}
      </div>
      <div className="form-step"><label className="step-label"><span>2</span>Période</label><select className="form-control" value={props.frequency} onChange={event => props.setFrequency(event.target.value as Frequency)}>{frequencies.map(item => <option key={item}>{item}</option>)}</select>
        {props.frequency === 'Période personnalisée' ? <div className="date-range"><label>Du<input className="form-control" type="date" value={props.customStart} onChange={event => props.setCustomStart(event.target.value)} /></label><label>Au<input className="form-control" type="date" value={props.customEnd} onChange={event => props.setCustomEnd(event.target.value)} /></label></div>
          : <label className="sub-label">Date de référence<input className="form-control" type="date" value={props.referenceDate} onChange={event => props.setReferenceDate(event.target.value)} /></label>}
        <p className={`period-hint ${props.validReportPeriod ? '' : 'period-error'}`}><CalendarDays size={13}/>{props.validReportPeriod ? `Période calculée : ${props.reportPeriod}` : 'Vérifiez les dates de la période personnalisée.'}</p>
      </div>
      <div className="form-step"><button className="step-toggle" onClick={() => setFiltersOpen(!filtersOpen)}><span className="step-label"><span>3</span>Filtres et sections</span><ChevronDown size={15}/></button>
        {filtersOpen && <div className="check-list">{sectionOptions.map(name => <label key={name}><input type="checkbox" checked={props.includedSections.includes(name)} onChange={() => toggleSection(name)}/>{`Inclure ${name.toLocaleLowerCase('fr-FR')}`}</label>)}</div>}
        {!filtersOpen && <button className="text-link customize-link" onClick={() => setFiltersOpen(true)}>Personnaliser les sections</button>}
      </div>
      <div className="form-step"><label className="step-label"><span>4</span>Prévisualiser</label><button className="button primary full-button" disabled={!props.validReportPeriod} onClick={preparePreview}><FileChartColumn size={16}/>Générer la prévisualisation</button></div>
      <div className="form-step"><label className="step-label"><span>5</span>Format d’export</label><div className="format-options">{formats.map(format => <button key={format} onClick={() => props.setReportFormat(format)} className={`format-chip ${props.reportFormat === format ? 'selected' : ''}`}>{format}</button>)}</div>
        <div className="export-actions"><button className="button primary" disabled={!props.previewReady} onClick={props.onExport}><ArrowDownToLine size={15}/>Télécharger</button><button className="button light" disabled={!props.previewReady} onClick={props.onPrint}><Printer size={15}/>Imprimer</button></div>
      </div>
      {history.length > 0 && <div className="report-history"><strong>Aperçus consultés récemment</strong><p className="history-note">{props.isRemote ? 'Historique synchronisé avec votre compte ; les fichiers ne sont pas archivés.' : 'Historique conservé sur cet appareil ; les fichiers ne sont pas archivés.'}</p>{history.slice(0, 3).map((entry, index) => <div className="history-entry" key={`${entry}-${index}`}><FileText size={14}/><span>{entry}</span></div>)}</div>}
    </section>
    <section id="report-preview" className="panel report-preview">
      <div className="report-brand">AGETIP <span>· INFORMATIQUE & TECHNIQUE</span></div><h2>{props.reportType}</h2><p className="report-period"><strong>Période couverte :</strong> {periodTitle} <span>·</span> Généré le {new Date().toLocaleDateString('fr-FR')}</p><p className="report-data-note">Données de démonstration — ne pas utiliser comme rapport opérationnel.</p>
      {!props.previewReady && <div className="preview-prompt"><FileChartColumn size={30}/><strong>Votre aperçu apparaîtra ici</strong><span>Configurez les options à gauche, puis générez la prévisualisation.</span></div>}
      {props.previewReady && <>
        {props.includedSections.includes('Indicateurs clés') && <div className="report-section"><h3>{props.reportAnalysis.chartTitle} — indicateurs</h3><div className="metric-grid">{props.reportAnalysis.metrics.map(([label, value]) => <div key={label}><span>{label}</span><strong className="small-value">{value}</strong></div>)}</div></div>}
        {props.includedSections.includes('Graphiques') && <div className="report-section"><h3>{props.reportAnalysis.chartTitle}</h3><p className="chart-caption">Répartition calculée à partir des enregistrements inclus dans ce rapport</p><div className="report-chart">{props.reportAnalysis.chartData.length ? props.reportAnalysis.chartData.map(([label, count]) => <div className="report-bar-column" key={label}><span>{count}</span><div className="report-bar" style={{ height: `${Math.max(8, count / Math.max(...props.reportAnalysis.chartData.map(([, value]) => value)) * 100)}%` }}/><small>{label}</small></div>) : <p className="empty-chart">Aucune donnée détaillée pour cette période.</p>}</div></div>}
        {props.includedSections.includes('Répartitions détaillées') && props.reportAnalysis.detailTables?.length ? <div className="report-breakdowns">{props.reportAnalysis.detailTables.map(table => <div className="report-breakdown" key={table.title}><h3>{table.title}</h3>{table.rows.length ? <table><tbody>{table.rows.map(([label, value]) => <tr key={label}><th>{label}</th><td>{value}</td></tr>)}</tbody></table> : <p className="empty-chart">Aucune donnée disponible.</p>}</div>)}</div> : null}
        {props.includedSections.includes('Conclusions') && <div className="report-conclusion"><strong>Conclusion</strong><p>{props.reportAnalysis.conclusion}</p>{props.reportAnalysis.observations?.length ? <><strong>Points de vigilance</strong><ul>{props.reportAnalysis.observations.map(observation => <li key={observation}>{observation}</li>)}</ul></> : null}</div>}
        {props.includedSections.includes('Détail des enregistrements') && <ReportDataTable data={props.reportData}/>}
        <footer className="report-footer"><span>AGETIP — Document généré depuis la plateforme de gestion informatique et technique</span><span>Page 1 / 1</span></footer>
      </>}
    </section>
  </div>
}

function ReportDataTable({ data }: { data: Record<string, string>[] }) {
  if (!data.length) return <div className="empty-state">Aucun enregistrement sur cette période.</div>
  const keys = Object.keys(data[0])
  return <div className="report-table-wrap"><div className="report-section"><h3>Détail des enregistrements</h3></div><table className="report-table"><thead><tr>{keys.map(key => <th key={key}>{key}</th>)}</tr></thead><tbody>{data.slice(0, 15).map((record, row) => <tr key={row}>{keys.map(key => <td key={key}>{record[key]}</td>)}</tr>)}</tbody></table>{data.length > 15 && <p className="table-note">Aperçu limité aux 15 premières lignes. L’export contient les {data.length} enregistrements.</p>}</div>
}

function IncidentDrawer({ incident, devices, airConditioners, isExisting, setIncident, onClose, onSave, onDelete, onWord, onPrint }: {
  incident: Incident; devices: EditableRecord[]; airConditioners: EditableRecord[]; isExisting: boolean; setIncident: (value: Incident) => void; onClose: () => void; onSave: (event: FormEvent<HTMLFormElement>) => void
  onDelete: () => void; onWord: () => void; onPrint: () => void
}) {
  const update = <K extends keyof Incident>(key: K, value: Incident[K]) => setIncident({ ...incident, [key]: value })
  const input = (label: string, key: keyof Incident, type = 'text', required = false) => <label className="field-label">{label}{required && <b> *</b>}<input type={type} required={required} value={String(incident[key] ?? '')} onChange={event => update(key, event.target.value as Incident[typeof key])}/></label>
  const area = (label: string, key: keyof Incident, required = false) => <label className="field-label full-field">{label}{required && <b> *</b>}<textarea rows={3} required={required} value={String(incident[key] ?? '')} onChange={event => update(key, event.target.value as Incident[typeof key])}/></label>
  return <div className="drawer-overlay" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}><aside className="incident-drawer"><div className="drawer-heading"><div><h2>Incidents – {isExisting ? 'modification' : 'nouveau'}</h2><p>Fiche officielle (EN/145/02)</p></div><button className="icon-button" onClick={onClose} aria-label="Fermer"><X size={19}/></button></div>
    <div className="official-bar"><span>Fiche officielle (EN/145/02)</span><button className="button light small-button" type="button" onClick={onWord}><FileText size={14}/>Word</button><button className="button light small-button" type="button" onClick={onPrint}><Printer size={14}/>PDF</button></div>
    <form className="incident-form" onSubmit={onSave}><div className="field-grid">
      {input('N° d’identification assigné à l’incident', 'id', 'text', true)}
      {input('Date et heure de signalisation de l’incident', 'reportedAt', 'datetime-local', true)}
      {input('Nom et prénom de la personne qui a signalé l’incident', 'reporter', 'text', true)}
      <label className="field-label">Niveau de classification de l’incident<b> *</b><select required value={incident.classification} onChange={event => update('classification', event.target.value as Incident['classification'])}><option>Mineur</option><option>Majeur</option><option>Critique</option></select></label>
      <label className="field-label">Type<b> *</b><select required value={incident.type} onChange={event => update('type', event.target.value)}>{incidentTypes.map(type => <option key={type}>{type}</option>)}</select></label>
      <label className="field-label">Équipement concerné<select value={incident.equipment} onChange={event => update('equipment', event.target.value)}><option value="">Non renseigné</option>{devices.map(device => <option key={device.reference}>{device.reference} — {device.designation}</option>)}{airConditioners.map(device => <option key={device.reference}>{device.reference} — {device.designation}</option>)}<option>Réseau — Siège</option><option>Messagerie AGETIP</option></select></label>
      {area('Descriptif de l’incident', 'description', true)}
      {area('Cause', 'cause')}
      {input('Responsable de l’enregistrement', 'recordedBy')}
      {input('Responsable de la prise en charge', 'assignee')}
      {input('Date et heure de prise en charge de l’incident', 'takenAt', 'datetime-local')}
      {area('Traitements appliqués pour la résolution de l’incident', 'treatments')}
      <label className="field-label full-field checkbox-field"><input type="checkbox" checked={incident.closed} onChange={event => update('closed', event.target.checked)}/>Clôture de la prise en charge de l’incident</label>
      {incident.closed && input('Date et heure de la clôture', 'closedAt', 'datetime-local')}
      {area('Observations', 'observations')}
    </div><div className="signature-heading">Ont signé</div><div className="signature-grid"><div>Personne qui a déclaré l’incident<span>Signature</span></div><div>Responsable de l’enregistrement<span>Signature</span></div><div>Responsable de la prise en charge<span>Signature</span></div></div>
    <div className="drawer-footer">{isExisting && <button type="button" className="button danger-outline" onClick={onDelete}>Supprimer</button>}<div/><button type="button" className="button light" onClick={onClose}>Annuler</button><button type="submit" className="button primary">Enregistrer</button></div></form>
  </aside></div>
}

function DocumentsPanel({ showNotice, session, isRemote, canManage }: {
  showNotice: (message: string) => void
  session: Session | null
  isRemote: boolean
  canManage: boolean
}) {
  const [files, setFiles] = useState<ReferenceDocument[]>([])
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!isRemote) return
    let active = true
    void loadReferenceDocuments().then(documents => {
      if (active) setFiles(documents)
    }).catch(error => {
      console.error('Impossible de charger les documents de référence.', error)
      if (active) showNotice('Impossible de charger les documents Supabase.')
    })
    return () => { active = false }
  }, [isRemote])

  async function addFiles(event: ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.target.files ?? [])
    event.target.value = ''
    if (!selected.length) return
    if (!isRemote || !session) {
      showNotice('Connectez-vous à Supabase pour stocker les documents de façon persistante.')
      return
    }
    if (!canManage) {
      showNotice('Seuls les administrateurs et techniciens peuvent ajouter des documents.')
      return
    }

    setBusy(true)
    let added = 0
    let indexed = 0
    try {
      for (const file of selected) {
        let extractedText: string | undefined
        try {
          extractedText = await extractReferenceText(file)
        } catch (error) {
          console.warn(`Le document ${file.name} sera stocké sans index de texte.`, error)
        }
        const document = await uploadReferenceDocument(file, session.user.id, extractedText)
        setFiles(current => [document, ...current])
        added += 1
        if (extractedText) indexed += 1
      }
      showNotice(`${added} document(s) ajouté(s), ${indexed} indexé(s) pour l’assistant.`)
    } catch (error) {
      console.error('Impossible de charger un document de référence.', error)
      showNotice(error instanceof Error ? error.message : 'Échec de l’ajout des documents.')
    } finally {
      setBusy(false)
    }
  }

  async function openDocument(file: ReferenceDocument) {
    if (!supabase) return
    const { data, error } = await supabase.storage.from('agetip-documents').createSignedUrl(file.path, 60)
    if (error) {
      console.error('Impossible de générer le lien sécurisé du document.', error)
      showNotice('Impossible d’ouvrir ce document.')
      return
    }
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer')
  }

  async function removeDocument(file: ReferenceDocument) {
    try {
      await deleteReferenceDocument(file)
      setFiles(current => current.filter(document => document.path !== file.path))
      showNotice('Document supprimé.')
    } catch (error) {
      console.error('Impossible de supprimer le document.', error)
      showNotice('Échec de la suppression. Vérifiez vos droits et réessayez.')
    }
  }

  return <div className="documents-layout"><section className="panel document-panel"><div className="panel-heading"><div><h2>Documents de référence</h2><p className="muted">{isRemote ? 'Fichiers privés partagés avec les utilisateurs authentifiés et indexés localement pour l’assistant.' : 'Connectez Supabase pour stocker les documents et les rendre disponibles à l’assistant.'}</p></div>{canManage && <button className="button primary" disabled={busy} onClick={() => document.getElementById('document-upload')?.click()}><CloudUpload size={16}/>{busy ? 'Chargement…' : 'Ajouter des documents'}</button>}<input id="document-upload" type="file" className="visually-hidden" multiple accept=".pdf,.docx,.doc,.txt" onChange={event => { void addFiles(event) }}/></div>
    <div className="upload-drop"><CloudUpload size={26}/><strong>Déposez ici vos documents de référence</strong><span>PDF, Word ou texte. Taille maximale : 20 Mo par fichier. Les documents numérisés sans texte ne pourront pas être interrogés.</span>{canManage && <button className="button light" disabled={busy} onClick={() => document.getElementById('document-upload')?.click()}><Upload size={15}/>Parcourir les fichiers</button>}</div>
    <div className="document-list"><div className="document-list-heading"><strong>{files.length ? 'Documents ajoutés' : 'Aucun document ajouté'}</strong><span>{files.length} fichier(s)</span></div>{files.map(file => <div className="file-row" key={file.path}><FileText size={18}/><strong>{file.name}</strong><span>{file.type.split('/').pop()?.toUpperCase() ?? 'FICHIER'}</span><small>{file.textPath ? 'Indexé' : 'Non indexé'} · {(file.size / 1024).toFixed(0)} Ko</small><button className="icon-button" onClick={() => { void openDocument(file) }} aria-label="Ouvrir le document"><BookOpenText size={15}/></button>{canManage && <button className="icon-button" onClick={() => { void removeDocument(file) }} aria-label="Supprimer"><X size={15}/></button>}</div>)}</div>
  </section><aside className="panel integration-panel"><div className="assistant-logo"><Sparkles size={20}/></div><h2>Base documentaire et assistant local</h2><p>{isRemote ? 'Les documents sont stockés dans un bucket Supabase privé. Leur texte est recherché par mots-clés dans le navigateur, puis transmis au serveur Ollama configuré localement.' : 'Configurez Supabase pour stocker les documents. Le texte extrait sera transmis au serveur Ollama local.'}</p><div className="integration-line"><span>Modèle</span><strong>Ollama local</strong></div><div className="integration-line"><span>Fichiers</span><strong>{isRemote ? 'Supabase privé' : 'Non configurés'}</strong></div><div className="integration-line"><span>Formats</span><strong>PDF, Word, texte</strong></div><p className="muted">Le serveur backend et le modèle Ollama doivent être démarrés sur une machine accessible aux utilisateurs.</p></aside></div>
}

function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [authLoading, setAuthLoading] = useState(Boolean(supabase))

  useEffect(() => {
    if (!supabase) return
    let active = true
    void supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return
      if (error) console.error('Impossible de restaurer la session Supabase.', error)
      setSession(data.session)
      setAuthLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setAuthLoading(false)
    })
    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  if (!supabase) return <Workspace session={null}/>
  if (authLoading) return <main className="auth-page"><section className="auth-card"><strong>AGETIP</strong><p>Vérification de la session sécurisée…</p></section></main>
  if (!session) return <AuthPage/>
  return <Workspace session={session}/>
}

function AuthPage() {
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-in')
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase) return
    setError('')
    setMessage('')
    setSubmitting(true)
    try {
      if (mode === 'sign-up') {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { display_name: displayName.trim() } },
        })
        if (signUpError) throw signUpError
        if (!data.session) {
          setMessage('Compte créé. Confirmez votre adresse e-mail, puis connectez-vous.')
        } else {
          setMessage('Compte créé. Votre rôle initial est « Lecture seule » jusqu’à validation par un administrateur.')
        }
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
        if (signInError) throw signInError
      }
    } catch (submitError) {
      console.error('Échec de l’authentification Supabase.', submitError)
      setError(submitError instanceof Error ? submitError.message : 'Échec de l’authentification.')
    } finally {
      setSubmitting(false)
    }
  }

  return <main className="auth-page">
    <section className="auth-card">
      <div className="auth-brand"><img src="/assets/logo-agetip.png" alt="Logo AGETIP"/><div><strong>AGETIP</strong><span>Informatique & technique</span></div></div>
      <h1>{mode === 'sign-in' ? 'Connexion sécurisée' : 'Créer un compte'}</h1>
      <p>Connectez-vous pour accéder aux données opérationnelles partagées.</p>
      <form className="auth-form" onSubmit={submit}>
        {mode === 'sign-up' && <label className="field-label">Nom et prénom<input autoComplete="name" required maxLength={80} value={displayName} onChange={event => setDisplayName(event.target.value)}/></label>}
        <label className="field-label">Adresse e-mail<input type="email" autoComplete="email" required value={email} onChange={event => setEmail(event.target.value)}/></label>
        <label className="field-label">Mot de passe<input type="password" autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'} required minLength={8} value={password} onChange={event => setPassword(event.target.value)}/></label>
        {error && <p className="auth-error" role="alert">{error}</p>}
        {message && <p className="auth-message" role="status">{message}</p>}
        <button className="button primary full-button" type="submit" disabled={submitting}>{submitting ? 'Patientez…' : mode === 'sign-in' ? 'Se connecter' : 'Créer mon compte'}</button>
      </form>
      <button className="text-link auth-toggle" onClick={() => { setMode(mode === 'sign-in' ? 'sign-up' : 'sign-in'); setError(''); setMessage('') }}>
        {mode === 'sign-in' ? 'Créer un nouveau compte' : 'J’ai déjà un compte'}
      </button>
      <p className="auth-role-note">Les nouveaux comptes reçoivent le rôle « Lecture seule ». Un administrateur doit autoriser les modifications.</p>
    </section>
  </main>
}

export default App
