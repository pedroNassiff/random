import { useState, type FormEvent } from 'react'
import { api, errorText } from '../api'
import { AVISO_LABEL, daysLabel, ESTADO_LABEL, formatDate, isClosed } from '../format'
import type { CalendarItem, Estado } from '../types'

const ESTADOS: Estado[] = ['pendiente', 'preparado', 'presentado', 'pagado']

function StatusForm({ item, onSaved }: { item: CalendarItem; onSaved: (item: CalendarItem) => void }) {
  const [estado, setEstado] = useState<Estado>(item.estado)
  const [justificante, setJustificante] = useState(item.justificante ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const closing = isClosed(estado)
  const dirty = estado !== item.estado || justificante !== (item.justificante ?? '')

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      onSaved(await api.setStatus(item.key, estado, justificante.trim() || null))
    } catch (err) {
      setError(errorText(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="rd-status" onSubmit={submit}>
      <label className="rd-sr" htmlFor={`estado-${item.key}`}>
        Estado de {item.titulo}
      </label>
      <select
        id={`estado-${item.key}`}
        className="rd-input"
        value={estado}
        onChange={(e) => setEstado(e.target.value as Estado)}
      >
        {ESTADOS.map((e) => (
          <option key={e} value={e}>
            {ESTADO_LABEL[e]}
          </option>
        ))}
      </select>
      {closing && (
        <>
          <label className="rd-sr" htmlFor={`just-${item.key}`}>
            Justificante de {item.titulo}
          </label>
          <input
            id={`just-${item.key}`}
            className="rd-input"
            placeholder="Justificante (CSV o referencia)"
            value={justificante}
            onChange={(e) => setJustificante(e.target.value)}
          />
        </>
      )}
      <button type="submit" className="rd-btn" disabled={busy || !dirty || (closing && !justificante.trim())}>
        Guardar
      </button>
      {error && (
        <p role="alert" className="rd-error">
          {error}
        </p>
      )}
    </form>
  )
}

export function ObligationRow({
  item,
  onSaved,
}: {
  item: CalendarItem
  onSaved: (item: CalendarItem) => void
}) {
  const closed = isClosed(item.estado)
  return (
    <li className={`rd-row rd-row--${item.aviso}`}>
      <div className="rd-row-date">
        <strong>{formatDate(item.vence)}</strong>
        {!closed && <span className="rd-muted">{daysLabel(item.dias_restantes)}</span>}
        {item.provisional && <span className="rd-tag rd-tag--warn">Fecha provisional</span>}
      </div>
      <div className="rd-row-main">
        <p className="rd-row-title">
          <span className="rd-tag">{item.modelo}</span> {item.titulo}
          {item.aviso !== 'sin_aviso' && (
            <span className={`rd-tag rd-tag--${item.aviso}`}>{AVISO_LABEL[item.aviso]}</span>
          )}
          {item.condicional && <span className="rd-tag">Si aplica</span>}
        </p>
        {item.nota && <p className="rd-muted">{item.nota}</p>}
        <p className="rd-source">Fuente: {item.fuente}</p>
      </div>
      <StatusForm key={`${item.estado}-${item.justificante ?? ''}`} item={item} onSaved={onSaved} />
    </li>
  )
}
