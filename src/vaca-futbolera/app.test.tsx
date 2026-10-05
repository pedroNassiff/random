import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StrictMode } from 'react'
import { render } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import VacaFutbolera from './VacaFutbolera'
import { ADMIN, MEMBER, mockApi, renderApp } from './test/helpers'

afterEach(() => vi.unstubAllGlobals())

const SKILLS = [
  {
    id: 's-pace',
    key: 'pace',
    name: 'Velocidad',
    description: 'Velocidad punta',
    weight: 1,
    is_active: true,
    sort_order: 1,
  },
  { id: 's-old', key: 'old', name: 'Vieja', description: '', weight: 1, is_active: false, sort_order: 2 },
]
const PLAYER = {
  id: 'p-ana',
  display_name: 'Ana',
  nickname: null,
  email: null,
  preferred_position: 'MED',
  can_play_gk: false,
  is_guest: false,
  guest_level: null,
  active: true,
}
const UNAUTH = { status: 401, body: { detail: 'Iniciá sesión.' } }

describe('sesión y guardas', () => {
  it('sin sesión redirige a /entrar', async () => {
    mockApi({ 'GET /me': UNAUTH })
    renderApp('/vaca-futbolera/jugadores')
    expect(await screen.findByRole('heading', { name: 'Entrar a Fútbol Vaquero' })).toBeInTheDocument()
  })

  it('miembro: ve Partido y Jugadores, pero no la pestaña Skills', async () => {
    mockApi({ 'GET /me': { body: MEMBER } })
    renderApp('/vaca-futbolera')
    expect(await screen.findByRole('heading', { name: 'Próximo partido' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Jugadores' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Skills' })).not.toBeInTheDocument()
  })

  it('miembro que abre /skills por URL vuelve al inicio', async () => {
    mockApi({ 'GET /me': { body: MEMBER } })
    renderApp('/vaca-futbolera/skills')
    expect(await screen.findByRole('heading', { name: 'Próximo partido' })).toBeInTheDocument()
  })

  it('admin ve la pestaña Skills; el encabezado tiene la marca al centro y la cuenta a la derecha', async () => {
    mockApi({ 'GET /me': { body: ADMIN }, 'GET /matches/current': { body: { match: null } } })
    renderApp('/vaca-futbolera')
    expect(await screen.findByRole('link', { name: 'Skills' })).toBeInTheDocument()
    const brand = screen.getByRole('link', { name: 'Fútbol Vaquero, inicio' })
    expect(brand).toHaveAttribute('href', '/vaca-futbolera')
    expect(brand.querySelector('img')).toHaveAttribute('src', '/lavaca-256.png')
    expect(brand).toHaveTextContent('.RANDOM()')
    // La cuenta es un círculo con la inicial; sus opciones no se ven hasta abrirlo.
    const account = screen.getByRole('button', { name: 'Cuenta de boss@x.com' })
    expect(account).toHaveTextContent('B')
    expect(screen.queryByRole('button', { name: 'Salir' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Contraseña' })).not.toBeInTheDocument()
  })
  it('una ruta desconocida vuelve al inicio', async () => {
    mockApi({ 'GET /me': { body: MEMBER } })
    renderApp('/vaca-futbolera/no-existe')
    expect(await screen.findByRole('heading', { name: 'Próximo partido' })).toBeInTheDocument()
  })

  it('Salir cierra la sesión y manda a /entrar', async () => {
    const calls = mockApi({ 'GET /me': { body: MEMBER }, 'POST /auth/logout': { status: 204 } })
    renderApp('/vaca-futbolera')
    await userEvent.click(await screen.findByRole('button', { name: 'Cuenta de juan@x.com' }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Salir' }))
    expect(await screen.findByRole('heading', { name: 'Entrar a Fútbol Vaquero' })).toBeInTheDocument()
    expect(calls.map((c) => c.key)).toContain('POST /auth/logout')
  })

  it('/dev/ui es accesible sin sesión', async () => {
    mockApi({ 'GET /me': UNAUTH })
    renderApp('/vaca-futbolera/dev/ui')
    expect(await screen.findByRole('heading', { name: 'Componentes base' })).toBeInTheDocument()
  })
})

describe('login', () => {
  it('pide el link por email y confirma sin revelar si existe', async () => {
    const calls = mockApi({ 'GET /me': UNAUTH, 'POST /auth/request': { status: 202, body: {} } })
    renderApp('/vaca-futbolera/entrar')
    await userEvent.click(await screen.findByRole('button', { name: /Primera vez/ }))
    await userEvent.type(screen.getByLabelText('Tu email'), 'juan@x.com')
    await userEvent.click(screen.getByRole('button', { name: 'Enviar link' }))
    expect(await screen.findByText(/Si tu email está en el grupo/)).toBeInTheDocument()
    expect(calls.find((c) => c.key === 'POST /auth/request')?.body).toEqual({ email: 'juan@x.com' })
  })

  it('muestra el error si falla el envío', async () => {
    mockApi({ 'GET /me': UNAUTH, 'POST /auth/request': { status: 500, body: { detail: 'SMTP caído' } } })
    renderApp('/vaca-futbolera/entrar')
    await userEvent.click(await screen.findByRole('button', { name: /Primera vez/ }))
    await userEvent.type(screen.getByLabelText('Tu email'), 'juan@x.com')
    await userEvent.click(screen.getByRole('button', { name: 'Enviar link' }))
    expect(await screen.findByText('SMTP caído')).toBeInTheDocument()
  })

  it('canjea el token UNA sola vez aunque StrictMode duplique el efecto, y pide crear la contraseña', async () => {
    const calls = mockApi({
      'GET /me': UNAUTH,
      'POST /auth/verify': { body: { ...MEMBER, has_password: false } },
    })
    render(
      <StrictMode>
        <MemoryRouter initialEntries={['/vaca-futbolera/entrar?token=abcdefghij123']}>
          <Routes>
            <Route path="/vaca-futbolera/*" element={<VacaFutbolera />} />
          </Routes>
        </MemoryRouter>
      </StrictMode>,
    )
    expect(await screen.findByRole('heading', { name: 'Creá tu contraseña' })).toBeInTheDocument()
    expect(calls.filter((c) => c.key === 'POST /auth/verify')).toHaveLength(1)
    expect(calls.find((c) => c.key === 'POST /auth/verify')?.body).toEqual({ token: 'abcdefghij123' })
  })

  it('un link vencido muestra el error y permite pedir otro', async () => {
    mockApi({
      'GET /me': UNAUTH,
      'POST /auth/verify': { status: 401, body: { detail: 'El link venció o ya se usó. Pedí uno nuevo.' } },
    })
    renderApp('/vaca-futbolera/entrar?token=abcdefghij123')
    expect(await screen.findByText(/El link venció/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Enviar link' })).toBeInTheDocument()
  })
})

describe('jugadores', () => {
  it('miembro: ve la lista con Puntuar y sin puntajes', async () => {
    mockApi({ 'GET /me': { body: MEMBER }, 'GET /players': { body: [PLAYER] } })
    renderApp('/vaca-futbolera/jugadores')
    expect(await screen.findByText('Ana')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Puntuar' })).toHaveAttribute(
      'href',
      '/vaca-futbolera/jugadores/p-ana/puntuar',
    )
    expect(screen.queryByRole('button', { name: /Ana/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Agregar jugador' })).not.toBeInTheDocument()
  })

  it('usuario sin jugador vinculado no ve Puntuar', async () => {
    mockApi({ 'GET /me': { body: ADMIN }, 'GET /players': { body: [PLAYER] } })
    renderApp('/vaca-futbolera/jugadores')
    expect(await screen.findByText('Ana')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Puntuar' })).not.toBeInTheDocument()
  })

  it('lista vacía invita a actuar', async () => {
    mockApi({ 'GET /me': { body: MEMBER }, 'GET /players': { body: [] } })
    renderApp('/vaca-futbolera/jugadores')
    expect(await screen.findByText(/Todavía no hay jugadores/)).toBeInTheDocument()
  })

  it('error al cargar se muestra', async () => {
    mockApi({ 'GET /me': { body: MEMBER }, 'GET /players': { status: 500, body: { detail: 'DB caída' } } })
    renderApp('/vaca-futbolera/jugadores')
    expect(await screen.findByText('DB caída')).toBeInTheDocument()
  })

  it('admin agrega un jugador y se recarga la lista', async () => {
    let created = false
    const calls = mockApi({
      'GET /me': { body: ADMIN },
      'GET /players': () => ({ body: created ? [PLAYER] : [] }),
      'POST /players': () => {
        created = true
        return { status: 201, body: PLAYER }
      },
    })
    renderApp('/vaca-futbolera/jugadores')
    await userEvent.type(await screen.findByLabelText('Nombre'), 'Ana')
    await userEvent.type(screen.getByLabelText('Email (para invitarlo)'), 'ana@x.com')
    await userEvent.selectOptions(screen.getByLabelText('Puesto'), 'Portero (POR)')
    await userEvent.click(screen.getByRole('button', { name: 'Agregar' }))
    expect(await screen.findByText('Ana', { selector: 'strong' })).toBeInTheDocument()
    expect(calls.find((c) => c.key === 'POST /players')?.body).toMatchObject({
      display_name: 'Ana',
      email: 'ana@x.com',
      preferred_position: 'POR',
      can_play_gk: true,
    })
  })

  it('admin ve el error de validación al agregar', async () => {
    mockApi({
      'GET /me': { body: ADMIN },
      'GET /players': { body: [] },
      'POST /players': { status: 422, body: { detail: 'El jugador necesita un nombre.' } },
    })
    renderApp('/vaca-futbolera/jugadores')
    await userEvent.type(await screen.findByLabelText('Nombre'), 'x')
    await userEvent.click(screen.getByRole('button', { name: 'Agregar' }))
    expect(await screen.findByText('El jugador necesita un nombre.')).toBeInTheDocument()
  })
})

describe('puntuar', () => {
  const routes = (extra = {}) => ({
    'GET /me': { body: MEMBER },
    'GET /skills': { body: SKILLS },
    'GET /players': { body: [PLAYER] },
    'GET /players/p-ana/ratings': { body: { 's-pace': 4 } },
    ...extra,
  })

  it('muestra solo skills activas, con mis valores previos', async () => {
    mockApi(routes())
    renderApp('/vaca-futbolera/jugadores/p-ana/puntuar')
    const slider = await screen.findByRole('slider', { name: 'Velocidad' })
    expect(slider).toHaveAttribute('aria-valuenow', '4')
    expect(screen.queryByRole('slider', { name: 'Vieja' })).not.toBeInTheDocument()
    expect(screen.getByText(/anónimos/)).toBeInTheDocument()
  })

  it('cambia el valor con el teclado y guarda solo lo puntuado', async () => {
    const calls = mockApi(routes({ 'PUT /players/p-ana/ratings': { status: 204 } }))
    renderApp('/vaca-futbolera/jugadores/p-ana/puntuar')
    const slider = await screen.findByRole('slider', { name: 'Velocidad' })
    slider.focus()
    await userEvent.keyboard('{ArrowRight}{ArrowRight}')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(await screen.findByRole('status')).toHaveTextContent('Puntajes guardados')
    expect(calls.find((c) => c.key === 'PUT /players/p-ana/ratings')?.body).toEqual({
      ratings: { 's-pace': 6 },
    })
  })

  it('avisa que la autoevaluación no cuenta', async () => {
    mockApi(routes({ 'GET /me': { body: { ...MEMBER, player_id: 'p-ana' } } }))
    renderApp('/vaca-futbolera/jugadores/p-ana/puntuar')
    expect(await screen.findByText(/no cuenta en el puntaje del grupo/)).toBeInTheDocument()
  })

  it('muestra el error del backend al guardar', async () => {
    mockApi(
      routes({
        'PUT /players/p-ana/ratings': { status: 403, body: { detail: 'Tu usuario no está vinculado.' } },
      }),
    )
    renderApp('/vaca-futbolera/jugadores/p-ana/puntuar')
    await screen.findByRole('slider', { name: 'Velocidad' })
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(await screen.findByText('Tu usuario no está vinculado.')).toBeInTheDocument()
  })

  it('jugador inexistente y error de carga', async () => {
    mockApi(routes({ 'GET /players': { body: [] } }))
    renderApp('/vaca-futbolera/jugadores/p-ana/puntuar')
    expect(await screen.findByText('Jugador no encontrado.')).toBeInTheDocument()
    mockApi(routes({ 'GET /skills': { status: 500, body: { detail: 'falló' } } }))
    renderApp('/vaca-futbolera/jugadores/p-ana/puntuar')
    expect(await screen.findByText('falló')).toBeInTheDocument()
  })
})

describe('skills (admin)', () => {
  it('lista, crea una skill nueva y recarga', async () => {
    let extra = false
    const calls = mockApi({
      'GET /me': { body: ADMIN },
      'GET /skills': () => ({
        body: extra
          ? [...SKILLS, { ...SKILLS[0], id: 's-air', key: 'juego_aereo', name: 'Juego aéreo' }]
          : SKILLS,
      }),
      'POST /skills': () => {
        extra = true
        return { status: 201, body: {} }
      },
    })
    renderApp('/vaca-futbolera/skills')
    expect(await screen.findByText('Velocidad')).toBeInTheDocument()
    await userEvent.type(screen.getByLabelText('Nombre'), 'Juego aéreo')
    await userEvent.type(screen.getByLabelText(/Clave/), 'juego_aereo')
    await userEvent.type(screen.getByLabelText('Descripción'), 'Cabeceo')
    await userEvent.click(screen.getByRole('button', { name: 'Crear skill' }))
    expect(await screen.findByText('Juego aéreo', { selector: 'strong' })).toBeInTheDocument()
    expect(calls.find((c) => c.key === 'POST /skills')?.body).toMatchObject({
      key: 'juego_aereo',
      weight: 1,
      is_active: true,
    })
  })

  it('muestra el error de skill duplicada', async () => {
    mockApi({
      'GET /me': { body: ADMIN },
      'GET /skills': { body: [] },
      'POST /skills': { status: 422, body: { detail: 'Ya existe una skill con esa clave.' } },
    })
    renderApp('/vaca-futbolera/skills')
    await userEvent.type(await screen.findByLabelText('Nombre'), 'X')
    await userEvent.type(screen.getByLabelText(/Clave/), 'pace')
    await userEvent.click(screen.getByRole('button', { name: 'Crear skill' }))
    expect(await screen.findByText('Ya existe una skill con esa clave.')).toBeInTheDocument()
  })

  it('cambia peso y desactiva una skill (nunca se borra)', async () => {
    const calls = mockApi({
      'GET /me': { body: ADMIN },
      'GET /skills': { body: [SKILLS[0]] },
      'PUT /skills/s-pace': { body: {} },
    })
    renderApp('/vaca-futbolera/skills')
    const weight = await screen.findByLabelText('Peso (0–3)', { selector: '#w-s-pace' })
    await userEvent.clear(weight)
    await userEvent.type(weight, '2.5')
    await userEvent.click(screen.getByRole('checkbox', { name: 'Activa' }))
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(calls.some((c) => c.key === 'PUT /skills/s-pace')).toBe(true))
    expect(calls.find((c) => c.key === 'PUT /skills/s-pace')?.body).toMatchObject({
      key: 'pace',
      weight: 2.5,
      is_active: false,
    })
  })

  it('error al actualizar una skill', async () => {
    mockApi({
      'GET /me': { body: ADMIN },
      'GET /skills': { body: [SKILLS[0]] },
      'PUT /skills/s-pace': { status: 422, body: { detail: 'El peso va de 0 a 3.' } },
    })
    renderApp('/vaca-futbolera/skills')
    await userEvent.click(await screen.findByRole('button', { name: 'Guardar' }))
    expect(await screen.findByText('El peso va de 0 a 3.')).toBeInTheDocument()
  })

  it('error al cargar skills', async () => {
    mockApi({ 'GET /me': { body: ADMIN }, 'GET /skills': { status: 500, body: { detail: 'DB caída' } } })
    renderApp('/vaca-futbolera/skills')
    expect(await screen.findByText('DB caída')).toBeInTheDocument()
  })
})
