import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useLoad } from '../../vaca-futbolera/useLoad'
import { api } from '../api'
import { ObligationRow } from '../components/ObligationRow'
import { formatDate, isClosed } from '../format'
import { PERFIL } from '../routes'
import type { CalendarItem, CalendarView } from '../types'

const isMonthlyQuota = (i: CalendarItem) => i.modelo === 'RETA' && i.periodo !== 'tarifa-plana'

function Group({
  title,
  items,
  onSaved,
  empty,
}: {
  title: string
  items: CalendarItem[]
  onSaved: (item: CalendarItem) => void
  empty: string
}) {
  return (
    <section className="rd-group" aria-label={title}>
      <h2 className="rd-subtitle">
        {title} <span className="rd-count">{items.length}</span>
      </h2>
      {items.length === 0 ? (
        <p className="rd-muted">{empty}</p>
      ) : (
        <ul className="rd-list">
          {items.map((i) => (
            <ObligationRow key={i.key} item={i} onSaved={onSaved} />
          ))}
        </ul>
      )}
    </section>
  )
}

function Calendar({ view }: { view: CalendarView }) {
  const [items, setItems] = useState(view.items)
  const [showQuotas, setShowQuotas] = useState(true)

  const onSaved = (saved: CalendarItem) =>
    setItems((all) => all.map((i) => (i.key === saved.key ? saved : i)))
  const visible = showQuotas ? items : items.filter((i) => !isMonthlyQuota(i))
  const overdue = visible.filter((i) => i.aviso === 'vencida')
  const upcoming = visible.filter((i) => !isClosed(i.estado) && i.aviso !== 'vencida')
  const closed = visible.filter((i) => isClosed(i.estado))
  const provisional = items.some((i) => i.provisional)
  const years = view.festivos_cargados.join(', ') || 'ninguno'

  return (
    <>
      <p className="rd-muted">
        Hoy es {formatDate(view.hoy)}. El calendario se genera desde tu perfil fiscal; solo se cierra una
        obligación con su justificante.
      </p>
      {provisional && (
        <p role="note" className="rd-banner">
          Hay fechas provisionales: solo hay festivos cargados para {years}. En los demás años el vencimiento
          salta fines de semana pero no festivos.
        </p>
      )}
      <label className="rd-check">
        <input type="checkbox" checked={showQuotas} onChange={(e) => setShowQuotas(e.target.checked)} />
        Mostrar las cuotas mensuales de autónomos
      </label>
      <Group title="Vencidas" items={overdue} onSaved={onSaved} empty="Nada vencido." />
      <Group title="Próximas" items={upcoming} onSaved={onSaved} empty="No hay obligaciones abiertas." />
      <Group title="Cerradas" items={closed} onSaved={onSaved} empty="Todavía no cerraste ninguna." />
    </>
  )
}

export function CalendarPage() {
  const { data, error, loading } = useLoad(api.calendar)
  if (loading) return <p role="status">Cargando calendario…</p>
  if (error)
    return (
      <p role="alert" className="rd-error">
        {error}
      </p>
    )
  if (!data)
    return (
      <div className="rd-card">
        <p>Todavía no cargaste tu perfil fiscal. El calendario se genera a partir de él.</p>
        <Link className="rd-btn rd-btn--primary" to={PERFIL}>
          Cargar perfil fiscal
        </Link>
      </div>
    )
  return <Calendar view={data} />
}
