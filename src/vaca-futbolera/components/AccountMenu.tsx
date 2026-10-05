import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { Link } from 'react-router-dom'
import { PASSWORD } from '../routes'

/** Inicial de la cuenta para el círculo: primera letra o número del email. */
export function initialOf(email: string): string {
  const match = email.match(/[\p{L}\p{N}]/u)
  return (match?.[0] ?? '?').toUpperCase()
}

/**
 * Cuenta del usuario: un círculo con la inicial que despliega las opciones (cambiar contraseña, salir).
 * Se cierra con Escape, al hacer clic afuera o al elegir una opción; las flechas recorren las opciones.
 */
export function AccountMenu({ email, onLogout }: { email: string; onLogout: () => void }) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuId = useId()

  const items = () => Array.from(rootRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])

  useEffect(() => {
    if (!open) return undefined
    items()[0]?.focus()
    const onPointer = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointer)
    return () => document.removeEventListener('pointerdown', onPointer)
  }, [open])

  const close = () => {
    setOpen(false)
    triggerRef.current?.focus()
  }

  const onMenuKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const list = items()
    const index = list.indexOf(document.activeElement as HTMLElement)
    if (e.key === 'Escape') {
      e.preventDefault()
      close()
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      const step = e.key === 'ArrowDown' ? 1 : -1
      list[(index + step + list.length) % list.length]?.focus()
    } else if (e.key === 'Tab') {
      setOpen(false) // salir del menú con Tab lo cierra, sin atrapar el foco
    }
  }

  return (
    <div className="vf-account" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className="vf-account__avatar"
        aria-label={`Cuenta de ${email}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((o) => !o)}
      >
        {initialOf(email)}
      </button>
      {open && (
        <div
          id={menuId}
          className="vf-account__menu"
          role="menu"
          tabIndex={-1}
          aria-label="Opciones de la cuenta"
          onKeyDown={onMenuKey}
        >
          <p className="vf-account__email">{email}</p>
          <Link to={PASSWORD} role="menuitem" className="vf-account__item" onClick={() => setOpen(false)}>
            Cambiar contraseña
          </Link>
          <button
            type="button"
            role="menuitem"
            className="vf-account__item"
            onClick={() => {
              setOpen(false)
              onLogout()
            }}
          >
            Salir
          </button>
        </div>
      )}
    </div>
  )
}
