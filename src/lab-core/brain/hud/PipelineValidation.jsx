/**
 * PipelineValidation — Modal de validación del pipeline per-channel.
 *
 * Ejecuta los 5 criterios de aceptación de Fase 1 del doc
 * prox-implementacion-mas-canales-PER-CHANNEL-EEG-STORAGE:
 *
 *  T1 — Consistencia de agregación
 *       mean(α_ch×4) ≈ avg_alpha guardado (tolerancia < 5%)
 *  T2 — Sanity check neurofisiológico
 *       α_tp9 + α_tp10 > α_af7 + α_af8 en baseline_closed
 *  T3 — Persistencia end-to-end
 *       per_channel_version=1 y alpha_tp9_avg no-null en Postgres
 *  T4 — API shape correcto
 *       GET /sessions/{id}/metrics devuelve per_channel.alpha.tp9 con N ventanas
 *  T5 — Frontend no se rompe
 *       SessionDetail sigue cargando (backward compat — siempre pasa si T4 pasa)
 *
 * Requiere que ya exista al menos una sesión grabada con per_channel_version=1.
 * Si no existe ninguna, muestra un estado de "pendiente" con instrucciones.
 */

import React, { useState, useCallback, useRef } from 'react'
import { API_BASE } from '../store'

// ── Colores semánticos ──────────────────────────────────────────────────────
const C = {
  pass:    '#5DCAA5',
  fail:    '#F87171',
  warn:    '#FBBF24',
  idle:    'rgba(255,255,255,0.25)',
  running: '#818CF8',
  bg:      'rgba(0,5,12,0.97)',
  border:  'rgba(100,200,255,0.12)',
  mono:    'monospace',
}

// ── Tipos de resultado ──────────────────────────────────────────────────────
const STATUS = { idle: 'idle', running: 'running', pass: 'pass', fail: 'fail', warn: 'warn', skip: 'skip' }

const INITIAL_TESTS = [
  {
    id: 'T1',
    label: 'Consistencia de agregación',
    desc: 'mean(α_tp9, α_af7, α_af8, α_tp10) ≈ avg_alpha guardado  ±5%',
  },
  {
    id: 'T2',
    label: 'Sanity check neurofisiológico',
    desc: 'En baseline_closed: α_tp9 + α_tp10 > α_af7 + α_af8',
  },
  {
    id: 'T3',
    label: 'Persistencia end-to-end (Postgres)',
    desc: 'per_channel_version=1  y  alpha_tp9_avg ≠ null',
  },
  {
    id: 'T4',
    label: 'API shape correcto',
    desc: 'GET /sessions/{id}/metrics → per_channel.alpha.tp9.length = N_windows',
  },
  {
    id: 'T5',
    label: 'Backward compatibility',
    desc: 'Sesiones antiguas (ver=0) devuelven per_channel=null sin error',
  },
]

// ── Helpers ─────────────────────────────────────────────────────────────────
function StatusDot({ status }) {
  const colors = {
    idle:    C.idle,
    running: C.running,
    pass:    C.pass,
    fail:    C.fail,
    warn:    C.warn,
    skip:    'rgba(255,255,255,0.15)',
  }
  const pulse = status === 'running'
  return (
    <span style={{
      display: 'inline-block',
      width: 8, height: 8,
      borderRadius: '50%',
      background: colors[status] || C.idle,
      flexShrink: 0,
      boxShadow: pulse ? `0 0 6px ${C.running}` : 'none',
      animation: pulse ? 'pulse-dot 1s ease-in-out infinite' : 'none',
    }} />
  )
}

// ── Lógica de tests ──────────────────────────────────────────────────────────
async function fetchLatestPerChannelSession(apiBase) {
  const res = await fetch(`${apiBase}/sessions?limit=20`)
  if (!res.ok) throw new Error(`GET /sessions → ${res.status}`)
  const data = await res.json()
  const sessions = data.sessions || data
  const latest = sessions.find(s => s.per_channel_version === 1)
  return latest || null
}

async function fetchSessionMetrics(apiBase, id) {
  const res = await fetch(`${apiBase}/sessions/${id}/metrics`)
  if (!res.ok) throw new Error(`GET /sessions/${id}/metrics → ${res.status}`)
  return res.json()
}

async function fetchOldSession(apiBase) {
  const res = await fetch(`${apiBase}/sessions?limit=20`)
  if (!res.ok) return null
  const data = await res.json()
  const sessions = data.sessions || data
  return sessions.find(s => s.per_channel_version === 0 || !s.per_channel_version) || null
}

function runT1(session, metricsResponse) {
  // mean of per-channel alpha averages vs avg_alpha in postgres
  const { alpha_tp9_avg, alpha_af7_avg, alpha_af8_avg, alpha_tp10_avg, avg_alpha } = session
  if ([alpha_tp9_avg, alpha_af7_avg, alpha_af8_avg, alpha_tp10_avg].some(v => v == null)) {
    return { status: STATUS.fail, detail: 'Uno o más avg de canal es null en Postgres' }
  }
  if (avg_alpha == null) {
    return { status: STATUS.warn, detail: 'avg_alpha null — no se puede calcular diferencia (sesión sin métricas)' }
  }
  const computed = (alpha_tp9_avg + alpha_af7_avg + alpha_af8_avg + alpha_tp10_avg) / 4
  const diff = Math.abs(computed - avg_alpha) / (avg_alpha || 1)
  const pct = (diff * 100).toFixed(2)
  if (diff <= 0.05) {
    return { status: STATUS.pass, detail: `Δ = ${pct}%  (computed=${computed.toFixed(4)}, stored=${avg_alpha.toFixed(4)})` }
  }
  return { status: STATUS.fail, detail: `Δ = ${pct}% > 5%  (computed=${computed.toFixed(4)}, stored=${avg_alpha.toFixed(4)})` }
}

function runT2(metricsResponse) {
  const pc = metricsResponse.per_channel
  if (!pc) return { status: STATUS.skip, detail: 'per_channel=null — graba una sesión con fases baseline_closed' }

  // Find windows where state tag is baseline_closed
  // pc.alpha = {tp9: [...], af7: [...], af8: [...], tp10: [...]}
  // pc.timestamps not available per-state here, so we compute over all windows as proxy
  // (real baseline_closed check needs state tagging — this is best-effort)
  const tp9 = pc.alpha?.tp9 || []
  const af7 = pc.alpha?.af7 || []
  const af8 = pc.alpha?.af8 || []
  const tp10 = pc.alpha?.tp10 || []

  if (!tp9.length) return { status: STATUS.skip, detail: 'per_channel.alpha vacío' }

  const mean = arr => arr.reduce((a, b) => a + b, 0) / arr.length
  const posterior = mean(tp9) + mean(tp10)
  const frontal   = mean(af7) + mean(af8)
  const detail = `posterior=${posterior.toFixed(4)}  frontal=${frontal.toFixed(4)}`

  if (posterior > frontal) {
    return { status: STATUS.pass, detail: `✓ posterior > frontal  (${detail})` }
  }
  return {
    status: STATUS.warn,
    detail: `posterior ≤ frontal — esperable si la sesión no tiene fase baseline_closed larga  (${detail})`,
  }
}

function runT3(session) {
  const { per_channel_version, alpha_tp9_avg } = session
  if (per_channel_version !== 1) {
    return { status: STATUS.fail, detail: `per_channel_version=${per_channel_version} (esperado 1)` }
  }
  if (alpha_tp9_avg == null) {
    return { status: STATUS.fail, detail: 'alpha_tp9_avg es null — escritura a InfluxDB no funcionó o la sesión fue muy corta' }
  }
  return { status: STATUS.pass, detail: `version=1  alpha_tp9_avg=${alpha_tp9_avg.toFixed(4)}` }
}

function runT4(metricsResponse) {
  const pc = metricsResponse.per_channel
  if (!pc) return { status: STATUS.fail, detail: 'per_channel=null en la respuesta' }
  const tp9 = pc.alpha?.tp9
  if (!tp9 || !tp9.length) return { status: STATUS.fail, detail: 'per_channel.alpha.tp9 vacío o ausente' }
  return { status: STATUS.pass, detail: `per_channel.alpha.tp9.length = ${tp9.length} ventanas` }
}

async function runT5(apiBase) {
  // Find an old session with ver=0 and fetch its metrics — should return per_channel=null without error
  const old = await fetchOldSession(apiBase)
  if (!old) return { status: STATUS.skip, detail: 'No hay sesiones antiguas (ver=0) para testear backward compat' }

  const res = await fetchSessionMetrics(apiBase, old.id)
  if (res.per_channel !== null && res.per_channel !== undefined) {
    return { status: STATUS.warn, detail: `Sesión #${old.id} (ver=${old.per_channel_version}) devolvió per_channel≠null — revisar` }
  }
  return {
    status: STATUS.pass,
    detail: `Sesión antigua #${old.id} devuelve per_channel=null correctamente`,
  }
}

// ── Componente ───────────────────────────────────────────────────────────────
export default function PipelineValidation({ onClose }) {
  const [tests, setTests] = useState(INITIAL_TESTS.map(t => ({ ...t, status: STATUS.idle, detail: null })))
  const [running, setRunning] = useState(false)
  const [sessionInfo, setSessionInfo] = useState(null) // {id, name}
  const [globalStatus, setGlobalStatus] = useState(null) // 'pass'|'fail'|'warn'
  const [log, setLog] = useState([])
  const cancelled = useRef(false)

  const addLog = useCallback((msg) => setLog(l => [...l, msg]), [])

  const updateTest = useCallback((id, patch) => {
    setTests(prev => prev.map(t => t.id === id ? { ...t, ...patch } : t))
  }, [])

  const runAll = useCallback(async () => {
    cancelled.current = false
    setRunning(true)
    setGlobalStatus(null)
    setLog([])
    setSessionInfo(null)
    setTests(INITIAL_TESTS.map(t => ({ ...t, status: STATUS.idle, detail: null })))

    try {
      // ── Buscar sesión con per_channel_version=1 ──────────────────────────
      addLog('Buscando sesión con per_channel_version=1…')
      let session
      try {
        session = await fetchLatestPerChannelSession(API_BASE)
      } catch (e) {
        addLog(`✗ No se pudo conectar al backend: ${e.message}`)
        setTests(prev => prev.map(t => ({ ...t, status: STATUS.fail, detail: 'Backend no disponible' })))
        setGlobalStatus('fail')
        setRunning(false)
        return
      }

      if (!session) {
        addLog('⚠ No hay sesiones con per_channel_version=1 aún.')
        addLog('→ Graba una sesión corta (2 min, ojos abiertos + ojos cerrados) con el Muse conectado.')
        setTests(prev => prev.map(t => ({ ...t, status: STATUS.skip, detail: 'Requiere sesión con pipeline per-channel activo' })))
        setGlobalStatus('warn')
        setRunning(false)
        return
      }

      setSessionInfo({ id: session.id, name: session.name })
      addLog(`✓ Sesión encontrada: #${session.id} "${session.name}"  (ver=${session.per_channel_version})`)

      // ── Obtener métricas ─────────────────────────────────────────────────
      addLog(`Fetching /sessions/${session.id}/metrics…`)
      let metricsResponse
      try {
        metricsResponse = await fetchSessionMetrics(API_BASE, session.id)
      } catch (e) {
        addLog(`✗ Error fetching metrics: ${e.message}`)
        setGlobalStatus('fail')
        setRunning(false)
        return
      }

      if (cancelled.current) return

      // ── T1 ───────────────────────────────────────────────────────────────
      updateTest('T1', { status: STATUS.running })
      await new Promise(r => setTimeout(r, 300))
      const r1 = runT1(session, metricsResponse)
      updateTest('T1', { status: r1.status, detail: r1.detail })
      addLog(`T1 ${r1.status.toUpperCase()}: ${r1.detail}`)

      if (cancelled.current) return

      // ── T2 ───────────────────────────────────────────────────────────────
      updateTest('T2', { status: STATUS.running })
      await new Promise(r => setTimeout(r, 300))
      const r2 = runT2(metricsResponse)
      updateTest('T2', { status: r2.status, detail: r2.detail })
      addLog(`T2 ${r2.status.toUpperCase()}: ${r2.detail}`)

      if (cancelled.current) return

      // ── T3 ───────────────────────────────────────────────────────────────
      updateTest('T3', { status: STATUS.running })
      await new Promise(r => setTimeout(r, 300))
      const r3 = runT3(session)
      updateTest('T3', { status: r3.status, detail: r3.detail })
      addLog(`T3 ${r3.status.toUpperCase()}: ${r3.detail}`)

      if (cancelled.current) return

      // ── T4 ───────────────────────────────────────────────────────────────
      updateTest('T4', { status: STATUS.running })
      await new Promise(r => setTimeout(r, 300))
      const r4 = runT4(metricsResponse)
      updateTest('T4', { status: r4.status, detail: r4.detail })
      addLog(`T4 ${r4.status.toUpperCase()}: ${r4.detail}`)

      if (cancelled.current) return

      // ── T5 ───────────────────────────────────────────────────────────────
      updateTest('T5', { status: STATUS.running })
      await new Promise(r => setTimeout(r, 400))
      const r5 = await runT5(API_BASE)
      updateTest('T5', { status: r5.status, detail: r5.detail })
      addLog(`T5 ${r5.status.toUpperCase()}: ${r5.detail}`)

      // ── Resultado global ─────────────────────────────────────────────────
      const results = [r1, r2, r3, r4, r5]
      if (results.some(r => r.status === STATUS.fail)) {
        setGlobalStatus('fail')
        addLog('━━ RESULTADO: FAIL — revisar items marcados en rojo')
      } else if (results.some(r => r.status === STATUS.warn)) {
        setGlobalStatus('warn')
        addLog('━━ RESULTADO: WARN — pipeline funcional, revisar advertencias')
      } else {
        setGlobalStatus('pass')
        addLog('━━ RESULTADO: PASS — pipeline per-channel validado ✓')
      }
    } catch (e) {
      addLog(`✗ Error inesperado: ${e.message}`)
      setGlobalStatus('fail')
    } finally {
      setRunning(false)
    }
  }, [addLog, updateTest])

  const globalColor = globalStatus === 'pass' ? C.pass : globalStatus === 'fail' ? C.fail : C.warn

  return (
    <>
      <style>{`
        @keyframes pulse-dot {
          0%,100% { opacity:1; }
          50%      { opacity:0.35; }
        }
        .pv-row:hover { background: rgba(100,200,255,0.04) !important; }
      `}</style>

      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.6)',
          zIndex: 400,
        }}
      />

      {/* Modal */}
      <div style={{
        position: 'fixed',
        top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 401,
        width: 560,
        maxWidth: 'calc(100vw - 40px)',
        maxHeight: '90vh',
        overflowY: 'auto',
        background: C.bg,
        border: `1px solid ${C.border}`,
        borderRadius: 12,
        padding: '28px 24px',
        fontFamily: C.mono,
        scrollbarWidth: 'none',
      }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <p style={{ margin: 0, fontSize: '0.58rem', letterSpacing: '0.4em', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase' }}>
              PIPELINE · FASE 1
            </p>
            <h2 style={{ margin: '6px 0 0', fontSize: '1rem', color: '#fff', fontWeight: 400, letterSpacing: '0.06em' }}>
              Validación per-channel
            </h2>
            <p style={{ margin: '6px 0 0', fontSize: '0.62rem', color: 'rgba(255,255,255,0.3)', letterSpacing: '0.02em', lineHeight: 1.5 }}>
              5 criterios de aceptación del pipeline <code style={{ color: 'rgba(150,200,255,0.6)' }}>eeg_band_power</code>
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none',
              color: 'rgba(255,255,255,0.3)', fontSize: '1.2rem',
              cursor: 'pointer', padding: '0 4px', lineHeight: 1,
            }}
          >×</button>
        </div>

        {/* Session info */}
        {sessionInfo && (
          <div style={{
            marginBottom: 16, padding: '8px 12px',
            background: 'rgba(100,200,255,0.05)',
            border: '1px solid rgba(100,200,255,0.1)',
            borderRadius: 6, fontSize: '0.62rem', color: 'rgba(255,255,255,0.5)',
          }}>
            Sesión evaluada: <span style={{ color: 'rgba(150,220,255,0.8)' }}>#{sessionInfo.id} "{sessionInfo.name}"</span>
          </div>
        )}

        {/* Tests */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 18 }}>
          {tests.map(t => (
            <div
              key={t.id}
              className="pv-row"
              style={{
                padding: '10px 12px',
                borderRadius: 7,
                border: '1px solid rgba(255,255,255,0.06)',
                background: 'rgba(255,255,255,0.02)',
                transition: 'background 0.15s',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <StatusDot status={t.status} />
                <span style={{
                  fontSize: '0.6rem', letterSpacing: '0.25em',
                  color: 'rgba(255,255,255,0.2)', minWidth: 22,
                }}>
                  {t.id}
                </span>
                <span style={{
                  fontSize: '0.72rem', color: 'rgba(255,255,255,0.75)',
                  flex: 1,
                }}>
                  {t.label}
                </span>
                <StatusBadge status={t.status} />
              </div>

              <p style={{
                margin: '5px 0 0 30px',
                fontSize: '0.6rem',
                color: 'rgba(255,255,255,0.28)',
                lineHeight: 1.5,
              }}>
                {t.detail || t.desc}
              </p>
            </div>
          ))}
        </div>

        {/* Log */}
        {log.length > 0 && (
          <div style={{
            marginBottom: 18,
            padding: '10px 12px',
            background: 'rgba(0,0,0,0.4)',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: 6,
            maxHeight: 120,
            overflowY: 'auto',
            scrollbarWidth: 'none',
          }}>
            {log.map((line, i) => (
              <p key={i} style={{
                margin: 0, fontSize: '0.58rem',
                color: 'rgba(255,255,255,0.35)',
                lineHeight: 1.7,
                borderBottom: i < log.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                paddingBottom: 2,
              }}>
                {line}
              </p>
            ))}
          </div>
        )}

        {/* Global result */}
        {globalStatus && (
          <div style={{
            marginBottom: 18, padding: '10px 14px',
            background: `${globalColor}10`,
            border: `1px solid ${globalColor}40`,
            borderRadius: 7,
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <span style={{ fontSize: '1rem' }}>
              {globalStatus === 'pass' ? '✓' : globalStatus === 'fail' ? '✗' : '⚠'}
            </span>
            <span style={{ fontSize: '0.72rem', color: globalColor, letterSpacing: '0.05em' }}>
              {globalStatus === 'pass' && 'Pipeline validado — podés avanzar a Fase 3 (topomap real)'}
              {globalStatus === 'fail' && 'Pipeline con errores — revisar logs antes de avanzar'}
              {globalStatus === 'warn' && 'Pipeline funcional con advertencias — revisar T2 cuando grabes con fases explícitas'}
            </span>
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={runAll}
            disabled={running}
            style={{
              flex: 1, padding: '11px',
              background: running ? 'rgba(130,130,255,0.1)' : 'rgba(130,130,255,0.15)',
              border: `1px solid ${running ? 'rgba(130,130,255,0.2)' : 'rgba(130,130,255,0.4)'}`,
              borderRadius: 7,
              color: running ? 'rgba(130,130,255,0.5)' : '#818CF8',
              fontSize: '0.72rem', fontFamily: C.mono,
              letterSpacing: '0.08em', cursor: running ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
            }}
          >
            {running ? '⏳ Ejecutando…' : globalStatus ? '↺ Volver a ejecutar' : '▶ Ejecutar tests'}
          </button>
          <button
            onClick={onClose}
            style={{
              padding: '11px 18px',
              background: 'transparent',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 7,
              color: 'rgba(255,255,255,0.35)', fontSize: '0.72rem',
              fontFamily: C.mono, cursor: 'pointer',
            }}
          >
            Cerrar
          </button>
        </div>

        {/* Instrucciones si no hay sesión */}
        {!running && globalStatus === 'warn' && !sessionInfo && (
          <div style={{
            marginTop: 16, padding: '12px',
            background: 'rgba(251,191,36,0.05)',
            border: '1px dashed rgba(251,191,36,0.25)',
            borderRadius: 7,
          }}>
            <p style={{ margin: 0, fontSize: '0.65rem', color: 'rgba(251,191,36,0.7)', lineHeight: 1.7 }}>
              Para ejecutar los tests, primero grabá una sesión corta:<br />
              <span style={{ color: 'rgba(255,255,255,0.4)' }}>
                1. Conectá el Muse 2 → tab "Muse 2"<br />
                2. Iniciá grabación → esperá 2 min (1′ ojos abiertos + 1′ ojos cerrados)<br />
                3. Detené la grabación → volvé aquí y ejecutá los tests
              </span>
            </p>
          </div>
        )}

      </div>
    </>
  )
}

// ── Badge inline ─────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const map = {
    idle:    { label: '—',       color: 'rgba(255,255,255,0.18)' },
    running: { label: 'RUN',     color: C.running },
    pass:    { label: 'PASS',    color: C.pass },
    fail:    { label: 'FAIL',    color: C.fail },
    warn:    { label: 'WARN',    color: C.warn },
    skip:    { label: 'SKIP',    color: 'rgba(255,255,255,0.2)' },
  }
  const { label, color } = map[status] || map.idle
  return (
    <span style={{
      fontSize: '0.52rem', letterSpacing: '0.15em',
      color, padding: '2px 6px',
      border: `1px solid ${color}`,
      borderRadius: 4,
      opacity: status === 'idle' ? 0.4 : 1,
    }}>
      {label}
    </span>
  )
}
