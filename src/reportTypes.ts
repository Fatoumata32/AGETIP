import type { Incident } from './types'
import type { ReportAnalysis } from './reportAnalysis'

export type ReportSection = 'Indicateurs clés' | 'Graphiques' | 'Répartitions détaillées' | 'Détail des enregistrements' | 'Conclusions'

export type ReportPayload = {
  title: string
  period: string
  generatedAt: string
  incidents: Incident[]
  modules: string[]
  sections: ReportSection[]
  data: Record<string, string>[]
  analysis: ReportAnalysis
  dataSource: string
}
