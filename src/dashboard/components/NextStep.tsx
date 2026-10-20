import type { Onboarding } from '../types'

interface Props {
  onboarding: Onboarding
  onAskNeo: () => void
  onShowGuide: () => void
}

/** Aviso permanente de lo siguiente que falta cargar. Desaparece cuando no queda nada pendiente. */
export function NextStep({ onboarding, onAskNeo, onShowGuide }: Props) {
  const step = onboarding.pasos.find((p) => p.clave === onboarding.siguiente)
  if (!step) return null
  return (
    <section className="rd-next" aria-label="Siguiente paso">
      <div>
        <p className="rd-muted">Siguiente paso</p>
        <p>
          <strong>{step.titulo}.</strong> Necesitamos: {step.documento}.
        </p>
        {step.detalle && <p className="rd-muted">{step.detalle}</p>}
      </div>
      <div className="rd-next-actions">
        <button type="button" className="rd-btn rd-btn--primary" onClick={onAskNeo}>
          Hacerlo con NEO
        </button>
        <button type="button" className="rd-link" onClick={onShowGuide}>
          Ver la guía
        </button>
      </div>
    </section>
  )
}
