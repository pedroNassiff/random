import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
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
