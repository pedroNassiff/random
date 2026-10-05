import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mockApi, PEDRO, renderApp } from './test/helpers'
import type { Client } from './types'

afterEach(() => vi.unstubAllGlobals())

const ME = { 'GET /auth/me': { body: PEDRO } }

function client(patch: Partial<Client> = {}): Client {
  return {
    id: 'c1',
    codigo: 1,
    nombre: 'Cliente Italia SRL',
    pais: 'IT',
    tipo: 'empresa',
    tax_id: 'IT01234567890',
    direccion: 'Via Esempio 28, Roma',
    email: null,
    moneda: 'EUR',
    retencion_pct: '0.00',
    dias_pago: null,
    vinculada: false,
    notas: '',
    activo: true,
    vies_ok: null,
    vies_checked_at: null,
    vies_nombre: null,
    operacion: 'intracomunitaria',
    mencion: 'Inversión del sujeto pasivo (art. 84.Uno.2º LIVA)',
    casillas: '303: casilla 59 · modelo 349',
    requiere_vies: true,
    observaciones: ['VAT sin comprobar en VIES: sin esa validación no corresponde facturar sin IVA.'],
    ...patch,
  }
}
const SPAIN = client({
  id: 'c2',
  codigo: 2,
  nombre: 'Web España SL',
  pais: 'ES',
  tax_id: 'B12345678',
  direccion: '',
  email: 'pagos@web.es',
  retencion_pct: '15.00',
  dias_pago: 30,
  vinculada: true,
  operacion: 'nacional',
  mencion: '',
  casillas: '303: casillas 07 (base) y 09 (cuota)',
  requiere_vies: false,
  observaciones: [],
})

describe('clientes', () => {
  it('está en el menú lateral y, sin clientes, invita a crear el primero', async () => {
    mockApi({ ...ME, 'GET /fiscal/clients': { body: [] } })
    renderApp('/dashboard/clientes')
    expect(await screen.findByRole('heading', { name: 'Clientes' })).toBeInTheDocument()
    expect(screen.getByText(/Todavía no hay clientes/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Clientes' })).toHaveAttribute('href', '/dashboard/clientes')
  })

  it('muestra código, país, tipo, operación, mención, VIES y observaciones de cada cliente', async () => {
    mockApi({ ...ME, 'GET /fiscal/clients': { body: [client(), SPAIN] } })
    renderApp('/dashboard/clientes')
    const [it, es] = await screen.findAllByRole('listitem')
    if (!it || !es) throw new Error('faltan filas')
    expect(within(it).getByText('C-001')).toBeInTheDocument()
    expect(within(it).getByText('IT')).toBeInTheDocument()
    expect(within(it).getByText('Empresa')).toBeInTheDocument()
    expect(within(it).getByText('Unión Europea')).toBeInTheDocument()
    expect(within(it).getByText('VIES sin comprobar')).toBeInTheDocument()
    expect(within(it).getByText(/Mención: Inversión del sujeto pasivo/)).toBeInTheDocument()
    expect(within(it).getByText(/VAT sin comprobar en VIES/)).toBeInTheDocument()
    expect(within(it).getByText('EUR · retención 0 %')).toBeInTheDocument()

    expect(within(es).getByText('C-002')).toBeInTheDocument()
    expect(within(es).getByText('España')).toBeInTheDocument()
    expect(within(es).getByText('Vinculada')).toBeInTheDocument()
    expect(within(es).getByText('B12345678 · Sin domicilio · pagos@web.es')).toBeInTheDocument()
    expect(within(es).getByText('EUR · retención 15 % · pago a 30 días')).toBeInTheDocument()
    expect(within(es).queryByRole('button', { name: /Comprobar VIES/ })).not.toBeInTheDocument()
  })

  it('comprobar VIES actualiza el estado; si VIES falla muestra el error', async () => {
    let checked = false
    mockApi({
      ...ME,
      'GET /fiscal/clients': () => ({
        body: [
          checked
            ? client({
                vies_ok: true,
                vies_checked_at: '2026-10-01T10:00:00+00:00',
                vies_nombre: 'CLIENTE ITALIA S.R.L.',
                observaciones: [],
              })
            : client(),
        ],
      }),
      'POST /fiscal/clients/c1/vies': () => {
        checked = true
        return { body: client() }
      },
    })
    const first = renderApp('/dashboard/clientes')
    await userEvent.click(await screen.findByRole('button', { name: 'Comprobar VIES de Cliente Italia SRL' }))
    expect(await screen.findByText('VIES válido (jue, 01/10/2026)')).toBeInTheDocument()
    expect(screen.getByText('Nombre en VIES: CLIENTE ITALIA S.R.L.')).toBeInTheDocument()
    first.unmount()

    mockApi({
      ...ME,
      'GET /fiscal/clients': { body: [client({ vies_ok: false, vies_checked_at: null })] },
      'POST /fiscal/clients/c1/vies': {
        status: 422,
        body: { detail: 'VIES no respondió. Probá de nuevo en unos minutos.' },
      },
    })
    renderApp('/dashboard/clientes')
    expect(await screen.findByText('VIES no válido')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Comprobar VIES de Cliente Italia SRL' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('VIES no respondió')
  })

  it('crea un cliente desde el formulario y recarga la lista', async () => {
    let created = false
    const calls = mockApi({
      ...ME,
      'GET /fiscal/clients': () => ({ body: created ? [SPAIN] : [] }),
      'POST /fiscal/clients': () => {
        created = true
        return { status: 201, body: SPAIN }
      },
    })
    renderApp('/dashboard/clientes')
    await userEvent.click(await screen.findByRole('button', { name: 'Nuevo cliente' }))
    const form = screen.getByRole('form', { name: 'Nuevo cliente' })
    await userEvent.type(within(form).getByLabelText('Nombre o razón social'), 'Web España SL')
    expect(within(form).getByLabelText('País (código de 2 letras)')).toHaveValue('ES')
    await userEvent.type(within(form).getByLabelText('NIF / VAT'), 'B12345678')
    await userEvent.type(within(form).getByLabelText('Email de facturación'), 'pagos@web.es')
    await userEvent.type(within(form).getByLabelText('Domicilio'), 'Calle Mayor 1')
    await userEvent.selectOptions(within(form).getByLabelText('Retención de IRPF que te aplica'), '15')
    await userEvent.type(within(form).getByLabelText('Plazo de pago (días)'), '30')
    await userEvent.click(within(form).getByLabelText('Es una sociedad mía o de un familiar'))
    await userEvent.click(within(form).getByRole('button', { name: 'Crear cliente' }))

    expect(await screen.findByText('C-002')).toBeInTheDocument()
    expect(screen.queryByRole('form')).not.toBeInTheDocument()
    expect(calls.find((c) => c.key === 'POST /fiscal/clients')?.body).toEqual({
      nombre: 'Web España SL',
      pais: 'ES',
      tipo: 'empresa',
      tax_id: 'B12345678',
      direccion: 'Calle Mayor 1',
      email: 'pagos@web.es',
      moneda: 'EUR',
      retencion_pct: '15',
      dias_pago: 30,
      vinculada: true,
      notas: '',
    })
  })

  it('edita un cliente con sus datos precargados; país y moneda van en mayúsculas', async () => {
    const calls = mockApi({
      ...ME,
      'GET /fiscal/clients': { body: [SPAIN] },
      'PUT /fiscal/clients/c2': { body: SPAIN },
    })
    renderApp('/dashboard/clientes')
    await userEvent.click(await screen.findByRole('button', { name: 'Editar Web España SL' }))
    const form = screen.getByRole('form', { name: 'Editar cliente' })
    expect(within(form).getByLabelText('Nombre o razón social')).toHaveValue('Web España SL')
    expect(within(form).getByLabelText('Retención de IRPF que te aplica')).toHaveValue('15')
    expect(within(form).getByLabelText('Plazo de pago (días)')).toHaveValue(30)
    await userEvent.clear(within(form).getByLabelText('País (código de 2 letras)'))
    await userEvent.type(within(form).getByLabelText('País (código de 2 letras)'), 'us')
    await userEvent.clear(within(form).getByLabelText('Moneda'))
    await userEvent.type(within(form).getByLabelText('Moneda'), 'usd')
    await userEvent.selectOptions(within(form).getByLabelText('Tipo'), 'autonomo')
    await userEvent.clear(within(form).getByLabelText('Plazo de pago (días)'))
    await userEvent.clear(within(form).getByLabelText('Email de facturación'))
    await userEvent.clear(within(form).getByLabelText('NIF / VAT'))
    await userEvent.type(within(form).getByLabelText('Notas'), 'paga tarde')
    await userEvent.click(within(form).getByRole('button', { name: 'Guardar cambios' }))
    await screen.findByText('C-002')
    expect(calls.find((c) => c.key === 'PUT /fiscal/clients/c2')?.body).toMatchObject({
      pais: 'US',
      moneda: 'USD',
      tipo: 'autonomo',
      dias_pago: null,
      email: null,
      tax_id: null,
      notas: 'paga tarde',
    })
  })

  it('muestra el error de validación y permite cancelar', async () => {
    mockApi({
      ...ME,
      'GET /fiscal/clients': { body: [] },
      'POST /fiscal/clients': { status: 422, body: { detail: 'Falta el NIF o VAT.' } },
    })
    renderApp('/dashboard/clientes')
    await userEvent.click(await screen.findByRole('button', { name: 'Nuevo cliente' }))
    await userEvent.type(screen.getByLabelText('Nombre o razón social'), 'X')
    await userEvent.click(screen.getByRole('button', { name: 'Crear cliente' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Falta el NIF o VAT.')
    expect(screen.getByRole('button', { name: 'Crear cliente' })).toBeEnabled()
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(screen.queryByRole('form')).not.toBeInTheDocument()
  })

  it('archiva, muestra archivados y reactiva', async () => {
    let active = true
    const calls = mockApi({
      ...ME,
      'GET /fiscal/clients': () => ({ body: active ? [SPAIN] : [] }),
      'GET /fiscal/clients?archivados=true': () => ({ body: [{ ...SPAIN, activo: active }] }),
      'POST /fiscal/clients/c2/archive?activo=false': () => {
        active = false
        return { body: SPAIN }
      },
      'POST /fiscal/clients/c2/archive?activo=true': () => {
        active = true
        return { body: SPAIN }
      },
    })
    renderApp('/dashboard/clientes')
    await userEvent.click(await screen.findByRole('button', { name: 'Archivar Web España SL' }))
    expect(await screen.findByText(/Todavía no hay clientes/)).toBeInTheDocument()
    await userEvent.click(screen.getByLabelText('Mostrar archivados'))
    expect(await screen.findByText('Archivado')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Reactivar Web España SL' }))
    expect(await screen.findByRole('button', { name: 'Archivar Web España SL' })).toBeInTheDocument()
    expect(calls.filter((c) => c.key.includes('/archive'))).toHaveLength(2)
  })

  it('si no carga la lista muestra el error', async () => {
    mockApi({ ...ME, 'GET /fiscal/clients': { status: 500, body: { detail: 'Se cayó la base.' } } })
    renderApp('/dashboard/clientes')
    expect(await screen.findByRole('alert')).toHaveTextContent('Se cayó la base.')
  })

  it('una propuesta de cliente de NEO crea o actualiza según traiga id', async () => {
    const payload = {
      nombre: 'Cliente Italia SRL',
      pais: 'IT',
      tipo: 'empresa',
      tax_id: 'IT01234567890',
      direccion: 'Roma',
      email: null,
      moneda: 'EUR',
      retencion_pct: '0',
      dias_pago: null,
      vinculada: false,
      notas: '',
    }
    const calls = mockApi({
      ...ME,
      'GET /fiscal/clients': { body: [] },
      'POST /fiscal/agent/chat': {
        body: {
          reply: 'Revisalos.',
          proposals: [
            {
              id: 'p1',
              kind: 'client',
              titulo: 'Nuevo cliente: Cliente Italia SRL',
              detalle: ['pais: — → IT'],
              payload: { id: null, ...payload },
            },
            {
              id: 'p2',
              kind: 'client',
              titulo: 'Actualizar cliente Web España SL',
              detalle: ['vinculada: no → sí'],
              payload: { id: 'c2', ...payload },
            },
          ],
        },
      },
      'POST /fiscal/clients': { status: 201, body: client() },
      'PUT /fiscal/clients/c2': { body: SPAIN },
    })
    renderApp('/dashboard/clientes')
    await userEvent.click(await screen.findByRole('button', { name: 'NEO' }))
    const chat = screen.getByRole('region', { name: 'NEO, asistente fiscal' })
    await userEvent.type(within(chat).getByLabelText('Mensaje para NEO'), 'cargá mis clientes{Enter}')
    const nuevo = await within(chat).findByRole('region', {
      name: 'Propuesta: Nuevo cliente: Cliente Italia SRL',
    })
    await userEvent.click(within(nuevo).getByRole('button', { name: 'Guardar' }))
    expect(await within(nuevo).findByText('Guardada')).toBeInTheDocument()
    const cambio = within(chat).getByRole('region', { name: 'Propuesta: Actualizar cliente Web España SL' })
    await userEvent.click(within(cambio).getByRole('button', { name: 'Guardar' }))
    expect(await within(cambio).findByText('Guardada')).toBeInTheDocument()
    expect(calls.find((c) => c.key === 'POST /fiscal/clients')?.body).toEqual(payload)
    expect(calls.find((c) => c.key === 'PUT /fiscal/clients/c2')?.body).toEqual(payload)
  })
})
