import type { TeamPlayer } from '../types'
import { PlayerChip } from './PlayerChip'

interface Props {
  name: string
  tone: 'light' | 'dark'
  otherName: string
  ids: string[]
  players: Record<string, TeamPlayer>
  strength: number
  onMove: (id: string) => void
}

/** Columna de equipo con alternativa por teclado al drag & drop: "Pasar a …" (DESIGN §7). */
export function TeamColumn({ name, tone, otherName, ids, players, strength, onMove }: Props) {
  return (
    <section className="vf-team" aria-label={name}>
      <h2 className={`vf-team__head vf-sheet__pill--${tone}`}>
        {name} <span className="vf-muted">({ids.length})</span>
      </h2>
      <ul className="vf-team__list">
        {ids.map((id) => {
          const p = players[id]
          return (
            <li key={id} className="vf-row">
              <PlayerChip
                name={p?.display_name ?? 'Jugador'}
                position={p?.preferred_position}
                team={tone === 'light' ? 'A' : 'B'}
                rating={p?.strength ?? undefined}
              />
              <button type="button" className="vf-move" onClick={() => onMove(id)}>
                Pasar a {otherName}
              </button>
            </li>
          )
        })}
      </ul>
      <p className="vf-team__foot">
        Fuerza <span className="vf-pixel">{strength.toFixed(1)}</span>
      </p>
    </section>
  )
}
