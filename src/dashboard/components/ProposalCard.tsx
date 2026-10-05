import type { ProposalState, ProposalStatus } from '../types'

export type { ProposalState, ProposalStatus }

const STATUS_LABEL: Record<ProposalStatus, string> = {
  pendiente: 'Sin guardar',
  guardando: 'Guardando…',
  guardada: 'Guardada',
  descartada: 'Descartada',
}

interface Props {
  state: ProposalState
  onSave: () => void
  onRedo: () => void
  onDiscard: () => void
}

export function ProposalCard({ state, onSave, onRedo, onDiscard }: Props) {
  const { proposal, status, error } = state
  const open = status === 'pendiente' || status === 'guardando'
  return (
    <section className={`rd-proposal rd-proposal--${status}`} aria-label={`Propuesta: ${proposal.titulo}`}>
      <p className="rd-proposal-head">
        <strong>{proposal.titulo}</strong>
        <span className="rd-tag">{STATUS_LABEL[status]}</span>
      </p>
      <ul className="rd-proposal-detail">
        {proposal.detalle.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      {error && (
        <p role="alert" className="rd-error">
          {error}
        </p>
      )}
      {open && (
        <div className="rd-proposal-actions">
          <button
            type="button"
            className="rd-btn rd-btn--primary"
            disabled={status === 'guardando'}
            onClick={onSave}
          >
            Guardar
          </button>
          <button type="button" className="rd-btn" disabled={status === 'guardando'} onClick={onRedo}>
            Rehacer
          </button>
          <button type="button" className="rd-link" disabled={status === 'guardando'} onClick={onDiscard}>
            Descartar
          </button>
        </div>
      )}
    </section>
  )
}
