import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { extractOfficeText } from '../invoiceImport'

const indexedTextLimit = 150_000

export async function extractReferenceText(file: File): Promise<string> {
  const extension = file.name.split('.').pop()?.toLocaleLowerCase('fr-FR')
  let text: string

  if (extension === 'txt') {
    text = await file.text()
  } else if (extension === 'doc' || extension === 'docx') {
    text = await extractOfficeText(file)
  } else if (extension === 'pdf') {
    const pdfjs = await import('pdfjs-dist')
    pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl
    const document = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise
    const pages = await Promise.all(Array.from({ length: document.numPages }, async (_, index) => {
      const page = await document.getPage(index + 1)
      const content = await page.getTextContent()
      return content.items
        .filter(item => 'str' in item)
        .map(item => 'str' in item ? item.str : '')
        .join(' ')
    }))
    text = pages.join('\n')
  } else {
    throw new Error('Format non pris en charge pour l’indexation. Utilisez PDF, Word ou texte.')
  }

  const normalized = text.replace(/\s+/g, ' ').trim()
  if (!normalized) throw new Error(`Aucun texte exploitable n’a été trouvé dans ${file.name}.`)
  return normalized.slice(0, indexedTextLimit)
}
