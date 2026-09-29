import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ADMIN, MEMBER, mockApi, renderApp } from './test/helpers'

afterEach(() => vi.unstubAllGlobals())

const PEDRO = {
  id: 'p-pedro',
  display_name: 'Pedro',
  nickname: null,
  email: null,
  preferred_position: 'DEF',
  can_play_gk: false,
  is_guest: false,
  guest_level: null,
  active: true,
  scoring: {
    composite: 6.25,
    skills: {
      overall: { name: 'Nivel general', value: 7, n_raters: 3, source: 'peers', self_value: 9 },
      pace: { name: 'Velocidad', value: 5, n_raters: 0, source: 'imputed', self_value: null },
    },
  },
}

describe('plantel (admin)', () => {
  it('cada jugador es un botón que despliega el desglose por skill', async () => {
    mockApi({ 'GET /me': { body: ADMIN }, 'GET /players': { body: [PEDRO] } })
    renderApp('/vaca-futbolera/jugadores')
    const toggle = await screen.findByRole('button', { name: /Pedro/ })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(within(toggle).getByText('6.3')).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()

    await userEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    const table = screen.getByRole('table')
    const panel = document.getElementById(toggle.getAttribute('aria-controls') ?? '')
    expect(panel).toContainElement(table)
    const overall = within(table).getByRole('row', { name: /Nivel general/ })
    expect(
      within(overall)
        .getAllByRole('cell')
        .map((c) => c.textContent),
    ).toEqual(['7.0', 'Pares', '3', '9'])
    const pace = within(table).getByRole('row', { name: /Velocidad/ })
    expect(
      within(pace)
        .getAllByRole('cell')
        .map((c) => c.textContent),
    ).toEqual(['5.0', 'Sin datos (5)', '0', '—'])

    await userEvent.click(toggle)
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('se despliega también con el teclado', async () => {
    mockApi({ 'GET /me': { body: ADMIN }, 'GET /players': { body: [PEDRO] } })
    renderApp('/vaca-futbolera/jugadores')
    const toggle = await screen.findByRole('button', { name: /Pedro/ })
    toggle.focus()
    await userEvent.keyboard('{Enter}')
    expect(screen.getByRole('table')).toBeInTheDocument()
  })

  it('un miembro no puede desplegar ni editar', async () => {
    const plain = { ...PEDRO, scoring: undefined }
    mockApi({ 'GET /me': { body: MEMBER }, 'GET /players': { body: [plain] } })
    renderApp('/vaca-futbolera/jugadores')
    expect(await screen.findByText('Pedro')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Pedro/ })).not.toBeInTheDocument()
  })

  it('invitado: muestra su nivel y el admin lo puede editar (sin tabla de skills)', async () => {
    const guest = { ...PEDRO, id: 'p-g', display_name: 'Invitado', scoring: { composite: 7, skills: {} } }
    mockApi({ 'GET /me': { body: ADMIN }, 'GET /players': { body: [guest] } })
    renderApp('/vaca-futbolera/jugadores')
    await userEvent.click(await screen.findByRole('button', { name: /Invitado.*7\.0/ }))
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    expect(screen.getByRole('form', { name: 'Editar Invitado' })).toBeInTheDocument()
  })

  it('el admin edita email, puesto y estado de un jugador', async () => {
    const calls = mockApi({
      'GET /me': { body: ADMIN },
      'GET /players': { body: [PEDRO] },
      'PUT /players/p-pedro': { body: PEDRO },
    })
    renderApp('/vaca-futbolera/jugadores')
    await userEvent.click(await screen.findByRole('button', { name: /Pedro/ }))
    const form = screen.getByRole('form', { name: 'Editar Pedro' })
    await userEvent.type(within(form).getByLabelText('Email'), 'pedro@x.com')
    await userEvent.type(within(form).getByLabelText('Apodo'), 'Pepe')
    await userEvent.selectOptions(within(form).getByLabelText('Puesto'), 'Portero (POR)')
    await userEvent.click(within(form).getByLabelText('Puede atajar'))
    await userEvent.click(within(form).getByLabelText('Activo'))
    await userEvent.click(within(form).getByRole('button', { name: 'Guardar cambios' }))
    expect(await within(form).findByRole('status')).toHaveTextContent('Jugador actualizado')
    expect(calls.find((c) => c.key === 'PUT /players/p-pedro')?.body).toEqual({
      display_name: 'Pedro',
      nickname: 'Pepe',
      email: 'pedro@x.com',
      preferred_position: 'POR',
      can_play_gk: true,
      is_guest: false,
      guest_level: null,
      active: false,
    })
  })

  it('muestra el error al editar y marca los inactivos', async () => {
    mockApi({
      'GET /me': { body: ADMIN },
      'GET /players': { body: [{ ...PEDRO, active: false, email: 'p@x.com', nickname: 'P' }] },
      'PUT /players/p-pedro': { status: 422, body: { detail: 'El jugador necesita un nombre.' } },
    })
    renderApp('/vaca-futbolera/jugadores')
    await userEvent.click(await screen.findByRole('button', { name: /Pedro \(inactivo\)/ }))
    const form = screen.getByRole('form', { name: 'Editar Pedro' })
    expect(within(form).getByLabelText('Email')).toHaveValue('p@x.com')
    await userEvent.clear(within(form).getByLabelText('Email'))
    await userEvent.clear(within(form).getByLabelText('Apodo'))
    await userEvent.selectOptions(within(form).getByLabelText('Puesto'), 'Sin definir')
    await userEvent.click(within(form).getByRole('button', { name: 'Guardar cambios' }))
    expect(await within(form).findByText('El jugador necesita un nombre.')).toBeInTheDocument()
  })
})
