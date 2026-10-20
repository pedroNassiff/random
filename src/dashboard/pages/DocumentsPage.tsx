import { useState } from 'react'
import { useLoad } from '../../vaca-futbolera/useLoad'
import { api, errorText } from '../api'
import { formatDate, formatSize } from '../format'
import type { StoredDocument } from '../types'

function Row({ doc, onDeleted }: { doc: StoredDocument; onDeleted: () => void }) {
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const remove = async () => {
    setBusy(true)
    setError(null)
    try {
      await api.deleteDocument(doc.id)
      onDeleted()
    } catch (err) {
      setError(errorText(err))
      setBusy(false)
    }
  }

  return (
    <li className="rd-doc">
      <div className="rd-row-main">
        <p className="rd-row-title">{doc.name}</p>
        <p className="rd-muted">
          Subido el {formatDate(doc.created_at.slice(0, 10))} · {formatSize(doc.size_bytes)}
        </p>
        {error && (
          <p role="alert" className="rd-error">
            {error}
          </p>
        )}
      </div>
      <div className="rd-doc-actions">
        <a className="rd-btn" href={api.documentUrl(doc.id)} download={doc.name}>
          Descargar
        </a>
        {confirming ? (
          <>
            <button
              type="button"
              className="rd-btn rd-btn--danger"
              disabled={busy}
              onClick={() => void remove()}
            >
              Sí, eliminar {doc.name}
            </button>
            <button type="button" className="rd-link" disabled={busy} onClick={() => setConfirming(false)}>
              Cancelar
            </button>
          </>
        ) : (
          <button type="button" className="rd-link" onClick={() => setConfirming(true)}>
            Eliminar {doc.name}
          </button>
        )}
      </div>
    </li>
  )
}

export function DocumentsPage() {
  const { data, error, loading, reload } = useLoad(api.documents)
  if (loading) return <p role="status">Cargando documentos…</p>
  if (error)
    return (
      <p role="alert" className="rd-error">
        {error}
      </p>
    )
  const docs = data ?? []
  return (
    <>
      <p className="rd-muted">
        Lo que adjuntás en el chat del asistente queda guardado acá, así no hace falta subirlo de nuevo. Solo
        vos podés verlo.
      </p>
      {docs.length === 0 ? (
        <div className="rd-card">
          <p>Todavía no hay documentos. Abrí el asistente y adjuntá tu 036 para empezar.</p>
        </div>
      ) : (
        <ul className="rd-list">
          {docs.map((d) => (
            <Row key={d.id} doc={d} onDeleted={reload} />
          ))}
        </ul>
      )}
    </>
  )
}
