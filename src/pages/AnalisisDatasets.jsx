import React, { useState, useCallback, useEffect } from 'react'
import { useBrainStore } from '../lab-core/brain/store.js'
import referenceData from './analisis-datasets/reference_data.json'

// ── Constantes ────────────────────────────────────────────────────────────────
const BANDS = ['delta', 'theta', 'alpha', 'beta', 'gamma']
const BAND_LABEL = { delta: 'δ', theta: 'θ', alpha: 'α', beta: 'β', gamma: 'γ' }
const BAR_COLORS = {
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

// Δ coloreado: verde ≤2%, amarillo ≤6%, rojo >6%
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

// ── Panel de snapshot ─────────────────────────────────────────────────────────
function SnapshotPanel({ snap, onDismiss }) {
  const tSec = Math.round(snap.sessionTimestamp ?? 0)
  const refRow = referenceData.rows.reduce((best, r) =>
    Math.abs(r.t - tSec) < Math.abs(best.t - tSec) ? r : best
  )
  // 'recorded' = métricas de InfluxDB (la grabación ya tenía EMA aplicado)
  // En ese caso bandsDisplayRaw == bandsDisplay (sin columna extra útil)
  // Para dataset/session recalculado: bandsDisplayRaw = pre-EMA real
  const isRecorded = snap.source === 'recorded'

  // Para recorded: usamos bandsDisplay directamente (mejor disponibilidad)
  // Para raw compute: usamos bandsDisplayRaw (pre-EMA)
  const compareVals = isRecorded ? snap.bandsDisplay : snap.bandsDisplayRaw
  const hasCompare  = compareVals != null

  const totalDelta = hasCompare
    ? BANDS.reduce((sum, b) => sum + Math.abs((compareVals[b] ?? 0) - refRow.bands_display[b]), 0) / BANDS.length
    : null

  const liveCoherence = snap.coherence  // MSC grabado (si source=recorded)
  const livePLV       = snap.plv        // PLV (grabado o calculado)

  return (
    <div className="bg-white/[0.03] border border-white/20 rounded-xl p-4 mb-6 relative">
      <button onClick={onDismiss} className="absolute top-3 right-3 text-white/30 hover:text-white/60 text-xs">✕</button>

      <div className="flex items-start justify-between mb-3 flex-wrap gap-2">
        <div>
          <p className="text-[10px] text-white/40 font-mono mb-0.5">
            SNAPSHOT — t={tSec}s · {(snap.sessionProgress * 100).toFixed(2)}% · ref t={refRow.t}s
            {isRecorded && <span className="ml-2 text-white/20">· source=recorded (InfluxDB)</span>}
          </p>
          {totalDelta != null
            ? <span className={`text-[10px] font-mono ${totalDelta < 0.02 ? 'text-green-400' : totalDelta < 0.05 ? 'text-yellow-400' : 'text-red-400'}`}>
                Error medio = {(totalDelta * 100).toFixed(1)}% vs referencia
                {isRecorded && <span className="text-white/20 ml-1">(grabado vs EDF fresco)</span>}
              </span>
            : null}
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          {isRecorded
            ? <><span className="text-[9px] text-white/30">grabado:</span><StateBadge state={snap.state} /></>
            : <>
                <span className="text-[9px] text-white/30">raw:</span><StateBadge state={snap.stateRaw ?? snap.state} />
                {snap.stateRaw !== snap.state && (
                  <><span className="text-[9px] text-white/30">EMA:</span><StateBadge state={snap.state} /></>
                )}
              </>}
          <span className="text-[9px] text-white/30">ref:</span><StateBadge state={refRow.state} />
        </div>
      </div>

      {isRecorded && (
        <p className="text-[9px] text-white/20 mb-3 leading-relaxed">
          Sesión grabada — los valores reproducen InfluxDB (ya incluían EMA de la grabación original).
          La columna “Raw pre-EMA” no aplica. Se compara directamente grabado ↔ referencia EDF.
        </p>
      )}

      <table className="w-full text-xs mb-3">
        <thead>
          <tr className="border-b border-white/10">
            <th className="text-left py-1 pr-2 w-4" />
            <th className="text-left py-1 px-1 text-[9px] text-white/40 uppercase">
              {isRecorded ? 'Grabado (InfluxDB)' : 'Live (EMA)'}
              <br/><span className="text-white/20 normal-case font-normal">bands_display</span>
            </th>
            {!isRecorded && (
              <th className="text-left py-1 px-1 text-[9px] text-white/40 uppercase">
                Raw (pre-EMA)<br/><span className="text-white/20 normal-case font-normal">bands_display_raw · Δ vs EMA</span>
              </th>
            )}
            <th className="text-left py-1 px-1 text-[9px] text-white/40 uppercase">
              Referencia t={refRow.t}s
              <br/><span className="text-white/20 normal-case font-normal">
                {isRecorded ? 'Δ grabado vs EDF' : 'Δ raw vs ref'}
              </span>
            </th>
          </tr>
        </thead>
        <tbody>
          {BANDS.map(b => (
            isRecorded
              // Modo recorded: 2 columnas — grabado | referencia
              ? <tr key={b} className="border-b border-white/[0.04]">
                  <td className="py-0.5 pr-2 text-[10px]" style={{ color: BAR_COLORS[b] }}>{BAND_LABEL[b]}</td>
                  <td className="py-0.5 px-1"><Bar value={snap.bandsDisplay?.[b] ?? 0} color={BAR_COLORS[b]} /></td>
                  <td className="py-0.5 px-1">
                    <div className="flex items-center">
                      <Bar value={refRow.bands_display[b]} color={BAR_COLORS[b]} />
                      <Delta a={snap.bandsDisplay?.[b]} b={refRow.bands_display[b]} />
                    </div>
                  </td>
                </tr>
              // Modo raw compute: 3 columnas — EMA | raw pre-EMA | referencia
              : <BandCompareRow
                  key={b} label={BAND_LABEL[b]} color={BAR_COLORS[b]}
                  live={snap.bandsDisplay?.[b]}
                  raw={snap.bandsDisplayRaw?.[b]}
                  ref={refRow.bands_display[b]}
                />
          ))}
        </tbody>
      </table>

      <div className="grid grid-cols-3 gap-2 text-[10px] pt-3 border-t border-white/[0.06]">
        <div>
          <span className="text-white/30">PLV live: </span>
          <span className="font-mono text-white/70">{livePLV != null ? livePLV.toFixed(3) : '–'}</span>
          {isRecorded && liveCoherence != null && liveCoherence !== livePLV && (
            <span className="text-white/20 ml-1">(MSC: {liveCoherence.toFixed(3)})</span>
          )}
        </div>
        <div>
          <span className="text-white/30">PLV ref: </span>
          <span className="font-mono text-white/70">{refRow.coherence.toFixed(3)}</span>
          {livePLV != null && <Delta a={livePLV} b={refRow.coherence} />}
        </div>
        <div><span className="text-white/30">f dom ref: </span><span className="font-mono text-white/70">{refRow.dominant_freq}Hz</span></div>
      </div>

      <div className="mt-3 pt-3 border-t border-white/[0.06] text-[10px] space-y-0.5">
        <p className="text-white/40 font-medium mb-1">Diagnóstico automático:</p>
        {hasCompare && BANDS.map(b => {
          const cmpVal = compareVals[b]
          const refVal = refRow.bands_display[b]
          if (cmpVal == null) return null
          const diff = cmpVal - refVal
          const abs  = Math.abs(diff)
          if (abs < 0.03) return null
          return (
            <p key={b}>
              <span style={{ color: BAR_COLORS[b] }}>{b}</span>
              {isRecorded ? ' grabado ' : ' raw '}
              <span className="text-white/50">{(cmpVal*100).toFixed(1)}%</span>
              {' vs ref '}<span className="text-white/50">{(refVal*100).toFixed(1)}%</span>
              {' → '}<span className={diff > 0 ? 'text-amber-400' : 'text-blue-400'}>
                {diff > 0 ? `+${(diff*100).toFixed(1)}% SOBRE` : `${(diff*100).toFixed(1)}% BAJO`}
              </span>
              {abs > 0.08 && <span className="text-red-400 ml-1"> ⚠ diferencia grande</span>}
            </p>
          )
        })}
        {!isRecorded && snap.stateRaw !== snap.state && (
          <p className="text-yellow-400">EMA cambia el estado: {snap.stateRaw} → {snap.state}</p>
        )}
        {snap.state !== refRow.state && (
          <p className="text-orange-400">Estado live ({snap.state}) ≠ ref ({refRow.state})</p>
        )}
        {isRecorded && livePLV != null && liveCoherence != null && (
          <p className="text-white/30">Coherencia grabada: MSC={liveCoherence.toFixed(3)} · PLV={livePLV.toFixed(3)} — métricas distintas, valores distintos son normales</p>
        )}
        {totalDelta != null && totalDelta < 0.02 && (
          <p className="text-green-400">✓ Pipeline correcto — error menor al 2% en todas las bandas</p>
        )}
      </div>
    </div>
  )
}

// ── Tabla de referencia con capturas intercaladas ─────────────────────────────
function RefTable({ snapshots, filter }) {
  const rows = filter === 'all' ? referenceData.rows : referenceData.rows.filter(r => r.state === filter)
  const snapMap = {}
  snapshots.forEach(s => { snapMap[Math.round(s.sessionTimestamp ?? 0)] = s })

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[10px]">
        <thead>
          <tr className="border-b border-white/10 text-white/30">
            <th className="text-left py-2 px-2 w-10">t(s)</th>
            {BANDS.map(b => (
              <th key={b} className="text-left py-2 px-1" style={{ color: BAR_COLORS[b] + '99' }}>
                {BAND_LABEL[b]} raw
              </th>
            ))}
            <th className="py-2 px-1 text-white/10">│</th>
            {BANDS.map(b => (
              <th key={b} className="text-left py-2 px-1" style={{ color: BAR_COLORS[b] + '66' }}>
                {BAND_LABEL[b]} disp
              </th>
            ))}
            <th className="py-2 px-1 text-white/10">│</th>
            <th className="text-left py-2 px-1">PLV</th>
            <th className="text-left py-2 px-1">f dom</th>
            <th className="text-left py-2 px-1">estado</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(row => {
            const snap = snapMap[row.t]
            const sc   = STATE_C[row.state] || STATE_C.transitioning
            return (
              <React.Fragment key={row.t}>
                {/* Fila referencia */}
                <tr className={`border-b border-white/[0.04] hover:bg-white/[0.02] ${snap ? 'border-b-0' : ''}`}>
                  <td className="py-1 px-2 font-mono text-white/40">{row.t}</td>
                  {BANDS.map(b => <td key={b} className="py-1 px-1"><Bar value={row.bands[b]} color={BAR_COLORS[b]} /></td>)}
                  <td className="text-white/10 px-1">│</td>
                  {BANDS.map(b => <td key={b} className="py-1 px-1"><Bar value={row.bands_display[b]} color={BAR_COLORS[b]} maxVal={0.65} /></td>)}
                  <td className="text-white/10 px-1">│</td>
                  <td className="py-1 px-1 font-mono" style={{
                    color: row.coherence > 0.5 ? '#a78bfa' : row.coherence > 0.35 ? '#34d399' : '#6b7280'
                  }}>{row.coherence.toFixed(3)}</td>
                  <td className="py-1 px-1 font-mono text-white/40">{row.dominant_freq}Hz</td>
                  <td className="py-1 px-1"><StateBadge state={row.state} /></td>
                </tr>

                {/* Sub-fila live (snapshot en este segundo) */}
                {snap && (
                  <tr className={`border-b border-white/10 ${sc.bg}`}>
                    <td className="py-1 px-2 text-[9px] text-white/30 italic">live</td>
                    {/* raw bands: captura pre-EMA vs referencia raw */}
                    {BANDS.map(b => (
                      <td key={b} className="py-1 px-1">
                        {snap.bandsRaw
                          ? <div className="flex items-center"><Bar value={snap.bandsRaw[b] ?? 0} color={BAR_COLORS[b]} /><Delta a={snap.bandsRaw[b]} b={row.bands[b]} /></div>
                          : <span className="text-[9px] text-white/15">–</span>}
                      </td>
                    ))}
                    <td className="text-white/10 px-1">│</td>
                    {/* display bands: captura pre-EMA vs referencia display */}
                    {BANDS.map(b => (
                      <td key={b} className="py-1 px-1">
                        {snap.bandsDisplayRaw
                          ? <div className="flex items-center"><Bar value={snap.bandsDisplayRaw[b] ?? 0} color={BAR_COLORS[b]} maxVal={0.65} /><Delta a={snap.bandsDisplayRaw[b]} b={row.bands_display[b]} /></div>
                          : <span className="text-[9px] text-white/15">–</span>}
                      </td>
                    ))}
                    <td className="text-white/10 px-1">│</td>
                    <td className="py-1 px-1 font-mono text-white/60">{(snap.plv ?? snap.coherence ?? 0).toFixed(3)}</td>
                    <td className="py-1 px-1" />
                    <td className="py-1 px-1"><StateBadge state={snap.stateRaw ?? snap.state} /></td>
                  </tr>
                )}
              </React.Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ── Timelines ─────────────────────────────────────────────────────────────────
function BandTimeline({ band, color, snapshots }) {
  const rows   = referenceData.rows
  const values = rows.map(r => r.bands[band])
  const max    = Math.max(...values, 0.01)
  const W = 800, H = 36
  const line = values.map((v, i) =>
    `${(i / (values.length - 1)) * W},${H - (v / max) * H * 0.9}`
  ).join(' ')
  const dots = snapshots
    .filter(s => s.bandsRaw?.[band] != null && s.sessionTimestamp != null)
    .map(s => ({
      x: (s.sessionTimestamp / 60) * W,
      y: H - (s.bandsRaw[band] / max) * H * 0.9
    }))
  return (
    <div>
      <div className="text-[10px] text-white/30 mb-0.5 capitalize">{band}</div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-7" preserveAspectRatio="none">
        <polyline points={line} fill="none" stroke={color} strokeWidth="1.5" opacity="0.5" />
        {dots.map((d, i) => (
          <circle key={i} cx={d.x} cy={d.y} r="5" fill={color} stroke="#000" strokeWidth="1.5" />
        ))}
      </svg>
    </div>
  )
}

// ── Live strip ────────────────────────────────────────────────────────────────
function LiveStrip() {
  const { bandsDisplay, bandsDisplayRaw, state, stateRaw, plv, coherence, sessionTimestamp, sessionProgress } = useBrainStore()
  if (!sessionProgress) return null
  const tSec = Math.round(sessionTimestamp ?? 0)
  const ref  = referenceData.rows.find(r => r.t === tSec)
  return (
    <div className="mb-4 bg-white/[0.03] border border-white/10 rounded-xl p-3 flex items-start gap-6 flex-wrap">
      <div>
        <p className="text-[9px] text-white/30 uppercase tracking-wider mb-1">t sesión</p>
        <p className="font-mono text-xs text-white/70">{tSec}s · {(sessionProgress * 100).toFixed(2)}%</p>
      </div>
      <div>
        <p className="text-[9px] text-white/30 uppercase tracking-wider mb-1">Estado</p>
        <div className="flex items-center gap-1 flex-wrap">
          <span className="text-[9px] text-white/20">raw:</span><StateBadge state={stateRaw ?? state} />
          {stateRaw && stateRaw !== state && (
            <><span className="text-[9px] text-white/20">EMA:</span><StateBadge state={state} /></>
          )}
          {ref && <><span className="text-[9px] text-white/20">ref:</span><StateBadge state={ref.state} /></>}
        </div>
      </div>
      <div>
        <p className="text-[9px] text-white/30 uppercase tracking-wider mb-1">α display</p>
        <p className="font-mono text-xs">
          <span className="text-purple-400">{((bandsDisplay?.alpha ?? 0) * 100).toFixed(1)}%</span>
          {bandsDisplayRaw && <span className="text-white/40"> raw {((bandsDisplayRaw.alpha ?? 0) * 100).toFixed(1)}%</span>}
          {ref && <span className="text-white/25"> ref {(ref.bands_display.alpha * 100).toFixed(1)}%</span>}
        </p>
      </div>
      <div>
        <p className="text-[9px] text-white/30 uppercase tracking-wider mb-1">PLV</p>
        <span className="font-mono text-xs text-white/70">{(plv ?? coherence ?? 0).toFixed(3)}</span>
        {ref && <span className="text-white/25 text-[10px] ml-1">ref {ref.coherence.toFixed(3)}</span>}
      </div>
    </div>
  )
}

// ── Botón captura ─────────────────────────────────────────────────────────────
function CaptureButton({ onCapture }) {
  const { sessionProgress, sessionTimestamp, bands, bandsDisplay,
          bandsRaw, bandsDisplayRaw, state, stateRaw, plv, coherence, source } = useBrainStore()
  const canCapture = sessionProgress != null
  return (
    <button
      onClick={() => canCapture && onCapture({
        capturedAt: Date.now(), sessionProgress, sessionTimestamp,
        bands, bandsDisplay, bandsRaw, bandsDisplayRaw,
        state, stateRaw, plv, coherence, source,
      })}
      disabled={!canCapture}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all
        ${canCapture
          ? 'bg-purple-600 hover:bg-purple-500 text-white'
          : 'bg-white/5 text-white/20 cursor-not-allowed'}`}
    >
      📸 {canCapture ? `Capturar t≈${Math.round(sessionTimestamp ?? 0)}s` : 'Sin sesión activa'}
    </button>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function AnalisisDatasets() {
  const [snapshots, setSnapshots] = useState([])
  const [activeSnap, setActiveSnap] = useState(null)
  const [filter, setFilter] = useState('all')
  const [showTL, setShowTL] = useState(true)
  const [showMeta, setShowMeta] = useState(false)
  const sessionProgress = useBrainStore(s => s.sessionProgress)
  const connectToField  = useBrainStore(s => s.connectToField)
  const socket          = useBrainStore(s => s.socket)
  const wsConnected     = socket?.readyState === WebSocket.OPEN

  // Auto-connect WS when this page mounts (works in any tab, no need to visit /lab/brain first)
  useEffect(() => { connectToField() }, [connectToField])

  const addSnapshot = useCallback((snap) => {
    setSnapshots(prev => [snap, ...prev.slice(0, 19)])
    setActiveSnap(snap)
  }, [])

  const states = [...new Set(referenceData.rows.map(r => r.state))]

  return (
    <div className="min-h-screen bg-black text-white px-4 py-8 max-w-screen-2xl mx-auto">

      <div className="mb-6 flex items-start justify-between flex-wrap gap-4">
        <div>
          <p className="text-[10px] text-white/20 font-mono uppercase tracking-wider mb-1">
            DEBUG · INTERNAL · /analisis-datasets
          </p>
          <h1 className="text-xl font-bold">Validación EEG — sub-001 meditación</h1>
          <p className="text-white/30 text-xs mt-0.5">
            Primer minuto · pipeline idéntico al backend · sin smoothing EMA
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* WS status dot */}
          <div className="flex items-center gap-1.5 text-[10px]">
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${wsConnected ? 'bg-green-400 animate-pulse' : 'bg-red-500'}`} />
            <span className={wsConnected ? 'text-green-400' : 'text-red-400'}>
              {wsConnected ? (sessionProgress != null ? 'sesión activa' : 'WS conectado…') : 'sin conexión'}
            </span>
          </div>
          <CaptureButton onCapture={addSnapshot} />
          {snapshots.length > 0 && (
            <button
              onClick={() => { setSnapshots([]); setActiveSnap(null) }}
              className="text-xs text-white/20 hover:text-white/40 transition-colors"
            >
              Borrar {snapshots.length} capturas
            </button>
          )}
        </div>
      </div>

      <LiveStrip />

      {activeSnap && <SnapshotPanel snap={activeSnap} onDismiss={() => setActiveSnap(null)} />}

      {snapshots.length > 1 && (
        <div className="mb-4 flex gap-2 flex-wrap">
          {snapshots.map((s, i) => (
            <button key={s.capturedAt} onClick={() => setActiveSnap(s)}
              className={`px-2 py-0.5 rounded text-[10px] font-mono border transition-colors
                ${activeSnap?.capturedAt === s.capturedAt
                  ? 'border-purple-500 text-purple-300 bg-purple-900/20'
                  : 'border-white/10 text-white/30 hover:border-white/30'}`}>
              #{i + 1} t≈{Math.round(s.sessionTimestamp ?? 0)}s
            </button>
          ))}
        </div>
      )}

      {!wsConnected && (
        <div className="mb-6 px-4 py-3 bg-red-900/20 border border-red-500/20 rounded-xl text-xs text-red-200/60">
          <strong>Sin conexión al backend.</strong> Asegúrate de que el backend está corriendo en <code>localhost:8000</code>.
          La página se reconecta automáticamente cada 2s.
        </div>
      )}
      {wsConnected && !sessionProgress && (
        <div className="mb-6 px-4 py-3 bg-amber-900/20 border border-amber-500/20 rounded-xl text-xs text-amber-200/60">
          <strong>WS conectado pero sin sesión.</strong> Ve a <code>/lab/brain</code> → activa modo sesión → pulsa play.
          Cuando quieras capturar un segundo, pon pausa ahí y usa el botón de captura.
        </div>
      )}

      <div className="mb-4 bg-white/[0.02] border border-white/[0.06] rounded-xl overflow-hidden">
        <button onClick={() => setShowMeta(!showMeta)}
          className="w-full flex items-center justify-between px-3 py-2 text-[10px] text-white/30 hover:text-white/50 transition-colors">
          <span className="uppercase tracking-wider">Leyenda y pipeline</span>
          <span>{showMeta ? '▲' : '▼'}</span>
        </button>
        {showMeta && (
          <div className="px-3 pb-3 grid grid-cols-2 gap-4 text-[10px]">
            <div>
              <p className="text-white/30 mb-1 uppercase text-[9px]">Cómo leer la tabla</p>
              <p className="text-white/40 leading-relaxed">
                <strong className="text-white/60">raw</strong>: Welch PSD normalizado.{' '}
                <strong className="text-white/60">disp</strong>: raw × f_centre/bandwidth (lo que ves en las barras).<br/>
                La fila <span className="italic text-purple-300">live</span> muestra tu captura pre-EMA.
                Los Δ en rojo/amarillo son diferencias vs referencia.
              </p>
            </div>
            <div>
              <p className="text-white/30 mb-1 uppercase text-[9px]">Pipeline referencia</p>
              {Object.entries(referenceData.meta.processing).map(([k, v]) => (
                <div key={k} className="flex gap-2 mb-0.5">
                  <span className="text-white/20 w-28 flex-shrink-0">{k}</span>
                  <span className="text-white/50 font-mono">{String(v)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="mb-4">
        <button onClick={() => setShowTL(!showTL)}
          className="text-[10px] text-white/30 hover:text-white/50 transition-colors uppercase tracking-wider flex items-center gap-2">
          Timelines — puntos = capturas
          <span>{showTL ? '▲' : '▼'}</span>
        </button>
        {showTL && (
          <div className="mt-2 bg-white/[0.02] border border-white/[0.06] rounded-xl p-3 grid gap-2">
            {BANDS.map(b => <BandTimeline key={b} band={b} color={BAR_COLORS[b]} snapshots={snapshots} />)}
            <div className="text-[9px] text-white/15">
              ← t=0s · · · · · · · t=59s → {snapshots.length > 0 && ' | ● = capturas'}
            </div>
          </div>
        )}
      </div>

      <div className="mb-3 flex flex-wrap gap-2">
        {[['all', referenceData.rows.length], ...states.map(s => [s, referenceData.rows.filter(r => r.state === s).length])].map(([s, ct]) => (
          <button key={s} onClick={() => setFilter(s)}
            className={`px-2.5 py-0.5 rounded text-[10px] transition-colors
              ${filter === s
                ? s === 'all' ? 'bg-white/15 text-white' : `${(STATE_C[s] || STATE_C.transitioning).bg} ${(STATE_C[s] || STATE_C.transitioning).text}`
                : 'bg-white/[0.04] text-white/30 hover:text-white/50'}`}>
            {s} ({ct}s)
          </button>
        ))}
      </div>

      <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl overflow-hidden">
        <div className="px-3 py-2 border-b border-white/[0.06] flex items-center justify-between">
          <span className="text-[9px] text-white/30 uppercase tracking-wider">
            REFERENCIA · raw (izq) │ display 1/f (der)
            {snapshots.length > 0 && (
              <span className="text-purple-400 ml-2">fila italic = captura pre-EMA · Δ vs ref</span>
            )}
          </span>
          <span className="text-[9px] text-white/20 font-mono">Δ verde ≤2% · amarillo ≤6% · rojo &gt;6%</span>
        </div>
        <RefTable snapshots={snapshots} filter={filter} />
      </div>

      <div className="mt-6 text-[10px] text-white/15">
        Regenerar: <code className="font-mono text-white/25">python scripts/generate_validation_reference.py</code>
      </div>
    </div>
  )
}
