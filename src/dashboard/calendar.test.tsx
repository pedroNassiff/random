import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { calendar, item, mockApi, PEDRO, renderApp } from './test/helpers'

afterEach(() => vi.unstubAllGlobals())

const ME = { 'GET /auth/me': { body: PEDRO } }
const OVERDUE = item({
  key: '303-2026-2T',
  periodo: '2T',
  titulo: 'IVA 2T 2026',
  vence: '2026-07-20',
  vence_nominal: '2026-07-20',
  aviso: 'vencida',
  dias_restantes: -73,
})
const UPCOMING = item({ aviso: 'T-5', dias_restantes: 5 })
const CONDITIONAL = item({
  key: '349-2026-3T',
  modelo: '349',
  titulo: 'Operaciones intracomunitarias 3T 2026',
  condicional: true,
  nota: 'Solo se presenta si hubo operaciones con clientes de la UE en el trimestre.',
})
const CLOSED = item({
  key: '303-2026-1T',
  periodo: '1T',
  titulo: 'IVA 1T 2026',
  vence: '2026-04-20',
  estado: 'presentado',
  justificante: 'CSV-1',
  dias_restantes: -164,
})
const PROVISIONAL = item({
  key: '390-2026-anual',
  modelo: '390',
  titulo: 'Resumen anual de IVA 2026',
  vence: '2027-02-01',
  vence_nominal: '2027-01-30',
  provisional: true,
  dias_restantes: 123,
})
const QUOTA = item({
  key: 'RETA-2026-10',
  modelo: 'RETA',
  periodo: '10',
  titulo: 'Cuota de autónomos de octubre 2026',
  vence: '2026-10-30',
  dias_restantes: 29,
})
const FLAT_RATE = item({
  key: 'RETA-2026-tarifa-plana',
  modelo: 'RETA',
  periodo: 'tarifa-plana',
  titulo: 'Fin de la tarifa plana',
  vence: '2026-12-05',
  dias_restantes: 65,
})

describe('calendario', () => {
  it('sin perfil fiscal invita a cargarlo', async () => {
    mockApi({
      ...ME,
      'GET /fiscal/calendar': { status: 404, body: { detail: 'Primero cargá tu perfil fiscal.' } },
    })
    renderApp('/dashboard/impuestos')
    expect(await screen.findByText(/Todavía no cargaste tu perfil fiscal/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Cargar perfil fiscal' })).toHaveAttribute(
      'href',
      '/dashboard/impuestos/perfil',
    )
  })

  it('muestra el error del backend', async () => {
    mockApi({ ...ME, 'GET /fiscal/calendar': { status: 500, body: { detail: 'Se cayó la base.' } } })
    renderApp('/dashboard/impuestos')
    expect(await screen.findByRole('alert')).toHaveTextContent('Se cayó la base.')
  })

  it('agrupa en vencidas, próximas y cerradas, con fecha, aviso y fuente', async () => {
    mockApi({ ...ME, 'GET /fiscal/calendar': { body: calendar([OVERDUE, UPCOMING, CONDITIONAL, CLOSED]) } })
    renderApp('/dashboard/impuestos')
    const overdue = await screen.findByRole('region', { name: 'Vencidas' })
    expect(within(overdue).getByText('IVA 2T 2026')).toBeInTheDocument()
    expect(within(overdue).getByText('lun, 20/07/2026')).toBeInTheDocument()
    expect(within(overdue).getByText('venció hace 73 días')).toBeInTheDocument()
    expect(within(overdue).getByText('Vencida')).toBeInTheDocument()

    const upcoming = screen.getByRole('region', { name: 'Próximas' })
    expect(within(upcoming).getByText('IVA 3T 2026')).toBeInTheDocument()
    expect(within(upcoming).getByText('Revisar borrador')).toBeInTheDocument()
    expect(within(upcoming).getByText('faltan 5 días')).toBeInTheDocument()
    expect(within(upcoming).getByText('Si aplica')).toBeInTheDocument()
    expect(within(upcoming).getByText(/clientes de la UE/)).toBeInTheDocument()
    expect(within(upcoming).getAllByText('Fuente: RIVA art. 71.4')).toHaveLength(2)

    const closed = screen.getByRole('region', { name: 'Cerradas' })
    expect(within(closed).getByText('IVA 1T 2026')).toBeInTheDocument()
    expect(within(closed).queryByText(/venció/)).not.toBeInTheDocument()
    expect(within(closed).getByLabelText('Justificante de IVA 1T 2026')).toHaveValue('CSV-1')
    expect(screen.getByText(/Hoy es jue, 01\/10\/2026/)).toBeInTheDocument()
    expect(screen.queryByRole('note')).not.toBeInTheDocument()
  })

  it('avisa cuando hay fechas provisionales por falta de festivos', async () => {
    mockApi({ ...ME, 'GET /fiscal/calendar': { body: calendar([PROVISIONAL]) } })
    renderApp('/dashboard/impuestos')
    expect(await screen.findByRole('note')).toHaveTextContent('solo hay festivos cargados para 2026')
    expect(screen.getByText('Fecha provisional')).toBeInTheDocument()
  })

  it('sin festivos cargados lo dice', async () => {
    mockApi({
      ...ME,
      'GET /fiscal/calendar': { body: { hoy: '2026-10-01', festivos_cargados: [], items: [PROVISIONAL] } },
    })
    renderApp('/dashboard/impuestos')
    expect(await screen.findByRole('note')).toHaveTextContent('festivos cargados para ninguno')
  })

  it('permite ocultar las cuotas mensuales, pero no el fin de la tarifa plana', async () => {
    mockApi({ ...ME, 'GET /fiscal/calendar': { body: calendar([QUOTA, FLAT_RATE]) } })
    renderApp('/dashboard/impuestos')
    expect(await screen.findByText('Cuota de autónomos de octubre 2026')).toBeInTheDocument()
    await userEvent.click(screen.getByLabelText('Mostrar las cuotas mensuales de autónomos'))
    expect(screen.queryByText('Cuota de autónomos de octubre 2026')).not.toBeInTheDocument()
    expect(screen.getByText('Fin de la tarifa plana')).toBeInTheDocument()
  })

  it('cerrar una obligación pide justificante y la mueve a cerradas', async () => {
    const calls = mockApi({
      ...ME,
      'GET /fiscal/calendar': { body: calendar([OVERDUE]) },
      'PUT /fiscal/obligations/303-2026-2T/status': (body) => ({
        body: { ...OVERDUE, ...(body as object), aviso: 'sin_aviso' },
      }),
    })
    renderApp('/dashboard/impuestos')
    const select = await screen.findByLabelText('Estado de IVA 2T 2026')
    const save = screen.getByRole('button', { name: 'Guardar' })
    expect(save).toBeDisabled() // sin cambios
    expect(screen.queryByLabelText('Justificante de IVA 2T 2026')).not.toBeInTheDocument()

    await userEvent.selectOptions(select, 'presentado')
    expect(save).toBeDisabled() // falta el justificante
    await userEvent.type(screen.getByLabelText('Justificante de IVA 2T 2026'), ' CSV-ABC ')
    await userEvent.click(save)

    const closed = await screen.findByRole('region', { name: 'Cerradas' })
    expect(await within(closed).findByText('IVA 2T 2026')).toBeInTheDocument()
    expect(
      within(screen.getByRole('region', { name: 'Vencidas' })).getByText('Nada vencido.'),
    ).toBeInTheDocument()
    expect(calls.find((c) => c.key.startsWith('PUT'))?.body).toEqual({
      estado: 'presentado',
      justificante: 'CSV-ABC',
    })
  })

  it('marcar como preparado no pide justificante', async () => {
    const calls = mockApi({
      ...ME,
      'GET /fiscal/calendar': { body: calendar([UPCOMING]) },
      'PUT /fiscal/obligations/303-2026-3T/status': (body) => ({
        body: { ...UPCOMING, ...(body as object) },
      }),
    })
    renderApp('/dashboard/impuestos')
    await userEvent.selectOptions(await screen.findByLabelText('Estado de IVA 3T 2026'), 'preparado')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(await screen.findByDisplayValue('Preparado')).toBeInTheDocument()
    expect(calls.find((c) => c.key.startsWith('PUT'))?.body).toEqual({
      estado: 'preparado',
      justificante: null,
    })
  })

  it('si el guardado falla muestra el error y no cambia el estado', async () => {
    mockApi({
      ...ME,
      'GET /fiscal/calendar': { body: calendar([UPCOMING]) },
      'PUT /fiscal/obligations/303-2026-3T/status': { status: 422, body: { detail: 'Estado desconocido.' } },
    })
    renderApp('/dashboard/impuestos')
    await userEvent.selectOptions(await screen.findByLabelText('Estado de IVA 3T 2026'), 'preparado')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Estado desconocido.')
    expect(
      within(screen.getByRole('region', { name: 'Próximas' })).getByText('IVA 3T 2026'),
    ).toBeInTheDocument()
  })
})
