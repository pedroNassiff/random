import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api, errorText } from '../api'
import { Button } from '../components/Button'
import { SectionHeader } from '../components/SectionHeader'
import { ShareSheet } from '../components/ShareSheet'
import { TeamColumn } from '../components/TeamColumn'
import { Toast } from '../components/Toast'
import { WinBar } from '../components/WinBar'
import { matchDay, matchTime } from '../match'
import { BASE } from '../routes'
import { sheetTeams } from '../teams'
import type { TeamEvaluation, TeamsView } from '../types'
import { ConstraintsPanel } from './ConstraintsPanel'

const TERM_LABELS: Record<string, string> = {
  balance: 'Diferencia de fuerza',
  profile: 'Perfil de skills',
  positions: 'Puestos',
  goalkeeping: 'Arqueros',
  repeat: 'Repetir equipos',
  goals: 'Goleadores',
}

function Breakdown({ evaluation }: { evaluation: TeamEvaluation }) {
  return (
    <details>
      <summary>
        Costo <span className="vf-pixel">{evaluation.cost.toFixed(2)}</span> · desglose
      </summary>
      <ul className="vf-muted">
        {Object.entries(evaluation.breakdown).map(([k, v]) => (
          <li key={k}>
            {TERM_LABELS[k] ?? k}: {v.toFixed(3)}
          </li>
        ))}
      </ul>
    </details>
  )
}

function Editor({ view, onPublished }: { view: TeamsView; onPublished: (v: TeamsView) => void }) {
  const [tab, setTab] = useState(0)
  // Movimientos manuales sobre la propuesta de la pestaña actual; cambiar de pestaña los descarta.
  const [edited, setEdited] = useState<TeamEvaluation | null>(null)
  const [error, setError] = useState<string | null>(null)
  const matchId = view.match.id
  const [a, b] = view.team_names
  const current = edited ?? view.proposals[tab] ?? null

  if (!current) return null

  const move = (id: string) => {
    const inA = current.team_a.includes(id)
    const teamA = inA ? current.team_a.filter((x) => x !== id) : [...current.team_a, id]
    const teamB = inA ? [...current.team_b, id] : current.team_b.filter((x) => x !== id)
    if (teamA.length === 0 || teamB.length === 0) return
    setError(null)
    api
      .evaluateTeams(matchId, teamA, teamB)
      .then(setEdited)
      .catch((e: unknown) => setError(errorText(e)))
  }
  const publish = () => {
    setError(null)
    api
      .publishTeams(matchId, current.team_a, current.team_b)
      .then(onPublished)
      .catch((e: unknown) => setError(errorText(e)))
  }

  return (
    <>
      <div className="vf-tabs" role="tablist" aria-label="Propuestas">
        {view.proposals.map((_, i) => (
          <button
            key={i}
            type="button"
            role="tab"
            aria-selected={tab === i}
            className="vf-tab"
            aria-current={tab === i ? 'page' : undefined}
            onClick={() => {
              setTab(i)
              setEdited(null)
            }}
          >
            Propuesta {i + 1}
          </button>
        ))}
      </div>
      <div className="vf-teams">
        <TeamColumn
          name={a}
          tone="light"
          otherName={b}
          ids={current.team_a}
          players={view.players}
          strength={current.strength_a}
          onMove={move}
        />
        <TeamColumn
          name={b}
          tone="dark"
          otherName={a}
          ids={current.team_b}
          players={view.players}
          strength={current.strength_b}
          onMove={move}
        />
      </div>
      <WinBar names={view.team_names} pctA={current.win_pct_a} pctB={current.win_pct_b} />
      <p>
        Diferencia de fuerza{' '}
        <span className="vf-pixel">{Math.abs(current.strength_a - current.strength_b).toFixed(1)}</span>
      </p>
      <Breakdown evaluation={current} />
      {error && <p className="vf-error">{error}</p>}
      <p>
        <Button onClick={publish}>Publicar equipos</Button>
      </p>
    </>
  )
}

function TeamsBody({
  view,
  busy,
  onGenerate,
  onPublished,
  onReload,
}: {
  view: TeamsView
  busy: boolean
  onGenerate: () => void
  onPublished: (v: TeamsView) => void
  onReload: () => void
}) {
  const heading = `${matchDay(view.match.starts_at)} · ${matchTime(view.match.starts_at)}`
  // Al volver a armar llegan propuestas nuevas: la key reinicia pestaña y ediciones.
  const editorKey = view.proposals.map((p) => p.team_a.join(',')).join('|')
  return (
    <>
      <p>
        {heading} · {Object.keys(view.players).length} convocados
      </p>
      <p>
        <Button disabled={busy} onClick={onGenerate}>
          {view.proposals.length ? 'Volver a armar' : 'Armar equipos'}
        </Button>
      </p>
      {view.proposals.length > 0 && <Editor key={editorKey} view={view} onPublished={onPublished} />}
      <ConstraintsPanel players={Object.values(view.players)} onChange={onReload} />
      {view.published && view.share_text && (
        <>
          <SectionHeader>Equipos publicados</SectionHeader>
          {view.published.win_pct_a !== undefined && view.published.win_pct_b !== undefined && (
            <>
              <p className="vf-muted">Solo lo ven los admins: la imagen que se comparte no lleva %.</p>
              <WinBar
                names={view.team_names}
                pctA={view.published.win_pct_a}
                pctB={view.published.win_pct_b}
              />
            </>
          )}
          <ShareSheet heading={heading} teams={sheetTeams(view, view.published)} text={view.share_text} />
        </>
      )}
    </>
  )
}

export function TeamsPage() {
  const { id = '' } = useParams()
  const [view, setView] = useState<TeamsView | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const clearToast = useCallback(() => setToast(null), [])

  const load = useCallback(() => {
    api
      .teams(id)
      .then(setView)
      .catch((e: unknown) => setError(errorText(e)))
  }, [id])
  useEffect(load, [load])

  const generate = () => {
    setBusy(true)
    setError(null)
    api
      .generateTeams(id)
      .then(setView)
      .catch((e: unknown) => setError(errorText(e)))
      .finally(() => setBusy(false))
  }
  const published = (v: TeamsView) => {
    setView(v)
    setToast('Equipos publicados')
  }

  return (
    <div className="vf-container">
      <h1 className="vf-title">Armar equipos</h1>
      <p>
        <Link to={BASE}>Volver al partido</Link>
      </p>
      {!view && !error && <p role="status">Cargando…</p>}
      {error && <p className="vf-error">{error}</p>}
      {view && (
        <TeamsBody view={view} busy={busy} onGenerate={generate} onPublished={published} onReload={load} />
      )}
      <Toast message={toast} onDone={clearToast} />
    </div>
  )
}
