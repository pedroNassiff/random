/**
 * SessionDetail — /lab/brain/doc/session/:sessionId
 *
 * Deep-dive into a single EEG session with:
 * - Session metadata & conditions
 * - Video recording (YouTube embed)
 * - Validation test results with neuroscience explanations
 * - Band power averages & coherence analysis
 * - Protocol phase breakdown
 * - Learning notes & observations
 */

import React, { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Liveline } from 'liveline'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'

// ── Constants ─────────────────────────────────────────────────────────────────
const BANDS = ['delta', 'theta', 'alpha', 'beta', 'gamma']
const BAND_SYMBOL = { delta: 'δ', theta: 'θ', alpha: 'α', beta: 'β', gamma: 'γ' }
const BAND_COLORS = {
  delta: '#8b5cf6', theta: '#3b82f6', alpha: '#10b981', beta: '#f59e0b', gamma: '#ef4444',
}
const GRADE_COLORS = {
  A: '#10b981', B: '#3b82f6', C: '#f59e0b', D: '#f97316', F: '#ef4444',
}

const PHASE_INFO = {
  baseline_open: {
    name: 'Baseline ojos abiertos', icon: '👁', duration: '2 min',
    what: 'Sentado, mirando un punto fijo. Sin instrucción mental.',
    why: 'Establece la referencia de alpha baja. Con los ojos abiertos, la corteza visual procesa información constantemente, suprimiendo alpha.',
    expect: 'Alpha baja (~0.08-0.12), beta relativamente alto por procesamiento visual.',
    science: 'La corteza occipital genera alpha cuando NO está procesando estímulos visuales. Ojos abiertos = corteza visual activa = alpha suprimido.',
  },
  baseline_closed: {
    name: 'Baseline ojos cerrados', icon: '🔒', duration: '2 min',
    what: 'Sentado, ojos cerrados. Sin instrucción de meditación.',
    why: 'Valida el efecto Berger: alpha DEBE aumentar al cerrar los ojos. Es la prueba más fundamental del EEG.',
    expect: 'Alpha sube 1.5-3x vs ojos abiertos. Si no sube, algo está mal con el contacto o el pipeline.',
    science: 'Hans Berger (1929) descubrió que cerrar los ojos produce ondas de ~10Hz (alpha). Es el fenómeno EEG más reproducible y la primera demostración de que la actividad cerebral se puede medir eléctricamente.',
  },
  shamatha: {
    name: 'Shamatha', icon: '🫁', duration: '5 min',
    what: 'Meditación de atención a la respiración. Foco en la inhalación y exhalación.',
    why: 'Shamatha (calma mental) es la práctica base budista. Entrena la atención sostenida y aquieta la mente.',
    expect: 'Theta empieza a subir, alpha se mantiene o sube. Beta baja gradualmente. La mente se tranquiliza.',
    science: 'Travis & Shear (2010) clasifican Shamatha como "focused attention meditation". La firma EEG es theta+alpha frontal midline, con theta/beta ratio aumentando.',
  },
  meditation_free: {
    name: 'Meditación libre', icon: '🧘', duration: '10 min',
    what: 'Sin instrucción. Meditación con la técnica personal del practicante.',
    why: 'Captura el estado natural de meditación. Es la fase más larga y donde esperamos los estados más profundos.',
    expect: 'En meditadores experimentados: theta dominante, coherencia alta, entropía baja. En principiantes: fluctuaciones.',
    science: 'Lutz et al. (2004) mostraron que meditadores budistas con >10,000 horas generan gamma de alta amplitud durante meditación compasiva. Nuestro objetivo es detectar patrones más sutiles con 4 canales.',
  },
  cognitive_task: {
    name: 'Tarea cognitiva', icon: '🧮', duration: '1 min',
    what: 'Restar de 7 en 7 desde 1000 (993, 986, 979...). En voz baja para activar cortex motor.',
    why: 'Valida que el Muse detecta engagement cognitivo. Beta y gamma DEBEN subir durante cálculo.',
    expect: 'Beta sube 1.2-2x vs meditación previa. Gamma sube 1.1-1.5x. Cambio abrupto en el espectro.',
    science: 'El cálculo aritmético activa la corteza prefrontal dorsolateral (DLPFC) y el angular gyrus. Estas áreas generan beta (13-30Hz) cuando procesan activamente. Si hacés la resta en voz baja, también se activa el área de Broca y el cortex motor, amplificando la señal.',
  },
  recovery: {
    name: 'Recovery', icon: '🌊', duration: '3 min',
    what: 'Relajación post-tarea. "Dejá de calcular, descansá."',
    why: 'Mide la capacidad de transición cognitiva. Un cerebro flexible vuelve rápido a alpha.',
    expect: 'Beta baja gradualmente en los primeros 30-60s. Alpha sube. Es la "curva de relajación".',
    science: 'La velocidad de transición beta→alpha post-tarea correlaciona con regulación atencional. Meditadores experimentados hacen esta transición más rápido que no-meditadores (Brandmeyer & Delorme, 2018).',
  },
  deep_meditation: {
    name: 'Meditación profunda', icon: '🌌', duration: '5 min',
    what: '"Dejá ir todo esfuerzo." Sin técnica, sin instrucción, puro awareness.',
    why: 'Busca el estado más profundo de la sesión. Theta dominante, posible delta, coherencia máxima.',
    expect: 'Theta alto, alpha moderado, coherencia pico. En la Teoría Sintérgica: máxima Sintergía, el campo neuronal se alinea con la Lattice.',
    science: 'Travis & Shear (2010) llaman a esto "automatic self-transcending". La mente trasciende el esfuerzo y accede a estados de conciencia pura. La firma EEG es theta alpha1 coherence, baja gamma, y alta regularidad temporal.',
  },
  close: {
    name: 'Cierre', icon: '🌅', duration: '2 min',
    what: 'Ojos cerrados → abiertos gradualmente. Transición de vuelta.',
    why: 'Mide alpha suppression al abrir los ojos. Confirma que el Berger effect funciona en reversa.',
    expect: 'Alpha alta al inicio (ojos cerrados) → supresión gradual al abrir → vuelve a baseline.',
    science: 'El ERD (event-related desynchronization) al abrir los ojos es la contraparte del Berger effect. Si alpha no se suprime al abrir, puede indicar que la señal no era real.',
  },
}

// Videos indexed by session_id — add YouTube URLs here as you record sessions
const SESSION_VIDEOS = {
  // 25: 'https://www.youtube.com/embed/VIDEO_ID_HERE',
  // 18: 'https://www.youtube.com/embed/VIDEO_ID_HERE',
}

// Session-specific notes/observations — add after each session
const SESSION_NOTES = {
  25: {
    observations: [
      'Primera sesión completa de 30 min sin desconexión BLE — los fixes de auto-reconnect funcionaron',
      'Berger effect falló (ratio 0.318) — alpha bajó al cerrar ojos en vez de subir',
      'Posible causa: ya estaba relajado con ojos abiertos (alpha alta como baseline)',
      'Coherencia estable (0.64 autocorrelación) — señal real, no ruido',
      'Tarea cognitiva no generó spike de beta — posiblemente no hice el cálculo activamente',
      '100% data completeness — sin ventanas perdidas en toda la sesión',
    ],
    learnings: [
      'Hacer el cálculo EN VOZ BAJA activa cortex motor + prefrontal = beta más claro',
      'Empezar baseline con algo estimulante (leer, pantalla) para tener alpha realmente baja como referencia',
      'La calidad de señal (0.94) fue excelente — el hardware no es el problema, es la ejecución del protocolo',
    ],
    conditions: 'Mañana, sin cafeína, sueño calidad 4/5, estado subjetivo pre=8',
  },
  18: {
    observations: [
      'Sesión con score B (70.3) — la mejor hasta ahora',
      'Berger marginal (ratio 1.496) — casi alcanza "good" (1.5x)',
      'Coherencia excelente (autocorr 0.825) — la señal es muy estable',
      'Tarea cognitiva falló pero menos que #25 — beta ratio 0.485',
      '99.3% completeness — casi perfecto',
    ],
    learnings: [
      'La coherencia arriba de 0.7 autocorrelación indica señal neural real — no ruido',
      'El Berger pasó marginal — mejorar contraste: estimulación visual activa antes de cerrar ojos',
    ],
    conditions: 'Sesión grabada como referencia baseline del sistema',
  },
  34: {
    observations: [
      'Score A (91.4) — la mejor sesión registrada hasta ahora',
      'Berger excelente: ratio 2.545× (alpha abiertos=0.58, cerrados=1.48 µV²) — el doble y medio',
      'Cero artefactos EOG en baseline (0 ventanas rechazadas en toda la calibración)',
      'Reactividad cognitiva passed good: beta subió 1.41× y gamma 1.93× durante cálculo',
      'Coherencia excelente: autocorr 0.72 — por encima del umbral de "señal neural real"',
      '8558 ventanas de 30 min de protocolo completo — completeness 100%',
    ],
    learnings: [
      'Berger 2.5× es el rango ideal para Muse 2 — confirma que el hardware funciona bien',
      'Gamma 1.93× durante tarea cognitiva es notable — activa prefrontal + cortex parietal',
      'La coherencia >0.7 clasifica como "Real neural coherence, excellent signal" en las interpretaciones del sistema',
    ],
    conditions: 'Protocolo de 30 min completo, sesión de referencia de alta calidad',
  },
  35: {
    observations: [
      'Score B (79.3), 28.6 minutos de datos — 8587 ventanas de métricas',
      'Berger excelente: ratio 1.554× — alpha closed 0.946 vs open 0.609',
      'Reactividad cognitiva passed good: beta 1.43×, gamma 0.833× (gamma no subió pero beta sí)',
      'deep_relaxation dominó el 76.9% de la sesión — el estado más profundo registrado como dominante',
      'deep_meditation alcanzó el 5.1% — ~88 segundos sostenidos',
      'Alpha media solo 0.112 normalizado — baja porque delta (0.617) domina el espectro',
      '0% blink contamination en toda la sesión — sin artefactos de parpadeo',
      'Coherencia media 0.544, peor en el último tercio (0.506) — señal se volvió más variable al final',
    ],
    learnings: [
      'Delta alto (0.617) + theta elevado (0.208) + alpha bajo = patrón típico de sueño ligero/meditación profunda con ojos cerrados',
      'La fórmula de estado "deep_relaxation" del sistema detecta correctamente el estado meditativo — el modelo de clasificación funciona',
      'El ratio Berger de 1.554 es "excellent" (>1.5×) según la literatura (Cannard et al. 2021)',
      'Gamma bajo (0.040) → ausencia de actividad gamma = sin arousal cognitivo, sin ansiedad — estado puro de quietud',
      'PLV=0.648 (Phase Locking Value) indica sincronización inter-hemisférica moderada-alta durante la sesión',
    ],
    conditions: 'Sesión de protocolo completo, 28.6 minutos efectivos de grabación',
  },
}

// ── Shared styles ─────────────────────────────────────────────────────────────
const pStyle = {
  fontSize: '0.78rem', color: 'rgba(255,255,255,0.6)', lineHeight: 1.7, margin: '8px 0',
}
const h4Style = {
  fontSize: '0.85rem', fontWeight: 600, color: '#e2e8f0',
  margin: '20px 0 8px 0', fontFamily: 'monospace',
}

// ── Small UI ──────────────────────────────────────────────────────────────────
function Badge({ children, color = '#3b82f6' }) {
  return (
    <span style={{
      display: 'inline-block', padding: '2px 8px', borderRadius: 4,
      background: `${color}22`, color, fontSize: '0.7rem', fontFamily: 'monospace',
      border: `1px solid ${color}44`,
    }}>{children}</span>
  )
}

function Card({ title, children, accent = '#3b82f6', id }) {
  return (
    <div id={id} style={{
      background: 'rgba(15, 15, 25, 0.8)', borderRadius: 12,
      border: `1px solid ${accent}33`, padding: '24px 28px',
      marginBottom: 24, backdropFilter: 'blur(8px)',
    }}>
      {title && (
        <h3 style={{
          margin: '0 0 16px 0', fontSize: '1.1rem', fontWeight: 600,
          color: accent, fontFamily: 'monospace', letterSpacing: '0.02em',
        }}>{title}</h3>
      )}
      {children}
    </div>
  )
}

function Stat({ label, value, unit, color = '#e2e8f0' }) {
  return (
    <div style={{ textAlign: 'center', minWidth: 80 }}>
      <div style={{ fontSize: '1.6rem', fontWeight: 700, color, fontFamily: 'monospace' }}>{value}</div>
      <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.4)', marginTop: 2, fontFamily: 'monospace' }}>
        {label}{unit && ` (${unit})`}
      </div>
    </div>
  )
}

// ── Data hook ─────────────────────────────────────────────────────────────────
function useSessionData(sessionId) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    if (!sessionId) return
    setLoading(true)
    setError(null)
    try {
      const r = await fetch(`${API}/doc/session/${sessionId}`)
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      const json = await r.json()
      if (json.status === 'error') throw new Error(json.message)
      setData(json)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [sessionId])

  useEffect(() => { load() }, [load])
  return { data, loading, error, reload: load }
}

function useSessionTimeSeries(recordingId) {
  const [metrics, setMetrics] = useState(null)

  useEffect(() => {
    if (!recordingId) return
    fetch(`${API}/sessions/${recordingId}/metrics`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d && Array.isArray(d)) setMetrics(d) })
      .catch(() => {})
  }, [recordingId])

  return metrics
}

// ── Section: Time-series live charts ─────────────────────────────────────────
function SectionTimeSeries({ metrics }) {
  if (!metrics || metrics.length < 3) {
    return (
      <Card title="Actividad durante la sesión" accent="#10b981">
        <p style={{ ...pStyle, textAlign: 'center', padding: '20px 0' }}>
          Cargando datos de tiempo real...
        </p>
      </Card>
    )
  }

  // Build Liveline data from metrics — each metric has a _time (ISO) or index
  const n = metrics.length
  const BASE = Date.now() - n * 2000 // 2s per window at 5Hz
  const toPoint = (m, i, field) => ({
    time: m._time ? new Date(m._time).getTime() : BASE + i * 2000,
    value: parseFloat(m[field] ?? 0) || 0,
  })

  const alphaData   = metrics.map((m, i) => toPoint(m, i, 'alpha'))
  const thetaData   = metrics.map((m, i) => toPoint(m, i, 'theta'))
  const cohData     = metrics.map((m, i) => toPoint(m, i, 'coherence'))
  const windowSecs  = n * 2

  const bandSeries = [
    { label: 'α alpha',  color: BAND_COLORS.alpha, data: alphaData },
    { label: 'θ theta',  color: BAND_COLORS.theta, data: thetaData },
  ]

  const latestAlpha = alphaData[alphaData.length - 1]?.value ?? 0
  const latestCoh   = cohData[cohData.length - 1]?.value ?? 0

  const fmtTime = t => {
    const s = Math.round((t - (metrics[0]?._time ? new Date(metrics[0]._time).getTime() : BASE)) / 1000)
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
  }

  return (
    <Card title="Actividad durante la sesión" accent="#10b981">
      <p style={pStyle}>
        Evolución temporal de las métricas EEG a lo largo de la sesión. Cada punto 
        representa una ventana de 2 segundos procesada en tiempo real.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, margin: '16px 0' }}>
        <div>
          <p style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.4)', fontFamily: 'monospace', marginBottom: 6 }}>
            Alpha (α) + Theta (θ) · {n} ventanas
          </p>
          <div style={{ height: 200 }}>
            <Liveline
              series={bandSeries}
              theme="dark"
              window={windowSecs}
              formatValue={v => (v * 100).toFixed(1) + '%'}
              formatTime={fmtTime}
              badge={false}
              scrub
            />
          </div>
        </div>
        <div>
          <p style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.4)', fontFamily: 'monospace', marginBottom: 6 }}>
            Coherencia PLV
          </p>
          <div style={{ height: 200 }}>
            <Liveline
              data={cohData}
              value={latestCoh}
              color="#10b981"
              theme="dark"
              showValue
              window={windowSecs}
              formatValue={v => v.toFixed(3)}
              formatTime={fmtTime}
              badge={false}
              scrub
              exaggerate
            />
          </div>
        </div>
      </div>
    </Card>
  )
}

// ── Section: Overview ─────────────────────────────────────────────────────────
function SectionOverview({ data, sessionId }) {
  const recording = data?.recording || {}
  const quality = data?.validation?.quality_score || {}
  const valSummary = data?.validation?.validation?.summary || {}
  const metricsSummary = data?.metrics_summary || {}
  const grade = quality.grade || '—'
  const score = (quality.total_score ?? quality.quality_score ?? 0).toFixed(1)
  const usable = quality.passes_quality_threshold ?? valSummary.usable_for_training ?? false

  return (
    <Card title="Resumen de sesión" accent={GRADE_COLORS[grade] || '#6b7280'}>
      {/* Grade + stats row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 32, flexWrap: 'wrap', marginBottom: 20 }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            fontSize: '3rem', fontWeight: 800, fontFamily: 'monospace',
            color: GRADE_COLORS[grade] || '#6b7280', lineHeight: 1,
          }}>{grade}</div>
          <div style={{ fontSize: '1rem', color: 'rgba(255,255,255,0.5)', fontFamily: 'monospace' }}>
            {score}/100
          </div>
        </div>

        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          <Stat label="Sesión" value={`#${sessionId}`} color="#e2e8f0" />
          <Stat label="Duración" value={metricsSummary.duration_seconds ? `${Math.round(metricsSummary.duration_seconds / 60)}m` : recording.duration_seconds ? `${Math.round(recording.duration_seconds / 60)}m` : '—'} color="#3b82f6" />
          <Stat label="Ventanas" value={metricsSummary.total_windows || '—'} color="#a78bfa" />
          <Stat label="Coherencia" value={(metricsSummary.coherence_avg || 0).toFixed(2)} color="#10b981" />
          <Stat label="Coh. máx" value={(metricsSummary.coherence_max || 0).toFixed(2)} color="#10b981" />
          <Stat label="Entrenamiento" value={usable ? 'Sí' : 'No'} color={usable ? '#10b981' : '#ef4444'} />
        </div>
      </div>

      {/* Conditions */}
      {recording.started_at && (
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 12 }}>
          <Badge color="#6366f1">
            {new Date(recording.started_at).toLocaleDateString('es-AR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </Badge>
          {recording.calibration_passed && <Badge color="#10b981">Calibración OK</Badge>}
          {recording.avg_signal_quality > 0 && <Badge color="#3b82f6">Señal: {(recording.avg_signal_quality * 100).toFixed(0)}%</Badge>}
        </div>
      )}

      {/* Band power averages */}
      {metricsSummary.bands_avg && (
        <>
          <h4 style={h4Style}>Potencia espectral promedio</h4>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {BANDS.map(b => {
              const val = metricsSummary.bands_avg[b] || 0
              return (
                <div key={b} style={{
                  flex: 1, minWidth: 80, padding: '10px 12px', borderRadius: 8,
                  background: `${BAND_COLORS[b]}11`, border: `1px solid ${BAND_COLORS[b]}33`, textAlign: 'center',
                }}>
                  <div style={{ fontSize: '1.2rem', fontWeight: 700, color: BAND_COLORS[b], fontFamily: 'monospace' }}>
                    {BAND_SYMBOL[b]}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#e2e8f0', fontFamily: 'monospace', marginTop: 4 }}>
                    {(val * 100).toFixed(1)}%
                  </div>
                  <div style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.3)', fontFamily: 'monospace' }}>
                    {b}
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}
    </Card>
  )
}

// ── Section: Video ────────────────────────────────────────────────────────────
function SectionVideo({ sessionId }) {
  const videoUrl = SESSION_VIDEOS[sessionId]

  return (
    <Card title="Video de sesión" accent="#6366f1">
      {videoUrl ? (
        <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0, borderRadius: 8, overflow: 'hidden' }}>
          <iframe
            src={videoUrl}
            title={`Sesión #${sessionId}`}
            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      ) : (
        <div style={{
          padding: '40px 20px', textAlign: 'center', borderRadius: 8,
          background: 'rgba(99, 102, 241, 0.06)', border: '1px dashed rgba(99, 102, 241, 0.25)',
        }}>
          <div style={{ fontSize: '2rem', marginBottom: 8 }}>🎥</div>
          <p style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', fontFamily: 'monospace', margin: 0 }}>
            Video pendiente de subir
          </p>
          <p style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.25)', fontFamily: 'monospace', marginTop: 8 }}>
            Subí el video a YouTube (unlisted) y agregá la URL en<br />
            <code style={{ color: '#6366f1' }}>SESSION_VIDEOS[{sessionId}]</code> en SessionDetail.jsx
          </p>
        </div>
      )}
    </Card>
  )
}

// ── Section: Validation Tests ─────────────────────────────────────────────────
function SectionValidation({ data }) {
  const validation = data?.validation?.validation || data?.validation
  const tests = validation?.tests || {}

  if (!Object.keys(tests).length) return null

  return (
    <Card title="Tests de validación científica" accent="#a78bfa">
      {Object.entries(tests).map(([key, test]) => {
        const passed = test.passed
        const color = passed ? '#10b981' : '#ef4444'
        const metrics = test.metrics || {}

        return (
          <div key={key} style={{
            marginBottom: 16, padding: '16px 20px', borderRadius: 8,
            background: `${color}08`, border: `1px solid ${color}22`,
          }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: '1rem', color }}>{passed ? '✓' : '✗'}</span>
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#e2e8f0', fontFamily: 'monospace' }}>
                {test.test?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || key}
              </span>
              <Badge color={color}>{test.quality || (passed ? 'passed' : 'failed')}</Badge>
            </div>

            {/* Metrics */}
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', margin: '8px 0' }}>
              {Object.entries(metrics).map(([mk, mv]) => (
                <div key={mk} style={{ fontSize: '0.7rem', fontFamily: 'monospace' }}>
                  <span style={{ color: 'rgba(255,255,255,0.4)' }}>{mk}: </span>
                  <span style={{ color: '#e2e8f0' }}>{typeof mv === 'number' ? mv.toFixed(4) : String(mv)}</span>
                </div>
              ))}
            </div>

            {/* Thresholds */}
            {test.thresholds && typeof test.thresholds === 'object' && (
              <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.3)', fontFamily: 'monospace', marginTop: 6 }}>
                Umbrales: {Object.entries(test.thresholds).map(([tk, tv]) => `${tk}=${typeof tv === 'object' ? JSON.stringify(tv) : tv}`).join(' · ')}
              </div>
            )}

            {/* Interpretation */}
            {test.interpretation && (
              <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.45)', marginTop: 8, fontStyle: 'italic' }}>
                {typeof test.interpretation === 'string'
                  ? test.interpretation
                  : Object.entries(test.interpretation).map(([ik, iv]) => `${ik}: ${iv}`).join(' · ')}
              </div>
            )}

            {/* Reference */}
            {test.reference && (
              <div style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.25)', marginTop: 6, fontFamily: 'monospace' }}>
                📚 {test.reference}
              </div>
            )}
          </div>
        )
      })}

      {/* Score components */}
      {data?.validation?.quality_score?.components && (
        <>
          <h4 style={h4Style}>Desglose del score</h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
            {Object.entries(data.validation.quality_score.components).map(([key, comp]) => {
              const score = typeof comp === 'object' ? comp.score : comp
              const pct = Math.min(100, Math.max(0, score || 0))
              return (
                <div key={key} style={{ padding: '12px 14px', borderRadius: 8, background: 'rgba(0,0,0,0.2)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.5)', fontFamily: 'monospace' }}>
                      {key.replace(/_/g, ' ')}
                    </span>
                    <span style={{ fontSize: '0.7rem', fontWeight: 600, color: '#e2e8f0', fontFamily: 'monospace' }}>
                      {(score || 0).toFixed(1)}
                    </span>
                  </div>
                  <div style={{ width: '100%', height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 2 }}>
                    <div style={{
                      width: `${pct}%`, height: '100%', borderRadius: 2,
                      background: pct >= 70 ? '#10b981' : pct >= 40 ? '#f59e0b' : '#ef4444',
                    }} />
                  </div>
                  {comp?.description && (
                    <div style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.25)', marginTop: 4 }}>
                      {comp.description}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}
    </Card>
  )
}

// ── Section: Protocol Phases ──────────────────────────────────────────────────
function SectionProtocol({ data }) {
  const events = data?.protocol_log?.events || []
  if (!events.length) return null

  // Group events into phases
  const phases = []
  let currentPhase = null
  for (const evt of events) {
    const label = evt.event || evt.label || ''
    if (label === 'phase_start' || label.endsWith('_start')) {
      const phaseName = evt.data?.phase || label.replace('_start', '')
      currentPhase = { name: phaseName, start: evt.elapsed, events: [evt] }
      phases.push(currentPhase)
    } else if (currentPhase) {
      currentPhase.events.push(evt)
      if (label === 'phase_end' || label === 'phase_auto_advance') {
        currentPhase.end = evt.elapsed
        currentPhase = null
      }
    }
  }

  return (
    <Card title="Fases del protocolo" accent="#ef4444">
      <p style={pStyle}>
        Desglose de cada fase del protocolo de 30 minutos con explicación neurocientífica 
        de qué pasa en el cerebro y por qué se mide.
      </p>

      {phases.map((phase, i) => {
        const info = PHASE_INFO[phase.name] || {}
        const duration = phase.end && phase.start != null ? Math.round(phase.end - phase.start) : null

        return (
          <div key={i} style={{
            marginBottom: 16, padding: '16px 20px', borderRadius: 8,
            background: 'rgba(239, 68, 68, 0.04)', border: '1px solid rgba(239, 68, 68, 0.12)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <span style={{ fontSize: '1.1rem' }}>{info.icon || '◉'}</span>
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#e2e8f0', fontFamily: 'monospace' }}>
                Fase {i + 1}: {info.name || phase.name}
              </span>
              {duration && (
                <Badge color="#ef4444">{Math.floor(duration / 60)}:{String(duration % 60).padStart(2, '0')}</Badge>
              )}
              {info.duration && <span style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.3)', fontFamily: 'monospace' }}>target: {info.duration}</span>}
            </div>

            {info.what && (
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: '0.65rem', color: '#ef4444', fontFamily: 'monospace', marginBottom: 2 }}>QUÉ</div>
                <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.6)' }}>{info.what}</div>
              </div>
            )}

            {info.why && (
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: '0.65rem', color: '#f59e0b', fontFamily: 'monospace', marginBottom: 2 }}>POR QUÉ</div>
                <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.6)' }}>{info.why}</div>
              </div>
            )}

            {info.expect && (
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: '0.65rem', color: '#10b981', fontFamily: 'monospace', marginBottom: 2 }}>QUÉ ESPERAR</div>
                <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.6)' }}>{info.expect}</div>
              </div>
            )}

            {info.science && (
              <div style={{ marginTop: 8, padding: '8px 12px', borderRadius: 6, background: 'rgba(99, 102, 241, 0.06)', borderLeft: '2px solid rgba(99, 102, 241, 0.3)' }}>
                <div style={{ fontSize: '0.65rem', color: '#6366f1', fontFamily: 'monospace', marginBottom: 2 }}>NEUROCIENCIA</div>
                <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.5)', lineHeight: 1.6 }}>{info.science}</div>
              </div>
            )}
          </div>
        )
      })}
    </Card>
  )
}

// ── Section: Notes ────────────────────────────────────────────────────────────
function SectionNotes({ sessionId }) {
  const notes = SESSION_NOTES[sessionId]
  if (!notes) return null

  return (
    <Card title="Observaciones y aprendizajes" accent="#10b981">
      {notes.conditions && (
        <div style={{ marginBottom: 16, padding: '10px 14px', borderRadius: 6, background: 'rgba(99, 102, 241, 0.06)', border: '1px solid rgba(99, 102, 241, 0.15)' }}>
          <div style={{ fontSize: '0.65rem', color: '#6366f1', fontFamily: 'monospace', marginBottom: 4 }}>CONDICIONES</div>
          <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.5)' }}>{notes.conditions}</div>
        </div>
      )}

      {notes.observations && (
        <>
          <h4 style={h4Style}>Observaciones</h4>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {notes.observations.map((obs, i) => (
              <li key={i} style={{ fontSize: '0.73rem', color: 'rgba(255,255,255,0.55)', padding: '3px 0', lineHeight: 1.6 }}>{obs}</li>
            ))}
          </ul>
        </>
      )}

      {notes.learnings && (
        <>
          <h4 style={h4Style}>Aprendizajes para próximas sesiones</h4>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {notes.learnings.map((l, i) => (
              <li key={i} style={{ fontSize: '0.73rem', color: 'rgba(255,255,255,0.55)', padding: '3px 0', lineHeight: 1.6 }}>
                <span style={{ color: '#10b981', marginRight: 4 }}>→</span>{l}
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  )
}

// ── Section: Protocol Metadata ────────────────────────────────────────────────
function SectionMetadata({ data }) {
  const meta = data?.protocol_log?.metadata || {}
  if (!Object.keys(meta).length) return null

  const fields = [
    { key: 'name', label: 'Nombre sesión', format: v => v },
    { key: 'time_of_day', label: 'Momento del día', format: v => v === 'morning' ? '🌅 Mañana' : v === 'afternoon' ? '☀️ Tarde' : v === 'evening' ? '🌙 Noche' : v },
    { key: 'sleep_quality', label: 'Calidad sueño', format: v => `${'★'.repeat(v)}${'☆'.repeat(5 - v)} (${v}/5)` },
    { key: 'caffeine', label: 'Cafeína', format: v => v ? '☕ Sí' : '🚫 No' },
    { key: 'prior_meditation_min', label: 'Meditación previa', format: v => v > 0 ? `${v} min` : 'Ninguna' },
    { key: 'subjective_pre', label: 'Estado subjetivo pre', format: v => `${v}/10` },
    { key: 'subjective_post', label: 'Estado subjetivo post', format: v => `${v}/10` },
  ]

  return (
    <Card title="Metadatos de sesión" accent="#f59e0b">
      <p style={pStyle}>
        Condiciones registradas antes y después de la sesión. Estos metadatos permiten 
        correlacionar variables ambientales y subjetivas con la calidad de la señal EEG.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, marginTop: 12 }}>
        {fields.map(f => {
          const val = meta[f.key]
          if (val === undefined || val === null || val === '') return null
          return (
            <div key={f.key} style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(245, 158, 11, 0.06)', border: '1px solid rgba(245, 158, 11, 0.15)' }}>
              <div style={{ fontSize: '0.6rem', color: '#f59e0b', fontFamily: 'monospace', marginBottom: 4 }}>{f.label}</div>
              <div style={{ fontSize: '0.78rem', color: '#e2e8f0' }}>{f.format(val)}</div>
            </div>
          )
        })}
      </div>
    </Card>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function SessionDetail() {
  const { sessionId } = useParams()
  const navigate = useNavigate()
  const { data, loading, error, reload } = useSessionData(sessionId)
  const metrics = useSessionTimeSeries(data?.recording?.id)

  if (loading) {
    return (
      <div style={{ position: 'fixed', inset: 0, background: '#0a0a14', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontFamily: 'monospace', color: 'rgba(255,255,255,0.4)', fontSize: '0.8rem' }}>Cargando sesión #{sessionId}...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ position: 'fixed', inset: 0, background: '#0a0a14', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
        <div style={{ fontFamily: 'monospace', color: '#ef4444', fontSize: '0.8rem' }}>Error: {error}</div>
        <button onClick={reload} style={{ background: 'none', border: '1px solid #3b82f6', color: '#3b82f6', padding: '6px 16px', borderRadius: 6, fontFamily: 'monospace', fontSize: '0.7rem', cursor: 'pointer' }}>Reintentar</button>
      </div>
    )
  }

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'linear-gradient(180deg, #0a0a14 0%, #0f0f1e 50%, #0a0a14 100%)',
      color: '#e2e8f0', overflow: 'hidden', display: 'flex',
    }}>
      {/* ─── Left nav ─── */}
      <nav style={{
        width: 200, minWidth: 200, height: '100vh',
        borderRight: '1px solid rgba(255,255,255,0.06)',
        padding: '20px 0', display: 'flex', flexDirection: 'column',
      }}>
        <button
          onClick={() => navigate('/lab/brain/doc')}
          style={{
            background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)',
            fontSize: '0.72rem', fontFamily: 'monospace', cursor: 'pointer',
            padding: '8px 16px', textAlign: 'left', transition: 'color 0.2s',
          }}
          onMouseEnter={e => e.currentTarget.style.color = '#e2e8f0'}
          onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.4)'}
        >
          ← DOC
        </button>

        <div style={{ padding: '12px 16px', marginBottom: 8 }}>
          <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.3)', fontFamily: 'monospace', letterSpacing: '0.1em' }}>
            .RANDOM() / LAB / ADA
          </div>
          <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#e2e8f0', fontFamily: 'monospace', marginTop: 4 }}>
            Sesión #{sessionId}
          </div>
          {data?.validation?.quality_score && (
            <div style={{
              fontSize: '1.4rem', fontWeight: 800, fontFamily: 'monospace', marginTop: 8,
              color: GRADE_COLORS[data.validation.quality_score.grade] || '#6b7280',
            }}>
              {data.validation.quality_score.grade}
            </div>
          )}
        </div>

        {/* Section links */}
        {['Resumen', 'Actividad', 'Video', 'Validación', 'Protocolo', 'Metadatos', 'Notas'].map(s => (
          <button
            key={s}
            onClick={() => {
              const id = s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
              const el = document.getElementById(`section-${id}`)
              if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
            }}
            style={{
              background: 'transparent', border: 'none', borderLeft: '2px solid transparent',
              color: 'rgba(255,255,255,0.35)', fontSize: '0.7rem', fontFamily: 'monospace',
              padding: '8px 16px', textAlign: 'left', cursor: 'pointer', transition: 'all 0.2s',
            }}
            onMouseEnter={e => e.currentTarget.style.color = 'rgba(255,255,255,0.6)'}
            onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.35)'}
          >
            {s}
          </button>
        ))}

        {/* Other sessions quick nav */}
        <div style={{ marginTop: 'auto', padding: '12px 16px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.3)', fontFamily: 'monospace', marginBottom: 8 }}>
            Otras sesiones
          </div>
          {[18, 19, 25].filter(id => id !== Number(sessionId)).map(id => (
            <button
              key={id}
              onClick={() => navigate(`/lab/brain/doc/session/${id}`)}
              style={{
                display: 'block', width: '100%', background: 'none', border: 'none',
                color: 'rgba(255,255,255,0.35)', fontSize: '0.65rem', fontFamily: 'monospace',
                padding: '4px 0', textAlign: 'left', cursor: 'pointer', transition: 'color 0.2s',
              }}
              onMouseEnter={e => e.currentTarget.style.color = '#e2e8f0'}
              onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.35)'}
            >
              → Sesión #{id}
            </button>
          ))}
        </div>
      </nav>

      {/* ─── Main content ─── */}
      <main style={{ flex: 1, overflowY: 'auto', padding: '32px 40px', maxWidth: 900, margin: '0 auto' }}>
        <header style={{ marginBottom: 32 }}>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 700, color: '#e2e8f0', fontFamily: 'monospace', margin: 0 }}>
            Sesión #{sessionId} — Análisis completo
          </h1>
          <p style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.3)', fontFamily: 'monospace', margin: '8px 0 0' }}>
            Estudio detallado de actividad cerebral · Random Lab · ADA
          </p>
        </header>

        <div id="section-resumen"><SectionOverview data={data} sessionId={sessionId} /></div>
        <div id="section-actividad"><SectionTimeSeries metrics={metrics} /></div>
        <div id="section-video"><SectionVideo sessionId={Number(sessionId)} /></div>
        <div id="section-validacion"><SectionValidation data={data} /></div>
        <div id="section-protocolo"><SectionProtocol data={data} /></div>
        <div id="section-metadatos"><SectionMetadata data={data} /></div>
        <div id="section-notas"><SectionNotes sessionId={Number(sessionId)} /></div>

        <footer style={{
          textAlign: 'center', padding: '40px 0 60px',
          fontSize: '0.65rem', color: 'rgba(255,255,255,0.2)', fontFamily: 'monospace',
        }}>
          <div>ADA · Random Lab · {new Date().getFullYear()}</div>
        </footer>
      </main>
    </div>
  )
}
