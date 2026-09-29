import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ADMIN, MEMBER, mockApi, renderApp } from './test/helpers'

afterEach(() => vi.unstubAllGlobals())

const ids = ['a1', 'a2', 'b1', 'b2']
const players = Object.fromEntries(
  ids.map((id, i) => [id, { id, display_name: `J${i}`, preferred_position: 'MED', strength: 25 + i }]),
)
const evaluation = (a: string[], b: string[], cost = 0.1, pa = 51) => ({
  team_a: a,
  team_b: b,
  cost,
  breakdown: { balance: cost, repeat: 0 },
  strength_a: 50,
  strength_b: 49,
  win_pct_a: pa,
  win_pct_b: 100 - pa,
})
const P1 = evaluation(['a1', 'a2'], ['b1', 'b2'])
const P2 = evaluation(['a1', 'b1'], ['a2', 'b2'], 0.2, 49)
const view = (overrides: Record<string, unknown> = {}) => ({
  match: { id: 'm1', starts_at: '2026-09-30T17:00:00Z', status: 'closed' },
  team_names: ['Blancos', 'Negros'],
  players,
  proposals: [P1, P2],
  published: null,
  share_text: null,
  ...overrides,
})
const PATH = '/vaca-futbolera/partidos/m1/equipos'

function first<T>(items: T[]): T {
  const item = items[0]
  if (item === undefined) throw new Error('lista vacía')
  return item
}
const base = { 'GET /me': { body: ADMIN }, 'GET /constraints': { body: [] } }

describe('armar equipos (admin)', () => {
  it('sin propuestas ofrece armar; al armar muestra pestañas, columnas y %', async () => {
    const calls = mockApi({
      ...base,
      'GET /matches/m1/teams': { body: view({ proposals: [] }) },
      'POST /matches/m1/teams/generate': { body: view() },
    })
    renderApp(PATH)
    expect(await screen.findByText(/MIÉ 30 SEP · 19:00H · 4 convocados/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Armar equipos' }))
    expect(await screen.findByRole('tab', { name: 'Propuesta 1' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('button', { name: 'Volver a armar' })).toBeInTheDocument()
    expect(within(screen.getByRole('region', { name: 'Blancos' })).getByText('J0')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Blancos 51%, Negros 49%' })).toBeInTheDocument()
    expect(calls.some((c) => c.key === 'POST /matches/m1/teams/generate')).toBe(true)
  })

  it('cambiar de pestaña muestra otra propuesta', async () => {
    mockApi({ ...base, 'GET /matches/m1/teams': { body: view() } })
    renderApp(PATH)
    await userEvent.click(await screen.findByRole('tab', { name: 'Propuesta 2' }))
    expect(within(screen.getByRole('region', { name: 'Blancos' })).getByText('J2')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Blancos 49%, Negros 51%' })).toBeInTheDocument()
  })

  it('pasar un jugador al otro equipo recalcula y publicar usa los equipos editados', async () => {
    const moved = evaluation(['a2'], ['b1', 'b2', 'a1'], 0.9, 30)
    const calls = mockApi({
      ...base,
      'GET /matches/m1/teams': { body: view() },
      'POST /matches/m1/teams/evaluate': { body: moved },
      'POST /matches/m1/teams/publish': {
        body: view({ published: moved, share_text: '⚽ Fútbol miércoles 30/09 — 19:00' }),
      },
    })
    renderApp(PATH)
    await userEvent.click(first(await screen.findAllByRole('button', { name: 'Pasar a Negros' })))
    expect(await screen.findByRole('img', { name: 'Blancos 30%, Negros 70%' })).toBeInTheDocument()
    expect(calls.find((c) => c.key === 'POST /matches/m1/teams/evaluate')?.body).toEqual({
      team_a: ['a2'],
      team_b: ['b1', 'b2', 'a1'],
    })
    await userEvent.click(screen.getByRole('button', { name: 'Publicar equipos' }))
    expect(await screen.findByRole('heading', { name: 'Equipos publicados' })).toBeInTheDocument()
    const sheet = screen.getByRole('group', { name: 'Blancos contra Negros' })
    expect(sheet).not.toHaveTextContent('%') // la imagen que se comparte no lleva %
    expect(screen.getAllByRole('img', { name: 'Blancos 30%, Negros 70%' })).toHaveLength(2) // editor + publicados (admin)
    expect(calls.find((c) => c.key === 'POST /matches/m1/teams/publish')?.body).toEqual({
      team_a: ['a2'],
      team_b: ['b1', 'b2', 'a1'],
    })
  })

  it('no deja un equipo vacío y muestra los errores del backend', async () => {
    const one = evaluation(['a1'], ['a2', 'b1', 'b2'])
    const calls = mockApi({
      ...base,
      'GET /matches/m1/teams': { body: view({ proposals: [one] }) },
      'POST /matches/m1/teams/publish': {
        status: 422,
        body: { detail: 'Este partido ya no admite cambios.' },
      },
      'POST /matches/m1/teams/evaluate': { status: 500, body: { detail: 'falló evaluar' } },
    })
    renderApp(PATH)
    const blancos = await screen.findByRole('region', { name: 'Blancos' })
    await userEvent.click(within(blancos).getByRole('button', { name: 'Pasar a Negros' }))
    expect(calls.some((c) => c.key === 'POST /matches/m1/teams/evaluate')).toBe(false)
    await userEvent.click(
      first(within(screen.getByRole('region', { name: 'Negros' })).getAllByRole('button')),
    )
    expect(await screen.findByText('falló evaluar')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Publicar equipos' }))
    expect(await screen.findByText('Este partido ya no admite cambios.')).toBeInTheDocument()
  })

  it('errores al cargar y al armar', async () => {
    mockApi({
      ...base,
      'GET /matches/m1/teams': { body: view({ proposals: [] }) },
      'POST /matches/m1/teams/generate': {
        status: 422,
        body: { detail: 'Hacen falta al menos 4 convocados' },
      },
    })
    renderApp(PATH)
    await userEvent.click(await screen.findByRole('button', { name: 'Armar equipos' }))
    expect(await screen.findByText(/al menos 4 convocados/)).toBeInTheDocument()
    mockApi({ ...base, 'GET /matches/m1/teams': { status: 404, body: { detail: 'Partido no encontrado.' } } })
    renderApp(PATH)
    expect(await screen.findByText('Partido no encontrado.')).toBeInTheDocument()
  })

  it('restricciones: listar, agregar y quitar', async () => {
    let list = [{ id: 'c1', player_a: 'a1', player_b: 'b1', kind: 'apart' }]
    const calls = mockApi({
      'GET /me': { body: ADMIN },
      'GET /matches/m1/teams': { body: view() },
      'GET /constraints': () => ({ body: list }),
      'POST /constraints': () => {
        list = [...list, { id: 'c2', player_a: 'a2', player_b: 'b2', kind: 'together' }]
        return { status: 201, body: {} }
      },
      'DELETE /constraints/c1': () => {
        list = list.filter((c) => c.id !== 'c1')
        return { status: 204 }
      },
    })
    renderApp(PATH)
    await userEvent.click(await screen.findByText('Restricciones (1)'))
    expect(screen.getByText(/J0 y J2: nunca juntos/)).toBeInTheDocument()
    await userEvent.selectOptions(screen.getByLabelText('Primer jugador'), 'J1')
    await userEvent.selectOptions(screen.getByLabelText('Segundo jugador'), 'J3')
    await userEvent.selectOptions(screen.getByLabelText('Tipo de restricción'), 'Siempre juntos')
    await userEvent.click(screen.getByRole('button', { name: 'Agregar restricción' }))
    expect(await screen.findByText(/J1 y J3: siempre juntos/)).toBeInTheDocument()
    expect(calls.find((c) => c.key === 'POST /constraints')?.body).toEqual({
      player_a: 'a2',
      player_b: 'b2',
      kind: 'together',
    })
    await userEvent.click(first(screen.getAllByRole('button', { name: 'Quitar' })))
    expect(await screen.findByText('Restricciones (1)')).toBeInTheDocument()
  })

  it('error al agregar una restricción', async () => {
    mockApi({
      ...base,
      'GET /matches/m1/teams': { body: view() },
      'POST /constraints': {
        status: 422,
        body: { detail: 'Ya hay una restricción entre esos dos jugadores.' },
      },
    })
    renderApp(PATH)
    await userEvent.click(await screen.findByText('Restricciones (0)'))
    await userEvent.selectOptions(screen.getByLabelText('Primer jugador'), 'J0')
    await userEvent.selectOptions(screen.getByLabelText('Segundo jugador'), 'J1')
    await userEvent.click(screen.getByRole('button', { name: 'Agregar restricción' }))
    expect(await screen.findByText(/Ya hay una restricción/)).toBeInTheDocument()
  })
})

describe('pestaña Partido con equipos publicados', () => {
  const match = {
    match: {
      id: 'm1',
      starts_at: '2026-09-30T17:00:00Z',
      signup_closes_at: '2026-09-29T21:59:00Z',
      status: 'teams_published',
    },
    capacity: 12,
    signup_open: false,
    closes_text: 'el martes a las 23:59',
    confirmed: [],
    waitlist: [],
    my_status: null,
    share_text: 'x',
  }

  it('todos ven la tarjeta VS; el admin además el link para armar equipos', async () => {
    mockApi({
      'GET /me': { body: MEMBER },
      'GET /matches/current': { body: match },
      'GET /matches/m1/teams': { body: view({ proposals: [], published: P1, share_text: '⚽ equipos' }) },
    })
    renderApp('/vaca-futbolera')
    const sheet = await screen.findByRole('group', { name: 'Blancos contra Negros' })
    expect(sheet).not.toHaveTextContent('%')
    expect(screen.queryByRole('img', { name: /Blancos \d+%/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Armar equipos' })).not.toBeInTheDocument()
  })

  it('sin publicar no muestra nada; con error lo avisa', async () => {
    mockApi({
      'GET /me': { body: ADMIN },
      'GET /players': { body: [] },
      'GET /matches/current': { body: match },
      'GET /matches/m1/teams': { status: 500, body: { detail: 'sin equipos' } },
    })
    renderApp('/vaca-futbolera')
    expect(await screen.findByText('sin equipos')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Armar equipos' })).toHaveAttribute(
      'href',
      '/vaca-futbolera/partidos/m1/equipos',
    )
  })

  it('publicado pero sin datos todavía: no muestra la tarjeta', async () => {
    mockApi({
      'GET /me': { body: MEMBER },
      'GET /matches/current': { body: match },
      'GET /matches/m1/teams': { body: view({ proposals: [], published: null }) },
    })
    renderApp('/vaca-futbolera')
    expect(await screen.findByText('0/12')).toBeInTheDocument()
    expect(screen.queryByRole('group', { name: 'Blancos contra Negros' })).not.toBeInTheDocument()
  })
})
