import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { BriefcaseBusiness, Mail, Pencil, Plus, Search, Trash2, UsersRound, X } from 'lucide-react'
import {
  deletePersonnelRecord,
  loadPersonnel,
  savePersonnelRecord,
  type PersonnelRecord,
} from './lib/supabaseData'

type Props = {
  isRemote: boolean
  canManage: boolean
}

type PersonnelDraft = Omit<PersonnelRecord, 'id'>

const emptyDraft: PersonnelDraft = { name: '', email: '', position: '', department: '' }
const storageKey = 'agetip-personnel'

function readLocalPersonnel(): PersonnelRecord[] {
  const saved = localStorage.getItem(storageKey)
  if (!saved) return []
  const parsed: unknown = JSON.parse(saved)
  if (!Array.isArray(parsed) || !parsed.every(member =>
    member && typeof member === 'object' &&
    typeof member.id === 'string' &&
    typeof member.name === 'string' &&
    typeof member.email === 'string' &&
    typeof member.position === 'string' &&
    typeof member.department === 'string',
  )) {
    throw new Error('Le répertoire local du personnel est invalide.')
  }
  return parsed as PersonnelRecord[]
}

export default function PersonnelDirectory({ isRemote, canManage }: Props) {
  const [members, setMembers] = useState<PersonnelRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [loadFailed, setLoadFailed] = useState(false)
  const [saving, setSaving] = useState(false)
  const [query, setQuery] = useState('')
  const [draft, setDraft] = useState<PersonnelDraft | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    setLoading(true)
    setLoadFailed(false)
    setError('')
    const fetchMembers = async () => {
      try {
        const loaded = isRemote ? await loadPersonnel() : readLocalPersonnel()
        if (active) setMembers(loaded)
      } catch (loadError) {
        console.error('Impossible de charger le répertoire du personnel.', loadError)
        if (active) {
          setLoadFailed(true)
          setError('Impossible de charger le répertoire du personnel. Rechargez la page pour réessayer.')
        }
      } finally {
        if (active) setLoading(false)
      }
    }
    void fetchMembers()
    return () => { active = false }
  }, [isRemote])

  useEffect(() => {
    if (!draft) return
    const dismissOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !saving) closeEditor()
    }
    window.addEventListener('keydown', dismissOnEscape)
    return () => window.removeEventListener('keydown', dismissOnEscape)
  }, [draft, saving])

  const filteredMembers = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('fr-FR')
    return members
      .filter(member => !normalizedQuery ||
        [member.name, member.email, member.position, member.department]
          .some(value => value.toLocaleLowerCase('fr-FR').includes(normalizedQuery)),
      )
      .sort((a, b) => a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' }))
  }, [members, query])

  function closeEditor() {
    setDraft(null)
    setEditingId(null)
    setError('')
  }

  async function saveMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!draft || saving) return
    const cleaned: PersonnelDraft = {
      name: draft.name.trim(),
      email: draft.email.trim(),
      position: draft.position.trim(),
      department: draft.department.trim(),
    }
    if (!cleaned.name || !cleaned.email) {
      setError('Le nom et l’adresse e-mail sont obligatoires.')
      return
    }
    if (members.some(member =>
      member.email.toLocaleLowerCase('fr-FR') === cleaned.email.toLocaleLowerCase('fr-FR') &&
      member.id !== editingId,
    )) {
      setError('Cette adresse e-mail est déjà attribuée à une fiche du répertoire.')
      return
    }

    const member: PersonnelRecord = { id: editingId ?? crypto.randomUUID(), ...cleaned }
    setSaving(true)
    setError('')
    try {
      if (isRemote) {
        await savePersonnelRecord(member)
      } else {
        const next = editingId
          ? members.map(existing => existing.id === editingId ? member : existing)
          : [...members, member]
        localStorage.setItem(storageKey, JSON.stringify(next))
        setMembers(next)
      }
      if (isRemote) {
        setMembers(current => editingId
          ? current.map(existing => existing.id === editingId ? member : existing)
          : [...current, member],
        )
      }
      closeEditor()
    } catch (saveError) {
      console.error('Impossible d’enregistrer la fiche du personnel.', saveError)
      setError('Échec de l’enregistrement. Vérifiez vos droits et réessayez.')
    } finally {
      setSaving(false)
    }
  }

  async function removeMember(member: PersonnelRecord) {
    if (!window.confirm(`Supprimer la fiche de ${member.name} ?`)) return
    setError('')
    try {
      if (isRemote) {
        await deletePersonnelRecord(member.id)
      } else {
        const next = members.filter(existing => existing.id !== member.id)
        localStorage.setItem(storageKey, JSON.stringify(next))
        setMembers(next)
      }
      if (isRemote) setMembers(current => current.filter(existing => existing.id !== member.id))
    } catch (deleteError) {
      console.error('Impossible de supprimer la fiche du personnel.', deleteError)
      setError('Échec de la suppression. Vérifiez vos droits et réessayez.')
    }
  }

  return <section className="personnel-directory">
    <div className="personnel-toolbar">
      <label className="search-box personnel-search"><Search size={16}/><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Rechercher un nom, un service, un e-mail…" /></label>
      {canManage && !loading && !loadFailed && <button className="button primary" onClick={() => { setError(''); setDraft({ ...emptyDraft }); setEditingId(null) }}><Plus size={15}/>Ajouter une personne</button>}
    </div>
    {!isRemote && <p className="personnel-storage-note">Mode local : ce répertoire est enregistré dans ce navigateur.</p>}
    {error && <p className="personnel-error" role="alert">{error}</p>}
    {loading ? <div className="empty-state">Chargement du répertoire…</div> : loadFailed ? null : filteredMembers.length ? <>
      <div className="personnel-grid">
        {filteredMembers.map(member => <article className="personnel-card" key={member.id}>
          <div className="personnel-card-heading">
            <div className="personnel-avatar" aria-hidden="true">{member.name.trim().split(/\s+/).slice(0, 2).map(part => part[0]?.toLocaleUpperCase('fr-FR')).join('')}</div>
            <div className="personnel-identity"><h2>{member.name}</h2><p>{member.position || 'Fonction non renseignée'}</p></div>
            {canManage && <div className="personnel-actions">
              <button className="icon-button" aria-label={`Modifier ${member.name}`} title="Modifier" onClick={() => { setError(''); setDraft({ name: member.name, email: member.email, position: member.position, department: member.department }); setEditingId(member.id) }}><Pencil size={15}/></button>
              <button className="icon-button personnel-delete" aria-label={`Supprimer ${member.name}`} title="Supprimer" onClick={() => { void removeMember(member) }}><Trash2 size={15}/></button>
            </div>}
          </div>
          <div className="personnel-detail"><BriefcaseBusiness size={14}/><span>{member.department || 'Service non renseigné'}</span></div>
          <a className="personnel-email" href={`mailto:${member.email}`}><Mail size={14}/>{member.email}</a>
        </article>)}
      </div>
      <div className="table-footer">{filteredMembers.length} personne(s){isRemote ? ' synchronisée(s) avec Supabase' : ' dans ce navigateur'}</div>
    </> : <div className="personnel-empty">
      <UsersRound size={28}/>
      <strong>{query ? 'Aucun résultat' : 'Le répertoire est vide'}</strong>
      <span>{query ? 'Essayez un autre nom, e-mail ou service.' : canManage ? 'Ajoutez les premières fiches du personnel et leurs adresses AGETIP.' : 'Les fiches du personnel apparaîtront ici.'}</span>
    </div>}

    {draft && <div className="modal-overlay" onMouseDown={event => { if (event.target === event.currentTarget && !saving) closeEditor() }}>
      <section className="profile-modal personnel-modal" role="dialog" aria-modal="true" aria-labelledby="personnel-modal-title">
        <div className="profile-modal-heading"><div className="profile-modal-avatar"><UsersRound size={20}/></div><div><h2 id="personnel-modal-title">{editingId ? 'Modifier une fiche' : 'Ajouter une personne'}</h2><p>Renseignez les coordonnées professionnelles AGETIP.</p></div><button className="icon-button" aria-label="Fermer" disabled={saving} onClick={closeEditor}><X size={17}/></button></div>
        <form className="profile-form" onSubmit={event => { void saveMember(event) }}>
          <label className="field-label">Nom complet<input autoFocus required maxLength={120} value={draft.name} onChange={event => setDraft({ ...draft, name: event.target.value })} placeholder="Prénom et nom" /></label>
          <label className="field-label">E-mail AGETIP<input required type="email" maxLength={254} value={draft.email} onChange={event => setDraft({ ...draft, email: event.target.value })} placeholder="prenom.nom@agetip.sn" /></label>
          <label className="field-label">Fonction<input maxLength={120} value={draft.position} onChange={event => setDraft({ ...draft, position: event.target.value })} placeholder="Ex. Responsable administratif" /></label>
          <label className="field-label">Service / direction<input maxLength={120} value={draft.department} onChange={event => setDraft({ ...draft, department: event.target.value })} placeholder="Ex. Direction financière" /></label>
          {error && <p className="personnel-error" role="alert">{error}</p>}
          <div className="profile-modal-actions"><div/><button className="button light" type="button" disabled={saving} onClick={closeEditor}>Annuler</button><button className="button primary" type="submit" disabled={saving}>{saving ? 'Enregistrement…' : 'Enregistrer'}</button></div>
        </form>
      </section>
    </div>}
  </section>
}
