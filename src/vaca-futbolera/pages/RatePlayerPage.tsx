import { useCallback, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api, errorText } from '../api'
import { useAuth } from '../auth'
import { Button } from '../components/Button'
import { SkillPicker } from '../components/SkillPicker'
import { Toast } from '../components/Toast'
import { BASE } from '../routes'
import { useLoad } from '../useLoad'

export function RatePlayerPage() {
  const { id = '' } = useParams()
  const { me } = useAuth()
  const loader = useCallback(async () => {
    const [skills, players, mine] = await Promise.all([api.skills(), api.players(), api.myRatings(id)])
    return { skills: skills.filter((s) => s.is_active), player: players.find((p) => p.id === id), mine }
  }, [id])
  const { data, error, loading } = useLoad(loader)
  const [edits, setEdits] = useState<Record<string, number>>({})
  const [toast, setToast] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const clearToast = useCallback(() => setToast(null), [])

  if (loading)
    return (
      <p role="status" className="vf-container">
        Cargando…
      </p>
    )
  if (error || !data) return <p className="vf-container vf-error">{error}</p>
  if (!data.player) return <p className="vf-container vf-error">Jugador no encontrado.</p>

  const values = { ...data.mine, ...edits }
  const isSelf = me?.player_id === id

  const save = async () => {
    setSaveError(null)
    try {
      await api.rate(id, values)
      setToast('Puntajes guardados')
    } catch (e) {
      setSaveError(errorText(e))
    }
  }

  return (
    <div className="vf-container">
      <h1 className="vf-title">Puntuar a {data.player.display_name}</h1>
      <p className="vf-muted">Tus puntajes son anónimos: nadie más los ve.</p>
      {isSelf && (
        <p className="vf-muted">Tu autoevaluación se guarda, pero no cuenta en el puntaje del grupo.</p>
      )}
      {data.skills.map((s) => (
        <div key={s.id} className="vf-card">
          <strong>{s.name}</strong>
          <SkillPicker
            label={s.name}
            description={s.description}
            value={values[s.id] ?? null}
            onChange={(v) => setEdits((prev) => ({ ...prev, [s.id]: v }))}
          />
        </div>
      ))}
      {saveError && <p className="vf-error">{saveError}</p>}
      <div className="vf-row">
        <Button onClick={save} disabled={Object.keys(values).length === 0}>
          Guardar
        </Button>
        <Link to={`${BASE}/jugadores`}>Volver a jugadores</Link>
      </div>
      <Toast message={toast} onDone={clearToast} />
    </div>
  )
}
