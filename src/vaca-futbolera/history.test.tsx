import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ADMIN, MEMBER, mockApi, renderApp } from './test/helpers'

afterEach(() => vi.unstubAllGlobals())

const p = (id: string, name: string, goals: number | null = null) => ({
  id,
  display_name: name,
  preferred_position: 'MED',
  goals,
})
const entry = (id: string, a: number, b: number, close: boolean, notes = '') => ({
  match: { id, starts_at: '2026-09-30T17:00:00Z', status: 'played' },
  result: { goals_a: a, goals_b: b, notes },
  close,
  team_a: [p('p1', 'Ana', 3), p('p2', 'Beto')],
  team_b: [p('p3', 'Caro', 1)],
})
const history = (matches: unknown[]) => ({ team_names: ['Blancos', 'Negros'], matches })

describe('pestaña Partidos', () => {
  it('está en el menú y muestra tarjetas con resultado, Parejo y notas', async () => {
    mockApi({
      'GET /me': { body: MEMBER },
      'GET /matches/current': { body: { match: null } },
      'GET /matches/history': {
        body: history([entry('m1', 5, 4, true, 'golazo'), entry('m2', 9, 1, false)]),
      },
    })
    renderApp('/vaca-futbolera')
    await userEvent.click(await screen.findByRole('link', { name: 'Partidos' }))
    expect(await screen.findByRole('heading', { name: 'Blancos 5 – 4 Negros' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Blancos 9 – 1 Negros' })).toBeInTheDocument()
    expect(screen.getAllByText('Parejo')).toHaveLength(1)
    expect(screen.getByText('golazo')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Editar resultado' })).not.toBeInTheDocument()
  })

  it('el desplegable muestra quién jugó en cada equipo', async () => {
    mockApi({
      'GET /me': { body: MEMBER },
      'GET /matches/history': { body: history([entry('m1', 2, 2, true)]) },
    })
    renderApp('/vaca-futbolera/partidos')
    const toggle = await screen.findByRole('button', { name: 'Ver equipos' })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    await userEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(toggle).toHaveTextContent('Ocultar equipos')
    expect(within(screen.getByRole('region', { name: 'Blancos' })).getByText('Beto')).toBeInTheDocument()
    expect(within(screen.getByRole('region', { name: 'Negros' })).getByText('Caro')).toBeInTheDocument()
    expect(screen.getByLabelText('3 goles')).toHaveTextContent('⚽ 3')
    expect(screen.getByLabelText('1 gol')).toBeInTheDocument()
    expect(screen.getAllByText(/⚽/)).toHaveLength(2) // Beto no tiene goles cargados
  })

  it('vacío y error', async () => {
    mockApi({ 'GET /me': { body: MEMBER }, 'GET /matches/history': { body: history([]) } })
    renderApp('/vaca-futbolera/partidos')
    expect(await screen.findByText(/Todavía no hay partidos jugados/)).toBeInTheDocument()
    mockApi({
      'GET /me': { body: MEMBER },
      'GET /matches/history': { status: 500, body: { detail: 'DB caída' } },
    })
    renderApp('/vaca-futbolera/partidos')
    expect(await screen.findByText('DB caída')).toBeInTheDocument()
  })

  it('el admin puede editar el resultado', async () => {
    mockApi({
      'GET /me': { body: ADMIN },
      'GET /matches/history': { body: history([entry('m1', 1, 0, true)]) },
    })
    renderApp('/vaca-futbolera/partidos')
    expect(await screen.findByRole('link', { name: 'Editar resultado' })).toHaveAttribute(
      'href',
      '/vaca-futbolera/partidos/m1/resultado',
    )
  })
})

const form = (overrides: Record<string, unknown> = {}) => ({
  match: { id: 'm1', starts_at: '2026-09-30T17:00:00Z', status: 'teams_published' },
  team_names: ['Blancos', 'Negros'],
  team_a: [p('p1', 'Ana'), p('p2', 'Beto')],
  team_b: [p('p3', 'Caro')],
  result: null,
  roster: [p('p1', 'Ana'), p('p2', 'Beto'), p('p3', 'Caro'), p('p4', 'Dani')],
  ...overrides,
})
const RESULT = '/vaca-futbolera/partidos/m1/resultado'

describe('cargar resultado (admin)', () => {
  it('corrige quién jugó, carga goles y vuelve a Partidos', async () => {
    const calls = mockApi({
      'GET /me': { body: ADMIN },
      'GET /matches/m1/result': { body: form() },
      'PUT /matches/m1/result': { body: form() },
      'GET /matches/history': { body: history([]) },
    })
    renderApp(RESULT)
    expect(await screen.findByText(/MIÉ 30 SEP · 19:00H/)).toBeInTheDocument()
    await userEvent.type(screen.getByLabelText('Goles Blancos'), '5')
    await userEvent.type(screen.getByLabelText('Goles Negros'), '4')
    const blancos = screen.getByRole('region', { name: 'Blancos' })
    const ana = within(blancos).getByText('Ana').closest('li') as HTMLElement
    await userEvent.click(within(ana).getByRole('button', { name: 'No jugó' }))
    const beto = within(blancos).getByText('Beto').closest('li') as HTMLElement
    await userEvent.click(within(beto).getByRole('button', { name: 'Pasar a Negros' }))
    await userEvent.selectOptions(screen.getByLabelText('Jugador que vino sin anotarse'), 'Dani')
    await userEvent.click(screen.getByRole('button', { name: 'Sumar' }))
    await userEvent.type(screen.getByLabelText('Notas (opcional)'), 'golazo')
    await userEvent.type(screen.getByLabelText('Goles de Dani'), '4')
    await userEvent.type(screen.getByLabelText('Goles de Caro'), '2')
    await userEvent.clear(screen.getByLabelText('Goles de Caro'))
    await userEvent.click(screen.getByRole('button', { name: 'Guardar resultado' }))
    expect(await screen.findByRole('heading', { name: 'Partidos' })).toBeInTheDocument()
    expect(calls.find((c) => c.key === 'PUT /matches/m1/result')?.body).toEqual({
      goals_a: 5,
      goals_b: 4,
      notes: 'golazo',
      team_a: ['p4'],
      team_b: ['p3', 'p2'],
      player_goals: { p4: 4 }, // vacío = no se sabe: no se envía
    })
  })

  it('precarga un resultado existente, suma al otro equipo y muestra errores', async () => {
    mockApi({
      'GET /me': { body: ADMIN },
      'GET /matches/m1/result': {
        body: form({
          result: { goals_a: 2, goals_b: 1, notes: 'x' },
          team_a: [p('p1', 'Ana', 2), p('p2', 'Beto')],
        }),
      },
      'PUT /matches/m1/result': {
        status: 422,
        body: { detail: 'Un jugador no puede estar en los dos equipos.' },
      },
    })
    renderApp(RESULT)
    expect(await screen.findByLabelText('Goles Blancos')).toHaveValue(2)
    expect(screen.getByLabelText('Notas (opcional)')).toHaveValue('x')
    expect(screen.getByLabelText('Goles de Ana')).toHaveValue(2)
    expect(screen.getByLabelText('Goles de Beto')).toHaveValue(null)
    const caro = within(screen.getByRole('region', { name: 'Negros' }))
      .getByText('Caro')
      .closest('li') as HTMLElement
    await userEvent.click(within(caro).getByRole('button', { name: 'Pasar a Blancos' }))
    await userEvent.selectOptions(screen.getByLabelText('Jugador que vino sin anotarse'), 'Dani')
    await userEvent.selectOptions(screen.getByLabelText('Equipo'), 'Negros')
    await userEvent.click(screen.getByRole('button', { name: 'Sumar' }))
    expect(within(screen.getByRole('region', { name: 'Negros' })).getByText('Dani')).toBeInTheDocument()
    expect(screen.queryByLabelText('Jugador que vino sin anotarse')).not.toBeInTheDocument() // no queda nadie en el banco
    await userEvent.click(screen.getByRole('button', { name: 'Guardar resultado' }))
    expect(await screen.findByText('Un jugador no puede estar en los dos equipos.')).toBeInTheDocument()
  })

  it('error al cargar el formulario', async () => {
    mockApi({
      'GET /me': { body: ADMIN },
      'GET /matches/m1/result': { status: 404, body: { detail: 'Partido no encontrado.' } },
    })
    renderApp(RESULT)
    expect(await screen.findByText('Partido no encontrado.')).toBeInTheDocument()
  })

  it('un miembro no puede entrar a cargar resultados', async () => {
    mockApi({ 'GET /me': { body: MEMBER }, 'GET /matches/current': { body: { match: null } } })
    renderApp(RESULT)
    expect(await screen.findByRole('heading', { name: 'Próximo partido' })).toBeInTheDocument()
  })
})
