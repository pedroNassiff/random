import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, errorText } from '../api'
import { useAuth } from '../auth'
import { Button } from '../components/Button'
import { MatchCard } from '../components/MatchCard'
import { PlayerChip } from '../components/PlayerChip'
import { SectionHeader } from '../components/SectionHeader'
import { Toast } from '../components/Toast'
import { countdown, matchDay, matchTime } from '../match'
import { isAbort, shareText } from '../share'
import { resultPath, teamsPath } from '../routes'
import { PublishedTeams } from './PublishedTeams'
import type { MatchView, Me, Player, SignupEntry } from '../types'
import { useLoad } from '../useLoad'

function useNow(ms = 60000): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms)
    return () => clearInterval(t)
  }, [ms])
  return now
}

function SignupList({ entries, onRemove }: { entries: SignupEntry[]; onRemove?: (e: SignupEntry) => void }) {
  return (
    <ul className="vf-signups">
      {entries.map((e) => (
        <li key={e.player_id} className="vf-signup">
          <PlayerChip name={e.display_name} position={e.preferred_position} />
          {onRemove && (
            <button
              type="button"
              className="vf-remove"
              aria-label={`Sacar a ${e.display_name}`}
              title={`Sacar a ${e.display_name}`}
              onClick={() => onRemove(e)}
            >
              <span aria-hidden="true">✕</span>
            </button>
          )}
        </li>
      ))}
    </ul>
  )
}

function MyAction({
  view,
  me,
  act,
}: {
  view: MatchView
  me: Me
  act: (f: () => Promise<MatchView>, msg: string) => void
}) {
  const id = view.match.id
  if (me.player_id === null) {
    return (
      <p className="vf-error">
        Tu usuario no está vinculado a un jugador. Pedile al admin que cargue tu email.
      </p>
    )
  }
  if (view.my_status) {
    const label = view.my_status === 'confirmed' ? 'Estás convocado.' : 'Estás en lista de espera.'
    return (
      <>
        <p>
          <strong>{label}</strong>
        </p>
        <Button block onClick={() => act(() => api.withdraw(id), 'Te bajaste del partido')}>
          Me bajo
        </Button>
      </>
    )
  }
  if (!view.signup_open && me.role !== 'admin') {
    return <p>La inscripción cerró {view.closes_text}. Pedile al admin que te agregue.</p>
  }
  return (
    <Button block onClick={() => act(() => api.signup(id), 'Te anotaste')}>
      Voy
    </Button>
  )
}

function AdminAdd({
  view,
  act,
}: {
  view: MatchView
  act: (f: () => Promise<MatchView>, msg: string) => void
}) {
  const { data: players } = useLoad(api.players)
  const [selected, setSelected] = useState('')
  const signed = new Set([...view.confirmed, ...view.waitlist].map((e) => e.player_id))
  const available = (players ?? []).filter((p: Player) => p.active && !signed.has(p.id))
  if (available.length === 0) return null
  return (
    <div className="vf-card">
      <label className="vf-label" htmlFor="add-player">
        Agregar jugador al partido
      </label>
      <div className="vf-row">
        <select
          id="add-player"
          className="vf-input"
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
        >
          <option value="">Elegí un jugador</option>
          {available.map((p) => (
            <option key={p.id} value={p.id}>
              {p.display_name}
            </option>
          ))}
        </select>
        <Button
          disabled={!selected}
          onClick={() => {
            act(() => api.signup(view.match.id, selected), 'Jugador agregado')
            setSelected('')
          }}
        >
          Agregar
        </Button>
      </div>
    </div>
  )
}

function Match({ initial, me }: { initial: MatchView; me: Me }) {
  const [view, setView] = useState(initial)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const clearToast = useCallback(() => setToast(null), [])
  const now = useNow()
  const isAdmin = me.role === 'admin'
  const cd = countdown(view.match.signup_closes_at, now)

  const act = (f: () => Promise<MatchView>, msg: string) => {
    setError(null)
    f()
      .then((v) => {
        setView(v)
        setToast(msg)
      })
      .catch((e: unknown) => setError(errorText(e)))
  }
  const remove = (e: SignupEntry) =>
    act(() => api.withdraw(view.match.id, e.player_id), `${e.display_name} fuera`)

  return (
    <>
      <MatchCard
        day={matchDay(view.match.starts_at)}
        time={matchTime(view.match.starts_at)}
        title="Fútbol de los miércoles"
        status={
          <>
            <p className={`vf-pixel ${cd.urgent ? 'vf-error' : ''}`}>{cd.text}</p>
            <p>
              <strong>
                {view.confirmed.length}/{view.capacity}
              </strong>{' '}
              convocados
            </p>
            <MyAction view={view} me={me} act={act} />
            {error && <p className="vf-error">{error}</p>}
          </>
        }
      />
      <p>
        <Button
          variant="secondary"
          onClick={() =>
            shareText(view.share_text).catch((e: unknown) => {
              if (!isAbort(e)) setError(errorText(e))
            })
          }
        >
          Compartir por WhatsApp
        </Button>
      </p>
      {view.match.status === 'teams_published' && <PublishedTeams matchId={view.match.id} />}
      {isAdmin && (
        <p className="vf-row">
          <Link className="vf-btn vf-extrude" to={teamsPath(view.match.id)}>
            Armar equipos
          </Link>
          <Link className="vf-btn vf-extrude" to={resultPath(view.match.id)}>
            Cargar resultado
          </Link>
        </p>
      )}
      {isAdmin && <AdminAdd view={view} act={act} />}
      <SectionHeader>Convocados</SectionHeader>
      {view.confirmed.length === 0 ? (
        <p>Todavía no se anotó nadie.</p>
      ) : (
        <SignupList entries={view.confirmed} onRemove={isAdmin ? remove : undefined} />
      )}
      {view.waitlist.length > 0 && (
        <>
          <SectionHeader>Lista de espera</SectionHeader>
          <SignupList entries={view.waitlist} onRemove={isAdmin ? remove : undefined} />
        </>
      )}
      <Toast message={toast} onDone={clearToast} />
    </>
  )
}

export function HomePage() {
  const { me } = useAuth()
  const { data, error, loading } = useLoad(api.currentMatch)

  return (
    <div className="vf-container">
      <h1 className="vf-title">Próximo partido</h1>
      {loading && <p role="status">Cargando…</p>}
      {error && <p className="vf-error">{error}</p>}
      {data && data.match === null && (
        <div className="vf-card">
          <p>Todavía no hay partido para el miércoles. La inscripción abre el jueves a las 00:00.</p>
        </div>
      )}
      {data && data.match !== null && me && <Match initial={data} me={me} />}
    </div>
  )
}
