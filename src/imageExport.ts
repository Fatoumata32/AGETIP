import html2canvas from 'html2canvas'
import { downloadBlob } from './fileUtils'

export async function exportReportImage(format: 'Image PNG' | 'Image JPG', preview: HTMLElement | null) {
  if (!preview) throw new Error('L’aperçu du rapport est introuvable.')
  const canvas = await html2canvas(preview, { scale: 2, backgroundColor: '#ffffff', useCORS: true })
  const mime = format === 'Image PNG' ? 'image/png' : 'image/jpeg'
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(result => result ? resolve(result) : reject(new Error('La conversion de l’image a échoué.')), mime, 0.94))
  downloadBlob(blob, `rapport-agetip.${format === 'Image PNG' ? 'png' : 'jpg'}`)
}
