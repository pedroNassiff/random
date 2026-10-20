import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { calendar, mockApi, PEDRO, renderApp } from './test/helpers'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  localStorage.clear()
})

const BASE = { 'GET /auth/me': { body: PEDRO }, 'GET /fiscal/calendar': { body: calendar([]) } }
const proposal = (status: string) => ({
  proposal: { id: 'p1', kind: 'status', titulo: 'IVA 2T 2026', detalle: ['estado: a → b'], payload: {} },
  status,
  error: null,
})
const STORED = [
  { id: 40, kind: 'user', text: '¿qué vence?', files: ['036.pdf'], proposals: [] },
  { id: 41, kind: 'assistant', text: 'El 303 del 3T.', files: [], proposals: [proposal('pendiente')] },
]
const page = (entries: unknown[], has_more = false) => ({ body: { entries, has_more } })
const posted = (calls: { key: string; body: unknown }[]) =>
  calls
    .filter((c) => c.key === 'POST /fiscal/agent/history')
    .flatMap((c) => (c.body as { entries: { kind: string; text: string }[] }).entries)

async function openChat() {
  await userEvent.click(await screen.findByRole('button', { name: 'NEO' }))
  return screen.getByRole('region', { name: 'NEO, asistente fiscal' })
}

describe('historial de NEO', () => {
  it('al entrar muestra el último bloque de la conversación, lo más reciente abajo', async () => {
    const calls = mockApi({ ...BASE, 'GET /fiscal/agent/history': page(STORED) })
    renderApp('/dashboard/impuestos')
    const chat = await openChat()
    expect(await within(chat).findByText('¿qué vence?')).toBeInTheDocument()
    expect(within(chat).getByText('Adjunto: 036.pdf')).toBeInTheDocument()
    const texts = within(chat)
      .getAllByText(/qué vence|El 303/)
      .map((n) => n.textContent)
    expect(texts).toEqual(['¿qué vence?', 'El 303 del 3T.'])
    const card = within(chat).getByRole('region', { name: 'Propuesta: IVA 2T 2026' })
    expect(within(card).getByRole('button', { name: 'Guardar' })).toBeInTheDocument()
    expect(within(chat).queryByText(/Yo propongo; vos decidís/)).not.toBeInTheDocument()
    expect(within(chat).queryByRole('button', { name: 'Ver mensajes anteriores' })).not.toBeInTheDocument()
    expect(calls.some((c) => c.key.startsWith('POST') || c.key.startsWith('PUT'))).toBe(false)
  })

  it('trae los mensajes anteriores por bloques, con el botón o al hacer scroll hasta arriba', async () => {
    const calls = mockApi({
      ...BASE,
      'GET /fiscal/agent/history': page(STORED, true),
      'GET /fiscal/agent/history?before=40': page(
        [{ id: 20, kind: 'user', text: 'mensaje del medio', files: [], proposals: [] }],
        true,
      ),
      'GET /fiscal/agent/history?before=20': page(
        [{ id: 3, kind: 'user', text: 'el primero de todos', files: [], proposals: [] }],
        false,
      ),
    })
    renderApp('/dashboard/impuestos')
    const chat = await openChat()
    await within(chat).findByText('¿qué vence?')
    expect(within(chat).queryByText('mensaje del medio')).not.toBeInTheDocument()

    await userEvent.click(within(chat).getByRole('button', { name: 'Ver mensajes anteriores' }))
    expect(await within(chat).findByText('mensaje del medio')).toBeInTheDocument()

    fireEvent.scroll(within(chat).getByRole('log'), { target: { scrollTop: 0 } })
    expect(await within(chat).findByText('el primero de todos')).toBeInTheDocument()
    const texts = within(chat)
      .getAllByText(/primero de todos|del medio|qué vence/)
      .map((n) => n.textContent)
    expect(texts).toEqual(['el primero de todos', 'mensaje del medio', '¿qué vence?'])
    // Ya no queda nada más viejo: desaparece el botón y el scroll no vuelve a pedir.
    expect(within(chat).queryByRole('button', { name: 'Ver mensajes anteriores' })).not.toBeInTheDocument()
    fireEvent.scroll(within(chat).getByRole('log'), { target: { scrollTop: 0 } })
    expect(calls.filter((c) => c.key.startsWith('GET /fiscal/agent/history'))).toHaveLength(3)
  })

  it('si falla la carga de un bloque viejo, se puede reintentar', async () => {
    mockApi({
      ...BASE,
      'GET /fiscal/agent/history': page(STORED, true),
      'GET /fiscal/agent/history?before=40': { status: 500, body: { detail: 'Se cayó la base.' } },
    })
    renderApp('/dashboard/impuestos')
    const chat = await openChat()
    await userEvent.click(await within(chat).findByRole('button', { name: 'Ver mensajes anteriores' }))
    await waitFor(() =>
      expect(within(chat).getByRole('button', { name: 'Ver mensajes anteriores' })).toBeEnabled(),
    )
    expect(within(chat).getByText('¿qué vence?')).toBeInTheDocument()
  })

  it('guarda cada mensaje al momento y manda el historial a NEO en el turno siguiente', async () => {
    let next = 50
    const calls = mockApi({
      ...BASE,
      'GET /fiscal/agent/history': page(STORED),
      'POST /fiscal/agent/history': (body) => ({
        status: 201,
        body: { ids: (body as { entries: unknown[] }).entries.map(() => next++) },
      }),
      'POST /fiscal/agent/chat': { body: { reply: 'Hasta el 20/10.', proposals: [] } },
    })
    renderApp('/dashboard/impuestos')
    const chat = await openChat()
    await within(chat).findByText('¿qué vence?')
    await userEvent.type(within(chat).getByLabelText('Mensaje para NEO'), '¿hasta cuándo?{Enter}')
    expect(await within(chat).findByText('Hasta el 20/10.')).toBeInTheDocument()
    await waitFor(() =>
      expect(posted(calls)).toEqual([
        { kind: 'user', text: '¿hasta cuándo?', files: [], proposals: [] },
        { kind: 'assistant', text: 'Hasta el 20/10.', files: [], proposals: [] },
      ]),
    )
    const sent = calls.find((c) => c.key === 'POST /fiscal/agent/chat')?.body as {
      history: { text: string }[]
    }
    expect(sent.history.map((h) => h.text)).toEqual([
      '¿qué vence?\n[Adjunto: 036.pdf]',
      'El 303 del 3T.\n[Propuesta mostrada: IVA 2T 2026]',
    ])
  })

  it('el estado de una propuesta (guardada o descartada) queda guardado en su mensaje', async () => {
    const calls = mockApi({
      ...BASE,
      'GET /fiscal/agent/history': page(STORED),
      'POST /fiscal/agent/history': { status: 201, body: { ids: [60] } },
      'PUT /fiscal/agent/history/41': { status: 204 },
    })
    renderApp('/dashboard/impuestos')
    const chat = await openChat()
    const card = await within(chat).findByRole('region', { name: 'Propuesta: IVA 2T 2026' })
    await userEvent.click(within(card).getByRole('button', { name: 'Descartar' }))
    expect(within(card).getByText('Descartada')).toBeInTheDocument()
    await waitFor(() =>
      expect(calls.find((c) => c.key === 'PUT /fiscal/agent/history/41')?.body).toEqual({
        proposals: [proposal('descartada')],
      }),
    )
    await waitFor(() =>
      expect(posted(calls)).toEqual([
        { kind: 'event', text: 'Descarté la propuesta: IVA 2T 2026', files: [], proposals: [] },
      ]),
    )
  })

  it('una propuesta resuelta antes de terminar de guardarse el mensaje también queda registrada', async () => {
    let release: (() => void) | undefined
    const gate = new Promise<void>((resolve) => (release = resolve))
    let nextId = 70
    const calls = mockApi({
      ...BASE,
      'GET /fiscal/agent/history': page([]),
      'POST /fiscal/agent/chat': { body: { reply: 'Listo.', proposals: [proposal('pendiente').proposal] } },
      'PUT /fiscal/agent/history/71': { status: 204 },
    })
    // El alta del mensaje de NEO (el segundo) tarda: mientras tanto la persona descarta la propuesta.
    const base = vi.mocked(fetch).getMockImplementation()
    if (!base) throw new Error('falta el mock de fetch')
    vi.mocked(fetch).mockImplementation(async (url, init) => {
      if (String(url) !== '/api/fiscal/agent/history' || init?.method !== 'POST') return base(url, init)
      const id = nextId++
      if (id === 71) await gate
      return new Response(JSON.stringify({ ids: [id] }), { status: 201 })
    })
    renderApp('/dashboard/impuestos')
    const chat = await openChat()
    await userEvent.type(within(chat).getByLabelText('Mensaje para NEO'), 'x{Enter}')
    const card = await within(chat).findByRole('region', { name: 'Propuesta: IVA 2T 2026' })
    await userEvent.click(within(card).getByRole('button', { name: 'Descartar' }))
    expect(calls.some((c) => c.key.startsWith('PUT'))).toBe(false)
    release?.()
    await waitFor(() =>
      expect(calls.find((c) => c.key === 'PUT /fiscal/agent/history/71')?.body).toEqual({
        proposals: [proposal('descartada')],
      }),
    )
  })

  it('borrar la conversación pide confirmación y la borra también en el servidor', async () => {
    const calls = mockApi({
      ...BASE,
      'GET /fiscal/agent/history': page(STORED, true),
      'DELETE /fiscal/agent/history': { status: 204 },
    })
    renderApp('/dashboard/impuestos')
    const chat = await openChat()
    await within(chat).findByText('¿qué vence?')
    await userEvent.click(within(chat).getByRole('button', { name: 'Borrar conversación' }))
    expect(calls.some((c) => c.key.startsWith('DELETE'))).toBe(false)
    await userEvent.click(within(chat).getByRole('button', { name: 'Confirmar: borrar todo' }))
    expect(within(chat).queryByText('¿qué vence?')).not.toBeInTheDocument()
    expect(within(chat).getByText(/Yo propongo; vos decidís/)).toBeInTheDocument()
    expect(calls.filter((c) => c.key === 'DELETE /fiscal/agent/history')).toHaveLength(1)
    expect(within(chat).queryByRole('button', { name: 'Ver mensajes anteriores' })).not.toBeInTheDocument()
    expect(within(chat).queryByRole('button', { name: 'Borrar conversación' })).not.toBeInTheDocument()
  })

  it('si no se pudo cargar el historial, no guarda nada para no dejarlo a medias', async () => {
    const calls = mockApi({
      ...BASE,
      'GET /fiscal/agent/history': { status: 500, body: { detail: 'Se cayó la base.' } },
      'POST /fiscal/agent/chat': { body: { reply: 'ok', proposals: [proposal('pendiente').proposal] } },
    })
    renderApp('/dashboard/impuestos')
    const chat = await openChat()
    await userEvent.type(within(chat).getByLabelText('Mensaje para NEO'), 'hola{Enter}')
    const card = await within(chat).findByRole('region', { name: 'Propuesta: IVA 2T 2026' })
    await userEvent.click(within(card).getByRole('button', { name: 'Descartar' }))
    await userEvent.click(within(chat).getByRole('button', { name: 'Borrar conversación' }))
    await userEvent.click(within(chat).getByRole('button', { name: 'Confirmar: borrar todo' }))
    expect(calls.filter((c) => /^(POST|PUT|DELETE) \/fiscal\/agent\/history/.test(c.key))).toEqual([])
  })
})

describe('tamaño de la ventana de NEO', () => {
  const size = (chat: HTMLElement) => [
    chat.style.getPropertyValue('--neo-w'),
    chat.style.getPropertyValue('--neo-h'),
  ]

  it('arranca en el tamaño por defecto y se agranda con las flechas, recordándolo', async () => {
    mockApi(BASE)
    const first = renderApp('/dashboard/impuestos')
    const chat = await openChat()
    expect(size(chat)).toEqual(['380px', '560px'])
    const handle = within(chat).getByRole('button', { name: /Cambiar el tamaño de NEO/ })
    handle.focus()
    await userEvent.keyboard('{ArrowLeft}{ArrowLeft}{ArrowUp}')
    expect(size(chat)).toEqual(['428px', '584px'])
    await userEvent.keyboard('{ArrowRight}{ArrowDown}{Enter}')
    expect(size(chat)).toEqual(['404px', '560px'])
    expect(JSON.parse(localStorage.getItem('rdash:neo-tamano') ?? '{}')).toEqual({ width: 404, height: 560 })

    first.unmount()
    renderApp('/dashboard/impuestos')
    expect(size(await openChat())[0]).toBe('404px')
  })

  it('se arrastra desde la esquina: hacia arriba y a la izquierda crece, con mínimo y máximo', async () => {
    mockApi(BASE)
    renderApp('/dashboard/impuestos')
    const chat = await openChat()
    const handle = within(chat).getByRole('button', { name: /Cambiar el tamaño de NEO/ })
    fireEvent.pointerDown(handle, { clientX: 500, clientY: 300 })
    fireEvent.pointerMove(window, { clientX: 400, clientY: 250 })
    expect(size(chat)).toEqual(['480px', '610px'])
    fireEvent.pointerMove(window, { clientX: 5000, clientY: 5000 })
    expect(size(chat)).toEqual(['320px', '360px'])
    fireEvent.pointerMove(window, { clientX: -5000, clientY: -5000 })
    expect(size(chat)).toEqual(['1000px', '1200px'])
    fireEvent.pointerUp(window)
    fireEvent.pointerMove(window, { clientX: 400, clientY: 250 })
    expect(size(chat)[0]).toBe('1000px') // al soltar deja de seguir al puntero
  })

  it('ignora un tamaño guardado corrupto y funciona con el almacenamiento bloqueado', async () => {
    localStorage.setItem('rdash:neo-tamano', '{"width":"ancho"}')
    mockApi(BASE)
    const first = renderApp('/dashboard/impuestos')
    expect(size(await openChat())[0]).toBe('380px')
    first.unmount()

    const blocked = () => {
      throw new Error('bloqueado')
    }
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(blocked)
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(blocked)
    renderApp('/dashboard/impuestos')
    const chat = await openChat()
    within(chat)
      .getByRole('button', { name: /Cambiar el tamaño de NEO/ })
      .focus()
    await userEvent.keyboard('{ArrowUp}')
    expect(size(chat)[1]).toBe('584px')
  })
})
