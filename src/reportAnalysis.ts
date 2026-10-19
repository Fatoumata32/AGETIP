import type { Incident } from './types'

export type ReportAnalysis = {
  metrics: [string, string][]
  chartTitle: string
  chartData: [string, number][]
  conclusion: string
  detailTables?: { title: string; rows: [string, string][] }[]
  observations?: string[]
}

const countBy = (values: string[]) => values.reduce<Record<string, number>>((counts, value) => {
  counts[value || 'Non renseigné'] = (counts[value || 'Non renseigné'] ?? 0) + 1
  return counts
}, {})
const formattedNumber = (value: number) => value.toLocaleString('fr-FR')
const sortedCounts = (values: string[]) => Object.entries(countBy(values)).sort((a, b) => b[1] - a[1])
const monthLabel = (value: string) => /^\d{4}-\d{2}$/.test(value)
  ? new Date(`${value}-01T12:00:00`).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
  : value || 'Non renseigné'
const countTable = (title: string, counts: [string, number][]): { title: string; rows: [string, string][] } => ({
  title,
  rows: counts.map(([label, count]) => [label, formattedNumber(count)]),
})
const amountBy = (data: Record<string, string>[], group: string, amount: string) => {
  const totals = new Map<string, number>()
  data.forEach(row => {
    const key = row[group] || 'Non renseigné'
    totals.set(key, (totals.get(key) ?? 0) + (Number(row[amount]) || 0))
  })
  return [...totals.entries()].sort((a, b) => b[1] - a[1])
}

export function analyzeReport(title: string, incidents: Incident[], data: Record<string, string>[]): ReportAnalysis {
  const statusCounts = countBy(data.map(row => row.Statut ?? row.État).filter((status): status is string => Boolean(status)))
  const moduleCounts = countBy(data.map(row => row.Module ?? ''))
  const invoiceRows = data.filter(row => row.Module === 'Factures SONATEL' || Boolean(row['N° facture SONATEL']))
  const invoiceTotal = invoiceRows.reduce((total, row) => total + (Number(row['Montant (FCFA)']) || 0), 0)
  const isIncidentReport = title === 'Incidents'

  if (isIncidentReport || title === 'Rapport général' || title === 'Rapport consolidé') {
    const incidentRows = isIncidentReport ? data : data.filter(row => row.Module === 'Incidents')
    const closedCount = incidentRows.filter(row => row.Statut === 'Clôturé').length
    const criticalCount = incidentRows.filter(row => row.Classification === 'Critique').length
    const incidentReferences = new Set(incidentRows.map(row => row.Référence))
    const inScopeIncidents = isIncidentReport ? incidents : incidents.filter(incident => incidentReferences.has(incident.id))
    const resolutionHours = inScopeIncidents.filter(incident => incident.closed && incident.closedAt).flatMap(incident => {
      const duration = new Date(incident.closedAt).getTime() - new Date(incident.reportedAt).getTime()
      return duration >= 0 ? [duration / 3_600_000] : []
    })
    const averageResolution = resolutionHours.length
      ? `${(resolutionHours.reduce((sum, value) => sum + value, 0) / resolutionHours.length).toFixed(1)} h`
      : 'Données insuffisantes'
    if (isIncidentReport) {
      return {
        metrics: [
          ['Incidents signalés', formattedNumber(incidentRows.length)],
          ['Clôturés', `${closedCount} (${incidentRows.length ? Math.round(closedCount / incidentRows.length * 100) : 0} %)`],
          ['À traiter', formattedNumber(incidentRows.length - closedCount)],
          ['Incidents critiques', formattedNumber(criticalCount)],
          ['Durée moyenne de résolution', averageResolution],
          ['Équipements concernés', formattedNumber(new Set(inScopeIncidents.map(incident => incident.equipment).filter(Boolean)).size)],
        ],
        chartTitle: 'Incidents — répartition par type',
        chartData: sortedCounts(incidentRows.map(row => row.Catégorie ?? '')),
        detailTables: [
          countTable('Incidents par statut', sortedCounts(incidentRows.map(row => row.Statut ?? ''))),
          countTable('Incidents par classification', sortedCounts(incidentRows.map(row => row.Classification ?? ''))),
          countTable('Incidents par catégorie', sortedCounts(incidentRows.map(row => row.Catégorie ?? ''))),
          countTable('Incidents signalés par mois', sortedCounts(incidentRows.map(row => monthLabel(row.Date?.slice(0, 7) ?? '')))),
          countTable('Équipements les plus concernés', sortedCounts(incidentRows.map(row => row.Équipement ?? '')).slice(0, 5)),
        ],
        observations: [
          `${incidentRows.length - closedCount} incident(s) restent ouverts${incidentRows.length ? ` (${Math.round((incidentRows.length - closedCount) / incidentRows.length * 100)} % du total)` : ''}.`,
          criticalCount ? `${criticalCount} incident(s) sont classés critiques et nécessitent une vérification prioritaire.` : 'Aucun incident n’est classé critique sur la période.',
          resolutionHours.length ? `La durée moyenne de résolution est de ${averageResolution}, calculée sur ${resolutionHours.length} incident(s) clôturé(s) avec dates valides.` : 'La durée moyenne de résolution n’est pas calculable : aucun incident clôturé ne possède de dates exploitables.',
        ],
        conclusion: `${incidentRows.length} incident(s) ont été signalés sur la période : ${closedCount} clôturé(s), ${incidentRows.length - closedCount} ouvert(s) et ${criticalCount} critique(s). ${resolutionHours.length ? `La durée moyenne de résolution des incidents clôturés datés est de ${averageResolution}.` : 'Les durées de résolution ne sont pas disponibles pour cette période.'}`,
      }
    }
    const metrics: [string, string][] = [
      ['Enregistrements', formattedNumber(data.length)],
      ['Modules avec données', formattedNumber(Object.keys(moduleCounts).length)],
    ]
    if (incidentRows.length) metrics.push(['Incidents ouverts', formattedNumber(incidentRows.filter(row => row.Statut === 'Ouvert').length)], ['Incidents critiques', formattedNumber(criticalCount)])
    if (invoiceRows.length) metrics.push(['Factures SONATEL', formattedNumber(invoiceRows.length)], ['Montant SONATEL', `${formattedNumber(invoiceTotal)} FCFA`])
    const stockRows = data.filter(row => row.Module === 'Cartouches (stock)' && row.Nature !== 'Mouvement')
    const movementRows = data.filter(row => row.Nature === 'Mouvement')
    const equipmentRows = data.filter(row => row.Module === 'Parc informatique')
    const climateRows = data.filter(row => row.Module === 'Climatisation')
    const maintenanceRows = data.filter(row => row.Module === 'Maintenances')
    if (stockRows.length) metrics.push(['Références sous le seuil', formattedNumber(stockRows.filter(row => Number(row.Stock) <= Number(row['Seuil minimum'])).length)])
    if (equipmentRows.length) metrics.push(['Équipements en panne', formattedNumber(equipmentRows.filter(row => row.État === 'En panne').length)])
    const detailTables: { title: string; rows: [string, string][] }[] = [
      countTable('Enregistrements par module', Object.entries(moduleCounts).filter(([module]) => module).sort((a, b) => b[1] - a[1])),
    ]
    if (incidentRows.length) {
      detailTables.push(
        countTable('Incidents par statut', sortedCounts(incidentRows.map(row => row.Statut ?? ''))),
        countTable('Incidents par classification', sortedCounts(incidentRows.map(row => row.Classification ?? ''))),
        countTable('Incidents par catégorie', sortedCounts(incidentRows.map(row => row.Catégorie ?? ''))),
        countTable('Incidents signalés par mois', sortedCounts(incidentRows.map(row => monthLabel(row.Date?.slice(0, 7) ?? '')))),
      )
    }
    if (invoiceRows.length) {
      detailTables.push(
        countTable('Factures SONATEL par statut', sortedCounts(invoiceRows.map(row => row.Statut ?? ''))),
        { title: 'Montants SONATEL par catégorie', rows: amountBy(invoiceRows, 'Catégorie', 'Montant (FCFA)').map(([category, total]) => [category, `${formattedNumber(total)} FCFA`]) },
      )
    }
    if (stockRows.length) {
      detailTables.push(
        countTable('Références de cartouches par état', sortedCounts(stockRows.map(row => row.État ?? ''))),
        {
          title: 'Mouvements de stock par type',
          rows: sortedCounts(movementRows.map(row => row.Mouvement ?? '')).map(([movement, count]) => [
            `${movement} — ${count} mouvement(s)`,
            `${formattedNumber(movementRows.filter(row => row.Mouvement === movement).reduce((sum, row) => sum + (Number(row.Quantité) || 0), 0))} unité(s)`,
          ]),
        },
      )
    }
    if (equipmentRows.length) detailTables.push(countTable('Parc informatique par état', sortedCounts(equipmentRows.map(row => row.État ?? ''))))
    if (climateRows.length) detailTables.push(countTable('Climatiseurs par état', sortedCounts(climateRows.map(row => row.État ?? ''))))
    if (maintenanceRows.length) detailTables.push(countTable('Maintenances par statut', sortedCounts(maintenanceRows.map(row => row.Statut ?? ''))))
    const observations = [
      incidentRows.length ? `${incidentRows.filter(row => row.Statut === 'Ouvert').length} incident(s) restent ouverts${criticalCount ? `, dont ${criticalCount} critique(s)` : ''}.` : 'Aucun incident n’est inclus dans cette synthèse.',
      invoiceRows.length ? `${formattedNumber(invoiceRows.filter(row => row.Statut === 'À valider').reduce((sum, row) => sum + (Number(row['Montant (FCFA)']) || 0), 0))} FCFA de factures SONATEL sont en attente de validation.` : 'Aucune facture SONATEL n’est incluse dans cette synthèse.',
      stockRows.length ? `${stockRows.filter(row => Number(row.Stock) <= Number(row['Seuil minimum'])).length} référence(s) de cartouches sont au niveau ou sous leur seuil.` : 'Aucune donnée de stock n’est incluse dans cette synthèse.',
      equipmentRows.length ? `${equipmentRows.filter(row => row.État === 'En panne').length} équipement(s) informatique(s) sont signalés en panne.` : 'Aucune donnée du parc informatique n’est incluse dans cette synthèse.',
      'Les états du parc et du stock sont des instantanés courants ; leur évolution historique n’est pas disponible.',
    ]
    return {
      metrics,
      chartTitle: 'Enregistrements par module',
      chartData: Object.entries(moduleCounts).filter(([module]) => module),
      detailTables,
      observations,
      conclusion: `${data.length} enregistrement(s) issus de ${Object.keys(moduleCounts).length} module(s) figurent dans cette synthèse. ${incidentRows.length ? `${incidentRows.filter(row => row.Statut === 'Ouvert').length} incident(s) sont ouverts. ` : ''}${invoiceRows.length ? `Les ${invoiceRows.length} facture(s) SONATEL représentent ${formattedNumber(invoiceTotal)} FCFA.` : ''}`,
    }
  }

  if (title === 'Factures SONATEL') {
    const pending = statusCounts['À valider'] ?? 0
    return {
      metrics: [
        ['Factures reçues', formattedNumber(data.length)],
        ['Montant total', `${formattedNumber(invoiceTotal)} FCFA`],
        ['Montant moyen', `${formattedNumber(data.length ? Math.round(invoiceTotal / data.length) : 0)} FCFA`],
        ['En attente de validation', formattedNumber(pending)],
        ['Factures traitées', formattedNumber(statusCounts.Traitée ?? 0)],
        ['Périodes facturées', formattedNumber(new Set(data.map(row => row['Période facturée']).filter(Boolean)).size)],
      ],
      chartTitle: 'Factures par catégorie',
      chartData: sortedCounts(data.map(row => row.Catégorie ?? '')),
      detailTables: [
        countTable('Factures par statut', sortedCounts(data.map(row => row.Statut ?? ''))),
        {
          title: 'Montants par catégorie',
          rows: amountBy(data, 'Catégorie', 'Montant (FCFA)').map(([category, total]) => [category, `${formattedNumber(total)} FCFA`]) as [string, string][],
        },
        countTable('Factures par période facturée', sortedCounts(data.map(row => row['Période facturée'] ?? ''))),
      ],
      observations: [
        pending ? `${pending} facture(s) sont encore à valider, pour ${formattedNumber(data.filter(row => row.Statut === 'À valider').reduce((sum, row) => sum + (Number(row['Montant (FCFA)']) || 0), 0))} FCFA.` : 'Aucune facture n’attend de validation.',
        `Le montant moyen par facture est de ${formattedNumber(data.length ? Math.round(invoiceTotal / data.length) : 0)} FCFA.`,
      ],
      conclusion: `${data.length} facture(s) SONATEL représentent ${formattedNumber(invoiceTotal)} FCFA, soit ${formattedNumber(data.length ? Math.round(invoiceTotal / data.length) : 0)} FCFA en moyenne par facture. ${pending} facture(s) attendent leur validation.`,
    }
  }

  if (title === 'Cartouches (stock)') {
    const inventoryRows = data.filter(row => row.Nature !== 'Mouvement')
    const quantity = inventoryRows.reduce((sum, row) => sum + (Number(row.Stock) || 0), 0)
    const belowMinimum = inventoryRows.filter(row => row['Seuil minimum'] !== undefined && Number(row.Stock) <= Number(row['Seuil minimum'])).length
    const movements = data.filter(row => row.Nature === 'Mouvement')
    const movementQuantity = movements.reduce((sum, row) => sum + (Number(row.Quantité) || 0), 0)
    return {
      metrics: [
        ['Références au catalogue', formattedNumber(inventoryRows.length)],
        ['Unités en stock', formattedNumber(quantity)],
        ['Références sous le seuil', formattedNumber(belowMinimum)],
        ['Mouvements sur la période', formattedNumber(movements.length)],
        ['Quantité concernée par les mouvements', formattedNumber(movementQuantity)],
      ],
      chartTitle: 'Répartition du stock par état',
      chartData: sortedCounts(inventoryRows.map(row => row.État ?? 'Non renseigné')),
      detailTables: [
        countTable('Références par état', sortedCounts(inventoryRows.map(row => row.État ?? ''))),
        {
          title: 'Mouvements de cartouches sur la période',
          rows: sortedCounts(movements.map(row => row.Mouvement ?? '')).map(([movement, count]) => [
            `${movement} — ${count} mouvement(s)`,
            `${formattedNumber(movements.filter(row => row.Mouvement === movement).reduce((sum, row) => sum + (Number(row.Quantité) || 0), 0))} unité(s)`,
          ]),
        },
        countTable('Motifs des mouvements', sortedCounts(movements.map(row => row.Motif ?? ''))),
      ],
      observations: [
        belowMinimum ? `${belowMinimum} référence(s) ont un stock inférieur ou égal à leur seuil minimum.` : 'Aucune référence n’est sous son seuil minimum.',
        movements.length ? `${movements.filter(row => row.Mouvement === 'Sortie').length} sortie(s) et ${movements.filter(row => row.Mouvement === 'Entrée').length} entrée(s) ont été enregistrées pendant la période.` : 'Aucun mouvement de stock n’a été enregistré pendant la période.',
        'Le stock affiché est un instantané courant ; aucun historique quotidien des quantités n’est disponible.',
      ],
      conclusion: `${inventoryRows.length} référence(s) totalisent ${formattedNumber(quantity)} unité(s). ${belowMinimum} référence(s) sont au niveau ou sous leur seuil minimum. ${movements.length} mouvement(s) de ${formattedNumber(movementQuantity)} unité(s) sont recensés sur la période.`,
    }
  }

  if (title === 'Parc informatique') {
    const inService = statusCounts['En service'] ?? 0
    const outOfOrder = statusCounts['En panne'] ?? 0
    const equipmentRows = data.filter(row => row.Nature !== 'Mouvement')
    return {
      metrics: [
        ['Équipements inventoriés', formattedNumber(equipmentRows.length)],
        ['En service', formattedNumber(inService)],
        ['En panne', formattedNumber(outOfOrder)],
        ['Taux en service', `${equipmentRows.length ? Math.round(inService / equipmentRows.length * 100) : 0} %`],
        ['Date d’observation', data[0]?.['État observé le'] ?? 'Non renseignée'],
      ],
      chartTitle: 'Parc informatique par état',
      chartData: sortedCounts(equipmentRows.map(row => row.État ?? '')),
      detailTables: [
        countTable('Équipements par état', sortedCounts(equipmentRows.map(row => row.État ?? ''))),
        countTable('Équipements par affectation', sortedCounts(equipmentRows.map(row => row.Affectation ?? ''))),
      ],
      observations: [
        outOfOrder ? `${outOfOrder} équipement(s) en panne sont à prendre en charge.` : 'Aucun équipement n’est indiqué en panne.',
        `${equipmentRows.length - inService - outOfOrder} équipement(s) ont un statut autre que « En service » ou « En panne » ; vérifier leur qualification.`,
        'Le parc est un instantané courant et ne décrit pas les changements d’état antérieurs à la date du rapport.',
      ],
      conclusion: `${inService} équipement(s) sur ${equipmentRows.length} sont indiqués en service (${equipmentRows.length ? Math.round(inService / equipmentRows.length * 100) : 0} %)${outOfOrder ? ` ; ${outOfOrder} sont en panne` : ''}.`,
    }
  }

  if (title === 'Climatiseurs') {
    const capacity = data.reduce((sum, row) => sum + (Number((row.Capacité ?? '').replace(/[^\d]/g, '')) || 0), 0)
    const working = statusCounts.Opérationnel ?? 0
    const airConditionerRows = data.filter(row => row.Nature !== 'Mouvement')
    return {
      metrics: [
        ['Climatiseurs inventoriés', formattedNumber(airConditionerRows.length)],
        ['Opérationnels', formattedNumber(working)],
        ['À traiter', formattedNumber(statusCounts['À traiter'] ?? 0)],
        ['Capacité totale renseignée', `${formattedNumber(capacity)} BTU`],
        ['Prochaines maintenances planifiées', formattedNumber(data.filter(row => row['Prochaine maintenance'] && row['Prochaine maintenance'] !== 'À planifier').length)],
      ],
      chartTitle: 'Climatiseurs par état',
      chartData: sortedCounts(airConditionerRows.map(row => row.État ?? '')),
      detailTables: [
        countTable('Climatiseurs par état', sortedCounts(airConditionerRows.map(row => row.État ?? ''))),
        { title: 'Capacité par équipement', rows: airConditionerRows.map(row => [row.Référence ?? row.Désignation ?? 'Équipement', row.Capacité || 'Non renseignée'] as [string, string]) },
        countTable('État de maintenance', sortedCounts(airConditionerRows.map(row => row['Prochaine maintenance'] ?? 'Non renseignée'))),
      ],
      observations: [
        `${statusCounts['À traiter'] ?? 0} climatiseur(s) sont signalés « À traiter ».`,
        `${data.filter(row => !row.Capacité).length} équipement(s) n’ont pas de capacité renseignée.`,
        'La dernière et la prochaine visite ne sont indiquées que si elles sont liées à une intervention enregistrée.',
      ],
      conclusion: `${working} climatiseur(s) sur ${airConditionerRows.length} sont indiqués opérationnels. La capacité totale renseignée est de ${formattedNumber(capacity)} BTU.`,
    }
  }

  const completed = statusCounts.Terminée ?? 0
  const planned = statusCounts.Planifiée ?? 0
  const upcoming = statusCounts['À venir'] ?? 0
  return {
    metrics: [
      ['Interventions sur la période', formattedNumber(data.length)],
      ['Terminées', formattedNumber(completed)],
      ['Planifiées', formattedNumber(planned)],
      ['À venir', formattedNumber(upcoming)],
      ['Taux de réalisation', `${data.length ? Math.round(completed / data.length * 100) : 0} %`],
    ],
    chartTitle: 'Interventions par statut',
    chartData: sortedCounts(data.map(row => row.Statut ?? '')),
    detailTables: [
      countTable('Interventions par statut', sortedCounts(data.map(row => row.Statut ?? ''))),
      countTable('Interventions par mois', sortedCounts(data.map(row => monthLabel(row.Date?.slice(0, 7) ?? '')))),
    ],
    observations: [
      `${data.length - completed} intervention(s) ne sont pas indiquées comme terminées.`,
      `${planned + upcoming} intervention(s) restent planifiées ou à venir.`,
      data.some(row => !row.Date) ? 'Certaines interventions n’ont pas de date exploitable.' : 'Toutes les interventions incluses possèdent une date.',
    ],
    conclusion: `${data.length} intervention(s) sont enregistrées sur la période : ${completed} terminée(s), ${planned} planifiée(s) et ${upcoming} à venir. Le taux de réalisation est de ${data.length ? Math.round(completed / data.length * 100) : 0} %.`,
  }
}
