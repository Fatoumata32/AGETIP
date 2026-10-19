import { useMemo, useState, type ChangeEvent } from 'react'
import { AlertTriangle, Check, CloudUpload, FileText, Plus, Trash2, X } from 'lucide-react'
import {
  invoiceCategories,
  invoicePeriodKey,
  invoicePeriodLabel,
  parseInvoiceFile,
  type InvoiceCategory,
  type InvoiceImportCandidate,
} from './invoiceImport'

type ExistingInvoice = {
  reference: string
  category?: string
  period?: string
  date?: string
}

type InvoiceImportDialogProps = {
  existingRecords: ExistingInvoice[]
  onClose: () => void
  onConfirm: (candidates: InvoiceImportCandidate[]) => void
}

function createManualCandidate(): InvoiceImportCandidate {
  return {
    id: `manual-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    category: '',
    period: '',
    date: '',
    amount: '',
    sourceFile: 'Saisie manuelle',
    sourceSheet: '',
    sourceExtract: '',
    replaceExisting: false,
  }
}

export default function InvoiceImportDialog({ existingRecords, onClose, onConfirm }: InvoiceImportDialogProps) {
  const [candidates, setCandidates] = useState<InvoiceImportCandidate[]>([])
  const [warnings, setWarnings] = useState<string[]>([])
  const [errors, setErrors] = useState<string[]>([])
  const [loading, setLoading] = useState(false)

  const duplicateInfo = useMemo(() => {
    const seen = new Set<string>()
    return candidates.map(candidate => {
      const key = candidate.category && candidate.period ? `${candidate.category}:${candidate.period}` : ''
      const duplicateInSelection = Boolean(key && seen.has(key))
      if (key) seen.add(key)
      const existing = key
        ? existingRecords.find(record => record.category === candidate.category && invoicePeriodKey(record.period, record.date) === candidate.period)
        : undefined
      return { duplicateInSelection, existing }
    })
  }, [candidates, existingRecords])

  const importable = candidates.filter((candidate, index) => {
    const validPeriod = /^\d{4}-(0[1-9]|1[0-2])$/.test(candidate.period)
    const validAmount = candidate.amount.trim() !== '' && Number.isFinite(Number(candidate.amount)) && Number(candidate.amount) >= 0
    const validCategory = invoiceCategories.includes(candidate.category as InvoiceCategory)
    return validPeriod && validAmount && validCategory &&
      !duplicateInfo[index].duplicateInSelection &&
      (!duplicateInfo[index].existing || candidate.replaceExisting)
  })

  async function readFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.currentTarget.files ?? [])
    event.currentTarget.value = ''
    if (!files.length) return

    setLoading(true)
    const newCandidates: InvoiceImportCandidate[] = []
    const newWarnings: string[] = []
    const newErrors: string[] = []

    for (const file of files) {
      try {
        const result = await parseInvoiceFile(file)
        newCandidates.push(...result.candidates.map((candidate, index) => ({
          ...candidate,
          id: `${file.name}-${Date.now()}-${index}`,
          replaceExisting: false,
        })))
        newWarnings.push(...result.warnings)
      } catch (error) {
        const detail = error instanceof Error ? error.message : 'Erreur de lecture inconnue.'
        newErrors.push(`${file.name} : ${detail}`)
        console.error(`Impossible de lire le fichier d’import ${file.name}.`, error)
      }
    }

    setCandidates(current => [...current, ...newCandidates])
    setWarnings(current => [...current, ...newWarnings])
    setErrors(current => [...current, ...newErrors])
    setLoading(false)
  }

  function updateCandidate(id: string, patch: Partial<InvoiceImportCandidate>) {
    setCandidates(current => current.map(candidate => candidate.id === id ? { ...candidate, ...patch } : candidate))
  }

  return <div className="modal-overlay invoice-import-overlay" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
    <section className="invoice-import-modal" role="dialog" aria-modal="true" aria-labelledby="invoice-import-title">
      <header className="invoice-import-heading">
        <div className="invoice-import-icon"><CloudUpload size={19}/></div>
        <div><h2 id="invoice-import-title">Importer les factures SONATEL</h2><p>Excel mensuel, fiche Word ou saisie manuelle</p></div>
        <button className="icon-button" onClick={onClose} aria-label="Fermer l’import"><X size={18}/></button>
      </header>
      <div className="invoice-import-body">
        <div className="invoice-import-source">
          <div><strong>Sélectionnez vos fichiers</strong><p>Les onglets mensuels sont analysés séparément. Rien n’est enregistré avant votre confirmation.</p></div>
          <label className={`button primary ${loading ? 'disabled-button' : ''}`}>
            <CloudUpload size={15}/>{loading ? 'Lecture en cours…' : 'Choisir des fichiers'}
            <input type="file" multiple accept=".xls,.xlsx,.csv,.doc,.docx" disabled={loading} onChange={readFiles}/>
          </label>
          <button className="button light" disabled={loading} onClick={() => setCandidates(current => [...current, createManualCandidate()])}><Plus size={15}/>Ajouter une ligne</button>
        </div>

        <div className="invoice-category-hint"><strong>Catégories</strong>{invoiceCategories.map(category => <span key={category}>{category}</span>)}</div>

        {warnings.length > 0 && <div className="import-message warning-message"><AlertTriangle size={16}/><div><strong>À vérifier avant validation</strong>{warnings.map((warning, index) => <p key={`${warning}-${index}`}>{warning}</p>)}</div></div>}
        {errors.length > 0 && <div className="import-message error-message"><AlertTriangle size={16}/><div><strong>Fichiers non lus</strong>{errors.map((error, index) => <p key={`${error}-${index}`}>{error}</p>)}</div></div>}

        {candidates.length === 0 ? <div className="invoice-import-empty"><FileText size={24}/><strong>Aucune facture dans l’aperçu</strong><span>Ajoutez un fichier Excel ou Word, ou créez une ligne à compléter.</span></div> : <div className="invoice-import-list">
          <div className="invoice-import-list-title"><strong>Aperçu avant enregistrement</strong><span>{candidates.length} ligne(s) détectée(s)</span></div>
          {candidates.map((candidate, index) => {
            const { duplicateInSelection, existing } = duplicateInfo[index]
            const validAmount = candidate.amount.trim() !== '' && Number.isFinite(Number(candidate.amount)) && Number(candidate.amount) >= 0
            const hasPeriod = /^\d{4}-(0[1-9]|1[0-2])$/.test(candidate.period)
            return <article className={`invoice-import-row ${duplicateInSelection ? 'has-duplicate' : ''}`} key={candidate.id}>
              <div className="invoice-import-row-top">
                <strong>{candidate.sourceSheet ? `${candidate.sourceSheet} · ` : ''}{candidate.sourceFile}</strong>
                <button className="icon-button" onClick={() => setCandidates(current => current.filter(item => item.id !== candidate.id))} aria-label="Retirer cette ligne"><Trash2 size={15}/></button>
              </div>
              <div className="invoice-import-fields">
                <label>Catégorie<select value={candidate.category} onChange={event => updateCandidate(candidate.id, { category: event.target.value as InvoiceCategory | '' })}><option value="">Choisir…</option>{invoiceCategories.map(category => <option key={category}>{category}</option>)}</select></label>
                <label>Période<input type="month" value={candidate.period} onChange={event => {
                  const period = event.target.value
                  const oldPeriodStart = candidate.period ? `${candidate.period}-01` : ''
                  updateCandidate(candidate.id, { period, date: !candidate.date || candidate.date === oldPeriodStart ? `${period}-01` : candidate.date })
                }}/></label>
                <label>Montant (FCFA)<input type="number" min="0" step="1" inputMode="numeric" value={candidate.amount} onChange={event => updateCandidate(candidate.id, { amount: event.target.value })} placeholder="À saisir si absent"/></label>
              </div>
              <div className="invoice-import-row-meta">
                <span>{hasPeriod ? invoicePeriodLabel(candidate.period) : 'Période à compléter'}</span>
                <span>{validAmount ? `${Number(candidate.amount).toLocaleString('fr-FR')} FCFA` : 'Montant à compléter'}</span>
                {existing && <label className="replace-existing"><input type="checkbox" checked={candidate.replaceExisting} onChange={event => updateCandidate(candidate.id, { replaceExisting: event.target.checked })}/>Mettre à jour {existing.reference}</label>}
                {duplicateInSelection && <strong className="duplicate-label">Doublon dans cette sélection — ligne ignorée</strong>}
              </div>
              {candidate.sourceExtract && <details className="invoice-source-preview"><summary>Voir les données extraites du document</summary><p>{candidate.sourceExtract}</p></details>}
            </article>
          })}
        </div>}
      </div>
      <footer className="invoice-import-footer">
        <span><Check size={14}/>{importable.length} ligne(s) prêtes à enregistrer</span>
        <button className="button light" onClick={onClose}>Annuler</button>
        <button className="button primary" disabled={loading || importable.length === 0} onClick={() => onConfirm(importable)}>Confirmer l’import</button>
      </footer>
    </section>
  </div>
}
