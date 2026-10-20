import { useState, type FocusEvent, type PointerEvent } from 'react'
import { formatMoney } from '../format'
import type { MovementSummary } from '../types'

const MONTH = new Intl.DateTimeFormat('es-ES', { month: 'short', year: '2-digit', timeZone: 'UTC' })
const MONTH_LONG = new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric', timeZone: 'UTC' })
const month = (iso: string) => MONTH.format(new Date(`${iso}T00:00:00Z`))
const monthLong = (iso: string) => MONTH_LONG.format(new Date(`${iso}T00:00:00Z`))

/** Variación contra el mes anterior, en texto (la dirección la dan la flecha y el signo, no el color). */
export function variation(previous: number, current: number): string {
  if (previous === 0) return current === 0 ? '' : 'nuevo'
  const pct = Math.round(((current - previous) / previous) * 100)
  if (pct === 0) return '='
  return `${pct > 0 ? '▲' : '▼'} ${Math.abs(pct)} %`
}

interface Tip {
  x: number
  y: number
  lines: string[]
}

/**
 * Mapa de calor categoría × mes: la intensidad del azul es el importe (escala secuencial de un solo tono,
 * relativa al mayor valor de la tabla). Cada celda muestra importe y variación contra el mes anterior.
 */
export function CategoryHeatmap({ summary }: { summary: MovementSummary }) {
  const [open, setOpen] = useState<string | null>(null)
  const [tip, setTip] = useState<Tip | null>(null)
  const max = Math.max(0, ...summary.filas.flatMap((f) => f.valores.map(Number)))

  const show = (e: PointerEvent<HTMLElement> | FocusEvent<HTMLElement>, lines: string[]) => {
    const rect = e.currentTarget.getBoundingClientRect()
    setTip({ x: rect.left + rect.width / 2, y: rect.top, lines })
  }

  return (
    <div className="rd-heat-wrap">
      <table className="rd-heat">
        <caption className="rd-sr">Gastos por categoría y mes</caption>
        <thead>
          <tr>
            <th scope="col">Categoría</th>
            {summary.meses.map((m) => (
              <th key={m} scope="col">
                {month(m)}
              </th>
            ))}
            <th scope="col">Promedio</th>
            <th scope="col">Total</th>
          </tr>
        </thead>
        <tbody>
          {summary.filas.map((f) => {
            const values = f.valores.map(Number)
            return [
              <tr key={f.categoria}>
                <th scope="row">
                  <button
                    type="button"
                    className="rd-heat-cat"
                    aria-expanded={open === f.categoria}
                    onClick={() => setOpen(open === f.categoria ? null : f.categoria)}
                  >
                    {f.categoria}
                  </button>
                </th>
                {values.map((v, i) => {
                  const prev = values[i - 1] ?? 0
                  const change = i === 0 ? '' : variation(prev, v)
                  const lines = [
                    `${f.categoria} · ${monthLong(summary.meses[i] ?? '')}`,
                    formatMoney(f.valores[i] ?? '0'),
                    ...(i > 0 ? [`Mes anterior: ${formatMoney(String(prev))}`] : []),
                  ]
                  return (
                    <td
                      key={summary.meses[i]}
                      tabIndex={0}
                      className="rd-heat-cell"
                      // Intensidad 0 → 1 sobre el mayor valor; 0 queda casi del color de fondo.
                      style={{ ['--heat' as string]: max ? (v / max).toFixed(3) : '0' }}
                      aria-label={lines.join('. ')}
                      onPointerEnter={(e) => show(e, lines)}
                      onPointerLeave={() => setTip(null)}
                      onFocus={(e) => show(e, lines)}
                      onBlur={() => setTip(null)}
                    >
                      <span className="rd-heat-value">
                        {v ? formatMoney(String(v)).replace(' €', '') : '—'}
                      </span>
                      {change && <span className="rd-heat-change">{change}</span>}
                    </td>
                  )
                })}
                <td className="rd-heat-num">{formatMoney(f.promedio)}</td>
                <td className="rd-heat-num rd-heat-total">{formatMoney(f.total)}</td>
              </tr>,
              open === f.categoria && (
                <tr key={`${f.categoria}-detalle`} className="rd-heat-detail">
                  <td colSpan={summary.meses.length + 3}>Incluye: {f.conceptos.join(', ')}</td>
                </tr>
              ),
            ]
          })}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row">Total</th>
            {summary.totales.map((t, i) => (
              <td key={summary.meses[i]} className="rd-heat-num">
                <span className="rd-heat-value">{formatMoney(t).replace(' €', '')}</span>
                {i > 0 && (
                  <span className="rd-heat-change">
                    {variation(Number(summary.totales[i - 1]), Number(t))}
                  </span>
                )}
              </td>
            ))}
            <td className="rd-heat-num">
              {formatMoney(String(Number(summary.total) / Math.max(1, summary.meses.length)))}
            </td>
            <td className="rd-heat-num rd-heat-total">{formatMoney(summary.total)}</td>
          </tr>
        </tfoot>
      </table>
      <div className="rd-heat-legend" aria-hidden="true">
        <span>menos</span>
        <span className="rd-heat-scale" />
        <span>más</span>
        <span className="rd-muted">· importes en €; ▲▼ = contra el mes anterior</span>
      </div>
      {tip && (
        <div className="rd-tooltip" role="tooltip" style={{ left: tip.x, top: tip.y }}>
          {tip.lines.map((l) => (
            <p key={l}>{l}</p>
          ))}
        </div>
      )}
    </div>
  )
}
