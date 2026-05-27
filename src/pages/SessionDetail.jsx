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

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ResponsiveGridLayout, useContainerWidth } from 'react-grid-layout'
import 'react-grid-layout/css/styles.css'

const API = import.meta.env.VITE_API_URL || import.meta.env.VITE_BRAIN_API_BASE || (import.meta.env.DEV ? 'http://localhost:8000' : 'https://api.random-lab.es')

// ── Constants ─────────────────────────────────────────────────────────────────
const BANDS = ['delta', 'theta', 'alpha', 'beta', 'gamma']
const BAND_SYMBOL = { delta: 'δ', theta: 'θ', alpha: 'α', beta: 'β', gamma: 'γ' }
const BAND_COLORS = {
  delta: '#8b5cf6', theta: '#3b82f6', alpha: '#10b981', beta: '#f59e0b', gamma: '#ef4444',
}
const GRADE_COLORS = {
  A: '#10b981', B: '#3b82f6', C: '#f59e0b', D: '#f97316', F: '#ef4444',
}

// Fases del protocolo de validación (30 min / 1800 s)
const PROTOCOL_PHASES = [
  { t: 0,    short: 'OA',   name: 'Baseline ojos abiertos' },
  { t: 120,  short: 'OC',   name: 'Baseline ojos cerrados' },
  { t: 240,  short: 'Sha',  name: 'Shamatha' },
  { t: 540,  short: 'Med',  name: 'Meditación libre' },
  { t: 1140, short: 'Cog',  name: 'Tarea cognitiva' },
  { t: 1200, short: 'Rec',  name: 'Recovery' },
  { t: 1380, short: 'Prof', name: 'Profundización' },
  { t: 1680, short: 'Cie',  name: 'Cierre' },
]

function formatTimeTick(sec) {
  if (sec < 60) return `${sec}s`
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return s === 0 ? `${m}m` : `${m}m${String(s).padStart(2, '0')}`
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
  37: {
    observations: [
      'Sesión de 30 min completos (8546 ventanas)',
      'Berger excelente: ratio 1.829× — alpha cerrados 1.295 vs abiertos 0.708',
      'Reactividad cognitiva passed marginal: beta 1.242× — gamma bajó (0.768×)',
      'calibration_passed: false — revisar colocación del headband en próxima sesión',
      'Coherencia promedio 0.467, pico 0.546 — moderada, por debajo de sesión 34',
    ],
    learnings: [
      '— completar con observaciones post-sesión —',
    ],
    conditions: '13 de abril 2026, 08:19 hs · calidad señal 93.2%',
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

// ── Grid layout ───────────────────────────────────────────────────────────────
const SESSION_LAYOUT_KEY = 'session_detail_layout'
const SESSION_DEFAULT_LAYOUT = {
  lg: [
    { i: 'resumen',    x: 0, y: 0,  w: 12, h: 9,  minW: 6, minH: 5 },
    { i: 'actividad',  x: 0, y: 9,  w: 12, h: 12, minW: 6, minH: 8 },
    { i: 'ersp',       x: 0, y: 21, w: 12, h: 17, minW: 6, minH: 10 },
    { i: 'topomap',    x: 0, y: 38, w: 12, h: 18, minW: 6, minH: 12 },
    { i: 'video',      x: 0, y: 56, w: 6,  h: 9,  minW: 4, minH: 5 },
    { i: 'validacion', x: 6, y: 56, w: 6,  h: 14, minW: 4, minH: 6 },
    { i: 'protocolo',  x: 0, y: 70, w: 12, h: 20, minW: 6, minH: 8 },
    { i: 'metadatos',  x: 0, y: 90, w: 6,  h: 7,  minW: 4, minH: 4 },
    { i: 'notas',      x: 6, y: 90, w: 6,  h: 12, minW: 4, minH: 5 },
  ],
  sm: [
    { i: 'resumen',    x: 0, y: 0,  w: 1, h: 9  },
    { i: 'actividad',  x: 0, y: 9,  w: 1, h: 12 },
    { i: 'ersp',       x: 0, y: 21, w: 1, h: 17 },
    { i: 'topomap',    x: 0, y: 38, w: 1, h: 18 },
    { i: 'video',      x: 0, y: 56, w: 1, h: 9  },
    { i: 'validacion', x: 0, y: 65, w: 1, h: 14 },
    { i: 'protocolo',  x: 0, y: 79, w: 1, h: 20 },
    { i: 'metadatos',  x: 0, y: 99, w: 1, h: 7  },
    { i: 'notas',      x: 0, y: 106, w: 1, h: 12 },
  ],
}
const SESSION_SECTIONS_CONFIG = [
  { key: 'resumen',    label: 'RESUMEN DE SESIÓN',              accent: '#3b82f6' },
  { key: 'actividad',  label: 'ACTIVIDAD EEG TEMPORAL',         accent: '#10b981' },
  { key: 'ersp',       label: 'ERSP — TRANSICIONES DE FASE',    accent: '#6366f1' },
  { key: 'topomap',    label: 'TOPOGRAPHIC MAPPING',            accent: '#ec4899' },
  { key: 'video',      label: 'VIDEO DE SESIÓN',                accent: '#6366f1' },
  { key: 'validacion', label: 'VALIDACIÓN CIENTÍFICA',          accent: '#a78bfa' },
  { key: 'protocolo',  label: 'FASES DEL PROTOCOLO',            accent: '#ef4444' },
  { key: 'metadatos',  label: 'METADATOS',                      accent: '#f59e0b' },
  { key: 'notas',      label: 'OBSERVACIONES',                  accent: '#10b981' },
]

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
  const [perChannelByPhase, setPerChannelByPhase] = useState(null)

  useEffect(() => {
    if (!recordingId) return
    fetch(`${API}/sessions/${recordingId}/metrics`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (!d) return
        if (Array.isArray(d.metrics)) setMetrics(d.metrics)
        if (d.per_channel_by_phase) setPerChannelByPhase(d.per_channel_by_phase)
      })
      .catch(() => {})
  }, [recordingId])

  return { metrics, perChannelByPhase }
}

// ── Section: Time-series EEG charts ──────────────────────────────────────────
function SingleBandChart({ label, color, values, durationSeconds, id }) {
  const n = values.length
  const max = Math.max(...values, 0.001)
  const W = 700, H = 52
  const pts = values.map((v, i) => `${(i / Math.max(n - 1, 1)) * W},${H - (v / max) * H * 0.9}`).join(' ')
  const area = `${pts} ${W},${H} 0,${H}`

  const isProtocol = durationSeconds != null && durationSeconds >= 1500
  const protocolTicks = isProtocol
    ? PROTOCOL_PHASES.map(p => ({ ...p, frac: p.t / durationSeconds })).filter(p => p.frac <= 1.005)
    : null

  const TICK_COUNT = 5
  const equalTicks = Array.from({ length: TICK_COUNT + 1 }, (_, i) => i / TICK_COUNT)

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
        <span style={{ fontSize: '0.65rem', fontFamily: 'monospace', color }}>{label}</span>
        <span style={{ fontSize: '0.6rem', fontFamily: 'monospace', color: 'rgba(255,255,255,0.2)' }}>máx {max.toFixed(4)}</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 40, display: 'block' }} preserveAspectRatio="none">
        <defs>
          <linearGradient id={`sg-${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.3" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {isProtocol
          ? protocolTicks.filter(p => p.frac > 0.001 && p.frac < 0.999).map((p, i) => (
              <line key={i} x1={p.frac * W} y1={0} x2={p.frac * W} y2={H}
                stroke="#f87171" strokeOpacity="0.55" strokeWidth="1.5" strokeDasharray="4,3" />
            ))
          : equalTicks.slice(1, -1).map((frac, i) => (
              <line key={i} x1={frac * W} y1={0} x2={frac * W} y2={H}
                stroke="white" strokeOpacity="0.07" strokeWidth="0.8" strokeDasharray="3,3" />
            ))
        }
        <polygon points={area} fill={`url(#sg-${id})`} />
        <polyline points={pts} fill="none" stroke={color} strokeWidth="0.9" />
      </svg>
      {/* X-axis labels */}
      {isProtocol ? (
        <div style={{ position: 'relative', height: 28 }}>
          {protocolTicks.map((p, i) => {
            const isLeft  = p.frac < 0.03
            const isRight = p.frac > 0.97
            const staggerDown = i === 5
            return (
              <div key={i} style={{
                position: 'absolute',
                left: `${p.frac * 100}%`,
                top: staggerDown ? 12 : 0,
                transform: isRight ? 'translateX(-100%)' : isLeft ? 'none' : 'translateX(-50%)',
                display: 'flex', flexDirection: 'column',
                alignItems: isLeft ? 'flex-start' : isRight ? 'flex-end' : 'center',
              }}>
                <span style={{ fontSize: '0.6rem', fontFamily: 'monospace', color: 'rgba(248,113,113,0.8)', fontWeight: 600, lineHeight: 1 }}>{p.short}</span>
                <span style={{ fontSize: '0.55rem', fontFamily: 'monospace', color: 'rgba(248,113,113,0.5)', lineHeight: 1, marginTop: 1 }}>{formatTimeTick(p.t)}</span>
              </div>
            )
          })}
        </div>
      ) : (
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          {equalTicks.map((frac, i) => (
            <span key={i} style={{ fontSize: '0.55rem', fontFamily: 'monospace', color: 'rgba(255,255,255,0.2)' }}>
              {durationSeconds ? formatTimeTick(Math.round(frac * durationSeconds)) : `${Math.round(frac * 100)}%`}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

function SectionTimeSeries({ metrics, durationSeconds }) {
  if (!metrics || metrics.length < 3) {
    return (
      <Card title="Actividad durante la sesión" accent="#10b981">
        <p style={{ ...pStyle, textAlign: 'center', padding: '20px 0' }}>
          Cargando datos de tiempo real...
        </p>
      </Card>
    )
  }

  // Subsample to max 600 points for SVG performance
  const step = Math.max(1, Math.ceil(metrics.length / 600))
  const sampled = metrics.filter((_, i) => i % step === 0)
  const dur = durationSeconds ?? metrics.length * 2

  const bandValues = {}
  BANDS.forEach(b => {
    bandValues[b] = sampled.map(m => parseFloat(m[b] ?? 0) || 0)
  })
  const coh = sampled.map(m => parseFloat(m.coherence ?? 0) || 0)

  return (
    <Card title="Actividad durante la sesión" accent="#10b981">
      <p style={pStyle}>
        Evolución temporal · {metrics.length} ventanas · {Math.round(dur / 60)}m
        {dur >= 1500 && <span style={{ color: '#f87171', marginLeft: 8, fontSize: '0.68rem', fontFamily: 'monospace' }}>▏líneas rojas = cambio de fase</span>}
      </p>
      <div style={{ marginTop: 16 }}>
        {BANDS.map(b => (
          <SingleBandChart
            key={b}
            id={b}
            label={`${BAND_SYMBOL[b]} ${b}`}
            color={BAND_COLORS[b]}
            values={bandValues[b]}
            durationSeconds={dur}
          />
        ))}
        <SingleBandChart
          id="coh"
          label="coherencia PLV"
          color="#10b981"
          values={coh}
          durationSeconds={dur}
        />
      </div>
    </Card>
  )
}

// ── ERSP: Event-Related Spectral Perturbation ───────────────────────────────────
// Pattern: epoch-locked band power, normalized to pre-event baseline.
// Ref: Makeig et al. 1993 · Brandmeyer & Delorme 2018 (Muse meditation)

const ERSP_PRE_SEC  = 30   // seconds before transition → baseline
const ERSP_POST_SEC = 55   // seconds after transition to observe
const PHASE_KEY_MAP = {
  OA: 'baseline_open', OC: 'baseline_closed', Sha: 'shamatha',
  Med: 'meditation_free', Cog: 'cognitive_task', Rec: 'recovery',
  Prof: 'deep_meditation', Cie: 'close',
}

function computeERSP(metrics, durationSec, phaseT) {
  if (!metrics || metrics.length < 20 || !durationSec) return null
  const dt   = durationSec / metrics.length
  const ci   = Math.round(phaseT / dt)
  const pre  = Math.round(ERSP_PRE_SEC  / dt)
  const post = Math.round(ERSP_POST_SEC / dt)
  if (ci - pre < 2 || ci + post >= metrics.length) return null
  const epoch = metrics.slice(ci - pre, ci + post + 1)
  // Baseline: 85% of pre-window to avoid peri-event contamination
  const blEnd = Math.floor(pre * 0.85)
  const baselines = {}
  BANDS.forEach(b => {
    const vals = epoch.slice(0, blEnd).map(m => parseFloat(m[b] ?? 0) || 0)
    baselines[b] = vals.reduce((s, v) => s + v, 0) / (vals.length || 1) || 0.0001
  })
  // % change relative to baseline at every sample
  const erspData = epoch.map((m, i) => {
    const p = { t: (i - pre) * dt }
    BANDS.forEach(b => { p[b] = ((parseFloat(m[b] ?? 0) || 0) - baselines[b]) / baselines[b] * 100 })
    return p
  })
  // Summary: mean change in first 30s post-event
  const postCount = Math.min(Math.round(30 / dt), erspData.length - pre)
  const postSlice = erspData.slice(pre, pre + postCount)
  const summaryStats = {}
  BANDS.forEach(b => {
    const vals = postSlice.map(p => p[b])
    const mean = vals.reduce((s, v) => s + v, 0) / (vals.length || 1)
    const peak = vals.reduce((best, v) => Math.abs(v) > Math.abs(best) ? v : best, 0)
    summaryStats[b] = { mean, peak, baseline: baselines[b] }
  })
  return { erspData, baselines, summaryStats, pre, dt }
}

function erspAutoInterpret(erspResult) {
  if (!erspResult) return null
  const { summaryStats } = erspResult
  const sorted = BANDS.map(b => ({ b, val: summaryStats[b].mean }))
    .sort((a, b) => Math.abs(b.val) - Math.abs(a.val))
  const top = sorted[0]
  if (Math.abs(top.val) < 5) return 'Cambio mínimo — transición suave o estado ya estabilizado antes de la fase.'
  const dir = top.val > 0 ? 'subió' : 'bajó'
  const mag = Math.abs(top.val) > 40 ? 'fuertemente' : Math.abs(top.val) > 15 ? 'moderadamente' : 'ligeramente'
  const INTERP = {
    alpha: { up: 'Relajación / inhibición cortical — estado meditativo o cierre ocular.',
             down: 'Activación cortical — procesamiento activo o apertura ocular.' },
    theta: { up: 'Estado contemplativo profundo, carga de memoria de trabajo elevada.',
             down: 'Mente activa y alerta — salida del estado meditativo.' },
    beta:  { up: 'Activación cognitiva/motora — engagement prefrontal.',
             down: 'Relajación — reducción del pensamiento activo.' },
    delta: { up: 'Ondas lentas — sueño ligero o artefacto de movimiento.',
             down: 'Reducción de ondas lentas — mayor activación cortical.' },
    gamma: { up: 'Binding perceptual / procesamiento de alto nivel.',
             down: 'Reducción de arousal cognitivo.' },
  }
  const ctx = INTERP[top.b]?.[top.val > 0 ? 'up' : 'down'] || ''
  return `${BAND_SYMBOL[top.b]} ${top.b} ${mag} ${dir} (${top.val > 0 ? '+' : ''}${top.val.toFixed(0)}%). ${ctx}`
}

function ERSPButterflyChart({ erspResult, phaseName }) {
  if (!erspResult) return (
    <div style={{
      padding: '28px', textAlign: 'center', color: 'rgba(255,255,255,0.2)',
      fontSize: '0.72rem', fontFamily: 'monospace', borderRadius: 8,
      background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.06)',
    }}>
      Datos insuficientes — la ventana pre-evento cae fuera del rango de la grabación
    </div>
  )
  const { erspData, pre } = erspResult
  const W = 700, H = 150, PL = 32, PR = 10, PT = 14, PB = 18
  const iW = W - PL - PR, iH = H - PT - PB, n = erspData.length
  const allVals = BANDS.flatMap(b => erspData.map(p => Math.max(-100, Math.min(130, p[b]))))
  const yMin = Math.max(-80, Math.floor(Math.min(...allVals) / 10) * 10)
  const yMax = Math.min(130, Math.ceil(Math.max(...allVals) / 10) * 10)
  const yr   = yMax - yMin || 1
  const toX  = i => PL + (i / Math.max(n - 1, 1)) * iW
  const toY  = v => PT + iH - ((Math.max(yMin, Math.min(yMax, v)) - yMin) / yr) * iH
  const cx   = toX(pre)
  const yGrid = []
  for (let v = Math.ceil(yMin / 20) * 20; v <= yMax; v += 20) yGrid.push(v)
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 140 }}>
        {/* Pre-event shaded region */}
        <rect x={PL} y={PT} width={cx - PL} height={iH} fill="rgba(255,255,255,0.025)" />
        {/* Y grid + labels */}
        {yGrid.map(v => (
          <g key={v}>
            <line x1={PL} y1={toY(v)} x2={W - PR} y2={toY(v)}
              stroke={v === 0 ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.05)'}
              strokeWidth={v === 0 ? 0.9 : 0.5} strokeDasharray={v === 0 ? '' : '3,4'} />
            <text x={PL - 3} y={toY(v) + 3} fontSize="7"
              fill="rgba(255,255,255,0.28)" textAnchor="end" fontFamily="monospace">
              {v > 0 ? `+${v}` : v}%
            </text>
          </g>
        ))}
        {/* Band lines */}
        {BANDS.map(b => (
          <polyline key={b}
            points={erspData.map((p, i) => `${toX(i)},${toY(p[b])}`).join(' ')}
            fill="none" stroke={BAND_COLORS[b]} strokeWidth="1" opacity="0.9" strokeLinejoin="round" />
        ))}
        {/* t=0 event marker */}
        <line x1={cx} y1={PT} x2={cx} y2={PT + iH}
          stroke="rgba(255,255,255,0.5)" strokeWidth={1.3} strokeDasharray="4,2" />
        {/* Region labels */}
        <text x={PL + (cx - PL) / 2} y={PT + 9} fontSize="7"
          fill="rgba(255,255,255,0.2)" textAnchor="middle" fontFamily="monospace">baseline ({ERSP_PRE_SEC}s)</text>
        <text x={cx + (W - PR - cx) / 2} y={PT + 9} fontSize="7"
          fill="rgba(255,255,255,0.28)" textAnchor="middle" fontFamily="monospace">{phaseName}</text>
        <text x={cx + 4} y={PT + 20} fontSize="6.5" fill="rgba(255,255,255,0.4)" fontFamily="monospace">t=0</text>
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', paddingLeft: 32, marginTop: 2 }}>
        <span style={{ fontSize: '0.55rem', fontFamily: 'monospace', color: 'rgba(255,255,255,0.2)' }}>−{ERSP_PRE_SEC}s</span>
        <span style={{ fontSize: '0.6rem', fontFamily: 'monospace', color: 'rgba(255,255,255,0.45)', fontWeight: 600 }}>↑ transición de fase</span>
        <span style={{ fontSize: '0.55rem', fontFamily: 'monospace', color: 'rgba(255,255,255,0.2)' }}>+{ERSP_POST_SEC}s</span>
      </div>
    </div>
  )
}

function ERSPHeatmap({ allErsp }) {
  const clamp = (v, max) => Math.min(1, Math.abs(v) / max)
  return (
    <div>
      <p style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.2)', fontFamily: 'monospace',
        textTransform: 'uppercase', letterSpacing: '0.15em', margin: '0 0 10px 0' }}>
        Resumen — cambio medio en primeros 30s post-transición
      </p>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'separate', borderSpacing: 3, fontSize: '0.62rem', fontFamily: 'monospace' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: '2px 10px 4px 4px', color: 'rgba(255,255,255,0.2)', fontWeight: 400, fontSize: '0.58rem' }} />
              {BANDS.map(b => (
                <th key={b} style={{ padding: '2px 8px 4px', textAlign: 'center', color: BAND_COLORS[b], fontWeight: 600, minWidth: 56 }}>
                  {BAND_SYMBOL[b]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {allErsp.map(({ phase, ersp }) => (
              <tr key={phase.t}>
                <td style={{ padding: '3px 12px 3px 4px', color: 'rgba(255,255,255,0.45)', whiteSpace: 'nowrap' }}>
                  {phase.short}
                  <span style={{ color: 'rgba(255,255,255,0.2)', marginLeft: 6 }}>{formatTimeTick(phase.t)}</span>
                </td>
                {BANDS.map(b => {
                  if (!ersp) return (
                    <td key={b} style={{ padding: '3px 6px', textAlign: 'center', color: 'rgba(255,255,255,0.1)', borderRadius: 3 }}>—</td>
                  )
                  const val = ersp.summaryStats[b].mean
                  const intensity = clamp(val, 60)
                  const bg = val > 3  ? `rgba(167,139,250,${intensity * 0.6 + 0.08})`
                           : val < -3 ? `rgba(248,113,113,${intensity * 0.6 + 0.08})`
                           : 'rgba(255,255,255,0.04)'
                  return (
                    <td key={b} style={{
                      padding: '3px 6px', textAlign: 'center', borderRadius: 3, background: bg,
                      color: Math.abs(val) > 12 ? '#e2e8f0' : 'rgba(255,255,255,0.35)',
                      fontWeight: Math.abs(val) > 20 ? 600 : 400,
                    }}>
                      {val > 0 ? '+' : ''}{val.toFixed(0)}%
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ display: 'flex', gap: 16, marginTop: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: '0.55rem', color: 'rgba(167,139,250,0.6)', fontFamily: 'monospace' }}>■ subida</span>
        <span style={{ fontSize: '0.55rem', color: 'rgba(248,113,113,0.6)', fontFamily: 'monospace' }}>■ bajada</span>
        <span style={{ fontSize: '0.55rem', color: 'rgba(255,255,255,0.18)', fontFamily: 'monospace' }}>media post-30s vs baseline pre-{ERSP_PRE_SEC}s</span>
      </div>
    </div>
  )
}

function SectionERSP({ metrics, durationSeconds }) {
  const [selectedIdx, setSelectedIdx] = useState(1) // default: OC — first real transition

  const isProtocol = durationSeconds != null && durationSeconds >= 1500

  // Pre-compute all ERSP epochs once (skip OA at t=0 — no pre-event data)
  const allErsp = useMemo(() => {
    if (!metrics || !durationSeconds) return []
    return PROTOCOL_PHASES.slice(1).map(p => ({ phase: p, ersp: computeERSP(metrics, durationSeconds, p.t) }))
  }, [metrics, durationSeconds])

  if (!isProtocol) return (
    <Card title="ERSP — Análisis de transiciones de fase" accent="#6366f1">
      <div style={{ padding: '32px 16px', textAlign: 'center', borderRadius: 8,
        background: 'rgba(99,102,241,0.04)', border: '1px dashed rgba(99,102,241,0.2)' }}>
        <p style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', fontFamily: 'monospace', margin: 0 }}>
          Disponible solo para sesiones de protocolo completo (≥ 25 min)
        </p>
      </div>
    </Card>
  )

  if (!metrics || metrics.length < 50) return (
    <Card title="ERSP — Análisis de transiciones de fase" accent="#6366f1">
      <p style={{ ...pStyle, textAlign: 'center', padding: '20px 0' }}>Cargando métricas...</p>
    </Card>
  )

  const validPhases = PROTOCOL_PHASES.slice(1) // OC → Cie
  const selIdx      = Math.min(selectedIdx, validPhases.length - 1)
  const selPhase    = validPhases[selIdx]
  const erspResult  = allErsp[selIdx]?.ersp ?? null
  const phaseInfo   = PHASE_INFO[PHASE_KEY_MAP[selPhase.short]] || {}
  const interp      = erspAutoInterpret(erspResult)

  return (
    <Card title="ERSP — Análisis de transiciones de fase" accent="#6366f1">
      <p style={pStyle}>
        Event-Related Spectral Perturbation: % de cambio de cada banda espectral al inicio de cada fase,
        normalizado contra el baseline de los {ERSP_PRE_SEC}s previos a la transición.
      </p>

      {/* Phase selector tabs */}
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 16, marginTop: 4 }}>
        {validPhases.map((p, i) => {
          const info = PHASE_INFO[PHASE_KEY_MAP[p.short]] || {}
          return (
            <button key={p.t} onClick={() => setSelectedIdx(i)} style={{
              padding: '6px 12px', borderRadius: 6, border: 'none', cursor: 'pointer',
              fontFamily: 'monospace', fontSize: '0.68rem', transition: 'all 0.15s',
              background: selIdx === i ? '#6366f1' : 'rgba(255,255,255,0.05)',
              color: selIdx === i ? '#fff' : 'rgba(255,255,255,0.4)',
              fontWeight: selIdx === i ? 600 : 400,
            }}>
              {info.icon || ''} {p.short}
              <span style={{ marginLeft: 4, opacity: 0.55, fontSize: '0.58rem' }}>{formatTimeTick(p.t)}</span>
            </button>
          )
        })}
      </div>

      {/* Selected phase header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: '1rem' }}>{phaseInfo.icon || '◉'}</span>
        <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#e2e8f0', fontFamily: 'monospace' }}>
          {phaseInfo.name || selPhase.name}
        </span>
        <Badge color="#6366f1">{formatTimeTick(selPhase.t)}</Badge>
      </div>

      {/* Band legend */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 8 }}>
        {BANDS.map(b => (
          <span key={b} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.62rem', fontFamily: 'monospace', color: BAND_COLORS[b] }}>
            <span style={{ width: 12, height: 2, background: BAND_COLORS[b], display: 'inline-block', borderRadius: 1 }} />
            {BAND_SYMBOL[b]} {b}
          </span>
        ))}
        <span style={{ marginLeft: 'auto', fontSize: '0.6rem', color: 'rgba(255,255,255,0.2)', fontFamily: 'monospace' }}>
          eje Y = % cambio vs baseline
        </span>
      </div>

      {/* Butterfly chart */}
      <ERSPButterflyChart erspResult={erspResult} phaseName={phaseInfo.name || selPhase.name} />

      {/* Stats + interpretation  */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 16 }}>
        {/* Stats table */}
        <div style={{ padding: '12px 14px', borderRadius: 8, background: 'rgba(99,102,241,0.04)', border: '1px solid rgba(99,102,241,0.12)' }}>
          <p style={{ fontSize: '0.6rem', color: '#6366f1', fontFamily: 'monospace',
            textTransform: 'uppercase', letterSpacing: '0.12em', margin: '0 0 8px 0' }}>Estadísticas</p>
          {erspResult ? (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.63rem', fontFamily: 'monospace' }}>
              <thead>
                <tr>
                  {['banda', 'baseline', 'Δ media', 'Δ pico'].map(h => (
                    <th key={h} style={{ textAlign: h === 'banda' ? 'left' : 'center', padding: '3px 6px',
                      color: 'rgba(255,255,255,0.25)', fontWeight: 400,
                      borderBottom: '1px solid rgba(255,255,255,0.06)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {BANDS.map(b => {
                  const s = erspResult.summaryStats[b]
                  const mc = s.mean >  8 ? '#a78bfa' : s.mean < -8 ? '#f87171' : 'rgba(255,255,255,0.4)'
                  const pc = s.peak > 15 ? '#a78bfa' : s.peak < -15 ? '#f87171' : 'rgba(255,255,255,0.35)'
                  return (
                    <tr key={b} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <td style={{ padding: '4px 6px', color: BAND_COLORS[b] }}>{BAND_SYMBOL[b]} {b}</td>
                      <td style={{ padding: '4px 6px', textAlign: 'center', color: 'rgba(255,255,255,0.3)' }}>{s.baseline.toFixed(4)}</td>
                      <td style={{ padding: '4px 6px', textAlign: 'center', color: mc, fontWeight: Math.abs(s.mean) > 8 ? 600 : 400 }}>
                        {s.mean > 0 ? '+' : ''}{s.mean.toFixed(1)}%
                      </td>
                      <td style={{ padding: '4px 6px', textAlign: 'center', color: pc }}>
                        {s.peak > 0 ? '+' : ''}{s.peak.toFixed(1)}%
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          ) : (
            <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: '0.68rem' }}>Sin datos</p>
          )}
        </div>

        {/* Interpretation */}
        <div style={{ padding: '12px 14px', borderRadius: 8, background: 'rgba(99,102,241,0.04)', border: '1px solid rgba(99,102,241,0.12)' }}>
          <p style={{ fontSize: '0.6rem', color: '#6366f1', fontFamily: 'monospace',
            textTransform: 'uppercase', letterSpacing: '0.12em', margin: '0 0 8px 0' }}>Qué esperar</p>
          {phaseInfo.expect && (
            <p style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.5)', lineHeight: 1.7, margin: '0 0 10px 0' }}>
              {phaseInfo.expect}
            </p>
          )}
          {interp && (
            <div style={{ padding: '8px 10px', borderRadius: 6, background: 'rgba(99,102,241,0.09)',
              borderLeft: '2px solid rgba(99,102,241,0.45)', fontSize: '0.7rem',
              color: 'rgba(255,255,255,0.65)', lineHeight: 1.65 }}>
              {interp}
            </div>
          )}
          {phaseInfo.science && (
            <div style={{ marginTop: 10, padding: '8px 10px', borderRadius: 6,
              background: 'rgba(255,255,255,0.03)', borderLeft: '2px solid rgba(255,255,255,0.08)',
              fontSize: '0.65rem', color: 'rgba(255,255,255,0.35)', lineHeight: 1.6 }}>
              {phaseInfo.science}
            </div>
          )}
        </div>
      </div>

      {/* Heatmap overview — all phases */}
      <div style={{ marginTop: 20, padding: '14px 16px', borderRadius: 8,
        background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.06)' }}>
        <ERSPHeatmap allErsp={allErsp} />
      </div>

      <div style={{ marginTop: 10, fontSize: '0.58rem', color: 'rgba(255,255,255,0.12)', fontFamily: 'monospace' }}>
        Refs: Makeig et al. 1993 (ERSP) · Brandmeyer &amp; Delorme 2018 (Muse meditation)
        · baseline: {ERSP_PRE_SEC}s pre-evento · observación: {ERSP_POST_SEC}s post-evento
      </div>
    </Card>
  )
}

// ── Topographic mapping ────────────────────────────────────────────────────────────
// Canvas-based IDW interpolation over Muse 2 electrode sites.
// SVG overlay draws the head, nose, ears and electrode labels.
// Refs: Cannard et al. 2021 (Muse validation) · Klimesch 1999 (band review)

// Electrode positions in normalized head coords: origin = vertex, +y = nose, +x = right
const MUSE_ELECTRODES = {
  AF7:  { x: -0.326, y:  0.749 },   // left prefrontal
  AF8:  { x:  0.326, y:  0.749 },   // right prefrontal
  TP9:  { x: -0.884, y: -0.150 },   // left temporal-parietal
  TP10: { x:  0.884, y: -0.150 },   // right temporal-parietal
}

// Neuroanatomical spatial priors: applied when only aggregate band data available.
// Alpha is measured from posterior (TP9/TP10) in this backend; theta/beta are frontal-dominant.
const BAND_SPATIAL_PRIOR = {
  delta: { AF7: 1.00, AF8: 1.00, TP9: 1.00, TP10: 1.00 },
  theta: { AF7: 1.20, AF8: 1.20, TP9: 0.80, TP10: 0.80 },
  alpha: { AF7: 0.78, AF8: 0.78, TP9: 1.25, TP10: 1.25 },
  beta:  { AF7: 1.12, AF8: 1.12, TP9: 0.88, TP10: 0.88 },
  gamma: { AF7: 1.15, AF8: 1.15, TP9: 0.85, TP10: 0.85 },
}

function _jet(t) {
  return [
    Math.max(0, Math.min(1, 1.5 - Math.abs(4 * t - 3))),
    Math.max(0, Math.min(1, 1.5 - Math.abs(4 * t - 2))),
    Math.max(0, Math.min(1, 1.5 - Math.abs(4 * t - 1))),
  ]
}

function _idw(px, py, ctrl, power = 2) {
  let num = 0, den = 0
  for (const [cx, cy, val] of ctrl) {
    const d2 = (px - cx) ** 2 + (py - cy) ** 2
    if (d2 < 1e-8) return val
    const w = 1 / d2 ** (power / 2)
    num += val * w; den += w
  }
  return den === 0 ? 0 : num / den
}

function TopoMapCanvas({ values, size }) {
  const ref = useRef(null)
  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const S = size * dpr
    canvas.width = S; canvas.height = S
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, S, S)
    const chs = Object.keys(MUSE_ELECTRODES).filter(ch => values[ch] != null)
    if (chs.length < 2) return
    const vals = chs.map(ch => values[ch])
    const vMin = Math.min(...vals), vMax = Math.max(...vals)
    const range = vMax - vMin || 0.0001
    const R = S / 2, ir = R * 0.92
    const ctrl = chs.map(ch => {
      const { x, y } = MUSE_ELECTRODES[ch]
      return [R + x * ir, R - y * ir, values[ch]]
    })
    const img = ctx.createImageData(S, S)
    const d   = img.data
    for (let py = 0; py < S; py++) {
      for (let px = 0; px < S; px++) {
        const dx = (px - R) / ir, dy = (py - R) / ir
        if (dx * dx + dy * dy > 1) continue
        const v = _idw(px, py, ctrl)
        const [r, g, b] = _jet((v - vMin) / range)
        const i = (py * S + px) * 4
        d[i] = Math.round(r * 255); d[i+1] = Math.round(g * 255)
        d[i+2] = Math.round(b * 255); d[i+3] = 255
      }
    }
    ctx.putImageData(img, 0, 0)
  }, [values, size])
  return <canvas ref={ref} style={{ position: 'absolute', top: 0, left: 0, width: size, height: size }} />
}

function TopoMap({ values, size = 120 }) {
  const R  = size / 2
  const ir = R * 0.92
  const hasData = values && Object.keys(MUSE_ELECTRODES).some(ch => values[ch] != null && values[ch] > 0)
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      {hasData && <TopoMapCanvas values={values} size={size} />}
      <svg viewBox={`0 0 ${size} ${size}`}
        style={{ position: 'absolute', top: 0, left: 0, width: size, height: size }}>
        {/* Head circle */}
        <circle cx={R} cy={R} r={ir}
          fill={hasData ? 'none' : 'rgba(255,255,255,0.025)'}
          stroke="rgba(255,255,255,0.45)" strokeWidth="0.8" />
        {/* Nose */}
        <path d={`M ${R-5},${R-ir*0.87} Q ${R},${R-ir*1.07} ${R+5},${R-ir*0.87}`}
          fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth="0.8" />
        {/* Left ear */}
        <path d={`M ${R-ir-1},${R+ir*0.13} Q ${R-ir*1.1},${R} ${R-ir-1},${R-ir*0.13}`}
          fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth="0.8" />
        {/* Right ear */}
        <path d={`M ${R+ir+1},${R+ir*0.13} Q ${R+ir*1.1},${R} ${R+ir+1},${R-ir*0.13}`}
          fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth="0.8" />
        {/* Electrodes */}
        {Object.entries(MUSE_ELECTRODES).map(([ch, pos]) => {
          const cx = R + pos.x * ir, cy = R - pos.y * ir
          return (
            <g key={ch}>
              <circle cx={cx} cy={cy} r={3.5}
                fill="rgba(0,0,0,0.7)" stroke="rgba(255,255,255,0.8)" strokeWidth="0.8" />
              <text
                x={cx + (pos.x < 0 ? -5.5 : 5.5)} y={cy - 5}
                fontSize="6" fill="rgba(255,255,255,0.65)" fontFamily="monospace"
                textAnchor={pos.x < 0 ? 'end' : 'start'}>
                {ch}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

function TopoColorBar({ vMin, vMax, width = 280, raw = false }) {
  const stops = Array.from({ length: 60 }, (_, i) => {
    const t = i / 59
    const [r, g, b] = _jet(t)
    return `rgb(${Math.round(r*255)},${Math.round(g*255)},${Math.round(b*255)})`
  }).join(',')
  const fmt = v => raw ? v.toFixed(2) : `${(v * 100).toFixed(1)}%`
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: '0.58rem', fontFamily: 'monospace', color: 'rgba(255,255,255,0.3)', minWidth: 30, textAlign: 'right' }}>
        {fmt(vMin)}
      </span>
      <div style={{
        width, height: 7, borderRadius: 4, flexShrink: 0,
        background: `linear-gradient(to right, ${stops})`,
        border: '1px solid rgba(255,255,255,0.1)',
      }} />
      <span style={{ fontSize: '0.58rem', fontFamily: 'monospace', color: 'rgba(255,255,255,0.3)', minWidth: 30 }}>
        {fmt(vMax)}
      </span>
    </div>
  )
}

function computePhaseAverages(metrics, durationSec) {
  if (!metrics || !durationSec || metrics.length < 10) return {}
  const dt = durationSec / metrics.length
  const res = {}
  PROTOCOL_PHASES.forEach((phase, i) => {
    const nextT = PROTOCOL_PHASES[i + 1]?.t ?? durationSec
    const s = Math.max(0, Math.round(phase.t / dt))
    const e = Math.min(metrics.length, Math.round(nextT / dt))
    if (e <= s + 2) return
    const slice = metrics.slice(s, e)
    res[phase.short] = {}
    BANDS.forEach(b => {
      res[phase.short][b] = slice.reduce((a, m) => a + (parseFloat(m[b]) || 0), 0) / slice.length
    })
    res[phase.short].coherence = slice.reduce((a, m) => a + (parseFloat(m.coherence) || 0), 0) / slice.length
  })
  return res
}

const CH_MAP = { af7: 'AF7', af8: 'AF8', tp9: 'TP9', tp10: 'TP10' }
const PHASE_ORDER = [
  'baseline_open', 'baseline_closed', 'shamatha', 'meditation_free',
  'cognitive_task', 'recovery', 'deep_meditation', 'close',
]
const PHASE_SHORT = {
  baseline_open: 'OA', baseline_closed: 'OC', shamatha: 'Sha',
  meditation_free: 'Med', cognitive_task: 'Cog', recovery: 'Rec',
  deep_meditation: 'Prof', close: 'Cie',
}

function SectionTopoMaps({ metrics, perChannelByPhase, durationSeconds }) {
  const [band, setBand] = useState('alpha')

  // useMemo must be before any conditional return (Rules of Hooks)
  const phaseAvgs = useMemo(
    () => computePhaseAverages(metrics, durationSeconds),
    [metrics, durationSeconds]
  )

  const hasReal = perChannelByPhase && Object.keys(perChannelByPhase).length > 0

  // ── REAL DATA BRANCH ────────────────────────────────────────────────────────
  if (hasReal) {
    const phases = PHASE_ORDER.filter(p => perChannelByPhase[p])
    const phaseTopo = phases.map(phaseKey => {
      const bandData = perChannelByPhase[phaseKey]?.[band] || {}
      const values = {}
      Object.entries(bandData).forEach(([k, v]) => {
        if (CH_MAP[k]) values[CH_MAP[k]] = v
      })
      const present = Object.values(values).filter(v => v != null)
      const bandAvg = present.length ? present.reduce((a, b) => a + b, 0) / present.length : 0
      return { phaseKey, phaseInfo: PHASE_INFO[phaseKey] || {}, values, bandAvg }
    })

    const allVals = phaseTopo.flatMap(p => Object.values(p.values))
    const gMin = allVals.length ? Math.min(...allVals) : 0
    const gMax = allVals.length ? Math.max(...allVals) : 1

    return (
      <Card title="Topographic mapping — distribución espacial" accent="#ec4899">
        <p style={pStyle}>
          Potencia de banda <strong>medida</strong> en cada electrodo del Muse 2
          (TP9, AF7, AF8, TP10) por fase del protocolo. Valores en µV²/Hz absolutos,
          interpolación IDW. Sin priors — distribución espacial real de la sesión.
        </p>

        <div style={{ marginBottom: 14 }}>
          <Badge color="#10b981">● MEDIDO · per-channel real</Badge>
        </div>

        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 22, marginTop: 4 }}>
          {BANDS.map(b => (
            <button key={b} onClick={() => setBand(b)} style={{
              padding: '5px 14px', borderRadius: 6, border: 'none', cursor: 'pointer',
              fontFamily: 'monospace', fontSize: '0.7rem', transition: 'all 0.15s',
              background: band === b ? BAND_COLORS[b] : 'rgba(255,255,255,0.05)',
              color: band === b ? '#fff' : BAND_COLORS[b],
              fontWeight: band === b ? 600 : 400,
              boxShadow: band === b ? `0 0 12px ${BAND_COLORS[b]}55` : 'none',
            }}>
              {BAND_SYMBOL[b]} {b}
            </button>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(phaseTopo.length, 4)}, 1fr)`, gap: '24px 16px' }}>
          {phaseTopo.map(({ phaseKey, phaseInfo, values, bandAvg }) => (
            <div key={phaseKey} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <TopoMap values={values} size={110} />
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '0.65rem', fontFamily: 'monospace', fontWeight: 600, color: 'rgba(255,255,255,0.75)' }}>
                  {phaseInfo.icon || ''} {PHASE_SHORT[phaseKey] || phaseKey}
                </div>
                <div style={{ fontSize: '0.56rem', fontFamily: 'monospace', color: 'rgba(255,255,255,0.25)' }}>
                  {phaseInfo.name || phaseKey}
                </div>
                <div style={{ fontSize: '0.62rem', fontFamily: 'monospace', marginTop: 2, color: BAND_COLORS[band] }}>
                  {bandAvg.toFixed(2)} µV²
                </div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 20, display: 'flex', justifyContent: 'center', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <TopoColorBar vMin={gMin} vMax={gMax} raw />
          <span style={{ fontSize: '0.56rem', fontFamily: 'monospace', color: 'rgba(255,255,255,0.18)' }}>
            escala global de la sesión (µV²/Hz) · azul = bajo · rojo = alto
          </span>
        </div>

        <div style={{ marginTop: 16, padding: '10px 14px', borderRadius: 8,
          background: 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.15)',
          fontSize: '0.6rem', fontFamily: 'monospace', color: 'rgba(255,255,255,0.35)', lineHeight: 1.7 }}>
          Distribución real por electrodo desde eeg_band_power. Las fases se derivan de
          los markers del protocolo (no de tiempos fijos). Habilita FAA y asimetría
          hemisférica reales (próximas fases). Refs: Cannard et al. 2021 · Klimesch 1999.
        </div>
      </Card>
    )
  }

  // ── FALLBACK: estimación con priors ─────────────────────────────────────────
  const isProtocol = durationSeconds != null && durationSeconds >= 1500

  if (!isProtocol) return (
    <Card title="Topographic mapping — distribución espacial" accent="#ec4899">
      <div style={{ padding: '32px 16px', textAlign: 'center', borderRadius: 8,
        background: 'rgba(236,72,153,0.04)', border: '1px dashed rgba(236,72,153,0.2)' }}>
        <p style={{ ...pStyle, margin: 0 }}>
          Sin datos per-channel para esta sesión. Disponible para sesiones de
          protocolo completo (≥ 25 min) grabadas antes del sistema per-channel.
        </p>
      </div>
    </Card>
  )
  if (!metrics || metrics.length < 50) return (
    <Card title="Topographic mapping — distribución espacial" accent="#ec4899">
      <p style={{ ...pStyle, textAlign: 'center', padding: '20px 0' }}>Cargando métricas...</p>
    </Card>
  )

  const prior = BAND_SPATIAL_PRIOR[band] || BAND_SPATIAL_PRIOR.alpha
  const phaseTopo = PROTOCOL_PHASES.map(p => {
    const avg = phaseAvgs[p.short]
    const base = avg?.[band] ?? 0
    return {
      phase: p,
      phaseInfo: PHASE_INFO[PHASE_KEY_MAP?.[p.short]] || {},
      values: { AF7: base * prior.AF7, AF8: base * prior.AF8, TP9: base * prior.TP9, TP10: base * prior.TP10 },
      bandAvg: base,
      coh: avg?.coherence ?? 0,
    }
  })

  const allVals = phaseTopo.flatMap(p => Object.values(p.values))
  const gMin = Math.min(...allVals), gMax = Math.max(...allVals)

  return (
    <Card title="Topographic mapping — distribución espacial" accent="#ec4899">
      <p style={pStyle}>
        Distribución espacial <strong>estimada</strong> de la potencia de banda con prior
        neuroanatómico. Interpolación IDW.
      </p>
      <div style={{ marginBottom: 14 }}>
        <Badge color="#f59e0b">◐ ESTIMADO · prior neuroanatómico</Badge>
      </div>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 22, marginTop: 4 }}>
        {BANDS.map(b => (
          <button key={b} onClick={() => setBand(b)} style={{
            padding: '5px 14px', borderRadius: 6, border: 'none', cursor: 'pointer',
            fontFamily: 'monospace', fontSize: '0.7rem', transition: 'all 0.15s',
            background: band === b ? BAND_COLORS[b] : 'rgba(255,255,255,0.05)',
            color: band === b ? '#fff' : BAND_COLORS[b],
            fontWeight: band === b ? 600 : 400,
            boxShadow: band === b ? `0 0 12px ${BAND_COLORS[b]}55` : 'none',
          }}>{BAND_SYMBOL[b]} {b}</button>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '24px 16px' }}>
        {phaseTopo.map(({ phase, phaseInfo, values, bandAvg, coh }) => (
          <div key={phase.t} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
            <TopoMap values={values} size={110} />
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '0.65rem', fontFamily: 'monospace', fontWeight: 600, color: 'rgba(255,255,255,0.75)' }}>
                {phaseInfo.icon || ''} {phase.short}
              </div>
              <div style={{ fontSize: '0.56rem', fontFamily: 'monospace', color: 'rgba(255,255,255,0.25)' }}>
                {formatTimeTick(phase.t)}
              </div>
              <div style={{ fontSize: '0.62rem', fontFamily: 'monospace', marginTop: 2, color: BAND_COLORS[band] }}>
                {(bandAvg * 100).toFixed(1)}%
              </div>
              {coh > 0 && (
                <div style={{ fontSize: '0.55rem', fontFamily: 'monospace', color: 'rgba(16,185,129,0.55)' }}>
                  coh {coh.toFixed(2)}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 20, display: 'flex', justifyContent: 'center', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
        <TopoColorBar vMin={gMin} vMax={gMax} />
        <span style={{ fontSize: '0.56rem', fontFamily: 'monospace', color: 'rgba(255,255,255,0.18)' }}>
          escala global de la sesión · azul = bajo · rojo = alto
        </span>
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
  if (!events.length) return (
    <Card title="Fases del protocolo" accent="#ef4444">
      <div style={{ padding: '32px 16px', textAlign: 'center', borderRadius: 8, background: 'rgba(239,68,68,0.04)', border: '1px dashed rgba(239,68,68,0.2)' }}>
        <div style={{ fontSize: '1.5rem', marginBottom: 8 }}>📋</div>
        <p style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', fontFamily: 'monospace', margin: 0 }}>
          No hay eventos de protocolo registrados para esta sesión
        </p>
        <p style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.2)', fontFamily: 'monospace', marginTop: 8 }}>
          Los eventos se loguean automáticamente cuando la sesión se corre con el app de protocolo Python
        </p>
      </div>
    </Card>
  )

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
  if (!notes) return (
    <Card title="Observaciones y aprendizajes" accent="#10b981">
      <div style={{ padding: '32px 16px', textAlign: 'center', borderRadius: 8, background: 'rgba(16,185,129,0.04)', border: '1px dashed rgba(16,185,129,0.2)' }}>
        <div style={{ fontSize: '1.5rem', marginBottom: 8 }}>📝</div>
        <p style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', fontFamily: 'monospace', margin: 0 }}>
          No hay observaciones para esta sesión
        </p>
        <p style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.2)', fontFamily: 'monospace', marginTop: 8 }}>
          Agregá una entrada en <code style={{ color: '#10b981' }}>SESSION_NOTES[{sessionId}]</code> en SessionDetail.jsx
        </p>
      </div>
    </Card>
  )

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
  if (!Object.keys(meta).length) return (
    <Card title="Metadatos de sesión" accent="#f59e0b">
      <div style={{ padding: '32px 16px', textAlign: 'center', borderRadius: 8, background: 'rgba(245,158,11,0.04)', border: '1px dashed rgba(245,158,11,0.2)' }}>
        <div style={{ fontSize: '1.5rem', marginBottom: 8 }}>🗃️</div>
        <p style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', fontFamily: 'monospace', margin: 0 }}>
          No hay metadatos de protocolo registrados
        </p>
        <p style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.2)', fontFamily: 'monospace', marginTop: 8 }}>
          Sueño, cafeína, estado subjetivo — se registran al iniciar el protocolo
        </p>
      </div>
    </Card>
  )

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
  const { metrics, perChannelByPhase } = useSessionTimeSeries(data?.recording?.id)
  const { containerRef: gridRef, width: gridWidth } = useContainerWidth()

  const [layouts, setLayouts] = useState(() => {
    try {
      const saved = localStorage.getItem(SESSION_LAYOUT_KEY)
      if (!saved) return SESSION_DEFAULT_LAYOUT
      const parsed = JSON.parse(saved)
      if (!parsed.lg || parsed.lg.length !== SESSION_DEFAULT_LAYOUT.lg.length) {
        localStorage.removeItem(SESSION_LAYOUT_KEY)
        return SESSION_DEFAULT_LAYOUT
      }
      return parsed
    } catch { return SESSION_DEFAULT_LAYOUT }
  })

  const handleLayoutChange = useCallback((_, allLayouts) => {
    setLayouts(allLayouts)
    localStorage.setItem(SESSION_LAYOUT_KEY, JSON.stringify(allLayouts))
  }, [])

  const resetLayout = () => {
    setLayouts(SESSION_DEFAULT_LAYOUT)
    localStorage.removeItem(SESSION_LAYOUT_KEY)
  }

  const renderSection = useCallback((key) => {
    switch (key) {
      case 'resumen':    return <SectionOverview data={data} sessionId={sessionId} />
      case 'actividad':  return <SectionTimeSeries metrics={metrics} durationSeconds={data?.recording?.duration_seconds} />
      case 'ersp':       return <SectionERSP metrics={metrics} durationSeconds={data?.recording?.duration_seconds} />
      case 'topomap':    return <SectionTopoMaps metrics={metrics} perChannelByPhase={perChannelByPhase} durationSeconds={data?.recording?.duration_seconds} />
      case 'video':      return <SectionVideo sessionId={Number(sessionId)} />
      case 'validacion': return <SectionValidation data={data} />
      case 'protocolo':  return <SectionProtocol data={data} />
      case 'metadatos':  return <SectionMetadata data={data} />
      case 'notas':      return <SectionNotes sessionId={Number(sessionId)} />
      default:           return null
    }
  }, [data, metrics, sessionId])

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
          <button
            onClick={resetLayout}
            style={{
              display: 'block', marginTop: 10, background: 'none',
              border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.3)',
              fontSize: '0.58rem', cursor: 'pointer', fontFamily: 'monospace',
              padding: '3px 8px', borderRadius: 4, width: '100%', transition: 'all 0.2s',
            }}
            onMouseEnter={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.6)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)' }}
            onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.3)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)' }}
          >
            ↺ reset layout
          </button>
        </div>
      </nav>

      {/* ─── Main content ─── */}
      <main style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '32px 24px 32px 32px' }}>
        <header style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 700, color: '#e2e8f0', fontFamily: 'monospace', margin: 0 }}>
            Sesión #{sessionId} — Análisis completo
          </h1>
          <p style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.3)', fontFamily: 'monospace', margin: '8px 0 0' }}>
            Estudio detallado de actividad cerebral · Random Lab · ADA
          </p>
        </header>

        <div ref={gridRef}>
          <ResponsiveGridLayout
            width={gridWidth}
            layouts={layouts}
            onLayoutChange={handleLayoutChange}
            breakpoints={{ lg: 1100, sm: 0 }}
            cols={{ lg: 12, sm: 1 }}
            rowHeight={40}
            draggableHandle=".doc-drag-handle"
            margin={[16, 16]}
            containerPadding={[0, 0]}
            useCSSTransforms
          >
            {SESSION_SECTIONS_CONFIG.map(({ key, label, accent }) => (
              <div
                key={key}
                id={`section-${key}`}
                style={{
                  display: 'flex', flexDirection: 'column', overflow: 'hidden',
                  background: 'rgba(15, 15, 25, 0.85)',
                  border: `1px solid ${accent}33`, borderRadius: 12,
                  backdropFilter: 'blur(8px)',
                }}
              >
                <div
                  className="doc-drag-handle"
                  style={{
                    padding: '7px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    background: `${accent}10`, borderBottom: `1px solid ${accent}22`,
                    cursor: 'grab', userSelect: 'none', flexShrink: 0,
                  }}
                >
                  <span style={{ fontSize: '0.65rem', color: `${accent}dd`, fontFamily: 'monospace', fontWeight: 600 }}>{label}</span>
                  <span style={{ color: `${accent}55`, fontSize: '0.9rem' }}>⠿</span>
                </div>
                <div style={{ flex: 1, overflowY: 'auto' }}>
                  {renderSection(key)}
                </div>
              </div>
            ))}
          </ResponsiveGridLayout>
        </div>

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
