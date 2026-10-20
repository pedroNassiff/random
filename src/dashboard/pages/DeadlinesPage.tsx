import { useState, type FormEvent } from 'react'
import { api, errorText } from '../api'
import { formatDate } from '../format'
import type { DeadlineKind, DeadlineResult } from '../types'

const KINDS: { value: DeadlineKind; label: string; help: string }[] = [
  {
    value: 'dias_habiles',
    label: 'Requerimiento (días hábiles)',
    help: 'El plazo cuenta desde el día siguiente a la notificación, sin sábados, domingos ni festivos.',
  },
  {
    value: 'apremio',
    label: 'Providencia de apremio',
    help: 'Notificada del 1 al 15: hasta el día 20. Del 16 a fin de mes: hasta el día 5 del mes siguiente.',
  },
]

export function DeadlinesPage() {
  const [tipo, setTipo] = useState<DeadlineKind>('dias_habiles')
  const [fecha, setFecha] = useState('')
  const [dias, setDias] = useState('10')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<DeadlineResult | null>(null)
  const kind = KINDS.find((k) => k.value === tipo)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setResult(null)
    try {
      const input =
        tipo === 'apremio'
          ? { tipo, fecha_notificacion: fecha }
          : { tipo, fecha_notificacion: fecha, dias: Number(dias) }
      setResult(await api.deadline(input))
    } catch (err) {
      setError(errorText(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <p className="rd-muted">
        La fecha de notificación la confirmás vos: de ella cuelga todo el plazo y el PDF no siempre la trae.
        Se usan los festivos del domicilio fiscal de tu perfil.
      </p>
      <form className="rd-card rd-form" onSubmit={submit}>
        <fieldset className="rd-fieldset">
          <legend className="rd-label">Tipo de notificación</legend>
          {KINDS.map((k) => (
            <label key={k.value} className="rd-check">
              <input
                type="radio"
                name="tipo"
                value={k.value}
                checked={tipo === k.value}
                onChange={() => setTipo(k.value)}
              />
              {k.label}
            </label>
          ))}
          <p className="rd-muted">{kind?.help}</p>
        </fieldset>
        <label className="rd-label" htmlFor="rd-notificado">
          Fecha de notificación
        </label>
        <input
          id="rd-notificado"
          className="rd-input"
          type="date"
          required
          value={fecha}
          onChange={(e) => setFecha(e.target.value)}
        />
        {tipo === 'dias_habiles' && (
          <>
            <label className="rd-label" htmlFor="rd-dias">
              Días hábiles de plazo
            </label>
            <input
              id="rd-dias"
              className="rd-input"
              type="number"
              min={1}
              max={120}
              required
              value={dias}
              onChange={(e) => setDias(e.target.value)}
            />
          </>
        )}
        <button type="submit" className="rd-btn rd-btn--primary" disabled={busy || !fecha}>
          Calcular plazo
        </button>
      </form>
      {error && (
        <p role="alert" className="rd-error">
          {error}
        </p>
      )}
      {result && (
        <section className="rd-card" aria-label="Resultado">
          <p className="rd-result">
            Vence el <strong>{formatDate(result.vence)}</strong>
          </p>
          <ol className="rd-trace">
            {result.traza.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
          <p className="rd-source">Fuente: {result.fuente}</p>
        </section>
      )}
    </>
  )
}
