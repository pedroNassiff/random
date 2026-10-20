import { ApiError } from '../vaca-futbolera/api'
import type {
  AgentReply,
  CalendarItem,
  CalendarView,
  ChatAttachment,
  ChatEntry,
  ChatTurn,
  Client,
  ClientInput,
  DeadlineInput,
  DeadlineResult,
  Estado,
  Invoice,
  InvoiceInput,
  ImportResult,
  InvoiceList,
  MovementSummary,
  Onboarding,
  Me,
  Profile,
  ProfileInput,
  QuarterSummary,
  StoredDocument,
} from './types'

export { ApiError, errorText } from '../vaca-futbolera/api'

/** Sesión compartida con el resto de páginas con login (misma cookie que Fútbol Vaquero). */
const AUTH = '/api/auth'
const FISCAL = '/api/fiscal'

async function errorMessage(res: Response): Promise<string> {
  try {
    const body: unknown = await res.json()
    const detail = (body as { detail?: unknown }).detail
    if (typeof detail === 'string') return detail
  } catch {
    /* cuerpo vacío o no JSON */
  }
  return res.status === 422 ? 'Revisá los datos e intentá de nuevo.' : 'Algo salió mal. Intentá de nuevo.'
}

async function send(url: string, method: string, body?: unknown): Promise<Response> {
  const res = await fetch(url, {
    method,
    credentials: 'include',
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (!res.ok) throw new ApiError(res.status, await errorMessage(res))
  return res
}

async function request<T>(url: string, method = 'GET', body?: unknown): Promise<T> {
  return (await (await send(url, method, body)).json()) as T
}

/** 404 = todavía no hay perfil fiscal: no es un error, es el estado inicial. */
async function calendar(): Promise<CalendarView | null> {
  try {
    return await request<CalendarView>(`${FISCAL}/calendar`)
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return null
    throw e
  }
}

export const api = {
  me: () => request<Me>(`${AUTH}/me`),
  login: (email: string, password: string) => request<Me>(`${AUTH}/login`, 'POST', { email, password }),
  logout: async () => {
    await send(`${AUTH}/logout`, 'POST')
  },
  profile: () => request<Profile | null>(`${FISCAL}/profile`),
  saveProfile: (p: ProfileInput) => request<Profile>(`${FISCAL}/profile`, 'PUT', p),
  calendar,
  setStatus: (key: string, estado: Estado, justificante: string | null) =>
    request<CalendarItem>(`${FISCAL}/obligations/${encodeURIComponent(key)}/status`, 'PUT', {
      estado,
      justificante,
    }),
  deadline: (input: DeadlineInput) => request<DeadlineResult>(`${FISCAL}/deadlines`, 'POST', input),
  invoices: (ejercicio: number) => request<InvoiceList>(`${FISCAL}/invoices?ejercicio=${ejercicio}`),
  addInvoice: (invoice: InvoiceInput) => request<Invoice>(`${FISCAL}/invoices`, 'POST', invoice),
  voidInvoice: async (id: string) => {
    await send(`${FISCAL}/invoices/${encodeURIComponent(id)}/void`, 'POST')
  },
  quarterSummary: (ejercicio: number, trimestre: number) =>
    request<QuarterSummary>(`${FISCAL}/invoices/summary?ejercicio=${ejercicio}&trimestre=${trimestre}`),
  onboarding: () => request<Onboarding>(`${FISCAL}/onboarding`),
  /** Un bloque del historial: los últimos mensajes, o los anteriores a `before`. */
  chatHistory: (before?: number) =>
    request<{ entries: ChatEntry[]; has_more: boolean }>(
      `${FISCAL}/agent/history${before === undefined ? '' : `?before=${before}`}`,
    ),
  appendChat: async (entries: ChatEntry[]) =>
    (
      await request<{ ids: number[] }>(`${FISCAL}/agent/history`, 'POST', {
        entries: entries.map(({ kind, text, files, proposals }) => ({ kind, text, files, proposals })),
      })
    ).ids,
  saveChatProposals: async (id: number, proposals: ChatEntry['proposals']) => {
    await send(`${FISCAL}/agent/history/${id}`, 'PUT', { proposals })
  },
  clearChatHistory: async () => {
    await send(`${FISCAL}/agent/history`, 'DELETE')
  },
  clients: (archivados = false) =>
    request<Client[]>(`${FISCAL}/clients${archivados ? '?archivados=true' : ''}`),
  createClient: (c: ClientInput) => request<Client>(`${FISCAL}/clients`, 'POST', c),
  updateClient: (id: string, c: ClientInput) =>
    request<Client>(`${FISCAL}/clients/${encodeURIComponent(id)}`, 'PUT', c),
  checkVies: (id: string) => request<Client>(`${FISCAL}/clients/${encodeURIComponent(id)}/vies`, 'POST'),
  archiveClient: (id: string, activo = false) =>
    request<Client>(`${FISCAL}/clients/${encodeURIComponent(id)}/archive?activo=${activo}`, 'POST'),
  movementSummary: (tipo: 'gasto' | 'ingreso', personas: string[], meses: number) => {
    const params = new URLSearchParams({ tipo, meses: String(meses) })
    personas.forEach((p) => params.append('persona', p))
    return request<MovementSummary>(`${FISCAL}/movements/summary?${params.toString()}`)
  },
  importMovements: (name: string, data: string) =>
    request<ImportResult>(`${FISCAL}/movements/import`, 'POST', { name, data }),
  documents: () => request<StoredDocument[]>(`${FISCAL}/documents`),
  documentUrl: (id: string) => `${FISCAL}/documents/${encodeURIComponent(id)}`,
  deleteDocument: async (id: string) => {
    await send(`${FISCAL}/documents/${encodeURIComponent(id)}`, 'DELETE')
  },
  agentChat: (message: string, history: ChatTurn[], pagina: string, attachments: ChatAttachment[] = []) =>
    request<AgentReply>(`${FISCAL}/agent/chat`, 'POST', { message, history, pagina, attachments }),
}
