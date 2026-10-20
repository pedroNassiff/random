import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { calendar, mockApi, PEDRO, renderApp } from './test/helpers'
import type { Invoice } from './types'

beforeEach(() => vi.useFakeTimers({ now: new Date('2026-10-01T10:00:00Z'), toFake: ['Date'] }))
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

const ME = { 'GET /auth/me': { body: PEDRO } }

function invoice(patch: Partial<Invoice> = {}): Invoice {
  return {
    id: 'i12',
    serie: '',
    numero: 12,
    fecha: '2026-07-02',
    fecha_devengo: '2026-07-02',
    trimestre: 3,
    cliente: 'Cliente Italia SRL',
    cliente_pais: 'IT',
    cliente_tax_id: 'IT01234567890',
    cliente_empresa: true,
    concepto: 'Desarrollo de software',
    moneda: 'EUR',
    importe: '975.00',
    tipo_cambio: '1',
    tipo_iva: '0',
    retencion_pct: '0',
    mencion: 'exenta',
    documento_id: null,
    anulada: false,
    operacion: 'intracomunitaria',
    base: '975.00',
    cuota_iva: '0.00',
    retencion: '0.00',
    total: '975.00',
    observaciones: ['Mención incorrecta: debe decir "Inversión del sujeto pasivo (art. 84.Uno.2º LIVA)".'],
    ...patch,
  }
}

const USD = invoice({
  id: 'i11',
  numero: 11,
  fecha: '2026-06-29',
  trimestre: 2,
  cliente: 'Client USA Corp',
  moneda: 'USD',
  importe: '2000.00',
  operacion: 'extracomunitaria',
  base: '1840.00',
  observaciones: [],
})

const summary = (trimestre: number) => ({
  ejercicio: 2026,
  trimestre,
  operaciones: [
    {
      operacion: 'nacional',
      casillas: '303: casillas 07 (base) y 09 (cuota)',
      base: '0.00',
      cuota_iva: '0.00',
      retencion: '0.00',
      facturas: [],
    },
    {
      operacion: 'intracomunitaria',
      casillas: '303: casilla 59 · modelo 349',
      base: trimestre === 3 ? '975.00' : '0.00',
      cuota_iva: '0.00',
      retencion: '0.00',
      facturas: trimestre === 3 ? ['12/2026 Cliente Italia SRL'] : [],
    },
    {
      operacion: 'extracomunitaria',
      casillas: '303: casilla 120',
      base: trimestre === 2 ? '1840.00' : '0.00',
      cuota_iva: '0.00',
      retencion: '0.00',
      facturas: trimestre === 2 ? ['11/2026 Client USA Corp'] : [],
    },
  ],
  clientes_ue:
    trimestre === 3 ? [{ tax_id: 'IT01234567890', cliente: 'Cliente Italia SRL', base: '975.00' }] : [],
  con_observaciones: 0,
})

const routes = (invoices: Invoice[], numeracion: string[] = []) => ({
  ...ME,
  'GET /fiscal/invoices?ejercicio=2026': { body: { ejercicio: 2026, invoices, numeracion } },
  'GET /fiscal/invoices/summary?ejercicio=2026&trimestre=4': { body: summary(4) },
  'GET /fiscal/invoices/summary?ejercicio=2026&trimestre=3': { body: summary(3) },
  'GET /fiscal/invoices/summary?ejercicio=2026&trimestre=2': { body: summary(2) },
})

describe('facturas', () => {
  it('sin facturas invita a adjuntarlas en el asistente', async () => {
    mockApi(routes([]))
    renderApp('/dashboard/impuestos/facturas')
    expect(await screen.findByText(/Todavía no hay facturas registradas en 2026/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Facturas' })).toHaveAttribute(
      'href',
      '/dashboard/impuestos/facturas',
    )
    expect(screen.queryByRole('note')).not.toBeInTheDocument()
  })

  it('lista cada factura con operación, importes, observaciones y avisos de numeración', async () => {
    mockApi(routes([USD, invoice()], ['Serie única 2026: faltan los números 1, 2, 3.']))
    renderApp('/dashboard/impuestos/facturas')
    expect(await screen.findByRole('note')).toHaveTextContent('Serie única 2026: faltan los números 1, 2, 3.')
    const [usd, eu] = screen.getAllByRole('listitem').filter((li) => li.className.includes('rd-row'))
    if (!usd || !eu) throw new Error('faltan filas')
    expect(within(usd).getByText('Nº 11/2026')).toBeInTheDocument()
    expect(within(usd).getByText('Fuera de la UE')).toBeInTheDocument()
    expect(within(usd).getByText('1.840,00 €')).toBeInTheDocument()
    expect(within(usd).getByText('2.000,00 USD facturados')).toBeInTheDocument()
    expect(within(eu).getByText('Unión Europea')).toBeInTheDocument()
    expect(within(eu).getByText(/Mención incorrecta/)).toBeInTheDocument()
    expect(within(eu).getByText('3T')).toBeInTheDocument()
    expect(within(eu).queryByText(/facturados/)).not.toBeInTheDocument()
  })

  it('muestra las bases del trimestre en curso y permite cambiar de trimestre', async () => {
    mockApi(routes([USD, invoice()]))
    renderApp('/dashboard/impuestos/facturas')
    // 1 de octubre de 2026: arranca en el 4T, sin facturas.
    const q4 = await screen.findByRole('region', { name: 'Bases del 4T' })
    expect(within(q4).getAllByText('sin facturas')).toHaveLength(3)
    await userEvent.click(screen.getByRole('button', { name: '3T' }))
    const q3 = await screen.findByRole('region', { name: 'Bases del 3T' })
    expect(within(q3).getByText('303: casilla 59 · modelo 349')).toBeInTheDocument()
    expect(within(q3).getByText(/12\/2026 Cliente Italia SRL/)).toBeInTheDocument()
    expect(
      within(q3).getByText(/Para el 349: Cliente Italia SRL \(IT01234567890\) 975,00 €/),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '3T' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('anular pide confirmación y recarga la lista', async () => {
    let voided = false
    const calls = mockApi({
      ...routes([]),
      'GET /fiscal/invoices?ejercicio=2026': () => ({
        body: { ejercicio: 2026, invoices: [invoice({ anulada: voided })], numeracion: [] },
      }),
      'POST /fiscal/invoices/i12/void': () => {
        voided = true
        return { status: 204 }
      },
    })
    renderApp('/dashboard/impuestos/facturas')
    await userEvent.click(await screen.findByRole('button', { name: 'Anular registro 12/2026' }))
    expect(calls.some((c) => c.key.includes('/void'))).toBe(false)
    await userEvent.click(screen.getByRole('button', { name: 'Sí, anular la 12/2026' }))
    expect(await screen.findByText('Anulada')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Anular registro/ })).not.toBeInTheDocument()
  })

  it('muestra errores al anular y al cargar', async () => {
    mockApi({
      ...routes([invoice()]),
      'POST /fiscal/invoices/i12/void': { status: 404, body: { detail: 'Esa factura no existe.' } },
    })
    const first = renderApp('/dashboard/impuestos/facturas')
    await userEvent.click(await screen.findByRole('button', { name: 'Anular registro 12/2026' }))
    await userEvent.click(screen.getByRole('button', { name: 'Sí, anular la 12/2026' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Esa factura no existe.')
    first.unmount()
    mockApi({
      ...ME,
      'GET /fiscal/invoices?ejercicio=2026': { status: 500, body: { detail: 'Se cayó la base.' } },
    })
    renderApp('/dashboard/impuestos/facturas')
    expect(await screen.findByRole('alert')).toHaveTextContent('Se cayó la base.')
  })

  it('una propuesta de factura del asistente se guarda con Guardar y aparece en la lista', async () => {
    let saved = false
    const payload = {
      serie: '',
      numero: 12,
      fecha: '2026-07-02',
      fecha_devengo: '2026-07-02',
      cliente: 'Cliente Italia SRL',
      cliente_pais: 'IT',
      cliente_tax_id: 'IT01234567890',
      cliente_empresa: true,
      concepto: 'Desarrollo',
      moneda: 'EUR',
      importe: '975.00',
      tipo_cambio: '1',
      tipo_iva: '0',
      retencion_pct: '0',
      mencion: 'exenta',
      documento_id: 'd1',
    }
    const calls = mockApi({
      ...routes([]),
      'GET /fiscal/calendar': { body: calendar([]) },
      'GET /fiscal/invoices?ejercicio=2026': () => ({
        body: { ejercicio: 2026, invoices: saved ? [invoice()] : [], numeracion: [] },
      }),
      'POST /fiscal/agent/chat': {
        body: {
          reply: 'Revisala.',
          proposals: [
            {
              id: 'p1',
              kind: 'invoice',
              titulo: 'Registrar factura 12/2026 — Cliente Italia SRL',
              detalle: ['importe: 975.00 EUR'],
              payload,
            },
          ],
        },
      },
      'POST /fiscal/invoices': () => {
        saved = true
        return { status: 201, body: invoice() }
      },
    })
    renderApp('/dashboard/impuestos/facturas')
    await screen.findByText(/Todavía no hay facturas/)
    await userEvent.click(screen.getByRole('button', { name: 'NEO' }))
    const chat = screen.getByRole('region', { name: 'NEO, asistente fiscal' })
    await userEvent.type(within(chat).getByLabelText('Mensaje para NEO'), 'registrá la factura{Enter}')
    const card = await within(chat).findByRole('region', { name: /Propuesta: Registrar factura 12\/2026/ })
    expect(calls.some((c) => c.key === 'POST /fiscal/invoices')).toBe(false)
    await userEvent.click(within(card).getByRole('button', { name: 'Guardar' }))
    expect(await within(card).findByText('Guardada')).toBeInTheDocument()
    expect(calls.find((c) => c.key === 'POST /fiscal/invoices')?.body).toEqual(payload)
    expect(await screen.findByText('Nº 12/2026')).toBeInTheDocument()
  })
})
