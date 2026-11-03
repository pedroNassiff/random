import { useCallback, useEffect, useState } from 'react'
import { useLoad } from '../../vaca-futbolera/useLoad'
import { api } from '../api'
import { BuildPanel } from '../components/BuildPanel'
import { formatDate } from '../format'
import type { Build, BuildsView, Spec } from '../types'

/** Cada cuánto se consulta el progreso mientras hay una construcción en curso. Los tests lo bajan. */
export const timing = { pollMs: 3000 }

/** Estado del builder local. Si no se puede consultar, la página sigue funcionando sin Construir. */
function useBuilds() {
  const [view, setView] = useState<BuildsView | null>(null)
  const [tick, setTick] = useState(0)
  const reload = useCallback(() => setTick((t) => t + 1), [])

  useEffect(() => {
    let cancelled = false
    api
      .builds()
      .then((v) => !cancelled && setView(v))
      .catch(() => !cancelled && setView(null))
    return () => {
      cancelled = true
    }
  }, [tick])

  const running = view?.builds.some((b) => b.estado === 'corriendo') ?? false
  useEffect(() => {
    if (!running) return
    const id = setTimeout(reload, timing.pollMs)
    return () => clearTimeout(id)
  }, [running, tick, reload])

  return { view, reload }
}

function SpecItem({ spec, builds, reload }: { spec: Spec; builds: BuildsView | null; reload: () => void }) {
  const escenarios = `${spec.escenarios} ${spec.escenarios === 1 ? 'escenario' : 'escenarios'}`
  const build: Build | undefined = builds?.builds.find(
    (b) => b.modulo.toLowerCase() === spec.modulo.toLowerCase(),
  )
  return (
    <article className="rd-card rd-spec" aria-label={spec.modulo}>
      <p className="rd-proposal-head">
        <strong>{spec.modulo}</strong>
        <span className="rd-tag">Pendiente de construir</span>
      </p>
      <p className="rd-muted">
        Versión {spec.version} · {escenarios} · {formatDate(spec.creada.slice(0, 10))}
      </p>
      <details>
        <summary>Ver la spec</summary>
        <pre className="rd-spec-body">{spec.contenido}</pre>
      </details>
      {builds?.disponible && (
        <BuildPanel modulo={spec.modulo} build={build} budget={builds.presupuesto_usd} onChanged={reload} />
      )}
    </article>
  )
}

/** Specs de módulos aprobadas desde NEO, esperando al builder. Se muestra la última versión de cada una. */
export function SpecsPage() {
  const { data, error, loading } = useLoad(api.specs)
  const { view, reload } = useBuilds()
  return (
    <>
      <h1 className="rd-title">Specs</h1>
      <p className="rd-muted">
        Lo que armás con NEO y guardás queda acá, pendiente de construir. Cada cambio que guardás es una
        versión nueva.
      </p>
      {loading && <p role="status">Cargando specs…</p>}
      {error && (
        <p role="alert" className="rd-error">
          {error}
        </p>
      )}
      {data &&
        (data.length === 0 ? (
          <div className="rd-card">
            <p>
              Todavía no hay specs. Contale a NEO qué querés sumar al dashboard y guardá la spec que arme.
            </p>
          </div>
        ) : (
          <div className="rd-list">
            {data.map((s) => (
              <SpecItem key={s.id} spec={s} builds={view} reload={reload} />
            ))}
          </div>
        ))}
    </>
  )
}
