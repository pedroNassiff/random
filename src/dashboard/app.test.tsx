import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { calendar, item, mockApi, PEDRO, renderApp, SIN_ACCESO, UNAUTH } from './test/helpers'

afterEach(() => {
  vi.unstubAllGlobals()
  localStorage.clear()
})

describe('sesión y guardas', () => {
  it('sin sesión redirige al login', async () => {
    mockApi({ 'GET /auth/me': UNAUTH })
    renderApp('/dashboard/impuestos')
    expect(await screen.findByRole('heading', { name: 'Entrar al dashboard' })).toBeInTheDocument()
  })

  it('con sesión pero sin acceso al dashboard no muestra datos y deja salir', async () => {
    const calls = mockApi({ 'GET /auth/me': { body: SIN_ACCESO }, 'POST /auth/logout': { status: 204 } })
    renderApp('/dashboard')
    expect(await screen.findByRole('heading', { name: 'Sin acceso' })).toBeInTheDocument()
    expect(screen.getByText('ana@x.com no tiene acceso al dashboard.')).toBeInTheDocument()
    expect(calls.some((c) => c.key.startsWith('GET /fiscal'))).toBe(false)
    await userEvent.click(screen.getByRole('button', { name: 'Salir' }))
    expect(await screen.findByRole('heading', { name: 'Entrar al dashboard' })).toBeInTheDocument()
  })

  it('login con contraseña entra a Putos Impuestos', async () => {
    const calls = mockApi({
      'GET /auth/me': UNAUTH,
      'POST /auth/login': { body: PEDRO },
      'GET /fiscal/calendar': { body: calendar([item()]) },
    })
    renderApp('/dashboard/entrar')
    await userEvent.type(await screen.findByLabelText('Email'), 'pedro@x.com')
    await userEvent.type(screen.getByLabelText('Contraseña'), 'correcta-123')
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }))
    expect(await screen.findByRole('heading', { name: 'Putos Impuestos' })).toBeInTheDocument()
    expect(calls.find((c) => c.key === 'POST /auth/login')?.body).toEqual({
      email: 'pedro@x.com',
      password: 'correcta-123',
    })
  })

  it('login fallido muestra el error y deja reintentar', async () => {
    mockApi({
      'GET /auth/me': UNAUTH,
      'POST /auth/login': { status: 401, body: { detail: 'Email o contraseña incorrectos.' } },
    })
    renderApp('/dashboard/entrar')
    await userEvent.type(await screen.findByLabelText('Email'), 'pedro@x.com')
    await userEvent.type(screen.getByLabelText('Contraseña'), 'mala')
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Email o contraseña incorrectos.')
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeEnabled()
  })

  it('con sesión, /entrar vuelve al dashboard', async () => {
    mockApi({ 'GET /auth/me': { body: PEDRO }, 'GET /fiscal/calendar': { body: calendar([]) } })
    renderApp('/dashboard/entrar')
    expect(await screen.findByRole('heading', { name: 'Putos Impuestos' })).toBeInTheDocument()
  })
})

describe('shell', () => {
  it('el sidebar tiene Putos Impuestos, la cuenta y las pestañas de la sección', async () => {
    mockApi({ 'GET /auth/me': { body: PEDRO }, 'GET /fiscal/calendar': { body: calendar([]) } })
    renderApp('/dashboard')
    const nav = await screen.findByRole('navigation', { name: 'Secciones del dashboard' })
    expect(nav).toHaveTextContent('Putos Impuestos')
    expect(screen.getByRole('link', { name: 'Putos Impuestos' })).toHaveAttribute(
      'href',
      '/dashboard/impuestos',
    )
    expect(screen.getByText('pedro@x.com')).toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: 'Putos Impuestos' })).toBeInTheDocument()
    for (const tab of ['Calendario', 'Plazos', 'Perfil fiscal'])
      expect(screen.getByRole('link', { name: tab })).toBeInTheDocument()
  })

  it('una ruta desconocida vuelve a impuestos', async () => {
    mockApi({ 'GET /auth/me': { body: PEDRO }, 'GET /fiscal/calendar': { body: calendar([]) } })
    renderApp('/dashboard/no-existe')
    expect(await screen.findByRole('heading', { name: 'Putos Impuestos' })).toBeInTheDocument()
    expect(await screen.findByText('Nada vencido.')).toBeInTheDocument()
  })

  it('salir cierra la sesión', async () => {
    const calls = mockApi({
      'GET /auth/me': { body: PEDRO },
      'GET /fiscal/calendar': { body: calendar([]) },
      'POST /auth/logout': { status: 204 },
    })
    renderApp('/dashboard')
    await userEvent.click(await screen.findByRole('button', { name: 'Salir' }))
    await waitFor(() => expect(calls.some((c) => c.key === 'POST /auth/logout')).toBe(true))
    expect(await screen.findByRole('heading', { name: 'Entrar al dashboard' })).toBeInTheDocument()
  })
})

describe('recordarme', () => {
  const LOGIN = {
    'GET /auth/me': UNAUTH,
    'POST /auth/login': { body: PEDRO },
    'GET /fiscal/calendar': { body: calendar([]) },
  }

  async function login() {
    await userEvent.type(screen.getByLabelText('Contraseña'), 'correcta-123')
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }))
    await screen.findByRole('heading', { name: 'Putos Impuestos' })
  }

  it('por defecto recuerda el email (nunca la contraseña) y lo precarga la próxima vez', async () => {
    mockApi(LOGIN)
    const first = renderApp('/dashboard/entrar')
    expect(await screen.findByLabelText('Recordar mi email en este equipo')).toBeChecked()
    await userEvent.type(screen.getByLabelText('Email'), ' pedro@x.com ')
    await login()
    expect(localStorage.getItem('rdash:email')).toBe('pedro@x.com')
    expect(JSON.stringify({ ...localStorage })).not.toContain('correcta-123')

    first.unmount()
    renderApp('/dashboard/entrar')
    expect(await screen.findByLabelText('Email')).toHaveValue('pedro@x.com')
    expect(screen.getByLabelText('Contraseña')).toHaveValue('')
  })

  it('si se desmarca, olvida el email guardado', async () => {
    localStorage.setItem('rdash:email', 'pedro@x.com')
    mockApi(LOGIN)
    renderApp('/dashboard/entrar')
    await userEvent.click(await screen.findByLabelText('Recordar mi email en este equipo'))
    await login()
    expect(localStorage.getItem('rdash:email')).toBeNull()
  })

  it('un login fallido no guarda nada', async () => {
    mockApi({ 'GET /auth/me': UNAUTH, 'POST /auth/login': { status: 401, body: { detail: 'No.' } } })
    renderApp('/dashboard/entrar')
    await userEvent.type(await screen.findByLabelText('Email'), 'pedro@x.com')
    await userEvent.type(screen.getByLabelText('Contraseña'), 'mala')
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }))
    await screen.findByRole('alert')
    expect(localStorage.getItem('rdash:email')).toBeNull()
  })

  it('con el almacenamiento bloqueado el login funciona igual', async () => {
    const blocked = () => {
      throw new Error('bloqueado')
    }
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(blocked)
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(blocked)
    mockApi(LOGIN)
    renderApp('/dashboard/entrar')
    await userEvent.type(await screen.findByLabelText('Email'), 'pedro@x.com')
    await login()
    vi.restoreAllMocks()
  })
})
