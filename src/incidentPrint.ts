import type { Incident } from './types'

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character] ?? character)
}

export function printIncidentSheet(incident: Incident) {
  const page = window.open('', '_blank')
  if (!page) throw new Error('La fenêtre d’impression a été bloquée par le navigateur.')
  page.opener = null
  const fields: [string, string][] = [
    ['Nom et Prénom de la personne qui a signalé l’incident', incident.reporter],
    ['Date et heure de signalisation de l’incident', incident.reportedAt.replace('T', ' ')],
    ['Numéro d’identification assigné à l’incident', incident.id],
    ['Niveau de classification de l’incident', incident.classification],
    ['Type', incident.type],
    ['Descriptif de l’incident', incident.description],
    ['Cause', incident.cause],
    ['Responsable de l’enregistrement', incident.recordedBy],
    ['Responsable de la prise en charge', incident.assignee],
    ['Date et heure de la prise en charge de l’incident', incident.takenAt.replace('T', ' ')],
    ['Traitements appliqués pour la résolution de l’incident', incident.treatments],
    ['Clôture de la prise en charge de l’incident', incident.closed ? 'Oui' : 'Non'],
    ['Date et heure de la clôture', incident.closedAt.replace('T', ' ')],
    ['Observations', incident.observations],
  ]
  const content = fields.map(([label, value]) => `<div class="field"><strong>${escapeHtml(label)} :</strong><p>${escapeHtml(value || '—')}</p></div>`).join('')
  const signatures = ['Personne qui a déclaré l’incident', 'Responsable de l’enregistrement', 'Responsable de la prise en charge']
    .map(label => `<div><span>${escapeHtml(label)}</span><i></i></div>`).join('')
  page.document.write(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${escapeHtml(incident.id)} — Fiche d’incident</title>
    <style>
      @page { size: A4; margin: 18mm 16mm; }
      * { box-sizing: border-box; } body { color: #23364a; font: 11pt Arial, sans-serif; margin: 0; }
      header { border-bottom: 2px solid #01592e; margin-bottom: 20px; padding-bottom: 11px; }
      header small { color: #087743; font-size: 9pt; font-weight: bold; letter-spacing: .6px; }
      h1 { color: #01592e; font-size: 19pt; margin: 10px 0 5px; } header p { color: #68798a; font-size: 9pt; margin: 0; }
      .field { break-inside: avoid; margin: 0 0 12px; } .field strong { color: #344d67; display: block; font-size: 9pt; margin-bottom: 4px; }
      .field p { border-bottom: 1px solid #cfd8df; font-size: 10pt; margin: 0; min-height: 23px; padding: 3px 2px 5px; white-space: pre-wrap; }
      h2 { border-bottom: 1px solid #d4dde5; color: #344d67; font-size: 11pt; margin: 23px 0 12px; padding-bottom: 6px; }
      .signatures { display: grid; gap: 16px; grid-template-columns: repeat(3, 1fr); }
      .signatures span { display: block; font-size: 8pt; min-height: 28px; } .signatures i { border-bottom: 1px solid #cfd8df; display: block; height: 48px; }
      @media screen { body { margin: 20px auto; max-width: 780px; padding: 26px 35px; } }
    </style></head><body><header><small>AGETIP · INFORMATIQUE &amp; TECHNIQUE · EN/145/02</small><h1>Fiche d’enregistrement d’un incident</h1><p>Fiche officielle — ${escapeHtml(incident.id)}</p></header>
    ${content}<h2>Ont signé</h2><div class="signatures">${signatures}</div>
    <script>window.addEventListener('load', () => window.print())</script></body></html>`)
  page.document.close()
}
