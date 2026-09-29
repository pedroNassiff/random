import type { Position } from '../types'

interface Props {
  name: string
  position?: Position | null
  team?: 'A' | 'B'
  /** Solo admin: rating / compuesto alineado a la derecha. */
  rating?: number
  /** Si se pasa, el chip es un botón que despliega un panel (aria-expanded / aria-controls). */
  onToggle?: () => void
  expanded?: boolean
  controls?: string
}

export function PlayerChip({ name, position, team, rating, onToggle, expanded, controls }: Props) {
  const cls = ['vf-chip', team === 'A' ? 'vf-chip--a' : team === 'B' ? 'vf-chip--b' : '']
    .filter(Boolean)
    .join(' ')
  const content = (
    <>
      <span>
        <strong>{name}</strong> {position && <span className="vf-chip__pos">· {position}</span>}
      </span>
      <span className="vf-row">
        {rating !== undefined && <span className="vf-pixel">{rating.toFixed(1)}</span>}
        {onToggle && <span aria-hidden="true">{expanded ? '▾' : '▸'}</span>}
      </span>
    </>
  )
  if (!onToggle) return <div className={cls}>{content}</div>
  return (
    <button
      type="button"
      className={`${cls} vf-chip--button`}
      aria-expanded={expanded}
      aria-controls={controls}
      onClick={onToggle}
    >
      {content}
    </button>
  )
}
