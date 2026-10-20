import { fireEvent, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { variation } from './components/CategoryHeatmap'
import { mockApi, PEDRO, renderApp } from './test/helpers'
import type { MovementSummary } from './types'

afterEach(() => vi.unstubAllGlobals())

const ME = { 'GET /auth/me': { body: PEDRO } }
const SUMMARY: MovementSummary = {
  meses: ['2026-08-01', '2026-09-01', '2026-10-01'],
  filas: [
    {
      categoria: 'Vivienda (tu parte)',
      valores: ['890.00', '890.00', '890.00'],
      total: '2670.00',
      promedio: '890.00',
      variacion: '0.0',
      conceptos: ['renta + servicios'],
    },
    {
      categoria: 'Suministros',
      valores: ['34.00', '62.00', '0.00'],
      total: '96.00',
      promedio: '32.00',
      variacion: '-100.0',
      conceptos: ['agua', 'luz'],
    },
    {
      categoria: 'Supermercado',
      valores: ['0.00', '0.00', '100.00'],
      total: '100.00',
      promedio: '33.33',
      variacion: null,
      conceptos: ['aldi'],
    },
  ],
  totales: ['924.00', '952.00', '990.00'],
  total: '2866.00',
  personas: ['Emma', 'Hogar', 'Pedro'],
}
const url = (tipo: string, meses: number, personas: string[] = []) =>
  `GET /fiscal/movements/summary?tipo=${tipo}&meses=${meses}${personas.map((p) => `&persona=${p}`).join('')}`

describe('variation', () => {
  it('describe el cambio contra el mes anterior', () => {
    expect(variation(100, 150)).toBe('▲ 50 %')
    expect(variation(100, 25)).toBe('▼ 75 %')
    expect(variation(100, 100)).toBe('=')
    expect(variation(0, 50)).toBe('nuevo')
    expect(variation(0, 0)).toBe('')
  })
})

describe('ingresos y gastos', () => {
  it('está en el menú y, sin datos, invita a importar el Excel', async () => {
    mockApi({ ...ME, [url('gasto', 6)]: { body: { ...SUMMARY, filas: [], personas: [] } } })
    renderApp('/dashboard/ingresos-y-gastos')
    expect(await screen.findByText(/Todavía no hay movimientos/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ingresos y gastos' })).toHaveAttribute(
      'href',
      '/dashboard/ingresos-y-gastos',
    )
    expect(screen.queryByRole('group', { name: 'Persona' })).not.toBeInTheDocument()
  })

  it('muestra la tabla categoría × mes con importes, variación, promedio y totales', async () => {
    mockApi({ ...ME, [url('gasto', 6)]: { body: SUMMARY } })
    renderApp('/dashboard/ingresos-y-gastos')
    const table = await screen.findByRole('table', { name: 'Gastos por categoría y mes' })
    const headers = within(table)
      .getAllByRole('columnheader')
      .map((h) => h.textContent)
    expect(headers).toEqual(['Categoría', 'ago 26', 'sept 26', 'oct 26', 'Promedio', 'Total'])
    const sumi = within(table).getByRole('row', { name: /Suministros/ })
    expect(
      within(sumi)
        .getAllByRole('cell')
        .map((c) => c.textContent),
    ).toEqual(['34,00', '62,00▲ 82 %', '—▼ 100 %', '32,00 €', '96,00 €'])
    const sup = within(table).getByRole('row', { name: /Supermercado/ })
    expect(within(sup).getAllByRole('cell')[2]).toHaveTextContent('100,00nuevo')
    const total = within(table).getByRole('row', { name: /^Total/ })
    expect(total).toHaveTextContent('924,00952,00▲ 3 %990,00▲ 4 %955,33 €2.866,00 €')
    expect(screen.getByText(/Mostrando a todos juntos/)).toBeInTheDocument()
  })

  it('cada celda tiene su tooltip con mes, importe y mes anterior; la categoría se despliega', async () => {
    mockApi({ ...ME, [url('gasto', 6)]: { body: SUMMARY } })
    renderApp('/dashboard/ingresos-y-gastos')
    const table = await screen.findByRole('table')
    const cell = within(within(table).getByRole('row', { name: /Suministros/ })).getAllByRole('cell')[1]
    if (!cell) throw new Error('falta la celda')
    expect(cell).toHaveAttribute(
      'aria-label',
      'Suministros · septiembre de 2026. 62,00 €. Mes anterior: 34,00 €',
    )
    fireEvent.pointerEnter(cell)
    expect(screen.getByRole('tooltip')).toHaveTextContent(
      'Suministros · septiembre de 202662,00 €Mes anterior: 34,00 €',
    )
    fireEvent.pointerLeave(cell)
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
    fireEvent.focus(cell)
    expect(screen.getByRole('tooltip')).toBeInTheDocument()
    fireEvent.blur(cell)
    const first = within(within(table).getByRole('row', { name: /Suministros/ })).getAllByRole('cell')[0]
    if (!first) throw new Error('falta la celda')
    fireEvent.focus(first)
    expect(screen.getByRole('tooltip')).not.toHaveTextContent('Mes anterior')

    await userEvent.click(within(table).getByRole('button', { name: 'Suministros' }))
    expect(within(table).getByText('Incluye: agua, luz')).toBeInTheDocument()
    expect(within(table).getByRole('button', { name: 'Suministros' })).toHaveAttribute(
      'aria-expanded',
      'true',
    )
    await userEvent.click(within(table).getByRole('button', { name: 'Suministros' }))
    expect(within(table).queryByText('Incluye: agua, luz')).not.toBeInTheDocument()
  })

  it('filtra por tipo, período y persona', async () => {
    const calls = mockApi({
      ...ME,
      [url('gasto', 6)]: { body: SUMMARY },
      [url('gasto', 12)]: { body: SUMMARY },
      [url('gasto', 12, ['Pedro'])]: { body: SUMMARY },
      [url('gasto', 12, ['Pedro', 'Emma'])]: { body: SUMMARY },
      [url('gasto', 12, ['Emma'])]: { body: SUMMARY },
      [url('ingreso', 12, ['Emma'])]: {
        body: {
          ...SUMMARY,
          filas: SUMMARY.filas.map((f) => ({ ...f, categoria: `Ingresos ${f.categoria}` })),
        },
      },
    })
    renderApp('/dashboard/ingresos-y-gastos')
    await screen.findByRole('table')
    await userEvent.click(screen.getByRole('button', { name: '12 meses' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Pedro' }))
    expect(screen.getByRole('button', { name: 'Pedro' })).toHaveAttribute('aria-pressed', 'true')
    expect(await screen.findByRole('table')).toBeInTheDocument()
    expect(screen.queryByText(/Mostrando a todos juntos/)).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Emma' }))
    await screen.findByRole('table')
    await userEvent.click(screen.getByRole('button', { name: 'Pedro' }))
    await screen.findByRole('table')
    await userEvent.click(screen.getByRole('button', { name: 'Ingresos' }))
    expect(await screen.findByRole('heading', { name: 'De dónde viene' })).toBeInTheDocument()
    expect(calls.map((c) => c.key).filter((k) => k.includes('summary'))).toEqual([
      url('gasto', 6),
      url('gasto', 12),
      url('gasto', 12, ['Pedro']),
      url('gasto', 12, ['Pedro', 'Emma']),
      url('gasto', 12, ['Emma']),
      url('ingreso', 12, ['Emma']),
    ])
  })

  it('importa el Excel, muestra el resultado y recarga la tabla', async () => {
    let imported = false
    const calls = mockApi({
      ...ME,
      [url('gasto', 6)]: () => ({ body: imported ? SUMMARY : { ...SUMMARY, filas: [], personas: [] } }),
      'POST /fiscal/movements/import': () => {
        imported = true
        return {
          body: {
            nuevos: 476,
            actualizados: 0,
            movimientos: 476,
            desde: '2024-11-01',
            hasta: '2026-10-01',
            meses: 24,
            omitidas: ['Viaje Argentina', 'Viaje Corsica'],
            dudosos: ['enero 2026!I5: «COliseo» sin importe en euros (nota: 1000.0).'],
            descuadres: ['marzo-2026: gastos de Pedro suman 1 y la planilla dice 2 (fila 21).'],
          },
        }
      },
    })
    renderApp('/dashboard/ingresos-y-gastos')
    await screen.findByText(/Todavía no hay movimientos/)
    const file = new File(['PK fake'], 'cuentas.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
    await userEvent.upload(screen.getByLabelText('Importar Excel de cuentas'), file)
    const report = await screen.findByRole('region', { name: 'Resultado de la importación' })
    expect(report).toHaveTextContent(
      '476 movimientos de 24 meses (2024-11 a 2026-10): 476 nuevos y 0 actualizados.',
    )
    expect(report).toHaveTextContent('Pestañas que no son de un mes: Viaje Argentina, Viaje Corsica.')
    expect(report).toHaveTextContent('gastos de Pedro suman 1')
    expect(within(report).getByText('1 filas sin importar por dudosas')).toBeInTheDocument()
    expect(await screen.findByRole('table')).toBeInTheDocument()
    expect(calls.find((c) => c.key === 'POST /fiscal/movements/import')?.body).toEqual({
      name: 'cuentas.xlsx',
      data: btoa('PK fake'),
    })
  })

  it('muestra los errores de importación y de carga', async () => {
    mockApi({
      ...ME,
      [url('gasto', 6)]: { body: { ...SUMMARY, filas: [], personas: [] } },
      'POST /fiscal/movements/import': {
        status: 422,
        body: { detail: 'El archivo no es un Excel (.xlsx) válido.' },
      },
    })
    const first = renderApp('/dashboard/ingresos-y-gastos')
    await screen.findByText(/Todavía no hay movimientos/)
    await userEvent.upload(screen.getByLabelText('Importar Excel de cuentas'), new File(['x'], 'x.xlsx'))
    expect(await screen.findByRole('alert')).toHaveTextContent('no es un Excel')
    first.unmount()

    class Broken {
      onerror: (() => void) | null = null
      readAsDataURL() {
        this.onerror?.()
      }
    }
    vi.stubGlobal('FileReader', Broken)
    mockApi({ ...ME, [url('gasto', 6)]: { status: 500, body: { detail: 'Se cayó la base.' } } })
    renderApp('/dashboard/ingresos-y-gastos')
    expect(await screen.findByRole('alert')).toHaveTextContent('Se cayó la base.')
    await userEvent.upload(screen.getByLabelText('Importar Excel de cuentas'), new File(['x'], 'x.xlsx'))
    expect(await screen.findByText('No se pudo leer el archivo.')).toBeInTheDocument()
  })
})
