import { useLoad } from '../../vaca-futbolera/useLoad'
import { api } from '../api'
import { formatDate } from '../format'
import type { Spec } from '../types'

function SpecItem({ spec }: { spec: Spec }) {
  const escenarios = `${spec.escenarios} ${spec.escenarios === 1 ? 'escenario' : 'escenarios'}`
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
    </article>
  )
}

/** Specs de módulos aprobadas desde NEO, esperando al builder. Se muestra la última versión de cada una. */
export function SpecsPage() {
  const { data, error, loading } = useLoad(api.specs)
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
              <SpecItem key={s.id} spec={s} />
            ))}
          </div>
        ))}
    </>
  )
}
