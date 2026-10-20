import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mockApi, PEDRO, PROFILE, renderApp } from './test/helpers'

afterEach(() => vi.unstubAllGlobals())

const ME = { 'GET /auth/me': { body: PEDRO } }

describe('plazos', () => {
  it('calcula un requerimiento en días hábiles y muestra traza y fuente', async () => {
    const calls = mockApi({
      ...ME,
      'POST /fiscal/deadlines': {
        body: {
          vence: '2026-10-06',
          fuente: 'Ley 39/2015 art. 30.2 y 30.3',
          traza: ['Notificación: 21/09/2026.', 'Se cuentan 10 días hábiles.'],
        },
      },
    })
    renderApp('/dashboard/impuestos/plazos')
    const submit = await screen.findByRole('button', { name: 'Calcular plazo' })
    expect(submit).toBeDisabled()
    await userEvent.type(screen.getByLabelText('Fecha de notificación'), '2026-09-21')
    expect(screen.getByLabelText('Días hábiles de plazo')).toHaveValue(10)
    await userEvent.click(submit)

    const result = await screen.findByRole('region', { name: 'Resultado' })
    expect(within(result).getByText('mar, 06/10/2026')).toBeInTheDocument()
    expect(within(result).getAllByRole('listitem')).toHaveLength(2)
    expect(within(result).getByText('Fuente: Ley 39/2015 art. 30.2 y 30.3')).toBeInTheDocument()
    expect(calls.find((c) => c.key === 'POST /fiscal/deadlines')?.body).toEqual({
      tipo: 'dias_habiles',
      fecha_notificacion: '2026-09-21',
      dias: 10,
    })
  })

  it('en apremio no pide días y no los manda', async () => {
    const calls = mockApi({
      ...ME,
      'POST /fiscal/deadlines': { body: { vence: '2026-10-05', fuente: 'LGT art. 62.5', traza: ['x'] } },
    })
    renderApp('/dashboard/impuestos/plazos')
    await userEvent.click(await screen.findByLabelText('Providencia de apremio'))
    expect(screen.queryByLabelText('Días hábiles de plazo')).not.toBeInTheDocument()
    expect(screen.getByText(/hasta el día 5 del mes siguiente/)).toBeInTheDocument()
    await userEvent.type(screen.getByLabelText('Fecha de notificación'), '2026-09-16')
    await userEvent.click(screen.getByRole('button', { name: 'Calcular plazo' }))
    expect(await screen.findByText('lun, 05/10/2026')).toBeInTheDocument()
    expect(calls.find((c) => c.key === 'POST /fiscal/deadlines')?.body).toEqual({
      tipo: 'apremio',
      fecha_notificacion: '2026-09-16',
    })
  })

  it('muestra el error del motor y borra el resultado anterior', async () => {
    mockApi({
      ...ME,
      'POST /fiscal/deadlines': {
        status: 422,
        body: {
          detail: 'No hay festivos cargados para 2027: no se puede calcular el plazo en días hábiles.',
        },
      },
    })
    renderApp('/dashboard/impuestos/plazos')
    await userEvent.type(await screen.findByLabelText('Fecha de notificación'), '2026-12-28')
    await userEvent.click(screen.getByRole('button', { name: 'Calcular plazo' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('No hay festivos cargados para 2027')
    expect(screen.queryByRole('region', { name: 'Resultado' })).not.toBeInTheDocument()
  })
})

describe('perfil fiscal', () => {
  it('sin perfil muestra el formulario vacío y guarda la versión 1', async () => {
    const calls = mockApi({
      ...ME,
      'GET /fiscal/profile': { body: null },
      'PUT /fiscal/profile': (body) => ({ body: { ...(body as object), nif: '12345678Z', version: 1 } }),
    })
    renderApp('/dashboard/impuestos/perfil')
    expect(await screen.findByText(/Estos son los datos de tu 036\/037/)).toBeInTheDocument()
    await userEvent.type(screen.getByLabelText('NIF'), '12345678z')
    await userEvent.type(screen.getByLabelText('Fecha de alta'), '2025-12-05')
    await userEvent.type(screen.getByLabelText('Epígrafe IAE'), '763')
    await userEvent.selectOptions(screen.getByLabelText('Régimen de IRPF'), 'directa_normal')
    await userEvent.click(screen.getByLabelText(/Alta en el ROI/))
    await userEvent.type(screen.getByLabelText('Domicilio fiscal'), 'Carrer 1')
    await userEvent.type(screen.getByLabelText('Municipio'), 'Barcelona')
    await userEvent.type(screen.getByLabelText('Comunidad autónoma'), 'Cataluña')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar perfil' }))

    expect(await screen.findByRole('status')).toHaveTextContent('Perfil guardado (versión 1).')
    expect(calls.find((c) => c.key === 'PUT /fiscal/profile')?.body).toEqual({
      nif: '12345678z',
      fecha_alta: '2025-12-05',
      iae: '763',
      regimen_iva: 'general',
      regimen_irpf: 'directa_normal',
      roi: true,
      tarifa_plana_hasta: null,
      domicilio_fiscal: 'Carrer 1',
      municipio: 'Barcelona',
      comunidad: 'Cataluña',
    })
  })

  it('con perfil precarga los datos, y editar crea una versión nueva', async () => {
    const calls = mockApi({
      ...ME,
      'GET /fiscal/profile': { body: PROFILE },
      'PUT /fiscal/profile': (body) => ({ body: { ...(body as object), version: 2 } }),
    })
    renderApp('/dashboard/impuestos/perfil')
    expect(await screen.findByLabelText('NIF')).toHaveValue('12345678Z')
    expect(screen.getByText(/^Versión 1\./)).toBeInTheDocument()
    expect(screen.getByLabelText('Tarifa plana hasta (opcional)')).toHaveValue('2026-12-05')
    expect(screen.getByLabelText(/Alta en el ROI/)).toBeChecked()

    await userEvent.selectOptions(screen.getByLabelText('Régimen de IVA'), 'exento')
    await userEvent.clear(screen.getByLabelText('Tarifa plana hasta (opcional)'))
    await userEvent.click(screen.getByRole('button', { name: 'Guardar perfil' }))
    expect(await screen.findByRole('status')).toHaveTextContent('versión 2')
    expect(screen.getByText(/^Versión 2\./)).toBeInTheDocument()
    expect(calls.find((c) => c.key === 'PUT /fiscal/profile')?.body).toMatchObject({
      regimen_iva: 'exento',
      tarifa_plana_hasta: null,
    })
    // Seguir editando borra el aviso de guardado.
    await userEvent.type(screen.getByLabelText('Municipio'), 'x')
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('muestra el error de validación del backend', async () => {
    mockApi({
      ...ME,
      'GET /fiscal/profile': { body: PROFILE },
      'PUT /fiscal/profile': { status: 422, body: { detail: 'La letra del NIF no coincide con el número.' } },
    })
    renderApp('/dashboard/impuestos/perfil')
    await userEvent.click(await screen.findByRole('button', { name: 'Guardar perfil' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('La letra del NIF no coincide')
  })

  it('si no carga el perfil muestra el error', async () => {
    mockApi({ ...ME, 'GET /fiscal/profile': { status: 500, body: { detail: 'Se cayó la base.' } } })
    renderApp('/dashboard/impuestos/perfil')
    expect(await screen.findByRole('alert')).toHaveTextContent('Se cayó la base.')
  })
})
