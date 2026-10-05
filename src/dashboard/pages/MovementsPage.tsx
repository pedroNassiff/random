import { useCallback, useState, type ChangeEvent } from 'react'
import { useLoad } from '../../vaca-futbolera/useLoad'
import { api, errorText } from '../api'
import { CategoryHeatmap } from '../components/CategoryHeatmap'
import type { ImportResult, MovementSummary } from '../types'

const RANGES = [6, 12, 24]
type Tipo = 'gasto' | 'ingreso'

function toBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('No se pudo leer el archivo.'))
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '')
    reader.readAsDataURL(file)
  })
}

function ImportReport({ result }: { result: ImportResult }) {
  return (
    <section className="rd-card" aria-label="Resultado de la importación">
      <p>
        <strong>{result.movimientos} movimientos</strong> de {result.meses} meses ({result.desde.slice(0, 7)}{' '}
        a {result.hasta.slice(0, 7)}): {result.nuevos} nuevos y {result.actualizados} actualizados.
      </p>
      {result.omitidas.length > 0 && (
        <p className="rd-muted">Pestañas que no son de un mes: {result.omitidas.join(', ')}.</p>
      )}
      {result.descuadres.map((d) => (
        <p key={d} className="rd-issue">
          {d}
        </p>
      ))}
      {result.dudosos.length > 0 && (
        <details>
          <summary>{result.dudosos.length} filas sin importar por dudosas</summary>
          <ul className="rd-trace">
            {result.dudosos.map((d) => (
              <li key={d}>{d}</li>
            ))}
          </ul>
        </details>
      )}
    </section>
  )
}

function Importer({ onImported }: { onImported: (r: ImportResult) => void }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onPick = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setBusy(true)
    setError(null)
    try {
      onImported(await api.importMovements(file.name, await toBase64(file)))
    } catch (err) {
      setError(errorText(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <label className={`rd-btn ${busy ? 'rd-btn--busy' : ''}`}>
        <input
          className="rd-sr"
          type="file"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          disabled={busy}
          aria-label="Importar Excel de cuentas"
          onChange={(e) => void onPick(e)}
        />
        {busy ? 'Importando…' : 'Importar Excel'}
      </label>
      {error && (
        <p role="alert" className="rd-error">
          {error}
        </p>
      )}
    </>
  )
}

interface FiltersProps {
  tipo: Tipo
  meses: number
  available: string[]
  selected: string[]
  onTipo: (t: Tipo) => void
  onMeses: (m: number) => void
  onToggle: (p: string) => void
  onImported: (r: ImportResult) => void
}

function Filters({ tipo, meses, available, selected, onTipo, onMeses, onToggle, onImported }: FiltersProps) {
  return (
    <div className="rd-filters" role="group" aria-label="Filtros">
      <div className="rd-segment" role="group" aria-label="Tipo">
        {(['gasto', 'ingreso'] as Tipo[]).map((t) => (
          <button key={t} type="button" aria-pressed={tipo === t} onClick={() => onTipo(t)}>
            {t === 'gasto' ? 'Gastos' : 'Ingresos'}
          </button>
        ))}
      </div>
      <div className="rd-segment" role="group" aria-label="Período">
        {RANGES.map((r) => (
          <button key={r} type="button" aria-pressed={meses === r} onClick={() => onMeses(r)}>
            {r} meses
          </button>
        ))}
      </div>
      {available.length > 1 && (
        <div className="rd-segment" role="group" aria-label="Persona">
          {available.map((p) => (
            <button key={p} type="button" aria-pressed={selected.includes(p)} onClick={() => onToggle(p)}>
              {p}
            </button>
          ))}
        </div>
      )}
      <Importer onImported={onImported} />
    </div>
  )
}

function Body({ data, tipo }: { data: MovementSummary; tipo: Tipo }) {
  if (data.filas.length === 0)
    return (
      <div className="rd-card">
        <p>Todavía no hay movimientos. Importá tu Excel de cuentas para traer el histórico.</p>
      </div>
    )
  const title = tipo === 'gasto' ? 'Gastos por categoría y mes' : 'Ingresos por mes'
  return (
    <section className="rd-card" aria-label={title}>
      <h2 className="rd-subtitle">
        {tipo === 'gasto' ? 'En qué se va la plata, mes a mes' : 'De dónde viene'}
      </h2>
      <CategoryHeatmap summary={data} />
    </section>
  )
}

export function MovementsPage() {
  const [tipo, setTipo] = useState<Tipo>('gasto')
  const [meses, setMeses] = useState(6)
  // Vacío = todas las personas juntas.
  const [personas, setPersonas] = useState<string[]>([])
  const [imported, setImported] = useState<ImportResult | null>(null)
  const load = useCallback(() => api.movementSummary(tipo, personas, meses), [tipo, personas, meses])
  const { data, error, loading, reload } = useLoad(load)
  const available = data?.personas ?? []
  const toggle = (p: string) =>
    setPersonas(personas.includes(p) ? personas.filter((x) => x !== p) : [...personas, p])

  return (
    <>
      <h1 className="rd-title">Ingresos y gastos</h1>
      <p className="rd-muted">
        Importá tu planilla de cuentas (una pestaña por mes) y mirá en qué se va la plata y cómo cambia cada
        mes. Reimportar actualiza lo que cambió, sin duplicar.
      </p>
      <Filters
        tipo={tipo}
        meses={meses}
        available={available}
        selected={personas}
        onTipo={setTipo}
        onMeses={setMeses}
        onToggle={toggle}
        onImported={(r) => {
          setImported(r)
          reload()
        }}
      />
      {personas.length === 0 && available.length > 1 && (
        <p className="rd-muted">
          Mostrando a todos juntos. Ojo: «Hogar» es el total de la casa y «Vivienda (tu parte)» de Pedro es
          una parte de eso; elegí personas para no sumar dos veces.
        </p>
      )}
      {imported && <ImportReport result={imported} />}
      {loading && <p role="status">Cargando…</p>}
      {error && (
        <p role="alert" className="rd-error">
          {error}
        </p>
      )}
      {data && <Body data={data} tipo={tipo} />}
    </>
  )
}
