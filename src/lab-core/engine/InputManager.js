/**
 * lab-core/engine — InputManager
 *
 * Teclado → acciones de movimiento. Devuelve un ref (no state) para leerlo
 * dentro de useFrame sin re-renderizar en cada tecla.
 */
import { useEffect, useRef } from 'react'

const KEY_TO_ACTION = {
  KeyW: 'forward', ArrowUp: 'forward',
  KeyS: 'backward', ArrowDown: 'backward',
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
  ShiftLeft: 'boost', ShiftRight: 'boost',
  Space: 'action',
}

export function useKeyboardActions() {
  const actionsRef = useRef({
    forward: false,
    backward: false,
    left: false,
    right: false,
    boost: false,
    action: false,
  })

  useEffect(() => {
    const setAction = (down) => (event) => {
      const action = KEY_TO_ACTION[event.code]
      if (!action) return
      actionsRef.current[action] = down
    }
    const onKeyDown = setAction(true)
    const onKeyUp = setAction(false)

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [])

  return actionsRef
}
