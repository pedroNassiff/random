import { fireEvent, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { initialOf } from './components/AccountMenu'
import { MEMBER, mockApi, renderApp } from './test/helpers'

afterEach(() => vi.unstubAllGlobals())

async function openMenu() {
  mockApi({ 'GET /me': { body: MEMBER }, 'GET /matches/current': { body: { match: null } } })
  renderApp('/vaca-futbolera')
  const trigger = await screen.findByRole('button', { name: 'Cuenta de juan@x.com' })
  await userEvent.click(trigger)
  return trigger
}

describe('menú de la cuenta', () => {
  it('la inicial sale del email, en mayúscula, salteando símbolos', () => {
    expect(initialOf('juan@x.com')).toBe('J')
    expect(initialOf('  .ñandu@x.com')).toBe('Ñ')
    expect(initialOf('7up@x.com')).toBe('7')
    expect(initialOf('')).toBe('?')
  })

  it('al abrirlo muestra el email y las opciones, con foco en la primera', async () => {
    const trigger = await openMenu()
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    expect(trigger).toHaveAttribute('aria-haspopup', 'menu')
    const menu = screen.getByRole('menu', { name: 'Opciones de la cuenta' })
    expect(trigger).toHaveAttribute('aria-controls', menu.id)
    expect(menu).toHaveTextContent('juan@x.com')
    expect(screen.getAllByRole('menuitem').map((i) => i.textContent)).toEqual(['Cambiar contraseña', 'Salir'])
    expect(screen.getByRole('menuitem', { name: 'Cambiar contraseña' })).toHaveFocus()
    expect(screen.getByRole('menuitem', { name: 'Cambiar contraseña' })).toHaveAttribute(
      'href',
      '/vaca-futbolera/contrasena',
    )
  })

  it('las flechas recorren las opciones en ronda', async () => {
    await openMenu()
    await userEvent.keyboard('{ArrowDown}')
    expect(screen.getByRole('menuitem', { name: 'Salir' })).toHaveFocus()
    await userEvent.keyboard('{ArrowDown}')
    expect(screen.getByRole('menuitem', { name: 'Cambiar contraseña' })).toHaveFocus()
    await userEvent.keyboard('{ArrowUp}')
    expect(screen.getByRole('menuitem', { name: 'Salir' })).toHaveFocus()
    await userEvent.keyboard('a') // otras teclas no hacen nada
    expect(screen.getByRole('menu')).toBeInTheDocument()
  })

  it('Escape lo cierra y devuelve el foco al círculo', async () => {
    const trigger = await openMenu()
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    expect(trigger).not.toHaveAttribute('aria-controls')
  })

  it('se cierra con clic afuera, con Tab o volviendo a tocar el círculo', async () => {
    const trigger = await openMenu()
    fireEvent.pointerDown(screen.getByRole('menu'))
    expect(screen.getByRole('menu')).toBeInTheDocument() // un clic adentro no lo cierra
    fireEvent.pointerDown(document.body)
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()

    await userEvent.click(trigger)
    await userEvent.tab()
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()

    await userEvent.click(trigger)
    await userEvent.click(trigger)
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('Cambiar contraseña lleva a la pantalla y cierra el menú', async () => {
    await openMenu()
    await userEvent.click(screen.getByRole('menuitem', { name: 'Cambiar contraseña' }))
    expect(await screen.findByRole('heading', { name: 'Cambiar contraseña' })).toBeInTheDocument()
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })
})
