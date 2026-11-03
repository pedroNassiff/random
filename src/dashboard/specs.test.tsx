import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { timing } from './pages/SpecsPage'
import { mockApi, PEDRO, renderApp } from './test/helpers'

// Spec: docs/sistema-agente-tributario.md/Spec — NEO constructor del dashboard.md § La spec aprobada queda guardada.

afterEach(() => vi.unstubAllGlobals())

const ME = { 'GET /auth/me': { body: PEDRO } }
const CONTENIDO = 'Característica: Finanzas familiares\n  Escenario: Cargar una cuenta\n    Cuando pulso +'
const SPEC = {
  id: 's2',
  modulo: 'Finanzas familiares',
  contenido: CONTENIDO,
  version: 2,
  estado: 'pendiente',
  escenarios: 1,
  creada: '2026-11-03T10:00:00+00:00',
}
const SPEC_PROPOSAL = {
  id: 'p9',
  kind: 'spec',
  titulo: 'Spec: Finanzas familiares',
  detalle: ['módulo: Finanzas familiares', 'escenarios: 1', 'versión: nueva'],
  payload: { modulo: 'Finanzas familiares', contenido: CONTENIDO },
}

describe('specs', () => {
  it('la sección está en el menú y sin specs explica de dónde salen', async () => {
    mockApi({ ...ME, 'GET /fiscal/specs': { body: [] } })
    renderApp('/dashboard/specs')
    expect(await screen.findByText(/Todavía no hay specs/)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Specs' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Specs' })).toHaveAttribute('href', '/dashboard/specs')
  })

  it('muestra la última versión de cada módulo, pendiente de construir, con su contenido', async () => {
    mockApi({ ...ME, 'GET /fiscal/specs': { body: [SPEC] } })
    renderApp('/dashboard/specs')
    const item = await screen.findByRole('article', { name: 'Finanzas familiares' })
    expect(within(item).getByText('Pendiente de construir')).toBeInTheDocument()
    expect(within(item).getByText('Versión 2 · 1 escenario · mar, 03/11/2026')).toBeInTheDocument()
    await userEvent.click(within(item).getByText('Ver la spec'))
    expect(within(item).getByText(/Escenario: Cargar una cuenta/)).toBeInTheDocument()
  })

  it('si no carga, muestra el error', async () => {
    mockApi({ ...ME, 'GET /fiscal/specs': { status: 500, body: { detail: 'Internal server error' } } })
    renderApp('/dashboard/specs')
    expect(await screen.findByRole('alert')).toBeInTheDocument()
  })

  it('la propuesta de spec de NEO se guarda con Guardar y aparece en Specs', async () => {
    let saved = false
    const calls = mockApi({
      ...ME,
      'GET /fiscal/specs': () => ({ body: saved ? [{ ...SPEC, version: 1 }] : [] }),
      'POST /fiscal/agent/chat': { body: { reply: 'Revisala y guardala.', proposals: [SPEC_PROPOSAL] } },
      'POST /fiscal/specs': () => {
        saved = true
        return { status: 201, body: { ...SPEC, version: 1 } }
      },
    })
    renderApp('/dashboard/specs')
    expect(await screen.findByText(/Todavía no hay specs/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'NEO' }))
    await userEvent.type(screen.getByLabelText('Mensaje para NEO'), 'el borrador está bien')
    await userEvent.click(screen.getByRole('button', { name: 'Enviar' }))
    const card = await screen.findByRole('region', { name: 'Propuesta: Spec: Finanzas familiares' })
    expect(within(card).getByText('versión: nueva')).toBeInTheDocument()
    expect(calls.some((c) => c.key === 'POST /fiscal/specs')).toBe(false)

    await userEvent.click(within(card).getByRole('button', { name: 'Guardar' }))
    expect(await within(card).findByText('Guardada')).toBeInTheDocument()
    expect(calls.find((c) => c.key === 'POST /fiscal/specs')?.body).toEqual(SPEC_PROPOSAL.payload)
    expect(await screen.findByRole('article', { name: 'Finanzas familiares' })).toBeInTheDocument()
  })
})

const BUILDS_OFF = { 'GET /fiscal/builds': { body: { disponible: false, presupuesto_usd: 0, builds: [] } } }
const running = (log: string[]) => ({
  slug: 'finanzas-familiares',
  modulo: 'Finanzas familiares',
  estado: 'corriendo',
  inicio: '2026-11-03T10:00:00+00:00',
  log,
  rama: null,
  intentos: null,
  costo_usd: null,
  pr_url: null,
  detalle: null,
})

describe('construir', () => {
  beforeEach(() => {
    timing.pollMs = 10
  })

  it('sin builder activo no aparece Construir', async () => {
    mockApi({ ...ME, ...BUILDS_OFF, 'GET /fiscal/specs': { body: [SPEC] } })
    renderApp('/dashboard/specs')
    expect(await screen.findByRole('article', { name: 'Finanzas familiares' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Construir/ })).not.toBeInTheDocument()
  })

  it('si no se puede consultar el builder, la página sigue funcionando', async () => {
    mockApi({ ...ME, 'GET /fiscal/specs': { body: [SPEC] } })
    renderApp('/dashboard/specs')
    expect(await screen.findByRole('article', { name: 'Finanzas familiares' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Construir/ })).not.toBeInTheDocument()
  })

  it('pide confirmar el costo, lanza, muestra el progreso y termina con el PR', async () => {
    let polls = 0
    const calls = mockApi({
      ...ME,
      'GET /fiscal/specs': { body: [SPEC] },
      'GET /fiscal/builds': () => {
        polls += 1
        const started = calls.some((c) => c.key === 'POST /fiscal/builds')
        const done = {
          ...running(['  · Write fiscal/domain/finanzas.py']),
          estado: 'pr_abierto',
          intentos: 2,
          costo_usd: 6.4,
          pr_url: 'https://github.com/x/y/pull/40',
          rama: 'neo/finanzas-familiares',
          detalle: 'Gauntlet en verde.',
        }
        const builds = !started ? [] : polls < 4 ? [running(['  · Write fiscal/domain/finanzas.py'])] : [done]
        return { body: { disponible: true, presupuesto_usd: 20, builds } }
      },
      'POST /fiscal/builds': { status: 202, body: running([]) },
    })
    renderApp('/dashboard/specs')
    const item = await screen.findByRole('article', { name: 'Finanzas familiares' })
    await userEvent.click(await within(item).findByRole('button', { name: 'Construir' }))
    expect(within(item).getByText(/hasta US\$ 20/)).toBeInTheDocument()
    await userEvent.click(within(item).getByRole('button', { name: 'Cancelar' }))
    expect(calls.some((c) => c.key === 'POST /fiscal/builds')).toBe(false)

    await userEvent.click(within(item).getByRole('button', { name: 'Construir' }))
    await userEvent.click(within(item).getByRole('button', { name: 'Sí, construir' }))
    expect(calls.find((c) => c.key === 'POST /fiscal/builds')?.body).toEqual({
      modulo: 'Finanzas familiares',
    })
    expect(await within(item).findByText('Construyendo…')).toBeInTheDocument()
    expect(within(item).getByText(/Write fiscal\/domain\/finanzas.py/)).toBeInTheDocument()

    const link = await within(item).findByRole('link', { name: 'Ver el PR en draft' })
    expect(link).toHaveAttribute('href', 'https://github.com/x/y/pull/40')
    expect(within(item).getByText('PR abierto · 2 intentos · US$ 6.40')).toBeInTheDocument()
    expect(within(item).getByRole('button', { name: 'Construir de nuevo' })).toBeInTheDocument()
  })

  it('muestra por qué se detuvo y deja cancelar una en curso', async () => {
    const stopped = {
      ...running([]),
      estado: 'gauntlet_roja',
      intentos: 3,
      costo_usd: 12,
      detalle: 'FAILED tests/fiscal/test_finanzas.py',
    }
    let cancelled = false
    const calls = mockApi({
      ...ME,
      'GET /fiscal/specs': { body: [SPEC, { ...SPEC, id: 's3', modulo: 'Proyectos' }] },
      'GET /fiscal/builds': () => ({
        body: {
          disponible: true,
          presupuesto_usd: 20,
          builds: [
            stopped,
            cancelled
              ? { ...running([]), slug: 'proyectos', modulo: 'Proyectos', estado: 'cancelado' }
              : { ...running(['arrancando']), slug: 'proyectos', modulo: 'Proyectos' },
          ],
        },
      }),
      'POST /fiscal/builds/proyectos/cancel': () => {
        cancelled = true
        return { status: 204 }
      },
    })
    renderApp('/dashboard/specs')
    const finanzas = await screen.findByRole('article', { name: 'Finanzas familiares' })
    expect(
      await within(finanzas).findByText('La gauntlet siguió en rojo · 3 intentos · US$ 12.00'),
    ).toBeInTheDocument()
    expect(within(finanzas).getByText('FAILED tests/fiscal/test_finanzas.py')).toBeInTheDocument()

    const proyectos = screen.getByRole('article', { name: 'Proyectos' })
    expect(within(proyectos).queryByRole('button', { name: /Construir/ })).not.toBeInTheDocument()
    await userEvent.click(within(proyectos).getByRole('button', { name: 'Cancelar construcción' }))
    expect(calls.some((c) => c.key === 'POST /fiscal/builds/proyectos/cancel')).toBe(true)
    expect(await within(proyectos).findByText(/Cancelada/)).toBeInTheDocument()
  })

  it('si lanzar falla, muestra el error', async () => {
    mockApi({
      ...ME,
      'GET /fiscal/specs': { body: [SPEC] },
      'GET /fiscal/builds': { body: { disponible: true, presupuesto_usd: 20, builds: [] } },
      'POST /fiscal/builds': {
        status: 409,
        body: { detail: 'Ya hay una construcción en curso para este módulo.' },
      },
    })
    renderApp('/dashboard/specs')
    const item = await screen.findByRole('article', { name: 'Finanzas familiares' })
    await userEvent.click(await within(item).findByRole('button', { name: 'Construir' }))
    await userEvent.click(within(item).getByRole('button', { name: 'Sí, construir' }))
    expect(await within(item).findByRole('alert')).toHaveTextContent('Ya hay una construcción en curso')
  })
})
