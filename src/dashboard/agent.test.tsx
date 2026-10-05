import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { calendar, item, mockApi, PEDRO, PROFILE, renderApp } from './test/helpers'

afterEach(() => vi.unstubAllGlobals())

const OVERDUE = item({ key: '303-2026-2T', titulo: 'IVA 2T 2026', vence: '2026-07-20', aviso: 'vencida' })
const BASE = { 'GET /auth/me': { body: PEDRO }, 'GET /fiscal/calendar': { body: calendar([OVERDUE]) } }
const STATUS_PROPOSAL = {
  id: 'p1',
  kind: 'status',
  titulo: 'IVA 2T 2026',
  detalle: ['estado: pendiente → presentado', 'justificante: CSV-9'],
  payload: { key: '303-2026-2T', estado: 'presentado', justificante: 'CSV-9' },
}
const PROFILE_INPUT = Object.fromEntries(Object.entries(PROFILE).filter(([k]) => k !== 'version'))
const PROFILE_PROPOSAL = {
  id: 'p2',
  kind: 'profile',
  titulo: 'Actualizar perfil fiscal',
  detalle: ['roi: true → false'],
  payload: { ...PROFILE_INPUT, roi: false },
}

async function openChat() {
  await userEvent.click(await screen.findByRole('button', { name: 'NEO' }))
  return screen.getByRole('region', { name: 'NEO, asistente fiscal' })
}

async function ask(text: string) {
  await userEvent.type(screen.getByLabelText('Mensaje para NEO'), text)
  await userEvent.click(screen.getByRole('button', { name: 'Enviar' }))
}

describe('asistente', () => {
  it('arranca cerrado, se abre abajo a la derecha y se puede cerrar', async () => {
    mockApi(BASE)
    renderApp('/dashboard/impuestos')
    expect(await screen.findByRole('button', { name: 'NEO' })).toHaveAttribute('aria-expanded', 'false')
    const chat = await openChat()
    expect(within(chat).getByText(/Yo propongo; vos decidís/)).toBeInTheDocument()
    expect(within(chat).getByRole('button', { name: 'Enviar' })).toBeDisabled()
    await userEvent.click(within(chat).getByRole('button', { name: 'Cerrar' }))
    expect(screen.queryByRole('region', { name: 'NEO, asistente fiscal' })).not.toBeInTheDocument()
  })

  it('no aparece sin sesión', async () => {
    mockApi({ 'GET /auth/me': { status: 401, body: { detail: 'Iniciá sesión.' } } })
    renderApp('/dashboard/impuestos')
    await screen.findByRole('heading', { name: 'Entrar al dashboard' })
    expect(screen.queryByRole('button', { name: 'NEO' })).not.toBeInTheDocument()
  })

  it('pregunta y respuesta: manda la página abierta y el historial en el segundo turno', async () => {
    const calls = mockApi({
      ...BASE,
      'POST /fiscal/agent/chat': (body) => ({
        body: { reply: `Respuesta a: ${(body as { message: string }).message}`, proposals: [] },
      }),
    })
    renderApp('/dashboard/impuestos')
    const chat = await openChat()
    await ask('¿qué vence?')
    expect(await within(chat).findByText('Respuesta a: ¿qué vence?')).toBeInTheDocument()
    expect(screen.getByLabelText('Mensaje para NEO')).toHaveValue('')

    await userEvent.type(screen.getByLabelText('Mensaje para NEO'), '¿y después?{Enter}')
    expect(await within(chat).findByText('Respuesta a: ¿y después?')).toBeInTheDocument()
    const sent = calls.filter((c) => c.key === 'POST /fiscal/agent/chat').map((c) => c.body)
    expect(sent[0]).toEqual({
      message: '¿qué vence?',
      history: [],
      pagina: '/dashboard/impuestos',
      attachments: [],
    })
    expect(sent[1]).toEqual({
      message: '¿y después?',
      history: [
        { role: 'user', text: '¿qué vence?' },
        { role: 'assistant', text: 'Respuesta a: ¿qué vence?' },
      ],
      pagina: '/dashboard/impuestos',
      attachments: [],
    })
  })

  it('Shift+Enter no envía; las sugerencias sí', async () => {
    const calls = mockApi({ ...BASE, 'POST /fiscal/agent/chat': { body: { reply: 'ok', proposals: [] } } })
    renderApp('/dashboard/impuestos')
    const chat = await openChat()
    await userEvent.type(screen.getByLabelText('Mensaje para NEO'), 'hola{Shift>}{Enter}{/Shift}')
    expect(calls.some((c) => c.key === 'POST /fiscal/agent/chat')).toBe(false)
    await userEvent.clear(screen.getByLabelText('Mensaje para NEO'))
    await userEvent.click(within(chat).getByRole('button', { name: '¿Qué me vence primero?' }))
    expect(await within(chat).findByText('ok')).toBeInTheDocument()
    expect(calls.find((c) => c.key === 'POST /fiscal/agent/chat')?.body).toMatchObject({
      message: '¿Qué me vence primero?',
    })
  })

  it('si el agente falla muestra el error y deja reintentar', async () => {
    mockApi({
      ...BASE,
      'POST /fiscal/agent/chat': { status: 503, body: { detail: 'El agente está saturado.' } },
    })
    renderApp('/dashboard/impuestos')
    const chat = await openChat()
    await ask('hola')
    expect(await within(chat).findByRole('alert')).toHaveTextContent('El agente está saturado.')
    expect(within(chat).getByText('hola')).toBeInTheDocument()
  })

  it('una propuesta no cambia nada hasta que la persona toca Guardar; después refresca el dashboard', async () => {
    let saved = false
    const calls = mockApi({
      'GET /auth/me': { body: PEDRO },
      'GET /fiscal/calendar': () => ({
        body: calendar([
          saved ? { ...OVERDUE, estado: 'presentado', justificante: 'CSV-9', aviso: 'sin_aviso' } : OVERDUE,
        ]),
      }),
      'POST /fiscal/agent/chat': { body: { reply: 'Te dejé la propuesta.', proposals: [STATUS_PROPOSAL] } },
      'PUT /fiscal/obligations/303-2026-2T/status': () => {
        saved = true
        return { body: OVERDUE }
      },
    })
    renderApp('/dashboard/impuestos')
    const chat = await openChat()
    await ask('presenté el 303 2T')
    const card = await within(chat).findByRole('region', { name: 'Propuesta: IVA 2T 2026' })
    expect(within(card).getByText('estado: pendiente → presentado')).toBeInTheDocument()
    expect(within(card).getByText('Sin guardar')).toBeInTheDocument()
    expect(calls.some((c) => c.key.startsWith('PUT'))).toBe(false)
    expect(
      within(screen.getByRole('region', { name: 'Vencidas' })).getByText('IVA 2T 2026'),
    ).toBeInTheDocument()

    await userEvent.click(within(card).getByRole('button', { name: 'Guardar' }))
    expect(await within(card).findByText('Guardada')).toBeInTheDocument()
    expect(within(card).queryByRole('button', { name: 'Guardar' })).not.toBeInTheDocument()
    expect(calls.find((c) => c.key.startsWith('PUT'))?.body).toEqual({
      estado: 'presentado',
      justificante: 'CSV-9',
    })
    // El calendario se recargó solo y la obligación pasó a cerradas.
    const closed = await screen.findByRole('region', { name: 'Cerradas' })
    expect(await within(closed).findByText('IVA 2T 2026')).toBeInTheDocument()
    expect(within(chat).getByText('Guardé la propuesta: IVA 2T 2026')).toBeInTheDocument()
  })

  it('una propuesta de perfil se guarda con el perfil completo', async () => {
    const calls = mockApi({
      ...BASE,
      'POST /fiscal/agent/chat': { body: { reply: 'Listo.', proposals: [PROFILE_PROPOSAL] } },
      'PUT /fiscal/profile': (body) => ({ body: { ...(body as object), version: 2 } }),
    })
    renderApp('/dashboard/impuestos')
    const chat = await openChat()
    await ask('ya no tengo ROI')
    const card = await within(chat).findByRole('region', { name: 'Propuesta: Actualizar perfil fiscal' })
    await userEvent.click(within(card).getByRole('button', { name: 'Guardar' }))
    expect(await within(card).findByText('Guardada')).toBeInTheDocument()
    expect(calls.find((c) => c.key === 'PUT /fiscal/profile')?.body).toEqual({ ...PROFILE_INPUT, roi: false })
  })

  it('si guardar falla, la propuesta sigue pendiente con el error', async () => {
    mockApi({
      ...BASE,
      'POST /fiscal/agent/chat': { body: { reply: 'Listo.', proposals: [STATUS_PROPOSAL] } },
      'PUT /fiscal/obligations/303-2026-2T/status': { status: 422, body: { detail: 'Estado desconocido.' } },
    })
    renderApp('/dashboard/impuestos')
    const chat = await openChat()
    await ask('x')
    const card = await within(chat).findByRole('region', { name: 'Propuesta: IVA 2T 2026' })
    await userEvent.click(within(card).getByRole('button', { name: 'Guardar' }))
    expect(await within(card).findByRole('alert')).toHaveTextContent('Estado desconocido.')
    expect(within(card).getByRole('button', { name: 'Guardar' })).toBeEnabled()
    expect(within(chat).queryByText(/Guardé la propuesta/)).not.toBeInTheDocument()
  })

  it('Rehacer descarta la propuesta y deja escrito el pedido para corregirla', async () => {
    const calls = mockApi({
      ...BASE,
      'POST /fiscal/agent/chat': { body: { reply: 'Listo.', proposals: [STATUS_PROPOSAL] } },
    })
    renderApp('/dashboard/impuestos')
    const chat = await openChat()
    await ask('x')
    const card = await within(chat).findByRole('region', { name: 'Propuesta: IVA 2T 2026' })
    await userEvent.click(within(card).getByRole('button', { name: 'Rehacer' }))
    expect(within(card).getByText('Descartada')).toBeInTheDocument()
    expect(within(card).queryByRole('button', { name: 'Guardar' })).not.toBeInTheDocument()
    const input = screen.getByLabelText('Mensaje para NEO')
    expect(input).toHaveValue('Rehacé la propuesta «IVA 2T 2026»: ')
    expect(input).toHaveFocus()
    await userEvent.type(input, 'el CSV es CSV-10{Enter}')
    await waitFor(() => expect(calls.filter((c) => c.key === 'POST /fiscal/agent/chat')).toHaveLength(2))
    expect(calls.filter((c) => c.key === 'POST /fiscal/agent/chat')[1]?.body).toEqual({
      message: 'Rehacé la propuesta «IVA 2T 2026»: el CSV es CSV-10',
      history: [
        { role: 'user', text: 'x' },
        { role: 'assistant', text: 'Listo.\n[Propuesta mostrada: IVA 2T 2026]' },
      ],
      pagina: '/dashboard/impuestos',
      attachments: [],
    })
    expect(calls.some((c) => c.key.startsWith('PUT'))).toBe(false)
  })

  it('Descartar no guarda y se lo cuenta al agente en el turno siguiente', async () => {
    const calls = mockApi({
      ...BASE,
      'POST /fiscal/agent/chat': { body: { reply: 'Listo.', proposals: [STATUS_PROPOSAL] } },
    })
    renderApp('/dashboard/impuestos')
    const chat = await openChat()
    await ask('x')
    const card = await within(chat).findByRole('region', { name: 'Propuesta: IVA 2T 2026' })
    await userEvent.click(within(card).getByRole('button', { name: 'Descartar' }))
    expect(within(card).getByText('Descartada')).toBeInTheDocument()
    expect(within(chat).getByText('Descarté la propuesta: IVA 2T 2026')).toBeInTheDocument()
    await ask('otra cosa')
    await waitFor(() => expect(calls.filter((c) => c.key === 'POST /fiscal/agent/chat')).toHaveLength(2))
    const history = (
      calls.filter((c) => c.key === 'POST /fiscal/agent/chat')[1]?.body as { history: unknown[] }
    ).history
    expect(history[2]).toEqual({ role: 'user', text: '[Descarté la propuesta: IVA 2T 2026]' })
    expect(calls.some((c) => c.key.startsWith('PUT'))).toBe(false)
  })
})
