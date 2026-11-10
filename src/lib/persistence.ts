export type ApiEnvelope<T> = {
  status: number
  payload: T
}

const fallbackApiBase = 'http://localhost:4000/api'
const apiBaseUrl = (import.meta.env.VITE_API_URL ?? fallbackApiBase).replace(/\/$/, '')

export function getApiBaseUrl() {
  return apiBaseUrl
}

export async function apiRequest<T>(path: string, method = 'GET', body?: unknown): Promise<T | null> {
  try {
    const request = await fetch(`${apiBaseUrl}${path.startsWith('/') ? path : `/${path}`}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    })

    if (request.status === 204) return null
    if (!request.ok) {
      console.warn(`API request failed (${request.status}) for ${path}`)
      return null
    }

    const payload = (await request.json()) as ApiEnvelope<T> | T
    if (payload && typeof payload === 'object' && 'payload' in payload && 'status' in payload) {
      return (payload as ApiEnvelope<T>).payload
    }

    return payload as T
  } catch (error) {
    console.warn(`Backend unreachable for ${path}. Falling back to local storage.`, error)
    return null
  }
}

export async function askLocalAssistant(
  messages: Array<{ role: 'assistant' | 'user'; content: string }>,
  context = '',
  accessToken?: string,
) {
  const response = await fetch(`${apiBaseUrl}/assistant/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify({ messages, context }),
  })

  if (!response.ok) {
    const body = await response.json().catch(() => null) as { message?: string } | null
    throw new Error(body?.message ?? `Le service Ollama a répondu avec le statut ${response.status}.`)
  }

  const result = await response.json() as { answer: string }
  if (typeof result.answer !== 'string' || !result.answer.trim()) {
    throw new Error('Le service Ollama n’a pas renvoyé de réponse exploitable.')
  }
  return result.answer
}
