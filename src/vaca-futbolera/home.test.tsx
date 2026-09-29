import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ADMIN, MEMBER, mockApi, renderApp } from './test/helpers'

afterEach(() => vi.unstubAllGlobals())

const inDays = (d: number) => new Date(Date.now() + d * 86400000).toISOString()
const entry = (id: string, name: string) => ({
  player_id: id,
  display_name: name,
  preferred_position: 'MED',
  late_withdrawal: false,
})

function view(overrides: Record<string, unknown> = {}) {
  return {
    match: { id: 'm1', starts_at: inDays(3), signup_closes_at: inDays(2), status: 'open' },
    capacity: 2,
    signup_open: true,
    closes_text: 'el domingo a las 23:59',
    confirmed: [entry('p-ana', 'Ana')],
    waitlist: [],
    my_status: null,
    share_text: '⚽ Fútbol miércoles 30/09 — 19:00',
    ...overrides,
  }
}

describe('pestaña Partido', () => {
  it('sin partido invita a esperar la apertura', async () => {
    mockApi({ 'GET /me': { body: MEMBER }, 'GET /matches/current': { body: { match: null } } })
    renderApp('/vaca-futbolera')
    expect(await screen.findByText(/Todavía no hay partido/)).toBeInTheDocument()
  })

  it('muestra fecha, cuenta regresiva, cupo y convocados; Voy anota al jugador', async () => {
    const calls = mockApi({
      'GET /me': { body: MEMBER },
      'GET /matches/current': { body: view() },
      'POST /matches/m1/signup': {
        body: view({ confirmed: [entry('p-ana', 'Ana'), entry('p-juan', 'Juan')], my_status: 'confirmed' }),
      },
    })
    renderApp('/vaca-futbolera')
    expect(await screen.findByText(/Cierra en 1d|Cierra en 2d/)).toBeInTheDocument()
    expect(screen.getByText('1/2')).toBeInTheDocument()
    expect(screen.getByText('Ana')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Voy' }))
    expect(await screen.findByText('Estás convocado.')).toBeInTheDocument()
    expect(screen.getByText('2/2')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Te anotaste')
    expect(calls.find((c) => c.key === 'POST /matches/m1/signup')?.body).toBeUndefined()
    expect(screen.queryByRole('button', { name: /Sacar/ })).not.toBeInTheDocument()
  })

  it('en lista de espera puede bajarse', async () => {
    mockApi({
      'GET /me': { body: MEMBER },
      'GET /matches/current': {
        body: view({ waitlist: [entry('p-juan', 'Juan')], my_status: 'waitlist' }),
      },
      'POST /matches/m1/withdraw': { body: view() },
    })
    renderApp('/vaca-futbolera')
    expect(await screen.findByText('Estás en lista de espera.')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Lista de espera' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Me bajo' }))
    expect(await screen.findByRole('button', { name: 'Voy' })).toBeInTheDocument()
  })

  it('con la inscripción cerrada, el miembro ve el aviso y no el botón Voy', async () => {
    const closed = view({
      signup_open: false,
      match: { id: 'm1', starts_at: inDays(1), signup_closes_at: inDays(-1), status: 'closed' },
      confirmed: [],
    })
    mockApi({ 'GET /me': { body: MEMBER }, 'GET /matches/current': { body: closed } })
    renderApp('/vaca-futbolera')
    expect(await screen.findByText(/La inscripción cerró el domingo a las 23:59/)).toBeInTheDocument()
    expect(screen.getByText('Inscripción cerrada')).toBeInTheDocument()
    expect(screen.getByText('Todavía no se anotó nadie.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Voy' })).not.toBeInTheDocument()
  })

  it('usuario sin jugador vinculado ve el aviso', async () => {
    mockApi({
      'GET /me': { body: ADMIN },
      'GET /matches/current': { body: view() },
      'GET /players': { body: [] },
    })
    renderApp('/vaca-futbolera')
    expect(await screen.findByText(/no está vinculado a un jugador/)).toBeInTheDocument()
  })

  it('muestra el error del backend', async () => {
    mockApi({
      'GET /me': { body: MEMBER },
      'GET /matches/current': { body: view() },
      'POST /matches/m1/signup': { status: 422, body: { detail: 'Este partido ya no admite cambios.' } },
    })
    renderApp('/vaca-futbolera')
    await userEvent.click(await screen.findByRole('button', { name: 'Voy' }))
    expect(await screen.findByText('Este partido ya no admite cambios.')).toBeInTheDocument()
  })

  it('admin agrega a un jugador y saca a otro', async () => {
    const calls = mockApi({
      'GET /me': { body: ADMIN },
      'GET /matches/current': { body: view() },
      'GET /players': {
        body: [
          { id: 'p-juan', display_name: 'Juan', active: true },
          { id: 'p-ana', display_name: 'Ana', active: true },
          { id: 'p-baja', display_name: 'Baja', active: false },
        ],
      },
      'POST /matches/m1/signup': {
        body: view({ confirmed: [entry('p-ana', 'Ana'), entry('p-juan', 'Juan')] }),
      },
      'POST /matches/m1/withdraw': { body: view({ confirmed: [entry('p-juan', 'Juan')] }) },
    })
    renderApp('/vaca-futbolera')
    const select = await screen.findByLabelText('Agregar jugador al partido')
    expect(within(select).queryByRole('option', { name: 'Ana' })).not.toBeInTheDocument()
    expect(within(select).queryByRole('option', { name: 'Baja' })).not.toBeInTheDocument()
    await userEvent.selectOptions(select, 'Juan')
    await userEvent.click(screen.getByRole('button', { name: 'Agregar' }))
    expect(await screen.findByRole('button', { name: 'Sacar a Juan' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Cargar resultado' })).toHaveAttribute(
      'href',
      '/vaca-futbolera/partidos/m1/resultado',
    )
    expect(calls.find((c) => c.key === 'POST /matches/m1/signup')?.body).toEqual({ player_id: 'p-juan' })
    await userEvent.click(screen.getByRole('button', { name: 'Sacar a Ana' }))
    expect(await screen.findByRole('status')).toHaveTextContent('Ana fuera')
    expect(calls.find((c) => c.key === 'POST /matches/m1/withdraw')?.body).toEqual({ player_id: 'p-ana' })
  })

  it('Compartir por WhatsApp comparte el texto armado en el servidor', async () => {
    const shareFn = vi.fn(async () => undefined)
    vi.stubGlobal('navigator', { ...navigator, share: shareFn })
    mockApi({ 'GET /me': { body: MEMBER }, 'GET /matches/current': { body: view() } })
    renderApp('/vaca-futbolera')
    await userEvent.click(await screen.findByRole('button', { name: 'Compartir por WhatsApp' }))
    expect(shareFn).toHaveBeenCalledWith({ text: '⚽ Fútbol miércoles 30/09 — 19:00' })
  })

  it('si compartir falla lo muestra, y si el usuario cancela no', async () => {
    const shareFn = vi.fn().mockRejectedValueOnce(new DOMException('x', 'AbortError'))
    shareFn.mockRejectedValueOnce(new Error('Sin permiso para compartir'))
    vi.stubGlobal('navigator', { ...navigator, share: shareFn })
    mockApi({ 'GET /me': { body: MEMBER }, 'GET /matches/current': { body: view() } })
    renderApp('/vaca-futbolera')
    const button = await screen.findByRole('button', { name: 'Compartir por WhatsApp' })
    await userEvent.click(button)
    expect(screen.queryByText('Sin permiso para compartir')).not.toBeInTheDocument()
    await userEvent.click(button)
    expect(await screen.findByText('Sin permiso para compartir')).toBeInTheDocument()
  })

  it('admin sin jugadores disponibles no ve el selector', async () => {
    mockApi({
      'GET /me': { body: ADMIN },
      'GET /matches/current': { body: view() },
      'GET /players': { body: [{ id: 'p-ana', display_name: 'Ana', active: true }] },
    })
    renderApp('/vaca-futbolera')
    expect(await screen.findByRole('button', { name: 'Sacar a Ana' })).toBeInTheDocument()
    expect(screen.queryByLabelText('Agregar jugador al partido')).not.toBeInTheDocument()
  })
})
