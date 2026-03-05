import React, { useState, useCallback, useEffect, useRef, useReducer } from 'react'
import { useBrainStore } from '../lab-core/brain/store.js'
import referenceData from './analisis-datasets/reference_data.json'

const API = 'http://localhost:8000'

// ── Paleta / constantes ───────────────────────────────────────────────────────
const BANDS = ['delta', 'theta', 'alpha', 'beta', 'gamma']
const BAND_LABEL = { delta: 'δ', theta: 'θ', alpha: 'α', beta: 'β', gamma: 'γ' }
const BAND_COLORS = {
  delta: '#60a5fa', theta: '#34d399', alpha: '#a78bfa', beta: '#fbbf24', gamma: '#f87171'
}
const STATE_C = {
  deep_relaxation: { bg: 'bg-blue-900/40',   text: 'text-blue-300',   dot: '#60a5fa' },
  meditation:      { bg: 'bg-purple-900/40',  text: 'text-purple-300', dot: '#c084fc' },
  deep_meditation: { bg: 'bg-violet-900/40',  text: 'text-violet-300', dot: '#a78bfa' },
  relaxed:         { bg: 'bg-teal-900/40',    text: 'text-teal-300',   dot: '#5eead4' },
  focused:         { bg: 'bg-amber-900/40',   text: 'text-amber-300',  dot: '#fbbf24' },
  transitioning:   { bg: 'bg-gray-800/40',    text: 'text-gray-400',   dot: '#9ca3af' },
  insight:         { bg: 'bg-pink-900/40',    text: 'text-pink-300',   dot: '#f472b6' },
}

// ── Hooks de datos ────────────────────────────────────────────────────────────
function useSessions() {
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const r = await fetch(`${API}/sessions?limit=200`)
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      const data = await r.json()
      setSessions(data.sessions ?? [])
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])
  return { sessions, loading, error, reload: load }
}

const metricsCache = {}
function useRecordingMetrics(id) {
  const [state, dispatch] = useReducer((s, a) => ({ ...s, ...a }), { data: null, loading: false, error: null })

  useEffect(() => {
    if (!id) return
    if (metricsCache[id]) { dispatch({ data: metricsCache[id], loading: false, error: null }); return }
    dispatch({ loading: true, error: null })
    fetch(`${API}/sessions/${id}/metrics`)
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })
      .then(d => { const m = d.metrics ?? d; metricsCache[id] = m; dispatch({ data: m, loading: false }) })
      .catch(e => dispatch({ error: e.message, loading: false }))
  }, [id])

  return state
}

// ── Atoms ─────────────────────────────────────────────────────────────────────
function StateBadge({ state }) {
  const c = STATE_C[state] || STATE_C.transitioning
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${c.bg} ${c.text}`}>
      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: c.dot }} />
      {state}
    </span>
  )
}

function Bar({ value, color, maxVal = 0.8 }) {
  const pct = Math.min(100, (value / maxVal) * 100)
  return (
    <div className="flex items-center gap-1">
      <div className="w-14 h-1.5 bg-white/5 rounded-full overflow-hidden flex-shrink-0">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <span className="text-[10px] font-mono text-white/50 w-8 text-right flex-shrink-0">
        {(value * 100).toFixed(1)}
      </span>
    </div>
  )
}

function Delta({ a, b }) {
  if (b == null || a == null) return null
  const d = a - b
  const abs = Math.abs(d)
  const cls = abs <= 0.02 ? 'text-white/20' : abs <= 0.06 ? 'text-yellow-400' : 'text-red-400'
  return (
    <span className={`text-[9px] font-mono ${cls} ml-0.5`}>
      {d > 0 ? '+' : ''}{(d * 100).toFixed(1)}
    </span>
  )
}

// ── Sidebar ───────────────────────────────────────────────────────────────────
function QualityDot({ q }) {
  const color = q >= 0.9 ? '#34d399' : q >= 0.6 ? '#fbbf24' : '#f87171'
  return <span className="w-2 h-2 rounded-full flex-shrink-0 inline-block" style={{ backgroundColor: color }} />
}

function RecordingItem({ rec, active, onClick }) {
  const date = rec.started_at ? new Date(rec.started_at).toLocaleString('es', {
    month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit'
  }) : '–'
  const dur = rec.duration_seconds ? `${Math.round(rec.duration_seconds)}s` : '–'
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-2.5 border-b border-white/[0.04] transition-colors flex items-start gap-2 group
        ${active ? 'bg-white/[0.06] border-l-2 border-l-purple-500' : 'hover:bg-white/[0.03] border-l-2 border-l-transparent'}`}
    >
      <QualityDot q={rec.avg_signal_quality ?? 0} />
      <div className="flex-1 min-w-0">
        <p className="text-[11px] text-white/80 font-medium truncate leading-tight">{rec.name || `Grabación #${rec.id}`}</p>
        <p className="text-[9px] text-white/30 mt-0.5">{date} · {dur}</p>
        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
          {rec.calibration_passed && (
            <span className="text-[8px] text-green-400 bg-green-900/30 px-1 py-0.5 rounded">CAL ✓</span>
          )}
          {rec.avg_coherence != null && (
            <span className="text-[8px] text-purple-300 font-mono">coh {rec.avg_coherence.toFixed(2)}</span>
          )}
          {rec.avg_alpha != null && (
            <span className="text-[8px] text-purple-300/60 font-mono">α {rec.avg_alpha.toFixed(3)}</span>
          )}
        </div>
      </div>
    </button>
  )
}

function Sidebar({ sessions, loading, error, selected, onSelect, onReload }) {
  const [q, setQ] = useState('')
  const filtered = q
    ? sessions.filter(s => (s.name || '').toLowerCase().includes(q.toLowerCase()) || String(s.id).includes(q))
    : sessions

  return (
    <div className="w-64 flex-shrink-0 border-r border-white/[0.06] flex flex-col h-full">
      <div className="px-3 py-3 border-b border-white/[0.06]">
        <p className="text-[10px] text-white/30 uppercase tracking-widest mb-2">Grabaciones</p>
        <input
          value={q} onChange={e => setQ(e.target.value)}
          placeholder="Buscar…"
          className="w-full bg-white/[0.04] border border-white/[0.08] rounded px-2 py-1 text-[11px] text-white/70
            placeholder-white/20 focus:outline-none focus:border-purple-500/50"
        />
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading && <p className="text-[10px] text-white/20 p-3">Cargando…</p>}
        {error && <p className="text-[10px] text-red-400 p-3">Error: {error}</p>}
        {!loading && !error && filtered.length === 0 && (
          <p className="text-[10px] text-white/15 p-3">Sin grabaciones</p>
        )}
        {filtered.map(s => (
          <RecordingItem key={s.id} rec={s} active={selected?.id === s.id} onClick={() => onSelect(s)} />
        ))}
      </div>

      <div className="px-3 py-2 border-t border-white/[0.06] flex items-center justify-between">
        <span className="text-[9px] text-white/20">{sessions.length} grabaciones</span>
        <button onClick={onReload} className="text-[9px] text-white/30 hover:text-white/60 transition-colors">⟳ recargar</button>
      </div>
    </div>
  )
}

// ── BandTimechart (SVG) ───────────────────────────────────────────────────────
function BandTimechart({ band, metrics }) {
  const color = BAND_COLORS[band]
  const vals  = metrics.map(m => m[band] ?? 0)
  const max   = Math.max(...vals, 0.001)
  const W = 600, H = 48
  const pts = vals.map((v, i) => `${(i / (vals.length - 1 || 1)) * W},${H - (v / max) * H * 0.9}`)
  const poly = pts.join(' ')
  const area = `${pts.join(' ')} ${W},${H} 0,${H}`

  return (
    <div>
      <div className="flex items-center justify-between mb-0.5">
        <span className="text-[10px]" style={{ color }}>{BAND_LABEL[band]} {band}</span>
        <span className="text-[9px] font-mono text-white/20">máx {max.toFixed(4)}</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-10" preserveAspectRatio="none">
        <defs>
          <linearGradient id={`g-${band}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.3" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon points={area} fill={`url(#g-${band})`} />
        <polyline points={poly} fill="none" stroke={color} strokeWidth="1.5" />
      </svg>
    </div>
  )
}

// ── StateTimeline ─────────────────────────────────────────────────────────────
function StateTimeline({ metrics }) {
  const total = metrics.length
  if (!total) return null

  const runs = []
  let cur = null
  metrics.forEach((m, i) => {
    const s = m.state || 'transitioning'
    if (s !== cur?.state) { cur = { state: s, start: i, count: 1 }; runs.push(cur) }
    else cur.count++
  })

  return (
    <div>
      <p className="text-[9px] text-white/30 uppercase tracking-wider mb-1">Estado en el tiempo</p>
      <div className="flex h-4 rounded overflow-hidden gap-px">
        {runs.map((r, i) => {
          const c = STATE_C[r.state] || STATE_C.transitioning
          const w = ((r.count / total) * 100).toFixed(2)
          return (
            <div key={i} style={{ width: `${w}%`, backgroundColor: c.dot, opacity: 0.7 }}
              title={`${r.state} (${r.count} muestras)`} />
          )
        })}
      </div>
      <div className="flex items-center gap-3 mt-1 flex-wrap">
        {[...new Set(runs.map(r => r.state))].map(s => (
          <span key={s} className="flex items-center gap-1 text-[9px] text-white/40">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: (STATE_C[s] || STATE_C.transitioning).dot }} />
            {s}
          </span>
        ))}
      </div>
    </div>
  )
}

// ── TabBandas ─────────────────────────────────────────────────────────────────
function TabBandas({ rec, metrics }) {
  if (!metrics || metrics.length === 0) return (
    <p className="text-[11px] text-white/30 p-6">Sin datos de métricas en InfluxDB para esta grabación.</p>
  )

  const avgBand = band => metrics.reduce((s, m) => s + (m[band] ?? 0), 0) / metrics.length

  return (
    <div className="p-5 space-y-6">
      <div className="flex gap-3 flex-wrap">
        {BANDS.map(b => (
          <div key={b} className="bg-white/[0.04] rounded-lg px-3 py-2 flex flex-col items-center">
            <span className="text-[10px]" style={{ color: BAND_COLORS[b] }}>{BAND_LABEL[b]}</span>
            <span className="text-sm font-mono text-white/80 mt-0.5">{(avgBand(b) * 100).toFixed(1)}%</span>
          </div>
        ))}
        <div className="bg-white/[0.04] rounded-lg px-3 py-2 flex flex-col items-center">
          <span className="text-[10px] text-purple-300">coh</span>
          <span className="text-sm font-mono text-white/80 mt-0.5">
            {(metrics.reduce((s, m) => s + (m.coherence ?? 0), 0) / metrics.length).toFixed(3)}
          </span>
        </div>
      </div>

      <StateTimeline metrics={metrics} />

      <div className="space-y-4">
        {BANDS.map(b => <BandTimechart key={b} band={b} metrics={metrics} />)}
      </div>
    </div>
  )
}

// ── TabInfo ───────────────────────────────────────────────────────────────────
function TabInfo({ rec, metrics }) {
  const rows = [
    ['ID', rec.id],
    ['Nombre', rec.name || '–'],
    ['Inicio', rec.started_at ? new Date(rec.started_at).toLocaleString('es') : '–'],
    ['Fin', rec.ended_at ? new Date(rec.ended_at).toLocaleString('es') : '–'],
    ['Duración', rec.duration_seconds ? `${rec.duration_seconds.toFixed(1)}s` : '–'],
    ['Muestras', rec.sample_count ?? '–'],
    ['Métricas', rec.metrics_count ?? '–'],
    ['Señal media', rec.avg_signal_quality != null ? rec.avg_signal_quality.toFixed(3) : '–'],
    ['Calibrado', rec.calibration_passed ? '✓ sí' : '✗ no'],
    ['Coherencia media', rec.avg_coherence != null ? rec.avg_coherence.toFixed(3) : '–'],
    ['Coherencia pico', rec.peak_coherence != null ? rec.peak_coherence.toFixed(3) : '–'],
    ['α media', rec.avg_alpha != null ? rec.avg_alpha.toFixed(4) : '–'],
    ['θ media', rec.avg_theta != null ? rec.avg_theta.toFixed(4) : '–'],
    ['δ media', rec.avg_delta != null ? rec.avg_delta.toFixed(4) : '–'],
    ['β media', rec.avg_beta != null ? rec.avg_beta.toFixed(4) : '–'],
    ['γ media', rec.avg_gamma != null ? rec.avg_gamma.toFixed(4) : '–'],
    ['Tags', rec.tags ? JSON.stringify(rec.tags) : '–'],
    ['Tipo', rec.recording_type || '–'],
  ]
  return (
    <div className="p-5">
      <p className="text-[9px] text-white/30 uppercase tracking-widest mb-3">Metadatos (PostgreSQL)</p>
      <table className="w-full text-xs mb-6">
        <tbody>
          {rows.map(([k, v]) => (
            <tr key={k} className="border-b border-white/[0.04]">
              <td className="py-1.5 pr-4 text-white/30 w-40">{k}</td>
              <td className="py-1.5 font-mono text-white/70">{String(v)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {metrics && metrics.length > 0 && (
        <>
          <p className="text-[9px] text-white/30 uppercase tracking-widest mb-3">
            Agregados InfluxDB ({metrics.length} puntos)
          </p>
          <table className="w-full text-xs">
            <tbody>
              {['alpha', 'theta', 'delta', 'beta', 'gamma', 'coherence', 'signal_quality_avg'].map(k => {
                const vals = metrics.map(m => m[k] ?? 0)
                const avg = vals.reduce((s, v) => s + v, 0) / (vals.length || 1)
                const mx = Math.max(...vals)
                return (
                  <tr key={k} className="border-b border-white/[0.04]">
                    <td className="py-1.5 pr-4 text-white/30 w-40">{k}</td>
                    <td className="py-1.5 font-mono text-white/60">avg {avg.toFixed(4)}</td>
                    <td className="py-1.5 font-mono text-white/30">max {mx.toFixed(4)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </>
      )}
    </div>
  )
}

// ── TabComparar (comparación con referencia EDF, conexión WS live) ────────────
function BandCompareRow({ label, color, live, raw, ref }) {
  const rawMissing = raw == null
  return (
    <tr className="border-b border-white/[0.04]">
      <td className="py-0.5 pr-2 text-[10px]" style={{ color }}>{label}</td>
      <td className="py-0.5 px-1"><Bar value={live ?? 0} color={color} /></td>
      <td className="py-0.5 px-1">
        {rawMissing
          ? <span className="text-[9px] text-white/15 italic">N/A</span>
          : <div className="flex items-center"><Bar value={raw} color={color} /><Delta a={raw} b={live} /></div>}
      </td>
      <td className="py-0.5 px-1">
        <div className="flex items-center">
          <Bar value={ref ?? 0} color={color} />
          {!rawMissing && <Delta a={raw} b={ref} />}
        </div>
      </td>
    </tr>
  )
}

function TabComparar() {
  const { bandsDisplay, bandsDisplayRaw, bandsRaw, state, stateRaw, plv, coherence,
          sessionProgress, sessionTimestamp, connectToField, socket, source } = useBrainStore()
  const wsConnected = socket?.readyState === WebSocket.OPEN

  useEffect(() => { connectToField() }, [connectToField])

  const [snapshots, setSnapshots] = useState([])
  const [activeSnap, setActiveSnap] = useState(null)

  const addSnapshot = useCallback(() => {
    if (sessionProgress == null) return
    const snap = {
      capturedAt: Date.now(), sessionProgress, sessionTimestamp,
      bandsDisplay, bandsDisplayRaw, bandsRaw, state, stateRaw, plv, coherence, source,
    }
    setSnapshots(prev => [snap, ...prev.slice(0, 19)])
    setActiveSnap(snap)
  }, [sessionProgress, sessionTimestamp, bandsDisplay, bandsDisplayRaw, bandsRaw, state, stateRaw, plv, coherence, source])

  const tSec = Math.round(sessionTimestamp ?? 0)
  const ref  = referenceData.rows.reduce((best, r) =>
    Math.abs(r.t - tSec) < Math.abs(best.t - tSec) ? r : best, referenceData.rows[0])

  return (
    <div className="p-5 space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1.5 text-[10px]">
          <span className={`w-2 h-2 rounded-full ${wsConnected ? 'bg-green-400 animate-pulse' : 'bg-red-500'}`} />
          <span className={wsConnected ? 'text-green-400' : 'text-red-400'}>
            {wsConnected ? (sessionProgress != null ? `t≈${tSec}s activo` : 'WS conectado') : 'sin WS'}
          </span>
        </div>
        <button
          onClick={addSnapshot} disabled={sessionProgress == null}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors
            ${sessionProgress != null ? 'bg-purple-600 hover:bg-purple-500 text-white' : 'bg-white/5 text-white/20 cursor-not-allowed'}`}
        >
          📸 Capturar t≈{tSec}s
        </button>
        {snapshots.length > 0 && (
          <button onClick={() => { setSnapshots([]); setActiveSnap(null) }}
            className="text-xs text-white/20 hover:text-white/40 transition-colors">
            Borrar {snapshots.length}
          </button>
        )}
      </div>

      {!wsConnected && (
        <div className="px-3 py-2 bg-red-900/20 border border-red-500/20 rounded text-xs text-red-300/60">
          Backend apagado. Inicia el servidor en <code>localhost:8000</code>.
        </div>
      )}

      {activeSnap && (
        <div className="bg-white/[0.03] border border-white/20 rounded-xl p-4 relative">
          <button onClick={() => setActiveSnap(null)} className="absolute top-3 right-3 text-white/30 hover:text-white/60 text-xs">✕</button>
          <p className="text-[10px] text-white/40 font-mono mb-2">
            SNAPSHOT t={Math.round(activeSnap.sessionTimestamp ?? 0)}s · {(activeSnap.sessionProgress * 100).toFixed(2)}%
          </p>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left py-1 pr-2 w-4" />
                <th className="text-left py-1 px-1 text-[9px] text-white/40 uppercase">Live</th>
                <th className="text-left py-1 px-1 text-[9px] text-white/40 uppercase">Raw pre-EMA</th>
                <th className="text-left py-1 px-1 text-[9px] text-white/40 uppercase">Ref t={ref.t}s</th>
              </tr>
            </thead>
            <tbody>
              {BANDS.map(b => (
                <BandCompareRow
                  key={b} label={BAND_LABEL[b]} color={BAND_COLORS[b]}
                  live={activeSnap.bandsDisplay?.[b]}
                  raw={activeSnap.bandsDisplayRaw?.[b]}
                  ref={ref.bands_display[b]}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl overflow-hidden">
        <div className="px-3 py-2 border-b border-white/[0.06]">
          <span className="text-[9px] text-white/30 uppercase tracking-wider">Referencia EDF — sub-001 meditación</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[10px]">
            <thead>
              <tr className="border-b border-white/10 text-white/30">
                <th className="text-left py-2 px-2 w-10">t(s)</th>
                {BANDS.map(b => (
                  <th key={b} className="text-left py-2 px-2" style={{ color: BAND_COLORS[b] + '99' }}>
                    {BAND_LABEL[b]}
                  </th>
                ))}
                <th className="text-left py-2 px-2">PLV</th>
                <th className="text-left py-2 px-2">estado</th>
              </tr>
            </thead>
            <tbody>
              {referenceData.rows.map(row => (
                <tr key={row.t} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                  <td className="py-1 px-2 font-mono text-white/40">{row.t}</td>
                  {BANDS.map(b => <td key={b} className="py-1 px-2"><Bar value={row.bands_display[b]} color={BAND_COLORS[b]} /></td>)}
                  <td className="py-1 px-2 font-mono text-white/40">{row.coherence.toFixed(3)}</td>
                  <td className="py-1 px-2"><StateBadge state={row.state} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ── RecordingHeader ───────────────────────────────────────────────────────────
function RecordingHeader({ rec }) {
  const date = rec.started_at ? new Date(rec.started_at).toLocaleString('es', {
    year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit'
  }) : '–'
  return (
    <div className="px-5 py-4 border-b border-white/[0.06]">
      <h2 className="text-base font-semibold text-white">{rec.name || `Grabación #${rec.id}`}</h2>
      <p className="text-[11px] text-white/40 mt-0.5">{date}</p>
      <div className="flex items-center gap-2 mt-2 flex-wrap">
        {rec.duration_seconds != null && (
          <span className="text-[10px] bg-white/[0.05] px-2 py-0.5 rounded text-white/60">
            {Math.round(rec.duration_seconds)}s
          </span>
        )}
        {rec.sample_count != null && (
          <span className="text-[10px] bg-white/[0.05] px-2 py-0.5 rounded text-white/60">
            {rec.sample_count} muestras
          </span>
        )}
        {rec.calibration_passed && (
          <span className="text-[10px] bg-green-900/40 text-green-300 px-2 py-0.5 rounded">calibrado ✓</span>
        )}
        {rec.avg_signal_quality != null && (
          <span className="text-[10px] bg-white/[0.05] px-2 py-0.5 rounded"
            style={{ color: rec.avg_signal_quality >= 0.9 ? '#34d399' : rec.avg_signal_quality >= 0.6 ? '#fbbf24' : '#f87171' }}>
            señal {(rec.avg_signal_quality * 100).toFixed(0)}%
          </span>
        )}
      </div>
    </div>
  )
}

// ── RecordingView ─────────────────────────────────────────────────────────────
const TABS = ['Bandas', 'Comparar ref.', 'Info']

function RecordingView({ rec }) {
  const [tab, setTab] = useState('Bandas')
  const { data: metrics, loading, error } = useRecordingMetrics(rec.id)

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <RecordingHeader rec={rec} />

      <div className="flex border-b border-white/[0.06] px-4 flex-shrink-0">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-3 py-2.5 text-xs font-medium transition-colors border-b-2 mr-1
              ${tab === t ? 'border-purple-500 text-white' : 'border-transparent text-white/30 hover:text-white/60'}`}>
            {t}
          </button>
        ))}
        {loading && <span className="ml-auto text-[9px] text-white/20 self-center">cargando métricas…</span>}
        {error && <span className="ml-auto text-[9px] text-red-400 self-center">error: {error}</span>}
      </div>

      <div className="flex-1 overflow-y-auto">
        {tab === 'Bandas'        && <TabBandas rec={rec} metrics={metrics ?? []} />}
        {tab === 'Comparar ref.' && <TabComparar />}
        {tab === 'Info'          && <TabInfo rec={rec} metrics={metrics ?? []} />}
      </div>
    </div>
  )
}

// ── EmptyState ────────────────────────────────────────────────────────────────
function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-white/20 select-none">
      <div className="text-4xl mb-3">⟁</div>
      <p className="text-sm">Selecciona una grabación</p>
      <p className="text-xs mt-1 text-white/10">Los datos se cargan bajo demanda</p>
    </div>
  )
}
// ── Página principal ──────────────────────────────────────────────────────────
export default function AnalisisDatasets() {
  const { sessions, loading, error, reload } = useSessions()
  const [selected, setSelected] = useState(null)

  return (
    <div className="h-screen w-screen bg-black text-white flex overflow-hidden">
      <Sidebar
        sessions={sessions}
        loading={loading}
        error={error}
        selected={selected}
        onSelect={setSelected}
        onReload={reload}
      />
      <div className="flex-1 flex flex-col overflow-hidden">
        {selected ? <RecordingView rec={selected} /> : <EmptyState />}
      </div>
    </div>
  )
}
