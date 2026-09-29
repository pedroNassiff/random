import { afterEach, describe, expect, it, vi } from 'vitest'
import { api, ApiError, errorText } from './api'

afterEach(() => vi.unstubAllGlobals())

const reply = (status: number, body?: unknown, raw?: string) =>
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(status === 204 ? null : (raw ?? JSON.stringify(body)), { status })),
  )

/** Primera llamada registrada a fetch, con chequeo explícito en vez de `!`. */
function firstCall(): [string, RequestInit] {
  const call = vi.mocked(fetch).mock.calls[0]
  if (!call) throw new Error('fetch no fue llamado')
  return [String(call[0]), call[1] ?? {}]
}

describe('api client', () => {
  it('envía cookies y JSON y devuelve el cuerpo', async () => {
    reply(200, { email: 'a@x.com', role: 'member', player_id: null, has_password: true })
    expect((await api.me()).role).toBe('member')
    const [url, init] = firstCall()
    expect(url).toBe('/api/futbol/me')
    expect(init).toMatchObject({ credentials: 'include', method: 'GET' })
  })

  it('serializa el cuerpo y pone Content-Type en las mutaciones', async () => {
    reply(200, { id: '1' })
    await api.verifyLink('tok')
    const [, init] = firstCall()
    expect(init.body).toBe('{"token":"tok"}')
    expect(init.headers).toEqual({ 'Content-Type': 'application/json' })
  })

  it('los comandos 202/204 resuelven sin cuerpo', async () => {
    reply(204)
    await expect(api.logout()).resolves.toBeUndefined()
    reply(204)
    await expect(api.rate('p1', { s1: 5 })).resolves.toBeUndefined()
    reply(202, { status: 'ok' })
    await expect(api.requestLink('a@x.com')).resolves.toBeUndefined()
  })

  it('usa el detail del backend como mensaje', async () => {
    reply(403, { detail: 'Solo el admin puede hacer esto.' })
    const err = await api
      .createSkill({ key: 'k', name: 'n', description: '', weight: 1, is_active: true, sort_order: 0 })
      .catch((e: unknown) => e)
    expect(err).toBeInstanceOf(ApiError)
    expect(err).toMatchObject({ status: 403, message: 'Solo el admin puede hacer esto.' })
  })

  it('traduce 422 de validación (detail no string) y errores no JSON', async () => {
    reply(422, { detail: [{ msg: 'x' }] })
    await expect(api.skills()).rejects.toThrow('Revisá los datos')
    reply(502, undefined, '<html>bad gateway</html>')
    await expect(api.players()).rejects.toThrow('Algo salió mal')
  })

  it('login y setPassword usan las rutas y métodos correctos', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('{}', { status: 200 })),
    )
    await api.login('a@x.com', 'clave-larga')
    await api.setPassword('clave-larga')
    const calls = vi.mocked(fetch).mock.calls.map((c) => `${c[1]?.method} ${c[0]} ${c[1]?.body}`)
    expect(calls).toEqual([
      'POST /api/futbol/auth/login {"email":"a@x.com","password":"clave-larga"}',
      'PUT /api/futbol/auth/password {"password":"clave-larga"}',
    ])
  })

  it('errorText tolera valores que no son Error', () => {
    expect(errorText(new Error('boom'))).toBe('boom')
    expect(errorText('x')).toBe('Algo salió mal. Intentá de nuevo.')
  })

  it('arma las rutas de recursos', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('[]', { status: 200 })),
    )
    await api.players()
    await api.skills()
    await api.myRatings('p1')
    await api.updateSkill('s1', {
      key: 'k',
      name: 'n',
      description: '',
      weight: 1,
      is_active: true,
      sort_order: 0,
    })
    await api.createPlayer({
      display_name: 'A',
      nickname: null,
      email: null,
      preferred_position: null,
      can_play_gk: false,
      is_guest: false,
      guest_level: null,
      active: true,
    })
    await api.updatePlayer('p1', {
      display_name: 'A',
      nickname: null,
      email: null,
      preferred_position: null,
      can_play_gk: false,
      is_guest: false,
      guest_level: null,
      active: true,
    })
    const urls = vi.mocked(fetch).mock.calls.map((c) => `${c[1]?.method} ${c[0]}`)
    expect(urls).toEqual([
      'GET /api/futbol/players',
      'GET /api/futbol/skills',
      'GET /api/futbol/players/p1/ratings',
      'PUT /api/futbol/skills/s1',
      'POST /api/futbol/players',
      'PUT /api/futbol/players/p1',
    ])
  })
})
