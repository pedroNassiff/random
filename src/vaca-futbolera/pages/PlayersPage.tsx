import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { api, errorText } from '../api'
import { useAuth } from '../auth'
import { Button } from '../components/Button'
import { PlayerChip } from '../components/PlayerChip'
import { SectionHeader } from '../components/SectionHeader'
import { BASE } from '../routes'
import { POSITION_LABELS, SOURCE_LABELS, type Player, type Position, type SkillScore } from '../types'
import { useLoad } from '../useLoad'
import { PlayerEditForm } from './PlayerEditForm'

const POSITIONS = Object.keys(POSITION_LABELS) as Position[]

function NewPlayerForm({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [position, setPosition] = useState<Position | ''>('')
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    try {
      await api.createPlayer({
        display_name: name,
        nickname: null,
        email: email || null,
        preferred_position: position || null,
        can_play_gk: position === 'POR',
        is_guest: false,
        guest_level: null,
        active: true,
      })
      setName('')
      setEmail('')
      setPosition('')
      onCreated()
    } catch (err) {
      setError(errorText(err))
    }
  }

  return (
    <form onSubmit={submit} className="vf-card">
      <h3 className="vf-title">Agregar jugador</h3>
      <label className="vf-label" htmlFor="p-name">
        Nombre
      </label>
      <input
        id="p-name"
        className="vf-input"
        required
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <label className="vf-label" htmlFor="p-email">
        Email (para invitarlo)
      </label>
      <input
        id="p-email"
        className="vf-input"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <label className="vf-label" htmlFor="p-pos">
        Puesto
      </label>
      <select
        id="p-pos"
        className="vf-input"
        value={position}
        onChange={(e) => setPosition(e.target.value as Position | '')}
      >
        <option value="">Sin definir</option>
        {POSITIONS.map((p) => (
          <option key={p} value={p}>
            {POSITION_LABELS[p]} ({p})
          </option>
        ))}
      </select>
      {error && <p className="vf-error">{error}</p>}
      <p>
        <Button type="submit" disabled={!name.trim()}>
          Agregar
        </Button>
      </p>
    </form>
  )
}

function SkillBreakdown({ skills }: { skills: Record<string, SkillScore> }) {
  return (
    <table className="vf-table">
      <caption className="vf-muted">Puntaje por skill. La autoevaluación se muestra, pero no cuenta.</caption>
      <thead>
        <tr>
          <th scope="col">Skill</th>
          <th scope="col">Valor</th>
          <th scope="col">Fuente</th>
          <th scope="col">Raters</th>
          <th scope="col">Autoev.</th>
        </tr>
      </thead>
      <tbody>
        {Object.entries(skills).map(([key, s]) => (
          <tr key={key}>
            <th scope="row">{s.name}</th>
            <td className="vf-pixel">{s.value.toFixed(1)}</td>
            <td>{SOURCE_LABELS[s.source]}</td>
            <td>{s.n_raters}</td>
            <td>{s.self_value ?? '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

interface RowProps {
  player: Player
  canRate: boolean
  isAdmin: boolean
  onSaved: () => void
}

function PlayerPanel({ player, isAdmin, onSaved }: Omit<RowProps, 'canRate'>) {
  return (
    <div id={`player-${player.id}`}>
      {player.scoring && Object.keys(player.scoring.skills).length > 0 && (
        <SkillBreakdown skills={player.scoring.skills} />
      )}
      {isAdmin && <PlayerEditForm player={player} onSaved={onSaved} />}
    </div>
  )
}

function PlayerRow({ player, canRate, isAdmin, onSaved }: RowProps) {
  const [open, setOpen] = useState(false)
  const expandable = isAdmin || Object.keys(player.scoring?.skills ?? {}).length > 0
  const toggle = expandable
    ? { onToggle: () => setOpen((o) => !o), expanded: open, controls: `player-${player.id}` }
    : {}

  return (
    <div>
      <PlayerChip
        name={player.active ? player.display_name : `${player.display_name} (inactivo)`}
        position={player.preferred_position}
        rating={player.scoring?.composite}
        {...toggle}
      />
      {open && <PlayerPanel player={player} isAdmin={isAdmin} onSaved={onSaved} />}
      {canRate && player.active && (
        <p>
          <Link className="vf-btn vf-extrude" to={`${BASE}/jugadores/${player.id}/puntuar`}>
            Puntuar
          </Link>
        </p>
      )}
    </div>
  )
}

export function PlayersPage() {
  const { me } = useAuth()
  const { data, error, loading, reload } = useLoad(api.players)

  return (
    <div className="vf-container">
      <h1 className="vf-title">Jugadores</h1>
      {me?.role === 'admin' && <NewPlayerForm onCreated={reload} />}
      <SectionHeader>Plantel</SectionHeader>
      {loading && <p role="status">Cargando…</p>}
      {error && <p className="vf-error">{error}</p>}
      {data && data.length === 0 && <p>Todavía no hay jugadores. Sumá el primero.</p>}
      <div className="vf-grid">
        {data?.map((p) => (
          <PlayerRow
            key={p.id}
            player={p}
            canRate={me?.player_id != null}
            isAdmin={me?.role === 'admin'}
            onSaved={reload}
          />
        ))}
      </div>
    </div>
  )
}
