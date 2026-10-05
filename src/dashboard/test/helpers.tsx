import { render } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { vi } from 'vitest'
import Dashboard from '../Dashboard'
import type { CalendarItem, CalendarView, Me, Profile } from '../types'

type Reply = { status?: number; body?: unknown } | ((body: unknown) => { status?: number; body?: unknown })

export interface Call {
  key: string
  body: unknown
}

/** Simula fetch por "METHOD /ruta" (sin el prefijo /api). Registra las llamadas. */
export function mockApi(routes: Record<string, Reply>) {
  const calls: Call[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      const key = `${init?.method ?? 'GET'} ${url.replace('/api', '')}`
      const body = init?.body ? JSON.parse(init.body as string) : undefined
      calls.push({ key, body })
      const found = routes[key]
      if (!found) return new Response(JSON.stringify({ detail: `sin mock para ${key}` }), { status: 500 })
      const r = typeof found === 'function' ? found(body) : found
      const status = r.status ?? 200
      if (status === 204) return new Response(null, { status })
      return new Response(JSON.stringify(r.body ?? null), { status })
    }),
  )
  return calls
}

export const PEDRO: Me = { email: 'pedro@x.com', has_password: true, apps: ['dashboard'] }
export const SIN_ACCESO: Me = { email: 'ana@x.com', has_password: true, apps: [] }
export const UNAUTH = { status: 401, body: { detail: 'Iniciá sesión.' } }

export const PROFILE: Profile = {
  version: 1,
  nif: '12345678Z',
  fecha_alta: '2025-12-05',
  iae: '763',
  regimen_iva: 'general',
  regimen_irpf: 'directa_simplificada',
  roi: true,
  tarifa_plana_hasta: '2026-12-05',
  domicilio_fiscal: "Carrer de l'Exemple 1",
  municipio: 'Barcelona',
  comunidad: 'Cataluña',
}

export function item(patch: Partial<CalendarItem> = {}): CalendarItem {
  return {
    key: '303-2026-3T',
    modelo: '303',
    ejercicio: 2026,
    periodo: '3T',
    titulo: 'IVA 3T 2026',
    vence: '2026-10-20',
    vence_nominal: '2026-10-20',
    provisional: false,
    condicional: false,
    nota: '',
    fuente: 'RIVA art. 71.4',
    estado: 'pendiente',
    justificante: null,
    aviso: 'sin_aviso',
    dias_restantes: 19,
    ...patch,
  }
}

export function calendar(items: CalendarItem[]): CalendarView {
  return { hoy: '2026-10-01', festivos_cargados: [2026], items }
}

export function renderApp(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/dashboard/*" element={<Dashboard />} />
      </Routes>
    </MemoryRouter>,
  )
}
