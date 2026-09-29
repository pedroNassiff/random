import { useCallback, useState, type FormEvent } from 'react'
import { api, errorText } from '../api'
import { Button } from '../components/Button'
import type { PlayerConstraint, TeamPlayer } from '../types'
import { useLoad } from '../useLoad'

const KIND_LABEL = { apart: 'nunca juntos', together: 'siempre juntos' } as const

/** UC-13: restricciones entre pares de jugadores. Cambiarlas obliga a volver a armar equipos. */
export function ConstraintsPanel({ players, onChange }: { players: TeamPlayer[]; onChange: () => void }) {
  const loader = useCallback(() => api.constraints(), [])
  const { data, reload } = useLoad(loader)
  const [a, setA] = useState('')
  const [b, setB] = useState('')
  const [kind, setKind] = useState<PlayerConstraint['kind']>('apart')
  const [error, setError] = useState<string | null>(null)
  const name = (id: string) => players.find((p) => p.id === id)?.display_name ?? 'Jugador'

  const act = async (f: () => Promise<unknown>) => {
    setError(null)
    try {
      await f()
      reload()
      onChange()
    } catch (err) {
      setError(errorText(err))
    }
  }
  const submit = (e: FormEvent) => {
    e.preventDefault()
    void act(() => api.addConstraint(a, b, kind))
  }

  return (
    <details className="vf-card">
      <summary>Restricciones ({data?.length ?? 0})</summary>
      <ul>
        {data?.map((c) => (
          <li key={c.id} className="vf-row">
            {name(c.player_a)} y {name(c.player_b)}: {KIND_LABEL[c.kind]}
            <button
              type="button"
              className="vf-link"
              onClick={() => void act(() => api.deleteConstraint(c.id))}
            >
              Quitar
            </button>
          </li>
        ))}
      </ul>
      <form onSubmit={submit} className="vf-row">
        {(['a', 'b'] as const).map((side) => (
          <select
            key={side}
            aria-label={side === 'a' ? 'Primer jugador' : 'Segundo jugador'}
            className="vf-input"
            value={side === 'a' ? a : b}
            onChange={(e) => (side === 'a' ? setA : setB)(e.target.value)}
          >
            <option value="">Elegí</option>
            {players.map((p) => (
              <option key={p.id} value={p.id}>
                {p.display_name}
              </option>
            ))}
          </select>
        ))}
        <select
          aria-label="Tipo de restricción"
          className="vf-input"
          value={kind}
          onChange={(e) => setKind(e.target.value as PlayerConstraint['kind'])}
        >
          <option value="apart">Nunca juntos</option>
          <option value="together">Siempre juntos</option>
        </select>
        <Button type="submit" disabled={!a || !b}>
          Agregar restricción
        </Button>
      </form>
      {error && <p className="vf-error">{error}</p>}
    </details>
  )
}
