import { afterEach, describe, expect, it, vi } from 'vitest'
import { api, ApiError } from './api'

afterEach(() => vi.unstubAllGlobals())

const reply = (status: number, body?: unknown, raw?: string) =>
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(status === 204 ? null : (raw ?? JSON.stringify(body)), { status })),
  )

function firstCall(): [string, RequestInit] {
  const call = vi.mocked(fetch).mock.calls[0]
  if (!call) throw new Error('fetch no fue llamado')
  return [String(call[0]), call[1] ?? {}]
}

describe('cliente del dashboard', () => {
  it('la sesión va contra /api/auth con cookies', async () => {
    reply(200, { email: 'a@x.com', has_password: true, apps: ['dashboard'] })
    expect((await api.login('a@x.com', 'clave')).apps).toEqual(['dashboard'])
    const [url, init] = firstCall()
    expect(url).toBe('/api/auth/login')
    expect(init).toMatchObject({ credentials: 'include', method: 'POST' })
    expect(init.body).toBe('{"email":"a@x.com","password":"clave"}')
    expect(init.headers).toEqual({ 'Content-Type': 'application/json' })
  })

  it('logout resuelve sin cuerpo', async () => {
    reply(204)
    await expect(api.logout()).resolves.toBeUndefined()
    expect(firstCall()[0]).toBe('/api/auth/logout')
  })

  it('el calendario sin perfil (404) es null, no un error', async () => {
    reply(404, { detail: 'Primero cargá tu perfil fiscal.' })
    await expect(api.calendar()).resolves.toBeNull()
  })

  it('otros errores del calendario se propagan con el detail del backend', async () => {
    reply(403, { detail: 'Tu usuario no tiene acceso a esta sección.' })
    const err = await api.calendar().catch((e: unknown) => e)
    expect(err).toBeInstanceOf(ApiError)
    expect(err).toMatchObject({ status: 403, message: 'Tu usuario no tiene acceso a esta sección.' })
  })

  it('codifica la clave de la obligación y manda estado y justificante', async () => {
    reply(200, {})
    await api.setStatus('RETA-2026-tarifa-plana', 'pagado', 'CSV 1')
    const [url, init] = firstCall()
    expect(url).toBe('/api/fiscal/obligations/RETA-2026-tarifa-plana/status')
    expect(init.method).toBe('PUT')
    expect(init.body).toBe('{"estado":"pagado","justificante":"CSV 1"}')
  })

  it('traduce 422 sin detail legible y respuestas no JSON', async () => {
    reply(422, { detail: [{ msg: 'x' }] })
    await expect(api.profile()).rejects.toThrow('Revisá los datos')
    reply(502, undefined, '<html>bad gateway</html>')
    await expect(api.deadline({ tipo: 'apremio', fecha_notificacion: '2026-09-16' })).rejects.toThrow(
      'Algo salió mal',
    )
  })
})
