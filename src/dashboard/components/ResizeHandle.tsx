import { useCallback, useState, type KeyboardEvent, type PointerEvent } from 'react'

export interface ChatSize {
  width: number
  height: number
}

const KEY = 'rdash:neo-tamano'
const DEFAULT: ChatSize = { width: 380, height: 560 }
const MIN: ChatSize = { width: 320, height: 360 }
const MAX: ChatSize = { width: 1000, height: 1200 }
const STEP = 24

const clamp = (size: ChatSize): ChatSize => ({
  width: Math.min(MAX.width, Math.max(MIN.width, Math.round(size.width))),
  height: Math.min(MAX.height, Math.max(MIN.height, Math.round(size.height))),
})

function stored(): ChatSize {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(KEY) ?? 'null')
    const { width, height } = (raw ?? {}) as Partial<ChatSize>
    if (typeof width === 'number' && typeof height === 'number') return clamp({ width, height })
  } catch {
    /* sin almacenamiento o valor corrupto: tamaño por defecto */
  }
  return DEFAULT
}

/** Tamaño de la ventana de NEO, recordado en este navegador. */
export function useChatSize() {
  const [size, setSize] = useState<ChatSize>(stored)
  const resize = useCallback((next: ChatSize) => {
    const clamped = clamp(next)
    setSize(clamped)
    try {
      localStorage.setItem(KEY, JSON.stringify(clamped))
    } catch {
      /* no se recuerda, pero el tamaño cambia igual */
    }
  }, [])
  return { size, resize }
}

/**
 * Tirador en la esquina superior izquierda: la ventana está anclada abajo a la derecha, así que crece
 * hacia arriba y hacia la izquierda. Con teclado, las flechas hacen lo mismo.
 */
export function ResizeHandle({ size, onResize }: { size: ChatSize; onResize: (size: ChatSize) => void }) {
  const onPointerDown = (e: PointerEvent<HTMLButtonElement>) => {
    e.preventDefault()
    const start = { x: e.clientX, y: e.clientY, ...size }
    const move = (ev: globalThis.PointerEvent) =>
      onResize({ width: start.width + (start.x - ev.clientX), height: start.height + (start.y - ev.clientY) })
    const stop = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', stop)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', stop)
  }

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    const delta: Record<string, ChatSize> = {
      ArrowLeft: { width: STEP, height: 0 },
      ArrowRight: { width: -STEP, height: 0 },
      ArrowUp: { width: 0, height: STEP },
      ArrowDown: { width: 0, height: -STEP },
    }
    const d = delta[e.key]
    if (!d) return
    e.preventDefault()
    onResize({ width: size.width + d.width, height: size.height + d.height })
  }

  return (
    <button
      type="button"
      className="rd-chat-resize"
      aria-label="Cambiar el tamaño de NEO (arrastrá o usá las flechas)"
      onPointerDown={onPointerDown}
      onKeyDown={onKeyDown}
    />
  )
}
