import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { calendar, mockApi, PEDRO, renderApp } from './test/helpers'
import { tourSteps } from './tour'
import type { Onboarding } from './types'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  localStorage.clear()
})

const step = (clave: string, titulo: string, estado: 'hecho' | 'pendiente' | 'opcional', detalle = '') => ({
  clave,
  titulo,
  estado,
  documento: `documento de ${clave}`,
  completa: `datos de ${clave}`,
  detalle,
})
const EMPTY: Onboarding = {
  siguiente: 'perfil',
  pasos: [
    step('perfil', 'Perfil fiscal', 'pendiente'),
    step('tarifa_plana', 'Tarifa plana de autónomos', 'opcional', 'Solo si tenés tarifa plana.'),
    step('facturas', 'Facturas emitidas', 'pendiente'),
    step('justificantes', 'Obligaciones vencidas sin cerrar', 'pendiente'),
    step('notificaciones', 'Notificaciones abiertas', 'opcional'),
  ],
}
const WITH_PROFILE: Onboarding = {
  siguiente: 'facturas',
  pasos: EMPTY.pasos.map((p) => (p.clave === 'perfil' ? { ...p, estado: 'hecho' as const } : p)),
}
const DONE: Onboarding = {
  siguiente: null,
  pasos: EMPTY.pasos.map((p) => ({ ...p, estado: 'hecho' as const })),
}

const routes = (onboarding: Onboarding) => ({
  'GET /auth/me': { body: PEDRO },
  'GET /fiscal/calendar': { body: calendar([]) },
  'GET /fiscal/onboarding': { body: onboarding },
})
const next = () => userEvent.click(screen.getByRole('button', { name: 'Siguiente' }))

describe('tourSteps', () => {
  it('arma bienvenida, un paso por cosa a cargar y el cierre con NEO', () => {
    const steps = tourSteps(EMPTY)
    expect(steps.map((s) => s.title)).toEqual([
      'Armemos tu base fiscal',
      'Perfil fiscal',
      'Tarifa plana de autónomos',
      'Facturas emitidas',
      'Obligaciones vencidas sin cerrar',
      'Notificaciones abiertas',
      'Empezá con NEO',
    ])
    expect(steps[0]?.body).toContain('Lo primero que necesitamos: documento de perfil.')
    expect(steps[0]?.target).toBeUndefined()
    expect(steps.map((s) => s.target).slice(1)).toEqual([
      'perfil',
      'perfil',
      'facturas',
      'calendario',
      'plazos',
      'neo',
    ])
    expect(steps[3]).toMatchObject({ hint: 'Acá se cargan tus facturas', tag: 'Pendiente' })
    expect(steps[2]?.body).toBe(
      'Documento: documento de tarifa_plana. Con eso se completa datos de tarifa_plana. Solo si tenés tarifa plana.',
    )
    expect(steps[2]?.tag).toBe('Opcional')
  })

  it('ignora pasos que no conoce y se adapta si no queda nada pendiente', () => {
    const steps = tourSteps({
      siguiente: null,
      pasos: [step('nuevo', 'Otro', 'pendiente'), step('perfil', 'Perfil fiscal', 'hecho')],
    })
    expect(steps.map((s) => s.title)).toEqual(['Armemos tu base fiscal', 'Perfil fiscal', 'Empezá con NEO'])
    expect(steps[0]?.body).toContain('Te muestro dónde está cada cosa.')
    expect(steps[1]?.tag).toBe('Hecho')
  })
})

describe('guía de primer ingreso', () => {
  it('la primera vez sin nada cargado muestra la guía, señala cada lugar y al terminar abre NEO', async () => {
    mockApi(routes(EMPTY))
    renderApp('/dashboard/impuestos')
    const dialog = await screen.findByRole('dialog', { name: 'Guía de inicio' })
    expect(within(dialog).getByText('Paso 1 de 7')).toBeInTheDocument()
    expect(within(dialog).getByRole('heading', { name: 'Armemos tu base fiscal' })).toBeInTheDocument()
    expect(screen.queryByRole('note')).not.toBeInTheDocument()
    expect(within(dialog).queryByRole('button', { name: 'Atrás' })).not.toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Siguiente' })).toHaveFocus()

    await next()
    expect(within(dialog).getByRole('heading', { name: 'Perfil fiscal' })).toBeInTheDocument()
    expect(within(dialog).getByText('Pendiente')).toBeInTheDocument()
    expect(screen.getByRole('note')).toHaveTextContent('Acá queda tu perfil fiscal')
    expect(screen.getByRole('link', { name: 'Perfil fiscal' })).toHaveAttribute('data-tour-active', 'true')

    await next()
    await next()
    expect(screen.getByRole('note')).toHaveTextContent('Acá se cargan tus facturas')
    expect(screen.getByRole('link', { name: 'Facturas' })).toHaveAttribute('data-tour-active', 'true')
    expect(screen.getByRole('link', { name: 'Perfil fiscal' })).not.toHaveAttribute('data-tour-active')

    await userEvent.click(screen.getByRole('button', { name: 'Atrás' }))
    expect(within(dialog).getByRole('heading', { name: 'Tarifa plana de autónomos' })).toBeInTheDocument()
    for (let i = 0; i < 4; i++) await next()
    expect(within(dialog).getByText('Paso 7 de 7')).toBeInTheDocument()
    expect(screen.getByRole('note')).toHaveTextContent('NEO: acá adjuntás tus documentos')
    expect(screen.getByRole('button', { name: 'NEO' })).toHaveAttribute('data-tour-active', 'true')

    await userEvent.click(screen.getByRole('button', { name: 'Abrir NEO' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'NEO, asistente fiscal' })).toBeInTheDocument()
    expect(localStorage.getItem('rdash:guia-vista')).toBe('1')
  })

  it('se puede saltar (botón o Escape) y no vuelve a aparecer en ese navegador', async () => {
    mockApi(routes(EMPTY))
    const first = renderApp('/dashboard/impuestos')
    await screen.findByRole('dialog', { name: 'Guía de inicio' })
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'NEO, asistente fiscal' })).not.toBeInTheDocument()
    expect(document.querySelector('[data-tour-active]')).toBeNull()
    first.unmount()

    renderApp('/dashboard/impuestos')
    expect(await screen.findByRole('region', { name: 'Siguiente paso' })).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    localStorage.clear()
    first.unmount()
  })

  it('con el perfil ya cargado no aparece sola, pero avisa el siguiente paso y se puede reabrir', async () => {
    mockApi(routes(WITH_PROFILE))
    renderApp('/dashboard/impuestos')
    const banner = await screen.findByRole('region', { name: 'Siguiente paso' })
    expect(banner).toHaveTextContent('Facturas emitidas. Necesitamos: documento de facturas.')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    await userEvent.click(within(banner).getByRole('button', { name: 'Ver la guía' }))
    const dialog = screen.getByRole('dialog', { name: 'Guía de inicio' })
    await userEvent.click(within(dialog).getByRole('button', { name: 'Saltar la guía' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    await userEvent.click(within(banner).getByRole('button', { name: 'Hacerlo con NEO' }))
    expect(screen.getByRole('region', { name: 'NEO, asistente fiscal' })).toBeInTheDocument()
  })

  it('muestra el detalle del paso pendiente y desaparece cuando no queda nada', async () => {
    const overdue = {
      ...WITH_PROFILE,
      siguiente: 'justificantes',
      pasos: WITH_PROFILE.pasos.map((p) =>
        p.clave === 'justificantes' ? { ...p, detalle: 'Vencidas sin cerrar: IVA 2T 2026.' } : p,
      ),
    }
    mockApi(routes(overdue))
    const first = renderApp('/dashboard/impuestos')
    expect(await screen.findByText('Vencidas sin cerrar: IVA 2T 2026.')).toBeInTheDocument()
    first.unmount()

    mockApi(routes(DONE))
    renderApp('/dashboard/impuestos')
    await screen.findByText('Nada vencido.')
    expect(screen.queryByRole('region', { name: 'Siguiente paso' })).not.toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('al guardar una propuesta de NEO el siguiente paso se actualiza solo', async () => {
    let saved = false
    mockApi({
      ...routes(EMPTY),
      'GET /fiscal/onboarding': () => ({ body: saved ? WITH_PROFILE : EMPTY }),
      'POST /fiscal/agent/chat': {
        body: {
          reply: 'Listo.',
          proposals: [
            {
              id: 'p1',
              kind: 'profile',
              titulo: 'Crear perfil fiscal',
              detalle: ['iae: — → 763'],
              payload: {},
            },
          ],
        },
      },
      'PUT /fiscal/profile': () => {
        saved = true
        return { body: { version: 1 } }
      },
    })
    localStorage.setItem('rdash:guia-vista', '1')
    renderApp('/dashboard/impuestos')
    const banner = await screen.findByRole('region', { name: 'Siguiente paso' })
    expect(banner).toHaveTextContent('Perfil fiscal.')
    await userEvent.click(within(banner).getByRole('button', { name: 'Hacerlo con NEO' }))
    const chat = screen.getByRole('region', { name: 'NEO, asistente fiscal' })
    await userEvent.type(within(chat).getByLabelText('Mensaje para NEO'), 'cargá mi perfil{Enter}')
    await userEvent.click(await within(chat).findByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(banner).toHaveTextContent('Facturas emitidas. Necesitamos'))
  })

  it('con el almacenamiento bloqueado la guía funciona igual', async () => {
    const blocked = () => {
      throw new Error('bloqueado')
    }
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(blocked)
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(blocked)
    mockApi(routes(EMPTY))
    renderApp('/dashboard/impuestos')
    const dialog = await screen.findByRole('dialog', { name: 'Guía de inicio' })
    await userEvent.click(within(dialog).getByRole('button', { name: 'Saltar la guía' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
