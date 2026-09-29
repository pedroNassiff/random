import { render } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { vi } from 'vitest'
import VacaFutbolera from '../VacaFutbolera'

type Reply = { status?: number; body?: unknown } | ((body: unknown) => { status?: number; body?: unknown })

export interface Call {
  key: string
  body: unknown
}

/** Simula fetch por "METHOD /path" (sin el prefijo /api/futbol). Registra las llamadas. */
export function mockApi(routes: Record<string, Reply>) {
  const calls: Call[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      const key = `${init?.method ?? 'GET'} ${url.replace('/api/futbol', '')}`
      const body = init?.body ? JSON.parse(init.body as string) : undefined
      calls.push({ key, body })
      const found = routes[key]
      if (!found) return new Response(JSON.stringify({ detail: `sin mock para ${key}` }), { status: 500 })
      const r = typeof found === 'function' ? found(body) : found
      const status = r.status ?? 200
      if (status === 204) return new Response(null, { status })
      return new Response(JSON.stringify(r.body ?? {}), { status })
    }),
  )
  return calls
}

export const ADMIN = { email: 'boss@x.com', role: 'admin', player_id: null, has_password: true }
export const MEMBER = { email: 'juan@x.com', role: 'member', player_id: 'p-juan', has_password: true }

export function renderApp(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/vaca-futbolera/*" element={<VacaFutbolera />} />
      </Routes>
    </MemoryRouter>,
  )
}
