import { useCallback, useState } from 'react'
import { useLoad } from '../../vaca-futbolera/useLoad'
import { api, errorText } from '../api'
import { formatDate, formatMoney } from '../format'
import type { Invoice, Operacion, QuarterSummary } from '../types'

const OPERACION: Record<Operacion, string> = {
  nacional: 'España',
  intracomunitaria: 'Unión Europea',
  extracomunitaria: 'Fuera de la UE',
}
const QUARTERS = [1, 2, 3, 4]

function Row({ invoice, onVoided }: { invoice: Invoice; onVoided: () => void }) {
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const label = `${invoice.numero}/${invoice.fecha.slice(0, 4)}`

  const remove = async () => {
    setError(null)
    try {
      await api.voidInvoice(invoice.id)
      onVoided()
    } catch (err) {
      setError(errorText(err))
    }
  }

  return (
    <li
      className={`rd-row ${invoice.observaciones.length ? 'rd-row--T-5' : ''} ${invoice.anulada ? 'rd-row--off' : ''}`}
    >
      <div className="rd-row-date">
        <strong>Nº {label}</strong>
        <span className="rd-muted">{formatDate(invoice.fecha)}</span>
        <span className="rd-tag">{invoice.trimestre}T</span>
      </div>
      <div className="rd-row-main">
        <p className="rd-row-title">
          {invoice.cliente} <span className="rd-tag">{OPERACION[invoice.operacion]}</span>
          {invoice.anulada && <span className="rd-tag rd-tag--warn">Anulada</span>}
        </p>
        <p className="rd-muted">{invoice.concepto}</p>
        {invoice.observaciones.map((o) => (
          <p key={o} className="rd-issue">
            {o}
          </p>
        ))}
        {error && (
          <p role="alert" className="rd-error">
            {error}
          </p>
        )}
      </div>
      <div className="rd-status">
        <strong>{formatMoney(invoice.base)}</strong>
        {invoice.moneda !== 'EUR' && (
          <span className="rd-muted">{formatMoney(invoice.importe, invoice.moneda)} facturados</span>
        )}
        <span className="rd-muted">
          IVA {formatMoney(invoice.cuota_iva)} · retención {formatMoney(invoice.retencion)}
        </span>
        {!invoice.anulada &&
          (confirming ? (
            <button type="button" className="rd-btn rd-btn--danger" onClick={() => void remove()}>
              Sí, anular la {label}
            </button>
          ) : (
            <button type="button" className="rd-link" onClick={() => setConfirming(true)}>
              Anular registro {label}
            </button>
          ))}
      </div>
    </li>
  )
}

function Summary({ summary }: { summary: QuarterSummary }) {
  return (
    <section className="rd-card" aria-label={`Bases del ${summary.trimestre}T`}>
      <p className="rd-muted">
        Bases de ingresos por tipo de operación. Todavía no incluye gastos ni el resultado de ningún modelo.
      </p>
      <ul className="rd-totals">
        {summary.operaciones.map((o) => (
          <li key={o.operacion}>
            <span>
              {OPERACION[o.operacion]} <span className="rd-source">{o.casillas}</span>
            </span>
            <strong>{formatMoney(o.base)}</strong>
            <span className="rd-muted">
              {o.facturas.length === 0
                ? 'sin facturas'
                : `IVA ${formatMoney(o.cuota_iva)} · ${o.facturas.join(', ')}`}
            </span>
          </li>
        ))}
      </ul>
      {summary.clientes_ue.length > 0 && (
        <p className="rd-muted">
          Para el 349:{' '}
          {summary.clientes_ue.map((c) => `${c.cliente} (${c.tax_id}) ${formatMoney(c.base)}`).join(' · ')}
        </p>
      )}
    </section>
  )
}

export function InvoicesPage() {
  const year = new Date().getFullYear()
  const [quarter, setQuarter] = useState(Math.floor(new Date().getMonth() / 3) + 1)
  const loadList = useCallback(() => api.invoices(year), [year])
  const loadSummary = useCallback(() => api.quarterSummary(year, quarter), [year, quarter])
  const list = useLoad(loadList)
  const summary = useLoad(loadSummary)

  if (list.loading) return <p role="status">Cargando facturas…</p>
  if (list.error)
    return (
      <p role="alert" className="rd-error">
        {list.error}
      </p>
    )
  const invoices = list.data?.invoices ?? []
  const numbering = list.data?.numeracion ?? []
  const reload = () => {
    list.reload()
    summary.reload()
  }

  return (
    <>
      <p className="rd-muted">
        Facturas emitidas en {year}, tal como se emitieron. Para sumar una, adjuntala en el asistente: él la
        lee y vos confirmás. Una factura con errores se corrige con una rectificativa, no editándola.
      </p>
      {numbering.length > 0 && (
        <div role="note" className="rd-banner">
          <strong>Numeración</strong>
          {numbering.map((n) => (
            <p key={n}>{n}</p>
          ))}
        </div>
      )}
      <div className="rd-tabs" role="group" aria-label="Trimestre">
        {QUARTERS.map((q) => (
          <button
            key={q}
            type="button"
            className={`rd-tab ${q === quarter ? 'active' : ''}`}
            aria-pressed={q === quarter}
            onClick={() => setQuarter(q)}
          >
            {q}T
          </button>
        ))}
      </div>
      {summary.data && <Summary summary={summary.data} />}
      {invoices.length === 0 ? (
        <div className="rd-card">
          <p>Todavía no hay facturas registradas en {year}. Abrí el asistente y adjuntá la primera.</p>
        </div>
      ) : (
        <ul className="rd-list">
          {invoices.map((i) => (
            <Row key={i.id} invoice={i} onVoided={reload} />
          ))}
        </ul>
      )}
    </>
  )
}
