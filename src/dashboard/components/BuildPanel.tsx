import { useState } from 'react'
import { api, errorText } from '../api'
import type { Build } from '../types'

const LABEL: Record<string, string> = {
  pr_abierto: 'PR abierto',
  gauntlet_roja: 'La gauntlet siguió en rojo',
  migracion_destructiva: 'Migración destructiva: necesita tu confirmación',
  sin_cambios: 'El agente no cambió nada',
  agente_fallo: 'El agente no terminó',
  error: 'No se pudo construir',
  cancelado: 'Cancelada',
  interrumpido: 'Se interrumpió',
}

function summary(b: Build): string {
  const parts = [LABEL[b.estado] ?? b.estado]
  if (b.intentos !== null) parts.push(`${b.intentos} ${b.intentos === 1 ? 'intento' : 'intentos'}`)
  if (b.costo_usd !== null) parts.push(`US$ ${b.costo_usd.toFixed(2)}`)
  return parts.join(' · ')
}

type Act = (action: () => Promise<unknown>) => Promise<void>

function Running({ build, busy, act }: { build: Build; busy: boolean; act: Act }) {
  return (
    <>
      <p className="rd-build-head">
        <strong>Construyendo…</strong>
        <button
          type="button"
          className="rd-link"
          disabled={busy}
          onClick={() => void act(() => api.cancelBuild(build.slug))}
        >
          Cancelar construcción
        </button>
      </p>
      {build.log.length > 0 && <pre className="rd-spec-body">{build.log.join('\n')}</pre>}
    </>
  )
}

function Finished({ build }: { build: Build }) {
  return (
    <>
      <p className="rd-build-head">
        <span>{summary(build)}</span>
        {build.pr_url && (
          <a href={build.pr_url} target="_blank" rel="noreferrer">
            Ver el PR en draft
          </a>
        )}
      </p>
      {build.estado !== 'pr_abierto' && build.detalle && <pre className="rd-spec-body">{build.detalle}</pre>}
    </>
  )
}

interface LaunchProps {
  modulo: string
  again: boolean
  budget: number
  busy: boolean
  act: Act
}

function Launch({ modulo, again, budget, busy, act }: LaunchProps) {
  const [confirming, setConfirming] = useState(false)
  if (!confirming)
    return (
      <button type="button" className="rd-btn" onClick={() => setConfirming(true)}>
        {again ? 'Construir de nuevo' : 'Construir'}
      </button>
    )
  return (
    <div className="rd-build-confirm">
      <p>
        Construir cuesta hasta US$ {budget} en la API de Claude. El builder escribe el código en una rama
        aparte, corre la gauntlet y abre un PR en draft para que lo revises.
      </p>
      <button
        type="button"
        className="rd-btn rd-btn--primary"
        disabled={busy}
        onClick={() => void act(() => api.startBuild(modulo))}
      >
        Sí, construir
      </button>
      <button type="button" className="rd-link" disabled={busy} onClick={() => setConfirming(false)}>
        Cancelar
      </button>
    </div>
  )
}

interface Props {
  modulo: string
  build: Build | undefined
  budget: number
  onChanged: () => void
}

/** Construir una spec con el builder local: confirmar el costo, seguir el progreso, cancelar y ver el PR. */
export function BuildPanel({ modulo, build, budget, onChanged }: Props) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const act: Act = async (action) => {
    setBusy(true)
    setError(null)
    try {
      await action()
      onChanged()
    } catch (err) {
      setError(errorText(err))
    } finally {
      setBusy(false)
    }
  }

  const running = build?.estado === 'corriendo'
  return (
    <div className="rd-build">
      {build && (running ? <Running build={build} busy={busy} act={act} /> : <Finished build={build} />)}
      {!running && <Launch modulo={modulo} again={!!build} budget={budget} busy={busy} act={act} />}
      {error && (
        <p role="alert" className="rd-error">
          {error}
        </p>
      )}
    </div>
  )
}
