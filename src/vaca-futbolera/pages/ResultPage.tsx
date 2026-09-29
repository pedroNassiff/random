import { useCallback, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api, errorText } from '../api'
import { Button } from '../components/Button'
import { PlayerChip } from '../components/PlayerChip'
import { matchDay, matchTime } from '../match'
import { HISTORY } from '../routes'
import type { LineupPlayer, ResultForm } from '../types'
import { useLoad } from '../useLoad'

type Side = 'a' | 'b'

function Team({
  name,
  players,
  other,
  goals,
  onGoals,
  onMove,
  onRemove,
}: {
  name: string
  players: LineupPlayer[]
  other: string
  goals: Record<string, string>
  onGoals: (id: string, value: string) => void
  onMove: (id: string) => void
  onRemove: (id: string) => void
}) {
  return (
    <section className="vf-team" aria-label={name}>
      <h2 className="vf-team__head">{name}</h2>
      <ul className="vf-team__list">
        {players.map((p) => (
          <li key={p.id} className="vf-row">
            <PlayerChip name={p.display_name} position={p.preferred_position} />
            <input
              className="vf-input vf-player-goals"
              type="number"
              min={0}
              max={99}
              placeholder="⚽"
              aria-label={`Goles de ${p.display_name}`}
              value={goals[p.id] ?? ''}
              onChange={(e) => onGoals(p.id, e.target.value)}
            />
            <button type="button" className="vf-move" onClick={() => onMove(p.id)}>
              Pasar a {other}
            </button>
            <button type="button" className="vf-move" onClick={() => onRemove(p.id)}>
              No jugó
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}

function Editor({ form }: { form: ResultForm }) {
  const navigate = useNavigate()
  const [teams, setTeams] = useState({ a: form.team_a, b: form.team_b })
  const [goals, setGoals] = useState({
    a: String(form.result?.goals_a ?? ''),
    b: String(form.result?.goals_b ?? ''),
  })
  const [notes, setNotes] = useState(form.result?.notes ?? '')
  // Goles por jugador: opcionales, vacío = no se sabe.
  const [playerGoals, setPlayerGoals] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      [...form.team_a, ...form.team_b].filter((p) => p.goals != null).map((p) => [p.id, String(p.goals)]),
    ),
  )
  const [add, setAdd] = useState({ id: '', side: 'a' as Side })
  const [error, setError] = useState<string | null>(null)
  const [na, nb] = form.team_names
  const playing = new Set([...teams.a, ...teams.b].map((p) => p.id))
  const bench = form.roster.filter((p) => !playing.has(p.id))

  const move = (id: string) => {
    const from: Side = teams.a.some((p) => p.id === id) ? 'a' : 'b'
    const to: Side = from === 'a' ? 'b' : 'a'
    const player = teams[from].find((p) => p.id === id)
    if (player)
      setTeams({ ...teams, [from]: teams[from].filter((p) => p.id !== id), [to]: [...teams[to], player] })
  }
  const remove = (id: string) =>
    setTeams({ a: teams.a.filter((p) => p.id !== id), b: teams.b.filter((p) => p.id !== id) })
  const addPlayer = () => {
    const player = form.roster.find((p) => p.id === add.id)
    if (player) setTeams({ ...teams, [add.side]: [...teams[add.side], player] })
    setAdd({ ...add, id: '' })
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    try {
      await api.saveResult(form.match.id, {
        goals_a: Number(goals.a),
        goals_b: Number(goals.b),
        notes,
        team_a: teams.a.map((p) => p.id),
        team_b: teams.b.map((p) => p.id),
        player_goals: Object.fromEntries(
          [...teams.a, ...teams.b]
            .filter((p) => (playerGoals[p.id] ?? '') !== '')
            .map((p) => [p.id, Number(playerGoals[p.id])]),
        ),
      })
      navigate(HISTORY)
    } catch (err) {
      setError(errorText(err))
    }
  }

  return (
    <form onSubmit={submit}>
      <div className="vf-card vf-row vf-score">
        {(['a', 'b'] as const).map((side) => (
          <label key={side} className="vf-label">
            Goles {side === 'a' ? na : nb}
            <input
              className="vf-input vf-pixel"
              type="number"
              min={0}
              max={99}
              required
              value={goals[side]}
              onChange={(e) => setGoals({ ...goals, [side]: e.target.value })}
            />
          </label>
        ))}
      </div>
      <p className="vf-muted">
        Quién jugó realmente: sacá a los que faltaron y sumá a los que vinieron sin anotarse.
      </p>
      <div className="vf-teams">
        {(['a', 'b'] as const).map((side) => (
          <Team
            key={side}
            name={side === 'a' ? na : nb}
            other={side === 'a' ? nb : na}
            players={teams[side]}
            goals={playerGoals}
            onGoals={(id, value) => setPlayerGoals({ ...playerGoals, [id]: value })}
            onMove={move}
            onRemove={remove}
          />
        ))}
      </div>
      {bench.length > 0 && (
        <div className="vf-card vf-row">
          <select
            aria-label="Jugador que vino sin anotarse"
            className="vf-input"
            value={add.id}
            onChange={(e) => setAdd({ ...add, id: e.target.value })}
          >
            <option value="">Sumar jugador…</option>
            {bench.map((p) => (
              <option key={p.id} value={p.id}>
                {p.display_name}
              </option>
            ))}
          </select>
          <select
            aria-label="Equipo"
            className="vf-input"
            value={add.side}
            onChange={(e) => setAdd({ ...add, side: e.target.value as Side })}
          >
            <option value="a">{na}</option>
            <option value="b">{nb}</option>
          </select>
          <Button disabled={!add.id} onClick={addPlayer}>
            Sumar
          </Button>
        </div>
      )}
      <label className="vf-label" htmlFor="notes">
        Notas (opcional)
      </label>
      <input
        id="notes"
        className="vf-input"
        value={notes}
        maxLength={500}
        onChange={(e) => setNotes(e.target.value)}
      />
      {error && <p className="vf-error">{error}</p>}
      <p>
        <Button type="submit">Guardar resultado</Button>
      </p>
    </form>
  )
}

/** UC-08: el admin carga el resultado y quién jugó en cada equipo. */
export function ResultPage() {
  const { id = '' } = useParams()
  const loader = useCallback(() => api.resultForm(id), [id])
  const { data, error, loading } = useLoad(loader)
  return (
    <div className="vf-container">
      <h1 className="vf-title">Cargar resultado</h1>
      {loading && <p role="status">Cargando…</p>}
      {error && <p className="vf-error">{error}</p>}
      {data && (
        <>
          <p>
            {matchDay(data.match.starts_at)} · {matchTime(data.match.starts_at)}
          </p>
          <Editor form={data} />
        </>
      )}
    </div>
  )
}
