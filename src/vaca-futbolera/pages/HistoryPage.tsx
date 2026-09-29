import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../auth'
import { MatchCard } from '../components/MatchCard'
import { PlayerChip } from '../components/PlayerChip'
import { matchDay, matchTime } from '../match'
import { resultPath } from '../routes'
import type { HistoryEntry } from '../types'
import { useLoad } from '../useLoad'

function Lineups({ entry, names, id }: { entry: HistoryEntry; names: [string, string]; id: string }) {
  return (
    <div id={id} className="vf-teams">
      {([entry.team_a, entry.team_b] as const).map((team, i) => (
        <section key={names[i]} aria-label={names[i]}>
          <h3 className={`vf-team__head vf-sheet__pill--${i === 0 ? 'light' : 'dark'}`}>{names[i]}</h3>
          <ul className="vf-team__list">
            {team.map((p) => (
              <li key={p.id} className="vf-row">
                <PlayerChip
                  name={p.display_name}
                  position={p.preferred_position}
                  team={i === 0 ? 'A' : 'B'}
                />
                {p.goals ? (
                  <span className="vf-goals" aria-label={`${p.goals} ${p.goals === 1 ? 'gol' : 'goles'}`}>
                    ⚽ {p.goals}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}

function PlayedCard({
  entry,
  names,
  isAdmin,
}: {
  entry: HistoryEntry
  names: [string, string]
  isAdmin: boolean
}) {
  const [open, setOpen] = useState(false)
  const { goals_a, goals_b, notes } = entry.result
  const panel = `lineups-${entry.match.id}`
  return (
    <MatchCard
      day={matchDay(entry.match.starts_at)}
      time={matchTime(entry.match.starts_at)}
      title={`${names[0]} ${goals_a} – ${goals_b} ${names[1]}`}
      status={
        <>
          {entry.close && <p className="vf-badge">Parejo</p>}
          {notes && <p className="vf-muted">{notes}</p>}
          <div className="vf-row">
            <button
              type="button"
              className="vf-link"
              aria-expanded={open}
              aria-controls={panel}
              onClick={() => setOpen((o) => !o)}
            >
              {open ? 'Ocultar equipos' : 'Ver equipos'}
            </button>
            {isAdmin && <Link to={resultPath(entry.match.id)}>Editar resultado</Link>}
          </div>
          {open && <Lineups entry={entry} names={names} id={panel} />}
        </>
      }
    />
  )
}

/** Pestaña Partidos: partidos jugados con resultado y quién jugó en cada equipo. */
export function HistoryPage() {
  const { me } = useAuth()
  const { data, error, loading } = useLoad(api.history)
  return (
    <div className="vf-container">
      <h1 className="vf-title">Partidos</h1>
      {loading && <p role="status">Cargando…</p>}
      {error && <p className="vf-error">{error}</p>}
      {data && data.matches.length === 0 && (
        <p>Todavía no hay partidos jugados. Aparecen acá cuando se carga el resultado.</p>
      )}
      {data?.matches.map((m) => (
        <PlayedCard key={m.match.id} entry={m} names={data.team_names} isAdmin={me?.role === 'admin'} />
      ))}
    </div>
  )
}
