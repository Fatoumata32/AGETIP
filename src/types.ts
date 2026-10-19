export type Incident = {
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

export type ReportFormat = 'PDF' | 'Word (.docx)' | 'Excel (.xlsx)' | 'PowerPoint (.pptx)' | 'Image PNG' | 'Image JPG'

export const incidentTypes = ['Réseau', 'Matériel', 'Logiciel', 'Messagerie', 'Climatisation', 'Autre']

export const initialIncidents: Incident[] = [
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
]

export const modules = [
  'Incidents',
  'Factures SONATEL',
  'Cartouches (stock)',
  'Parc informatique',
  'Climatisation',
  'Maintenances',
] as const

export type ModuleName = (typeof modules)[number]
