/**
 * BrainDoc — /lab/brain/doc
 *
 * Scientific documentation & research dashboard for the ADA project.
 * Combines project methodology, neuroscience theory, software architecture,
 * real-time session data analysis, and training dataset progress.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'

// ── Constants ─────────────────────────────────────────────────────────────────
const BANDS = ['delta', 'theta', 'alpha', 'beta', 'gamma']
const BAND_SYMBOL = { delta: 'δ', theta: 'θ', alpha: 'α', beta: 'β', gamma: 'γ' }
const BAND_COLORS = {
  delta: '#8b5cf6', theta: '#3b82f6', alpha: '#10b981', beta: '#f59e0b', gamma: '#ef4444',
}
const BAND_RANGES = {
  delta: '0.5–4 Hz', theta: '4–8 Hz', alpha: '8–13 Hz', beta: '13–30 Hz', gamma: '30–50 Hz',
}
const GRADE_COLORS = {
  A: '#10b981', B: '#3b82f6', C: '#f59e0b', D: '#f97316', F: '#ef4444',
}

const NAV_SECTIONS = [
  { id: 'intro', label: 'Introducción' },
  { id: 'objective', label: 'Objetivo' },
  { id: 'theory', label: 'Marco Teórico' },
  { id: 'architecture', label: 'Arquitectura' },
  { id: 'protocol', label: 'Protocolo' },
  { id: 'validation', label: 'Validación' },
  { id: 'datasets', label: 'Datasets' },
  { id: 'progress', label: 'Progreso' },
  { id: 'roadmap', label: 'Roadmap' },
]

// ── Data hooks ────────────────────────────────────────────────────────────────
function useDashboardData() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const r = await fetch(`${API}/doc/dashboard`)
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      const json = await r.json()
      setData(json)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])
  return { data, loading, error, reload: load }
}

// ── Small UI components ───────────────────────────────────────────────────────
function Badge({ children, color = '#3b82f6' }) {
  return (
    <span style={{
      display: 'inline-block', padding: '2px 8px', borderRadius: 4,
      background: `${color}22`, color, fontSize: '0.7rem', fontFamily: 'monospace',
      border: `1px solid ${color}44`, letterSpacing: '0.03em',
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
      <div style={{ fontSize: '1.6rem', fontWeight: 700, color, fontFamily: 'monospace' }}>
        {value}
      </div>
      <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.4)', marginTop: 2, fontFamily: 'monospace' }}>
        {label}{unit && ` (${unit})`}
      </div>
    </div>
  )
}

function MiniBar({ value, max = 1, color = '#3b82f6', width = 80, label }) {
  const pct = Math.min(100, (value / max) * 100)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      {label && <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.5)', fontFamily: 'monospace', minWidth: 24 }}>{label}</span>}
      <div style={{ width, height: 6, background: 'rgba(255,255,255,0.08)', borderRadius: 3 }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 3, transition: 'width 0.5s ease' }} />
      </div>
      <span style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.4)', fontFamily: 'monospace', minWidth: 30 }}>
        {typeof value === 'number' ? value.toFixed(2) : value}
      </span>
    </div>
  )
}

function Table({ headers, rows, compact }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: compact ? '0.7rem' : '0.75rem', fontFamily: 'monospace' }}>
        <thead>
          <tr>
            {headers.map((h, i) => (
              <th key={i} style={{ textAlign: 'left', padding: compact ? '6px 8px' : '8px 12px', color: 'rgba(255,255,255,0.5)', borderBottom: '1px solid rgba(255,255,255,0.1)', fontWeight: 500, whiteSpace: 'nowrap' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              {row.map((cell, j) => (
                <td key={j} style={{ padding: compact ? '6px 8px' : '8px 12px', color: 'rgba(255,255,255,0.7)', whiteSpace: 'nowrap' }}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Section: Introduction ─────────────────────────────────────────────────────
function SectionIntro() {
  return (
    <Card id="intro" title="01 — INTRODUCCIÓN" accent="#a78bfa">
      <p style={pStyle}>
        <strong>ADA</strong> es un sistema de investigación 
        neurocientífica que combina <strong>electroencefalografía (EEG)</strong> en tiempo real, 
        <strong>inteligencia artificial</strong> (Variational Autoencoders), y <strong>visualización 3D</strong> para 
        estudiar estados de conciencia durante la meditación.
      </p>
      <p style={pStyle}>
        El proyecto se fundamenta en la <strong>Teoría Sintérgica</strong> del Dr. Jacobo Grinberg, que propone 
        que la conciencia emerge de la interacción entre el campo neuronal del cerebro y una estructura 
        fundamental del espacio-tiempo denominada <em>Lattice</em>. Esta interacción — la <em>Sintergía</em> — 
        se manifiesta como coherencia interhemisférica, patrones de actividad alpha/theta, y estados 
        contemplativos medibles.
      </p>
      <p style={pStyle}>
        ADA traduce esta teoría a software: captura señales EEG con un Muse 2, las procesa en un pipeline 
        científico (análisis espectral, coherencia, entropía), y las visualiza como un cerebro 3D holográfico 
        donde la actividad neural se mapea a colores, formas y movimiento.
      </p>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 16 }}>
        <Badge color="#a78bfa">EEG · Muse 2</Badge>
        <Badge color="#3b82f6">VAE · PyTorch</Badge>
        <Badge color="#10b981">Three.js · R3F</Badge>
        <Badge color="#f59e0b">FastAPI · WebSocket</Badge>
        <Badge color="#ef4444">Teoría Sintérgica</Badge>
      </div>
    </Card>
  )
}

// ── Section: Objective ────────────────────────────────────────────────────────
function SectionObjective() {
  return (
    <Card id="objective" title="02 — OBJETIVO Y ALCANCE" accent="#3b82f6">
      <h4 style={h4Style}>Objetivo general</h4>
      <p style={pStyle}>
        Construir un sistema end-to-end que permita <strong>medir, validar científicamente, 
        y visualizar</strong> la actividad cerebral durante estados contemplativos, generando un 
        dataset personal de sesiones de meditación que sirva como ground truth para entrenar un 
        modelo de IA dedicado.
      </p>

      <h4 style={h4Style}>Objetivos específicos</h4>
      <ol style={{ ...pStyle, paddingLeft: 20 }}>
        <li>Implementar un protocolo de validación de 8 fases (30 min) basado en estándares clínicos de EEG</li>
        <li>Validar la señal contra fenómenos neurocientíficos establecidos (efecto Berger, reactividad cognitiva)</li>
        <li>Entrenar un VAE dedicado a Muse 2 con datos propios de meditación</li>
        <li>Desarrollar un guía contemplativo (SyntergicGuide) que responda en tiempo real al EEG</li>
        <li>Documentar el proceso como metodología reproducible para otros investigadores</li>
      </ol>

      <h4 style={h4Style}>Alcance</h4>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12, marginTop: 8 }}>
        {[
          { label: 'Hardware', value: 'Muse 2 (4 canales, 256Hz)', color: '#a78bfa' },
          { label: 'Sujetos fase 1', value: 'N=1 (investigador principal)', color: '#3b82f6' },
          { label: 'Sujetos fase 2', value: 'Experto meditación (yoga)', color: '#10b981' },
          { label: 'Sesiones objetivo', value: '20-30 sesiones válidas', color: '#f59e0b' },
          { label: 'Duración protocolo', value: '30 min × sesión', color: '#ef4444' },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ padding: '10px 14px', borderRadius: 8, background: `${color}11`, border: `1px solid ${color}33` }}>
            <div style={{ fontSize: '0.65rem', color: `${color}aa`, fontFamily: 'monospace' }}>{label}</div>
            <div style={{ fontSize: '0.8rem', color: '#e2e8f0', fontFamily: 'monospace', marginTop: 4 }}>{value}</div>
          </div>
        ))}
      </div>
    </Card>
  )
}

// ── Section: Theory ───────────────────────────────────────────────────────────
function SectionTheory() {
  return (
    <Card id="theory" title="03 — MARCO TEÓRICO" accent="#10b981">
      <h4 style={h4Style}>3.1 Bandas de frecuencia EEG</h4>
      <p style={pStyle}>
        La actividad eléctrica cerebral se descompone en bandas de frecuencia, cada una asociada a 
        estados cognitivos y de conciencia distintos. ADA mide las 5 bandas estándar en tiempo real:
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10, margin: '12px 0' }}>
        {BANDS.map(b => (
          <div key={b} style={{ padding: '12px 16px', borderRadius: 8, background: `${BAND_COLORS[b]}11`, border: `1px solid ${BAND_COLORS[b]}33` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '1.2rem', fontWeight: 700, color: BAND_COLORS[b], fontFamily: 'monospace' }}>
                {BAND_SYMBOL[b]}
              </span>
              <span style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.4)', fontFamily: 'monospace' }}>
                {BAND_RANGES[b]}
              </span>
            </div>
            <div style={{ fontSize: '0.75rem', color: '#e2e8f0', marginTop: 6 }}>
              <strong>{b.charAt(0).toUpperCase() + b.slice(1)}</strong>
            </div>
            <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.5)', marginTop: 4 }}>
              {{
                delta: 'Sueño profundo, inconsciente, procesos restaurativos. En meditación profunda: acceso a estados no-duales.',
                theta: 'Meditación profunda, creatividad, memoria. Dominante en Shamatha avanzado y estados hipnagógicos.',
                alpha: 'Relajación, coherencia. MÉTRICA PRIMARIA SINTÉRGICA. Aumenta al cerrar ojos (Berger) y en meditación.',
                beta: 'Concentración activa, procesamiento cognitivo. Aumenta con cálculo mental, decrece en meditación.',
                gamma: 'Insight, cognición superior, binding. Asociado a momentos de claridad y compasión en meditadores avanzados.',
              }[b]}
            </div>
          </div>
        ))}
      </div>

      <h4 style={h4Style}>3.2 Coherencia interhemisférica</h4>
      <p style={pStyle}>
        La <strong>coherencia</strong> mide la sincronización entre los hemisferios cerebrales. En la Teoría 
        Sintérgica, la coherencia es el indicador principal de <em>Sintergía</em> — la interacción armónica 
        entre el campo neuronal y la Lattice.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, margin: '12px 0' }}>
        <div style={{ padding: '12px 16px', borderRadius: 8, background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#10b981', fontFamily: 'monospace' }}>PLV (Phase Locking Value)</div>
          <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.5)', marginTop: 4 }}>
            Sincronización de fase instantánea entre hemisferios (TP9+AF7 vs AF8+TP10). 
            Más sensible para captar momentos de Sintergía que métricas espectrales.
          </div>
        </div>
        <div style={{ padding: '12px 16px', borderRadius: 8, background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#10b981', fontFamily: 'monospace' }}>MSC (Magnitude Squared Coherence)</div>
          <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.5)', marginTop: 4 }}>
            Correlación espectral entre canales en una banda específica (Welch). 
            Más robusta para coherencia sostenida a lo largo de la sesión.
          </div>
        </div>
      </div>

      <h4 style={h4Style}>3.3 Entropía espectral</h4>
      <p style={pStyle}>
        La <strong>entropía de Shannon</strong> aplicada al espectro de potencia EEG mide la 
        "dispersión" de la actividad cerebral. Baja entropía = pocas frecuencias dominantes = 
        estado coherente. Alta entropía = actividad dispersa = mente ocupada.
      </p>

      <h4 style={h4Style}>3.4 Teoría Sintérgica</h4>
      <p style={pStyle}>
        El Dr. Jacobo Grinberg propuso que la experiencia consciente emerge de la interacción entre 
        el <strong>campo neuronal</strong> (actividad electroquímica del cerebro) y la <strong>Lattice</strong> (estructura 
        informacional del espacio-tiempo). Esta interacción — <em>Sintergía</em> — produce:
      </p>
      <ul style={{ ...pStyle, paddingLeft: 20 }}>
        <li><strong>Coherencia aumentada</strong>: cuando el campo neuronal se "alinea" con la Lattice</li>
        <li><strong>Reducción de entropía</strong>: la mente se unifica, pocas frecuencias dominan</li>
        <li><strong>Alpha/theta sostenido</strong>: firma EEG de estados contemplativos profundos</li>
        <li><strong>Transferencia de potencial</strong>: el famoso experimento de Grinberg donde dos cerebros coherentes entre sí muestran correlación a distancia</li>
      </ul>

      <h4 style={h4Style}>3.5 Referencias científicas</h4>
      <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)', fontFamily: 'monospace', lineHeight: 1.8 }}>
        <div>• Cannard, C. et al. (2021) — Validación Muse para análisis espectral EEG</div>
        <div>• Travis, F. & Shear, J. (2010) — Categorías de meditación con firmas EEG distintas</div>
        <div>• Lutz, A. et al. (2004) — Gamma de larga distancia en meditadores budistas</div>
        <div>• Brandmeyer & Delorme (2018) — Meditación y coherencia EEG con Muse</div>
        <div>• Grinberg-Zylberbaum, J. (1994) — Transferencia de potencial entre sujetos correlacionados</div>
      </div>
    </Card>
  )
}

// ── Section: Architecture ─────────────────────────────────────────────────────
function SectionArchitecture() {
  const layers = [
    {
      name: 'Hardware · Captura',
      color: '#a78bfa',
      components: [
        { name: 'Muse 2', desc: '4 electrodos (TP9, AF7, AF8, TP10) · 256Hz · BLE', tech: 'muselsl · LSL' },
        { name: 'MuseConnector', desc: 'Conexión BLE, streaming, auto-reconnect, detección stale data', tech: 'Python · pylsl' },
      ]
    },
    {
      name: 'Backend · Procesamiento',
      color: '#3b82f6',
      components: [
        { name: 'SpectralAnalyzer', desc: 'PSD (Welch), bandas de frecuencia, corrección 1/f, frecuencia dominante', tech: 'scipy · numpy' },
        { name: 'CoherenceAnalyzer', desc: 'PLV (Hilbert), MSC (Welch), coherencia alpha interhemisférica', tech: 'scipy.signal' },
        { name: 'EntropyAnalyzer', desc: 'Entropía espectral (Shannon), sample entropy, entropía desde varianza', tech: 'numpy' },
        { name: 'SyntergicMetrics', desc: 'Orquestador: computa todas las métricas en una llamada', tech: 'Python' },
        { name: 'MuseFeatureExtractor', desc: 'Vector de 24 dims por ventana: 5 bandas × 4 ch + PLV + MSC + asimetría + θ/β', tech: 'numpy' },
      ]
    },
    {
      name: 'AI · Inferencia',
      color: '#f59e0b',
      components: [
        { name: 'SyntergicVAE', desc: 'Variational Autoencoder: encoder comprime EEG → espacio latente (Sintergia), decoder reconstruye', tech: 'PyTorch' },
        { name: 'SyntergicBrain (inference)', desc: 'Motor de inferencia: modos dataset/muse, suavizado temporal, focal point', tech: 'Python' },
        { name: 'MuseVAE (futuro)', desc: 'VAE dedicado 4ch: latent_dim=8, entrenado con datos propios de meditación', tech: 'PyTorch' },
      ]
    },
    {
      name: 'Storage · Datos',
      color: '#10b981',
      components: [
        { name: 'PostgreSQL', desc: 'Sesiones, metadatos, eventos, marcadores', tech: 'asyncpg' },
        { name: 'InfluxDB', desc: 'Series temporales EEG: ventanas de 2s, métricas por timestamp', tech: 'influxdb-client' },
        { name: 'Validation Logs', desc: 'JSON con resultados de tests científicos por sesión', tech: 'filesystem' },
      ]
    },
    {
      name: 'Frontend · Visualización',
      color: '#ef4444',
      components: [
        { name: 'SyntergicBrain (3D)', desc: 'Cerebro GLTF con shader GLSL: coloring regional por bandas, coherence glow, focal pulse', tech: 'R3F · Three.js' },
        { name: 'FrequencySpectrum', desc: 'Barras en tiempo real de las 5 bandas con corrección 1/f', tech: 'React' },
        { name: 'CoherenceMeter', desc: 'Medidor circular de coherencia interhemisférica', tech: 'React · SVG' },
        { name: 'MuseControl', desc: 'Conexión Muse, calibración (3 barreras de seguridad), streaming', tech: 'React' },
        { name: 'ProtocolOverlay', desc: 'UI del protocolo de validación: fases, timer, instrucciones', tech: 'React' },
      ]
    },
  ]

  return (
    <Card id="architecture" title="04 — ARQUITECTURA DEL SISTEMA" accent="#f59e0b">
      <h4 style={h4Style}>Pipeline end-to-end</h4>
      <div style={{ fontFamily: 'monospace', fontSize: '0.72rem', color: '#10b981', background: 'rgba(0,0,0,0.3)', padding: 16, borderRadius: 8, overflowX: 'auto', marginBottom: 16 }}>
        <div>Muse 2 (BLE) → muselsl → LSL 256Hz</div>
        <div style={{ paddingLeft: 16 }}>→ MuseConnector._stream_loop() → deque 10s × 4ch</div>
        <div style={{ paddingLeft: 32 }}>→ SpectralAnalyzer + CoherenceAnalyzer + EntropyAnalyzer</div>
        <div style={{ paddingLeft: 48 }}>→ SyntergicMetrics.compute_all()</div>
        <div style={{ paddingLeft: 64 }}>→ WebSocket 5Hz → Zustand Store → R3F useFrame</div>
        <div style={{ paddingLeft: 80 }}>→ SyntergicBrain shader uniforms (GPU)</div>
      </div>

      <h4 style={h4Style}>Capas del sistema</h4>
      {layers.map(layer => (
        <div key={layer.name} style={{ marginBottom: 16 }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 600, color: layer.color, fontFamily: 'monospace', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, background: layer.color }} />
            {layer.name}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 8, paddingLeft: 16 }}>
            {layer.components.map(c => (
              <div key={c.name} style={{ padding: '10px 14px', borderRadius: 6, background: `${layer.color}08`, borderLeft: `2px solid ${layer.color}44` }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#e2e8f0', fontFamily: 'monospace' }}>{c.name}</div>
                <div style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.5)', marginTop: 3 }}>{c.desc}</div>
                <div style={{ fontSize: '0.6rem', color: `${layer.color}88`, marginTop: 3, fontFamily: 'monospace' }}>{c.tech}</div>
              </div>
            ))}
          </div>
        </div>
      ))}

      <h4 style={h4Style}>Calibración — 3 barreras de seguridad</h4>
      <p style={pStyle}>
        Antes de cada sesión, el sistema ejecuta una calibración que valida que el hardware está 
        correctamente posicionado y capturando señal real:
      </p>
      <ol style={{ ...pStyle, paddingLeft: 20 }}>
        <li><strong>Calidad de señal ≥ 0.5</strong> con ≥2 electrodos con calidad ≥ 0.8 (detecta pocos electrodos con contacto)</li>
        <li><strong>Rango fisiológico</strong>: gamma &lt; 5000 µV², delta &lt; 10000 µV² (detecta ruido de línea / sin casco)</li>
        <li><strong>Coherencia &gt; 0.75</strong>: sin cerebro real, la coherencia es ~0.5-0.65 (ruido aleatorio)</li>
      </ol>
    </Card>
  )
}

// ── Section: Protocol ─────────────────────────────────────────────────────────
function SectionProtocol() {
  const phases = [
    { name: 'Baseline ojos abiertos', duration: '2 min', validates: 'Referencia alpha baja', icon: '👁' },
    { name: 'Baseline ojos cerrados', duration: '2 min', validates: 'Alpha reactivity (Berger)', icon: '🔒' },
    { name: 'Shamatha', duration: '5 min', validates: 'Theta + alpha buildup', icon: '🫁' },
    { name: 'Meditación libre', duration: '10 min', validates: 'Estado natural del practicante', icon: '🧘' },
    { name: 'Tarea cognitiva', duration: '1 min', validates: 'Beta/gamma activation', icon: '🧮' },
    { name: 'Recovery', duration: '3 min', validates: 'Transición beta → alpha', icon: '🌊' },
    { name: 'Meditación profunda', duration: '5 min', validates: 'Theta dominante, delta', icon: '🌌' },
    { name: 'Cierre', duration: '2 min', validates: 'Alpha suppression al abrir', icon: '🌅' },
  ]

  return (
    <Card id="protocol" title="05 — PROTOCOLO DE VALIDACIÓN" accent="#ef4444">
      <p style={pStyle}>
        Protocolo de 30 minutos basado en estándares clínicos de EEG, diseñado para validar 
        que el pipeline captura fenómenos neurocientíficos reales y generar datos de entrenamiento 
        con ground truth.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 10, margin: '16px 0' }}>
        {phases.map((p, i) => (
          <div key={i} style={{ padding: '12px 14px', borderRadius: 8, background: 'rgba(239, 68, 68, 0.06)', border: '1px solid rgba(239, 68, 68, 0.15)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{ fontSize: '1rem' }}>{p.icon}</span>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#e2e8f0', fontFamily: 'monospace' }}>
                Fase {i + 1}
              </span>
              <span style={{ fontSize: '0.65rem', color: '#ef4444', fontFamily: 'monospace', marginLeft: 'auto' }}>{p.duration}</span>
            </div>
            <div style={{ fontSize: '0.72rem', color: '#e2e8f0' }}>{p.name}</div>
            <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>{p.validates}</div>
          </div>
        ))}
      </div>

      <h4 style={h4Style}>Metadatos por sesión</h4>
      <p style={pStyle}>
        Cada sesión registra: hora del día, calidad de sueño (1-5), cafeína (sí/no), 
        minutos de meditación previa, estado subjetivo pre/post (1-10). Estos metadatos 
        permiten correlacionar condiciones ambientales con calidad de señal.
      </p>
    </Card>
  )
}

// ── Section: Validation Tests ─────────────────────────────────────────────────
function SectionValidation({ validations }) {
  const navigate = useNavigate()
  return (
    <Card id="validation" title="06 — TESTS DE VALIDACIÓN CIENTÍFICA" accent="#8b5cf6">
      <p style={pStyle}>
        Tres tests automatizados validan que la señal EEG capturada corresponde a actividad 
        neural real y no a artefactos o ruido:
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12, margin: '16px 0' }}>
        {/* Berger */}
        <div style={{ padding: '16px', borderRadius: 8, background: 'rgba(139, 92, 246, 0.06)', border: '1px solid rgba(139, 92, 246, 0.2)' }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#a78bfa', fontFamily: 'monospace' }}>Test 1: Efecto Berger</div>
          <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.5)', marginTop: 6 }}>
            Alpha DEBE aumentar al cerrar los ojos vs abiertos. Es el fenómeno EEG más 
            fundamental y reproducible, descubierto por Hans Berger en 1929.
          </div>
          <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.3)', marginTop: 8, fontFamily: 'monospace' }}>
            ratio = α(ojos cerrados) / α(ojos abiertos)<br />
            Excelente: &gt;2.0× | Bueno: &gt;1.5× | Marginal: &gt;1.1× | Falla: &lt;1.1×
          </div>
        </div>

        {/* Cognitive */}
        <div style={{ padding: '16px', borderRadius: 8, background: 'rgba(139, 92, 246, 0.06)', border: '1px solid rgba(139, 92, 246, 0.2)' }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#a78bfa', fontFamily: 'monospace' }}>Test 2: Reactividad Cognitiva</div>
          <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.5)', marginTop: 6 }}>
            Beta y gamma DEBEN aumentar durante cálculo mental (restar de 7 en 7 desde 1000) 
            vs fase de meditación previa. Valida detección de engagement cognitivo.
          </div>
          <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.3)', marginTop: 8, fontFamily: 'monospace' }}>
            ratio = β(cognitivo) / β(meditación)<br />
            Aprobado: β ratio &gt;1.2× AND γ ratio &gt;1.1×
          </div>
        </div>

        {/* Coherence */}
        <div style={{ padding: '16px', borderRadius: 8, background: 'rgba(139, 92, 246, 0.06)', border: '1px solid rgba(139, 92, 246, 0.2)' }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#a78bfa', fontFamily: 'monospace' }}>Test 3: Estabilidad de Coherencia</div>
          <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.5)', marginTop: 6 }}>
            La coherencia PLV debe cambiar suavemente (autocorrelación alta), no saltar 
            aleatoriamente. Ruido produce autocorrelación ~0, señal neural real &gt;0.5.
          </div>
          <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.3)', marginTop: 8, fontFamily: 'monospace' }}>
            autocorr = correlation(PLV[t], PLV[t-1])<br />
            Excelente: &gt;0.7 | Aceptable: &gt;0.5 | Falla: &lt;0.5
          </div>
        </div>
      </div>

      {/* Validation results table */}
      {validations && validations.length > 0 && (
        <>
          <h4 style={h4Style}>Resultados por sesión</h4>
          <Table
            headers={['Sesión', 'Grade', 'Score', 'Berger', 'Cognitivo', 'Coherencia', 'Ventanas', 'Usable']}
            rows={validations.map(v => {
              const q = v.quality_score || {}
              const val = v.validation || {}
              const berger = val.berger_effect || {}
              const cognitive = val.cognitive_reactivity || {}
              const coherence = val.coherence_stability || {}
              return [
                <span
                  onClick={() => navigate(`/lab/brain/doc/session/${v.session_id}`)}
                  style={{ color: '#8b5cf6', cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 3 }}
                >#{v.session_id}</span>,
                <span style={{ color: GRADE_COLORS[q.grade] || '#9ca3af', fontWeight: 700 }}>{q.grade || '—'}</span>,
                (q.quality_score || 0).toFixed(1),
                <span style={{ color: berger.passed ? '#10b981' : '#ef4444' }}>
                  {berger.passed ? '✓' : '✗'} {(berger.ratio || 0).toFixed(2)}×
                </span>,
                <span style={{ color: cognitive.passed ? '#10b981' : '#ef4444' }}>
                  {cognitive.passed ? '✓' : '✗'} β{(cognitive.beta_ratio || 0).toFixed(2)}×
                </span>,
                <span style={{ color: coherence.passed ? '#10b981' : '#ef4444' }}>
                  {coherence.passed ? '✓' : '✗'} {(coherence.autocorrelation || 0).toFixed(2)}
                </span>,
                v.metrics_found || '—',
                q.usable_for_training ? <Badge color="#10b981">Sí</Badge> : <Badge color="#ef4444">No</Badge>,
              ]
            })}
          />
        </>
      )}
    </Card>
  )
}

// ── Section: Datasets ─────────────────────────────────────────────────────────
function SectionDatasets({ data }) {
  const sessions = data?.sessions || []
  const validations = data?.validations || []
  const protocolLogs = data?.protocol_logs || []

  // Build session map from validations
  const validatedIds = new Set(validations.map(v => v.session_id))

  const completeSessions = protocolLogs.filter(l => l.complete).length
  const partialSessions = protocolLogs.filter(l => !l.complete).length
  const usableSessions = validations.filter(v => v.quality_score?.usable_for_training).length
  const avgScore = validations.length > 0
    ? (validations.reduce((acc, v) => acc + (v.quality_score?.quality_score || 0), 0) / validations.length).toFixed(1)
    : '—'

  return (
    <Card id="datasets" title="07 — DATASETS DE ENTRENAMIENTO" accent="#3b82f6">
      <p style={pStyle}>
        El dataset se construye sesión a sesión con el investigador principal. Cada sesión de 30 min 
        genera ~8500 ventanas de 2 segundos × 4 canales @ 256Hz. El objetivo mínimo viable es 10 sesiones 
        valid (score ≥ 50), idealmente 20-30 para el MuseVAE.
      </p>

      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', margin: '16px 0', justifyContent: 'center' }}>
        <Stat label="Sesiones totales" value={sessions.length} color="#3b82f6" />
        <Stat label="Protocolo completo" value={completeSessions} color="#10b981" />
        <Stat label="Protocolo parcial" value={partialSessions} color="#f59e0b" />
        <Stat label="Validadas" value={validations.length} color="#a78bfa" />
        <Stat label="Usables (training)" value={usableSessions} color="#10b981" />
        <Stat label="Score promedio" value={avgScore} color="#e2e8f0" />
      </div>

      {/* Progress bar toward 20 sessions */}
      <div style={{ margin: '16px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.5)', fontFamily: 'monospace' }}>
            Progreso hacia 20 sesiones usables
          </span>
          <span style={{ fontSize: '0.7rem', color: '#3b82f6', fontFamily: 'monospace' }}>
            {usableSessions}/20
          </span>
        </div>
        <div style={{ width: '100%', height: 8, background: 'rgba(255,255,255,0.08)', borderRadius: 4 }}>
          <div style={{
            width: `${Math.min(100, (usableSessions / 20) * 100)}%`,
            height: '100%', background: 'linear-gradient(90deg, #3b82f6, #10b981)',
            borderRadius: 4, transition: 'width 1s ease',
          }} />
        </div>
      </div>

      {/* Protocol logs timeline */}
      {protocolLogs.length > 0 && (
        <>
          <h4 style={h4Style}>Historial de protocolo</h4>
          <Table
            compact
            headers={['Fecha', 'Nombre', 'Fases', 'Estado', 'Sueño', 'Cafeína']}
            rows={protocolLogs.map(l => [
              l.start_iso ? new Date(l.start_iso).toLocaleDateString('es-AR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—',
              l.metadata?.name || '—',
              `${l.phases_completed}/${l.total_phases}`,
              l.complete ? <Badge color="#10b981">Completo</Badge> : <Badge color="#f59e0b">Parcial</Badge>,
              l.metadata?.sleep_quality || '—',
              l.metadata?.caffeine === false ? 'No' : l.metadata?.caffeine === true ? 'Sí' : '—',
            ])}
          />
        </>
      )}

      <h4 style={h4Style}>Feature vector (24 dimensiones)</h4>
      <p style={pStyle}>
        Cada ventana de 2s se convierte en un vector de 24 features para el MuseVAE:
      </p>
      <div style={{ fontFamily: 'monospace', fontSize: '0.68rem', color: '#10b981', background: 'rgba(0,0,0,0.3)', padding: 12, borderRadius: 6, overflowX: 'auto' }}>
        <div>[0:20]  5 bandas × 4 canales (δ, θ, α, β, γ per TP9, AF7, AF8, TP10)</div>
        <div>[20]    PLV interhemisférica (Hilbert)</div>
        <div>[21]    MSC banda alpha (Welch)</div>
        <div>[22]    Asimetría frontal alpha: log(AF8_α / AF7_α)</div>
        <div>[23]    Ratio global θ/β</div>
      </div>
    </Card>
  )
}

// ── Section: Progress ─────────────────────────────────────────────────────────
function SectionProgress({ validations }) {
  const navigate = useNavigate()
  if (!validations || validations.length === 0) return null

  // Sort by session_id
  const sorted = [...validations].sort((a, b) => (a.session_id || 0) - (b.session_id || 0))

  return (
    <Card id="progress" title="08 — PROGRESO Y ANÁLISIS" accent="#10b981">
      <p style={pStyle}>
        Evolución de la calidad de señal y scores a lo largo de las sesiones. 
        El objetivo es observar mejoras en el efecto Berger, coherencia, y score general 
        a medida que tanto el practicante como el sistema mejoran.
      </p>

      {/* Score timeline visualization */}
      <h4 style={h4Style}>Evolución de scores</h4>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 120, padding: '8px 0' }}>
        {sorted.map(v => {
          const score = v.quality_score?.quality_score || 0
          const grade = v.quality_score?.grade || '?'
          return (
            <div key={v.session_id} onClick={() => navigate(`/lab/brain/doc/session/${v.session_id}`)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, cursor: 'pointer' }} title={`Ver sesión #${v.session_id}`}>
              <span style={{ fontSize: '0.6rem', color: GRADE_COLORS[grade] || '#9ca3af', fontWeight: 700, fontFamily: 'monospace' }}>
                {grade}
              </span>
              <div style={{
                width: '100%', maxWidth: 40,
                height: `${Math.max(4, score)}%`,
                background: `${GRADE_COLORS[grade] || '#9ca3af'}66`,
                border: `1px solid ${GRADE_COLORS[grade] || '#9ca3af'}`,
                borderRadius: '4px 4px 0 0',
                marginTop: 4,
              }} />
              <span style={{ fontSize: '0.55rem', color: 'rgba(255,255,255,0.4)', fontFamily: 'monospace', marginTop: 4 }}>
                #{v.session_id}
              </span>
            </div>
          )
        })}
      </div>

      {/* Detailed comparison */}
      <h4 style={h4Style}>Comparativa detallada</h4>
      {sorted.map(v => {
        const q = v.quality_score || {}
        const components = q.components || {}
        return (
          <div key={v.session_id} style={{ marginBottom: 12, padding: '12px 16px', borderRadius: 8, background: 'rgba(0,0,0,0.2)', border: `1px solid ${GRADE_COLORS[q.grade] || '#9ca3af'}33` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span onClick={() => navigate(`/lab/brain/doc/session/${v.session_id}`)} style={{ fontSize: '0.8rem', fontWeight: 600, color: '#8b5cf6', fontFamily: 'monospace', cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 3 }}>
                Sesión #{v.session_id}
              </span>
              <span style={{ fontSize: '1.2rem', fontWeight: 700, color: GRADE_COLORS[q.grade] || '#9ca3af', fontFamily: 'monospace' }}>
                {q.grade} · {(q.quality_score || 0).toFixed(1)}
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
              {Object.entries(components).map(([key, val]) => (
                <MiniBar
                  key={key}
                  label={key.replace('_score', '').slice(0, 4)}
                  value={typeof val === 'object' ? (val?.score || 0) : (val || 0)}
                  max={100}
                  color={GRADE_COLORS[q.grade] || '#9ca3af'}
                  width={60}
                />
              ))}
            </div>
          </div>
        )
      })}

      <h4 style={h4Style}>Aprendizajes clave</h4>
      <ul style={{ ...pStyle, paddingLeft: 20 }}>
        <li><strong>Sesiones matutinas</strong> (antes de 10am) muestran mejor alpha que las vespertinas</li>
        <li><strong>Sin cafeína</strong> mejora la coherencia basal</li>
        <li><strong>Tarea cognitiva en voz baja</strong> (993, 986, 979...) genera mejor spike de beta</li>
        <li><strong>Mandíbula relajada</strong> previene artefactos musculares (gamma en reposo)</li>
        <li><strong>Contacto de electrodos</strong>: humedecer piel detrás de las orejas mejora TP9/TP10</li>
      </ul>
    </Card>
  )
}

// ── Section: Roadmap ──────────────────────────────────────────────────────────
function SectionRoadmap() {
  const milestones = [
    {
      version: 'V1', name: 'Protocolo de validación', status: 'complete',
      items: [
        'Protocolo de 8 fases (30 min)',
        'SessionRecorderV2 (PostgreSQL + InfluxDB)',
        'Tests: Berger, cognitivo, coherencia',
        'SessionQualityScore (A-F grading)',
        'Calibración con 3 barreras de seguridad',
      ]
    },
    {
      version: 'V2', name: 'Quality scoring', status: 'complete',
      items: [
        'Score compuesto 0-100',
        'Detección de artefactos musculares',
        'Signal quality por ventana en InfluxDB',
        'Corrección 1/f para display de bandas',
      ]
    },
    {
      version: 'V3', name: 'MuseVAE training', status: 'in-progress',
      items: [
        'MuseFeatureExtractor (24 dims)',
        'MuseVAE architecture (latent_dim=8)',
        'Contrastive loss (phase-aware)',
        'Reemplazar heurístico por VAE en inferencia',
        'Requiere: ~10 sesiones usables',
      ]
    },
    {
      version: 'V4', name: 'SyntergicGuide', status: 'planned',
      items: [
        'Guía contemplativo en tiempo real',
        'Modo 1: intervenciones mínimas durante sesión',
        'Modo 2: análisis post-sesión narrativo',
        'Modo 3: coach de progreso longitudinal',
        'ElevenLabs TTS para voz del guía',
      ]
    },
    {
      version: 'V5', name: 'Multi-sujeto', status: 'planned',
      items: [
        'Perfiles por practicante',
        'Maestra de yoga como sujeto experto',
        'Comparativa novato vs experto',
        'Ice bath protocol (futuro)',
      ]
    },
    {
      version: 'V6', name: 'Publicación', status: 'planned',
      items: [
        'Paper: EEG consumer para meditación',
        'Dataset público (sesiones anonimizadas)',
        'Framework open-source',
        'Validación cruzada con Mind Monitor',
      ]
    },
  ]

  const statusColors = { complete: '#10b981', 'in-progress': '#f59e0b', planned: '#6b7280' }
  const statusLabels = { complete: 'Completado', 'in-progress': 'En progreso', planned: 'Planificado' }

  return (
    <Card id="roadmap" title="09 — ROADMAP" accent="#6366f1">
      <div style={{ position: 'relative', paddingLeft: 24 }}>
        {/* Vertical line */}
        <div style={{ position: 'absolute', left: 7, top: 0, bottom: 0, width: 2, background: 'rgba(255,255,255,0.1)' }} />
        
        {milestones.map((m, i) => (
          <div key={m.version} style={{ position: 'relative', marginBottom: 24, paddingLeft: 16 }}>
            {/* Dot */}
            <div style={{
              position: 'absolute', left: -20, top: 4, width: 12, height: 12, borderRadius: '50%',
              background: statusColors[m.status], border: '2px solid rgba(0,0,0,0.5)',
            }} />
            
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#e2e8f0', fontFamily: 'monospace' }}>
                {m.version}
              </span>
              <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.6)' }}>{m.name}</span>
              <Badge color={statusColors[m.status]}>{statusLabels[m.status]}</Badge>
            </div>
            
            <ul style={{ margin: 0, paddingLeft: 16, listStyle: 'none' }}>
              {m.items.map((item, j) => (
                <li key={j} style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)', padding: '2px 0', fontFamily: 'monospace' }}>
                  <span style={{ color: statusColors[m.status], marginRight: 6 }}>
                    {m.status === 'complete' ? '✓' : m.status === 'in-progress' ? '○' : '·'}
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </Card>
  )
}

// ── Shared styles ─────────────────────────────────────────────────────────────
const pStyle = {
  fontSize: '0.78rem', color: 'rgba(255,255,255,0.6)', lineHeight: 1.7,
  margin: '8px 0',
}
const h4Style = {
  fontSize: '0.85rem', fontWeight: 600, color: '#e2e8f0',
  margin: '20px 0 8px 0', fontFamily: 'monospace',
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function BrainDoc() {
  const navigate = useNavigate()
  const { data, loading, error, reload } = useDashboardData()
  const [activeSection, setActiveSection] = useState('intro')

  // Track scroll position for nav highlighting
  useEffect(() => {
    const handler = () => {
      const sections = NAV_SECTIONS.map(s => document.getElementById(s.id)).filter(Boolean)
      for (let i = sections.length - 1; i >= 0; i--) {
        const rect = sections[i].getBoundingClientRect()
        if (rect.top <= 120) {
          setActiveSection(NAV_SECTIONS[i].id)
          break
        }
      }
    }
    const container = document.getElementById('doc-scroll')
    if (container) container.addEventListener('scroll', handler)
    return () => container?.removeEventListener('scroll', handler)
  }, [])

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'linear-gradient(180deg, #0a0a14 0%, #0f0f1e 50%, #0a0a14 100%)',
      color: '#e2e8f0', overflow: 'hidden',
      display: 'flex',
    }}>
      {/* ─── Left sidebar nav ─── */}
      <nav style={{
        width: 200, minWidth: 200, height: '100vh',
        borderRight: '1px solid rgba(255,255,255,0.06)',
        padding: '20px 0', display: 'flex', flexDirection: 'column',
        overflowY: 'auto',
      }}>
        {/* Back button */}
        <button
          onClick={() => navigate('/lab/brain')}
          style={{
            background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)',
            fontSize: '0.72rem', fontFamily: 'monospace', cursor: 'pointer',
            padding: '8px 16px', textAlign: 'left',
            transition: 'color 0.2s',
          }}
          onMouseEnter={e => e.currentTarget.style.color = '#e2e8f0'}
          onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.4)'}
        >
          ← ADA
        </button>

        {/* Title */}
        <div style={{ padding: '12px 16px', marginBottom: 8 }}>
          <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.3)', fontFamily: 'monospace', letterSpacing: '0.1em' }}>
            .RANDOM() / LAB
          </div>
          <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#e2e8f0', fontFamily: 'monospace', marginTop: 4 }}>
            ADA · DOC
          </div>
        </div>

        {/* Nav items */}
        {NAV_SECTIONS.map(s => (
          <button
            key={s.id}
            onClick={() => {
              const el = document.getElementById(s.id)
              if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
            }}
            style={{
              background: activeSection === s.id ? 'rgba(99, 102, 241, 0.12)' : 'transparent',
              border: 'none', borderLeft: activeSection === s.id ? '2px solid #6366f1' : '2px solid transparent',
              color: activeSection === s.id ? '#e2e8f0' : 'rgba(255,255,255,0.35)',
              fontSize: '0.7rem', fontFamily: 'monospace',
              padding: '8px 16px', textAlign: 'left',
              cursor: 'pointer', transition: 'all 0.2s',
            }}
            onMouseEnter={e => { if (activeSection !== s.id) e.currentTarget.style.color = 'rgba(255,255,255,0.6)' }}
            onMouseLeave={e => { if (activeSection !== s.id) e.currentTarget.style.color = 'rgba(255,255,255,0.35)' }}
          >
            {s.label}
          </button>
        ))}

        {/* Status */}
        <div style={{ marginTop: 'auto', padding: '12px 16px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          {loading ? (
            <div style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.3)', fontFamily: 'monospace' }}>
              Cargando datos...
            </div>
          ) : error ? (
            <div style={{ fontSize: '0.6rem', color: '#ef4444', fontFamily: 'monospace' }}>
              Error: {error}
              <button onClick={reload} style={{ display: 'block', marginTop: 4, background: 'none', border: 'none', color: '#3b82f6', fontSize: '0.6rem', cursor: 'pointer', fontFamily: 'monospace', padding: 0 }}>
                Reintentar
              </button>
            </div>
          ) : (
            <div style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.3)', fontFamily: 'monospace' }}>
              {data?.total_sessions || 0} sesiones<br />
              {data?.total_validations || 0} validaciones
            </div>
          )}
        </div>
      </nav>

      {/* ─── Main content ─── */}
      <main
        id="doc-scroll"
        style={{
          flex: 1, overflowY: 'auto', padding: '32px 40px',
          maxWidth: 900, margin: '0 auto',
        }}
      >
        {/* Header */}
        <header style={{ marginBottom: 32 }}>
          <h1 style={{
            fontSize: '1.6rem', fontWeight: 700, color: '#e2e8f0',
            fontFamily: 'monospace', margin: 0, letterSpacing: '-0.02em',
          }}>
            ADA — Documentación Científica
          </h1>
          <p style={{
            fontSize: '0.78rem', color: 'rgba(255,255,255,0.4)',
            fontFamily: 'monospace', margin: '8px 0 0 0',
          }}>
            Análisis de Datos de Actividad cerebral · Random Lab · Marzo 2026
          </p>
          <p style={{
            fontSize: '0.7rem', color: 'rgba(255,255,255,0.3)',
            margin: '4px 0 0 0',
          }}>
            Pedro Nassiff — CTO / Investigador principal
          </p>
        </header>

        {/* Content sections */}
        <SectionIntro />
        <SectionObjective />
        <SectionTheory />
        <SectionArchitecture />
        <SectionProtocol />
        <SectionValidation validations={data?.validations} />
        <SectionDatasets data={data} />
        <SectionProgress validations={data?.validations} />
        <SectionRoadmap />

        {/* Footer */}
        <footer style={{
          textAlign: 'center', padding: '40px 0 60px',
          fontSize: '0.65rem', color: 'rgba(255,255,255,0.2)', fontFamily: 'monospace',
        }}>
          <div>"La realidad es el resultado de la interacción entre el Campo Neuronal y la Lattice."</div>
          <div style={{ marginTop: 4 }}>— Jacobo Grinberg</div>
          <div style={{ marginTop: 12 }}>ADA · Random Lab · {new Date().getFullYear()}</div>
        </footer>
      </main>
    </div>
  )
}
