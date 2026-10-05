import { useEffect, useRef, useState } from 'react'
import type { TourStep } from '../tour'

interface Props {
  steps: TourStep[]
  /** Terminó de ver los pasos. */
  onFinish: () => void
  /** La cerró antes de terminar. */
  onSkip: () => void
}

const GAP = 10

/** Coloca la etiqueta debajo del elemento señalado (o arriba si no entra) y lo resalta. */
function point(target: string | undefined, coach: HTMLElement | null): () => void {
  const el = target ? document.querySelector<HTMLElement>(`[data-tour="${target}"]`) : null
  if (!el || !coach) return () => undefined
  const place = () => {
    const rect = el.getBoundingClientRect()
    const below = rect.bottom + GAP + coach.offsetHeight < window.innerHeight
    const left = Math.min(Math.max(8, rect.left), Math.max(8, window.innerWidth - coach.offsetWidth - 8))
    coach.style.left = `${left}px`
    coach.style.top = `${below ? rect.bottom + GAP : rect.top - GAP - coach.offsetHeight}px`
    coach.dataset.side = below ? 'below' : 'above'
  }
  el.setAttribute('data-tour-active', 'true')
  el.scrollIntoView?.({ block: 'nearest' })
  place()
  window.addEventListener('resize', place)
  window.addEventListener('scroll', place, true)
  return () => {
    el.removeAttribute('data-tour-active')
    window.removeEventListener('resize', place)
    window.removeEventListener('scroll', place, true)
  }
}

export function OnboardingTour({ steps, onFinish, onSkip }: Props) {
  const [index, setIndex] = useState(0)
  const coachRef = useRef<HTMLDivElement>(null)
  const nextRef = useRef<HTMLButtonElement>(null)
  const step = steps[index]
  const last = index === steps.length - 1

  useEffect(() => {
    nextRef.current?.focus()
    return point(step?.target, coachRef.current)
  }, [step])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onSkip()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onSkip])

  if (!step) return null
  return (
    <>
      <div className="rd-tour-backdrop" aria-hidden="true" />
      {step.hint && (
        <div ref={coachRef} className="rd-coach" role="note">
          {step.hint}
        </div>
      )}
      <div className="rd-tour" role="dialog" aria-modal="true" aria-label="Guía de inicio">
        <p className="rd-muted">
          Paso {index + 1} de {steps.length}
          {step.tag && <span className="rd-tag">{step.tag}</span>}
        </p>
        <h2 className="rd-subtitle">{step.title}</h2>
        <p>{step.body}</p>
        <div className="rd-tour-actions">
          <button type="button" className="rd-link" onClick={onSkip}>
            Saltar la guía
          </button>
          {index > 0 && (
            <button type="button" className="rd-btn" onClick={() => setIndex(index - 1)}>
              Atrás
            </button>
          )}
          <button
            ref={nextRef}
            type="button"
            className="rd-btn rd-btn--primary"
            onClick={() => (last ? onFinish() : setIndex(index + 1))}
          >
            {last ? 'Abrir NEO' : 'Siguiente'}
          </button>
        </div>
      </div>
    </>
  )
}
