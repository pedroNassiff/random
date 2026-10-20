import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MEMBER, mockApi, renderApp } from './test/helpers'

afterEach(() => vi.unstubAllGlobals())

const UNAUTH = { status: 401, body: { detail: 'Iniciá sesión.' } }

describe('contraseña', () => {
  it('entra con email y contraseña', async () => {
    const calls = mockApi({ 'GET /me': UNAUTH, 'POST /auth/login': { body: MEMBER } })
    renderApp('/vaca-futbolera/entrar')
    await userEvent.type(await screen.findByLabelText('Tu email'), 'juan@x.com')
    await userEvent.type(screen.getByLabelText('Contraseña'), 'mi-clave-segura')
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }))
    expect(await screen.findByRole('heading', { name: 'Próximo partido' })).toBeInTheDocument()
    expect(calls.find((c) => c.key === 'POST /auth/login')?.body).toEqual({
      email: 'juan@x.com',
      password: 'mi-clave-segura',
    })
  })

  it('credenciales incorrectas muestran el error y se puede volver a intentar', async () => {
    mockApi({
      'GET /me': UNAUTH,
      'POST /auth/login': { status: 401, body: { detail: 'Email o contraseña incorrectos.' } },
    })
    renderApp('/vaca-futbolera/entrar')
    await userEvent.type(await screen.findByLabelText('Tu email'), 'juan@x.com')
    await userEvent.type(screen.getByLabelText('Contraseña'), 'mala')
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }))
    expect(await screen.findByText('Email o contraseña incorrectos.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeEnabled()
  })

  it('desde "Primera vez" se puede volver al login con contraseña', async () => {
    mockApi({ 'GET /me': UNAUTH })
    renderApp('/vaca-futbolera/entrar')
    await userEvent.click(await screen.findByRole('button', { name: /Primera vez/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Ya tengo contraseña' }))
    expect(screen.getByLabelText('Contraseña')).toBeInTheDocument()
  })

  it('sin contraseña, cualquier ruta obliga a crearla primero', async () => {
    mockApi({ 'GET /me': { body: { ...MEMBER, has_password: false } } })
    renderApp('/vaca-futbolera/jugadores')
    expect(await screen.findByRole('heading', { name: 'Creá tu contraseña' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Seguir sin cambiarla' })).not.toBeInTheDocument()
  })

  it('valida largo y coincidencia antes de llamar a la API', async () => {
    const calls = mockApi({ 'GET /me': { body: { ...MEMBER, has_password: false } } })
    renderApp('/vaca-futbolera/contrasena')
    const pass = await screen.findByLabelText(/Contraseña nueva/)
    await userEvent.type(pass, 'corta')
    await userEvent.type(screen.getByLabelText('Repetila'), 'corta')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar contraseña' }))
    expect(await screen.findByText('Usá al menos 8 caracteres.')).toBeInTheDocument()
    await userEvent.clear(pass)
    await userEvent.type(pass, 'mi-clave-segura')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar contraseña' }))
    expect(await screen.findByText('Las contraseñas no coinciden.')).toBeInTheDocument()
    expect(calls.some((c) => c.key === 'PUT /auth/password')).toBe(false)
  })

  it('crea la contraseña y entra a la app', async () => {
    const calls = mockApi({
      'GET /me': { body: { ...MEMBER, has_password: false } },
      'PUT /auth/password': { body: MEMBER },
    })
    renderApp('/vaca-futbolera/contrasena')
    await userEvent.type(await screen.findByLabelText(/Contraseña nueva/), 'mi-clave-segura')
    await userEvent.type(screen.getByLabelText('Repetila'), 'mi-clave-segura')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar contraseña' }))
    expect(await screen.findByRole('heading', { name: 'Próximo partido' })).toBeInTheDocument()
    expect(calls.find((c) => c.key === 'PUT /auth/password')?.body).toEqual({ password: 'mi-clave-segura' })
  })

  it('con contraseña ya creada: cambiarla es opcional y el backend puede rechazarla', async () => {
    mockApi({
      'GET /me': { body: MEMBER },
      'PUT /auth/password': {
        status: 422,
        body: { detail: 'La contraseña puede tener hasta 128 caracteres.' },
      },
    })
    renderApp('/vaca-futbolera')
    await userEvent.click(await screen.findByRole('button', { name: 'Cuenta de juan@x.com' }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Cambiar contraseña' }))
    expect(await screen.findByRole('heading', { name: 'Cambiar contraseña' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Seguir sin cambiarla' })).toBeInTheDocument()
    await userEvent.type(screen.getByLabelText(/Contraseña nueva/), 'mi-clave-segura')
    await userEvent.type(screen.getByLabelText('Repetila'), 'mi-clave-segura')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar contraseña' }))
    expect(await screen.findByText(/hasta 128 caracteres/)).toBeInTheDocument()
  })
})
