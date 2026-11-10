import dotenv from 'dotenv'
import cors from 'cors'
import express from 'express'
import morgan from 'morgan'
import { z } from 'zod'

dotenv.config({ path: '.env.local' })

const app = express()
const port = Number(process.env.PORT ?? 4000)
const ollamaBaseUrl = (process.env.OLLAMA_BASE_URL ?? 'http://127.0.0.1:11434').replace(/\/$/, '')
const ollamaModel = process.env.OLLAMA_MODEL ?? 'qwen2.5:3b'
const supabaseUrl = process.env.VITE_SUPABASE_URL?.replace(/\/$/, '')
const supabasePublishableKey =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? process.env.VITE_SUPABASE_ANON_KEY

app.use(cors())
app.use(express.json({ limit: '2mb' }))
app.use(morgan('dev'))

const assistantRequestSchema = z.object({
  messages: z.array(z.object({
    role: z.enum(['assistant', 'user']),
    content: z.string().trim().min(1).max(12_000),
  })).min(1).max(20),
  context: z.string().max(20_000).default(''),
})

type Incident = {
  id: string
  reportedAt: string
  reporter: string
  classification: 'Critique' | 'Majeur' | 'Mineur'
  type: string
  equipment: string
  description: string
  cause: string
  recordedBy: string
  assignee: string
  takenAt: string
  treatments: string
  closed: boolean
  closedAt: string
  observations: string
}

const incidentSchema = z.object({
  id: z.string().min(1),
  reportedAt: z.string().min(1),
  reporter: z.string().min(1),
  classification: z.enum(['Critique', 'Majeur', 'Mineur']),
  type: z.string().min(1),
  equipment: z.string().min(1),
  description: z.string().min(1),
  cause: z.string().default(''),
  recordedBy: z.string().min(1),
  assignee: z.string().min(1),
  takenAt: z.string().default(''),
  treatments: z.string().default(''),
  closed: z.boolean().default(false),
  closedAt: z.string().default(''),
  observations: z.string().default(''),
})

const operationalRecordSchema = z.record(z.string(), z.string())
const tonerMovementSchema = z.object({
  reference: z.string().min(1),
  designation: z.string().min(1),
  movement: z.enum(['Entrée', 'Sortie', 'Ajustement']),
  reason: z.string().min(1),
  quantity: z.string().min(1),
  date: z.string().min(1),
})

const moduleNames = [
  'Incidents',
  'Factures SONATEL',
  'Cartouches (stock)',
  'Parc informatique',
  'Climatisation',
  'Maintenances',
] as const

type ModuleName = (typeof moduleNames)[number]

const initialIncidents: Incident[] = [
  { id: 'INC-2026-0028', reportedAt: '2026-10-15T03:40', reporter: 'Agent 4', classification: 'Mineur', type: 'Messagerie', equipment: 'Messagerie AGETIP', description: 'Messagerie inaccessible', cause: '', recordedBy: 'Service informatique', assignee: 'M. Ndiaye', takenAt: '', treatments: '', closed: false, closedAt: '', observations: '' },
  { id: 'INC-2026-0016', reportedAt: '2026-10-03T04:40', reporter: 'Agent 15', classification: 'Mineur', type: 'Réseau', equipment: 'Réseau — Siège', description: 'Lenteur du poste', cause: '', recordedBy: 'Service informatique', assignee: 'M. Ndiaye', takenAt: '', treatments: '', closed: false, closedAt: '', observations: '' },
  { id: 'INC-2026-0021', reportedAt: '2026-09-26T06:40', reporter: 'Agent 2', classification: 'Critique', type: 'Matériel', equipment: 'INV-023 — Écran Dell P2422H', description: 'Perte de connexion réseau', cause: '', recordedBy: 'Service informatique', assignee: 'M. Ndiaye', takenAt: '', treatments: '', closed: false, closedAt: '', observations: '' },
  { id: 'INC-2026-0023', reportedAt: '2026-09-18T05:40', reporter: 'Agent 3', classification: 'Critique', type: 'Réseau', equipment: 'Réseau — Siège', description: 'Perte de connexion réseau', cause: '', recordedBy: 'Service informatique', assignee: 'M. Ndiaye', takenAt: '', treatments: '', closed: false, closedAt: '', observations: '' },
  { id: 'INC-2026-0003', reportedAt: '2026-09-08T03:40', reporter: 'Agent 18', classification: 'Mineur', type: 'Climatisation', equipment: 'CLIM-05 — Salle serveur 5', description: 'Lenteur du poste', cause: '', recordedBy: 'Service informatique', assignee: 'M. Ndiaye', takenAt: '', treatments: '', closed: false, closedAt: '', observations: '' },
  { id: 'INC-2026-0020', reportedAt: '2026-08-23T09:40', reporter: 'Agent 9', classification: 'Majeur', type: 'Messagerie', equipment: 'Messagerie AGETIP', description: 'Perte de connexion réseau', cause: '', recordedBy: 'Service informatique', assignee: 'M. Ndiaye', takenAt: '', treatments: '', closed: false, closedAt: '', observations: '' },
  { id: 'INC-2026-0029', reportedAt: '2026-06-02T05:40', reporter: 'Agent 8', classification: 'Majeur', type: 'Logiciel', equipment: 'INV-023 — Écran Dell P2422H', description: 'Imprimante en panne', cause: '', recordedBy: 'Service informatique', assignee: 'Mme Ndiaye', takenAt: '2026-06-02T10:40', treatments: '', closed: false, closedAt: '', observations: '' },
  { id: 'INC-2026-0013', reportedAt: '2026-05-05T09:40', reporter: 'Agent 15', classification: 'Mineur', type: 'Matériel', equipment: 'INV-014 — HP ProBook', description: 'Clavier défectueux', cause: 'Usure', recordedBy: 'Service informatique', assignee: 'M. Diallo', takenAt: '2026-05-05T10:10', treatments: 'Remplacement du clavier', closed: true, closedAt: '2026-05-05T14:00', observations: '' },
  { id: 'INC-2026-0026', reportedAt: '2026-07-07T08:40', reporter: 'Agent 2', classification: 'Majeur', type: 'Réseau', equipment: 'Réseau — Siège', description: 'Connexion intermittente', cause: '', recordedBy: 'Service informatique', assignee: 'M. Ndiaye', takenAt: '', treatments: '', closed: false, closedAt: '', observations: '' },
  { id: 'INC-2026-0022', reportedAt: '2026-07-10T10:40', reporter: 'Agent 3', classification: 'Mineur', type: 'Logiciel', equipment: 'INV-008 — Dell OptiPlex', description: 'Mise à jour requise', cause: '', recordedBy: 'Service informatique', assignee: 'M. Diallo', takenAt: '', treatments: '', closed: false, closedAt: '', observations: '' },
] as const

const operationalDefaults = {
  'Factures SONATEL': [
    { reference: 'SON-2026-018', designation: 'Facture téléphonie fixe — siège', date: '2026-10-17', period: 'Septembre 2026', amount: '128000', category: 'Téléphonie fixe', status: 'À valider' },
    { reference: 'SON-2026-017', designation: 'Facture internet — liaison principale', date: '2026-10-14', period: 'Septembre 2026', amount: '45500', category: 'Internet', status: 'Traitée' },
    { reference: 'SON-2026-016', designation: 'Facture mobile — flotte professionnelle', date: '2026-10-09', period: 'Septembre 2026', amount: '299500', category: 'Téléphonie mobile', status: 'Traitée' },
  ],
  'Cartouches (stock)': [
    { reference: 'CF259A', designation: 'Toner HP 59A noir', compatibility: 'HP LaserJet M404', stock: '6', minimumStock: '2', status: 'OK' },
    { reference: 'CE505A', designation: 'Toner HP 05A noir', compatibility: 'HP LaserJet P2035', stock: '6', minimumStock: '2', status: 'OK' },
  ],
  'Parc informatique': [
    { reference: 'INV-023', designation: 'Écran Dell P2422H', holder: 'Service informatique', status: 'En service' },
    { reference: 'INV-014', designation: 'HP ProBook 450 G8', holder: 'A. Diop', status: 'En service' },
  ],
  'Climatisation': [
    { reference: 'CLIM-01', designation: 'Bureau Direction', capacity: '18 000 BTU', status: 'Opérationnel' },
    { reference: 'CLIM-05', designation: 'Salle serveur 5', capacity: '24 000 BTU', status: 'À traiter' },
  ],
  'Maintenances': [
    { reference: 'MAI-2026-041', designation: 'Maintenance préventive — CLIM-05', date: '2026-10-24', status: 'Planifiée' },
    { reference: 'MAI-2026-038', designation: 'Entretien climatisation — CLIM-01', date: '2026-10-20', status: 'À venir' },
  ],
} as const

let incidents: Incident[] = [...initialIncidents]
let operationalRecords: Record<ModuleName, Record<string, string>[]> = {
  'Incidents': [],
  'Factures SONATEL': [...(operationalDefaults['Factures SONATEL'] ?? [])],
  'Cartouches (stock)': [...(operationalDefaults['Cartouches (stock)'] ?? [])],
  'Parc informatique': [...(operationalDefaults['Parc informatique'] ?? [])],
  Climatisation: [...(operationalDefaults.Climatisation ?? [])],
  Maintenances: [...(operationalDefaults.Maintenances ?? [])],
}
let tonerMovements: Record<string, string>[] = [
  { reference: 'MVT-2026-014', designation: 'Sortie — Toner HP 59A noir', movement: 'Sortie', reason: 'Service comptabilité', quantity: '1', date: '2026-10-14' },
  { reference: 'MVT-2026-013', designation: 'Entrée — Toner Brother', movement: 'Entrée', reason: 'Commande fournisseur', quantity: '4', date: '2026-10-10' },
  { reference: 'MVT-2026-012', designation: 'Sortie — Toner HP 05A noir', movement: 'Sortie', reason: 'Direction générale', quantity: '1', date: '2026-10-07' },
]

const jsonResponse = <T,>(payload: T, status = 200) => ({
  status,
  payload,
})

app.get('/api/health', (_req, res) => {
  res.json(jsonResponse({ ok: true, timestamp: new Date().toISOString() }))
})

app.get('/api/assistant/health', async (_req, res) => {
  try {
    const response = await fetch(`${ollamaBaseUrl}/api/tags`, { signal: AbortSignal.timeout(5_000) })
    if (!response.ok) {
      res.status(503).json(jsonResponse({ status: 'unavailable', message: `Ollama a répondu avec le statut ${response.status}.` }, 503))
      return
    }

    const result = await response.json() as { models?: Array<{ name: string }> }
    const available = result.models?.some(model => model.name === ollamaModel || model.name.startsWith(`${ollamaModel}:`)) ?? false
    res.status(available ? 200 : 503).json(jsonResponse({
      status: available ? 'ready' : 'model_missing',
      model: ollamaModel,
      message: available ? 'Assistant local prêt.' : `Le modèle ${ollamaModel} n’est pas téléchargé dans Ollama.`,
    }, available ? 200 : 503))
  } catch (error) {
    console.error('Ollama est inaccessible.', error)
    res.status(503).json(jsonResponse({ status: 'unavailable', message: 'Ollama est inaccessible sur le serveur local.' }, 503))
  }
})

app.post('/api/assistant/chat', async (req, res) => {
  if (Boolean(supabaseUrl) !== Boolean(supabasePublishableKey)) {
    res.status(503).json(jsonResponse({ message: 'Configuration Supabase incomplète sur le backend.' }, 503))
    return
  }
  if (supabaseUrl && supabasePublishableKey) {
    const authorization = req.get('authorization')
    if (!authorization?.startsWith('Bearer ')) {
      res.status(401).json(jsonResponse({ message: 'Connectez-vous pour utiliser l’assistant.' }, 401))
      return
    }

    try {
      const authResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
        headers: { apikey: supabasePublishableKey, Authorization: authorization },
        signal: AbortSignal.timeout(5_000),
      })
      if (!authResponse.ok) {
        res.status(401).json(jsonResponse({ message: 'La session Supabase a expiré. Reconnectez-vous.' }, 401))
        return
      }
    } catch (error) {
      console.error('Impossible de vérifier la session Supabase pour l’assistant.', error)
      res.status(503).json(jsonResponse({ message: 'Le service d’authentification est temporairement inaccessible.' }, 503))
      return
    }
  }

  const parsed = assistantRequestSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json(jsonResponse({ message: 'Message assistant invalide.', issues: parsed.error.issues }, 400))
    return
  }

  const systemPrompt = [
    'Tu es l’assistant local de l’AGETIP. Réponds en français, clairement et sans inventer.',
    'Si le contexte documentaire ne contient pas la réponse, dis-le explicitement.',
    parsed.data.context ? `Contexte documentaire:\n${parsed.data.context}` : '',
  ].filter(Boolean).join('\n\n')

  try {
    const response = await fetch(`${ollamaBaseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(90_000),
      body: JSON.stringify({
        model: ollamaModel,
        stream: false,
        messages: [
          { role: 'system', content: systemPrompt },
          ...parsed.data.messages,
        ],
      }),
    })

    if (!response.ok) {
      const details = await response.text()
      console.error(`Erreur Ollama (${response.status}): ${details.slice(0, 500)}`)
      res.status(502).json(jsonResponse({ message: `Ollama n’a pas pu générer de réponse (statut ${response.status}).` }, 502))
      return
    }

    const result = await response.json() as { message?: { content?: string } }
    const answer = result.message?.content?.trim()
    if (!answer) {
      res.status(502).json(jsonResponse({ message: 'Ollama a renvoyé une réponse vide.' }, 502))
      return
    }

    res.json(jsonResponse({ answer }))
  } catch (error) {
    console.error('Échec de la requête vers Ollama.', error)
    res.status(503).json(jsonResponse({ message: 'Ollama est inaccessible ou a dépassé le délai autorisé.' }, 503))
  }
})

app.get('/api/incidents', (_req, res) => {
  res.json(jsonResponse(incidents))
})

app.post('/api/incidents', (req, res) => {
  const parsed = incidentSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json(jsonResponse({ message: 'Invalid incident payload', issues: parsed.error.issues }, 400))
    return
  }

  incidents = [...incidents, parsed.data]
  res.status(201).json(jsonResponse(parsed.data, 201))
})

app.get('/api/operational-records', (_req, res) => {
  res.json(jsonResponse(operationalRecords))
})

app.get('/api/operational-records/:module', (req, res) => {
  const moduleName = req.params.module as ModuleName
  if (!moduleNames.includes(moduleName)) {
    res.status(404).json(jsonResponse({ message: 'Module introuvable' }, 404))
    return
  }

  res.json(jsonResponse(operationalRecords[moduleName] ?? []))
})

app.post('/api/operational-records/:module', (req, res) => {
  const moduleName = req.params.module as ModuleName
  if (!moduleNames.includes(moduleName)) {
    res.status(404).json(jsonResponse({ message: 'Module introuvable' }, 404))
    return
  }

  const parsed = operationalRecordSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json(jsonResponse({ message: 'Invalid operational record payload', issues: parsed.error.issues }, 400))
    return
  }

  const next = [...(operationalRecords[moduleName] ?? []), parsed.data]
  operationalRecords[moduleName] = next
  res.status(201).json(jsonResponse(parsed.data, 201))
})

app.put('/api/operational-records/:module/:reference', (req, res) => {
  const moduleName = req.params.module as ModuleName
  const reference = req.params.reference
  if (!moduleNames.includes(moduleName)) {
    res.status(404).json(jsonResponse({ message: 'Module introuvable' }, 404))
    return
  }

  const parsed = operationalRecordSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json(jsonResponse({ message: 'Invalid operational record payload', issues: parsed.error.issues }, 400))
    return
  }

  const rows = [...(operationalRecords[moduleName] ?? [])]
  const index = rows.findIndex((row) => row.reference === reference)
  if (index === -1) {
    res.status(404).json(jsonResponse({ message: 'Record not found' }, 404))
    return
  }

  rows[index] = parsed.data
  operationalRecords[moduleName] = rows
  res.json(jsonResponse(parsed.data))
})

app.delete('/api/operational-records/:module/:reference', (req, res) => {
  const moduleName = req.params.module as ModuleName
  const reference = req.params.reference
  if (!moduleNames.includes(moduleName)) {
    res.status(404).json(jsonResponse({ message: 'Module introuvable' }, 404))
    return
  }

  const rows = [...(operationalRecords[moduleName] ?? [])]
  const next = rows.filter((row) => row.reference !== reference)
  if (next.length === rows.length) {
    res.status(404).json(jsonResponse({ message: 'Record not found' }, 404))
    return
  }

  operationalRecords[moduleName] = next
  res.status(204).send()
})

app.get('/api/toner-movements', (_req, res) => {
  res.json(jsonResponse(tonerMovements))
})

app.post('/api/toner-movements', (req, res) => {
  const parsed = tonerMovementSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json(jsonResponse({ message: 'Invalid toner movement payload', issues: parsed.error.issues }, 400))
    return
  }

  tonerMovements = [parsed.data, ...tonerMovements]
  res.status(201).json(jsonResponse(parsed.data, 201))
})

app.put('/api/toner-movements/:reference', (req, res) => {
  const reference = req.params.reference
  const parsed = tonerMovementSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json(jsonResponse({ message: 'Invalid toner movement payload', issues: parsed.error.issues }, 400))
    return
  }

  const index = tonerMovements.findIndex((item) => item.reference === reference)
  if (index === -1) {
    res.status(404).json(jsonResponse({ message: 'Movement not found' }, 404))
    return
  }

  tonerMovements[index] = parsed.data
  res.json(jsonResponse(parsed.data))
})

app.delete('/api/toner-movements/:reference', (req, res) => {
  const reference = req.params.reference
  const before = tonerMovements.length
  tonerMovements = tonerMovements.filter((item) => item.reference !== reference)
  if (tonerMovements.length === before) {
    res.status(404).json(jsonResponse({ message: 'Movement not found' }, 404))
    return
  }

  res.status(204).send()
})

app.put('/api/incidents/:id', (req, res) => {
  const { id } = req.params
  const parsed = incidentSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json(jsonResponse({ message: 'Invalid incident payload', issues: parsed.error.issues }, 400))
    return
  }

  const index = incidents.findIndex((incident) => incident.id === id)
  if (index === -1) {
    res.status(404).json(jsonResponse({ message: 'Incident not found' }, 404))
    return
  }

  incidents[index] = parsed.data
  res.json(jsonResponse(parsed.data))
})

app.delete('/api/incidents/:id', (req, res) => {
  const { id } = req.params
  const before = incidents.length
  incidents = incidents.filter((incident) => incident.id !== id)
  if (incidents.length === before) {
    res.status(404).json(jsonResponse({ message: 'Incident not found' }, 404))
    return
  }

  res.status(204).send()
})

app.get('/api/modules', (_req, res) => {
  res.json(jsonResponse(moduleNames))
})

app.use((_req, res) => {
  res.status(404).json(jsonResponse({ message: 'Route inconnue' }, 404))
})

app.listen(port, () => {
  console.log(`Backend AGETIP running on http://localhost:${port}`)
})
