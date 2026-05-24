import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import SanjiCopilotPanel from '../components/SanjiCopilotPanel';

const API_BASE = import.meta.env.VITE_SANJI_API || 'http://localhost:8001';

// ─── helpers ─────────────────────────────────────────────────────────────────

function fmt(val, suffix = '') {
  if (val == null) return '—';
  return `${val}${suffix}`;
}

function trendIndicator(current, previous) {
  if (current == null || previous == null) return null;
  const diff = current - previous;
  if (Math.abs(diff) < 0.2) return { icon: '→', color: 'text-neutral-400' };
  return diff > 0
    ? { icon: '↑', color: 'text-green-400' }
    : { icon: '↓', color: 'text-red-400' };
}

// ─── Micro widgets ────────────────────────────────────────────────────────────

function StatCard({ label, value, unit = '', sub, color = 'text-white', icon }) {
  return (
    <div className="bg-neutral-900 rounded-xl p-4 border border-neutral-800">
      <div className="flex items-start justify-between mb-1">
        <p className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest">{label}</p>
        {icon && <span className="text-base">{icon}</span>}
      </div>
      <p className={`text-2xl font-bold tabular-nums ${color}`}>
        {value}<span className="text-sm font-normal text-neutral-500 ml-1">{unit}</span>
      </p>
      {sub && <p className="text-[10px] text-neutral-600 mt-1">{sub}</p>}
    </div>
  );
}

function MiniBar({ value, max = 100, color = 'bg-cyan-500' }) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div className="w-full h-1.5 bg-neutral-800 rounded-full overflow-hidden mt-2">
      <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function VectorCard({ label, score, max = 5, lowerIsBetter = false }) {
  const ratio = score != null ? score / max : null;
  const isGood = ratio != null && (lowerIsBetter ? ratio <= 0.4 : ratio >= 0.6);
  const isBad  = ratio != null && (lowerIsBetter ? ratio >= 0.7 : ratio <= 0.3);
  const barColor = isBad ? 'bg-red-500' : isGood ? 'bg-green-500' : 'bg-amber-500';
  return (
    <div className="bg-neutral-900 rounded-lg p-3 border border-neutral-800">
      <div className="flex justify-between items-center">
        <span className="text-[11px] font-mono text-neutral-400">{label}</span>
        <span className={`text-sm font-bold tabular-nums ${isBad ? 'text-red-400' : isGood ? 'text-green-400' : 'text-amber-400'}`}>
          {fmt(score)}<span className="text-neutral-600 text-[10px]">/{max}</span>
        </span>
      </div>
      {score != null && <MiniBar value={score} max={max} color={barColor} />}
    </div>
  );
}

// Quick status badges — full-width strip showing today's vitals at a glance
function TodayStatusBar({ log }) {
  const items = [
    { label: 'Apetito',  val: `${log.appetite_pct ?? '—'}%`,
      ok: log.appetite_pct >= 70, bad: log.appetite_pct < 40 },
    { label: 'Hiper.',   val: log.hyperesthesia_score ?? '—',
      ok: log.hyperesthesia_score <= 1, bad: log.hyperesthesia_score >= 4 },
    { label: 'Ataxia',   val: log.ataxia_score ?? '—',
      ok: log.ataxia_score <= 1,  bad: log.ataxia_score >= 3 },
    { label: 'Social',   val: log.social_score ?? '—',
      ok: log.social_score >= 3,  bad: log.social_score <= 1 },
    { label: 'Sueño',    val: log.sleep_quality ?? '—',
      ok: log.sleep_quality >= 3, bad: log.sleep_quality <= 1 },
    { label: 'Agua',     val: log.water_visits ?? '—',
      ok: false, bad: false },
  ];
  return (
    <div className="flex flex-wrap gap-2">
      {items.map(({ label, val, ok, bad }) => (
        <div key={label} className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-mono
          ${bad  ? 'border-red-800   bg-red-950/30   text-red-300'
          : ok   ? 'border-green-800 bg-green-950/30 text-green-300'
                 : 'border-neutral-700 bg-neutral-900 text-neutral-300'}`}>
          <span className="text-neutral-500 text-[10px]">{label}</span>
          <span className="font-bold tabular-nums">{val}</span>
        </div>
      ))}
      {log.seizure_suspected && (
        <div className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-red-600 bg-red-950/50 text-red-300 text-xs font-bold animate-pulse">
          ⚠ Crisis
        </div>
      )}
    </div>
  );
}

// Mini bar chart — last 7 days for a given metric
function SparkDots({ logs, field, good = 'high', max = 5 }) {
  const recent = [...logs].slice(0, 7).reverse();
  if (!recent.length) return null;
  return (
    <div className="flex items-end gap-1 h-5 flex-1">
      {recent.map((log, i) => {
        const val = log[field];
        if (val == null) return <div key={i} className="flex-1 max-w-[20px] bg-neutral-800 rounded-sm self-end" style={{ height: 3 }} />;
        const ratio = Math.min(1, Math.max(0, val / max));
        const isGood = good === 'high' ? ratio >= 0.6 : ratio <= 0.4;
        const isBad  = good === 'high' ? ratio < 0.35 : ratio > 0.65;
        const color  = isBad ? 'bg-red-400' : isGood ? 'bg-green-400' : 'bg-amber-400';
        return (
          <div key={i}
            className={`flex-1 max-w-[20px] ${color} rounded-sm self-end`}
            style={{ height: `${Math.max(3, Math.round(ratio * 20))}px` }}
          />
        );
      })}
    </div>
  );
}

function Dot({ value, max = 5, lowerIsBetter = false }) {
  if (value == null) return <span className="w-2 h-2 rounded-full bg-neutral-800 inline-block" />;
  const ratio = value / max;
  const isGood = lowerIsBetter ? ratio <= 0.4 : ratio >= 0.6;
  const isBad  = lowerIsBetter ? ratio >= 0.7 : ratio <= 0.3;
  return (
    <span className={`w-2 h-2 rounded-full inline-block flex-shrink-0 ${
      isBad ? 'bg-red-400' : isGood ? 'bg-green-400' : 'bg-amber-400'
    }`} />
  );
}

function LogRow({ log, isToday, onClick }) {
  const d = new Date(log.log_date + 'T12:00:00');
  const dayNum = d.getDate();
  const weekday = d.toLocaleDateString('es-ES', { weekday: 'short' });
  const month = d.toLocaleDateString('es-ES', { month: 'short' });
  const appetite = log.appetite_pct;
  const appetiteColor = appetite == null ? 'text-neutral-600'
    : appetite >= 80 ? 'text-green-400'
    : appetite >= 50 ? 'text-amber-400' : 'text-red-400';

  const vitals = [
    { label: 'Apetito', value: appetite != null ? `${appetite}%` : '—', color: appetiteColor },
    { label: 'Hiper.',  value: log.hyperesthesia_score ?? '—',
      color: log.hyperesthesia_score == null ? 'text-neutral-500'
        : log.hyperesthesia_score <= 1 ? 'text-green-400'
        : log.hyperesthesia_score >= 4 ? 'text-red-400' : 'text-amber-400' },
    { label: 'Social',  value: log.social_score ?? '—',
      color: log.social_score == null ? 'text-neutral-500'
        : log.social_score >= 3 ? 'text-green-400'
        : log.social_score <= 1 ? 'text-red-400' : 'text-amber-400' },
    { label: 'Sueño',   value: log.sleep_quality ?? '—',
      color: log.sleep_quality == null ? 'text-neutral-500'
        : log.sleep_quality >= 3 ? 'text-green-400'
        : log.sleep_quality <= 1 ? 'text-red-400' : 'text-amber-400' },
  ];

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left flex items-center gap-4 px-4 py-3 rounded-xl border transition-all group
        ${isToday
          ? 'border-cyan-700/60 bg-cyan-950/20 hover:border-cyan-600'
          : 'border-neutral-800 bg-neutral-900/50 hover:border-neutral-600 hover:bg-neutral-900'}`}
    >
      {/* Date column */}
      <div className="flex-shrink-0 w-10 text-center">
        <p className={`text-lg font-bold leading-none tabular-nums ${
          isToday ? 'text-cyan-400' : 'text-white'
        }`}>{dayNum}</p>
        <p className="text-[9px] font-mono text-neutral-600 mt-0.5 capitalize">{weekday}</p>
        <p className="text-[9px] font-mono text-neutral-700 capitalize">{month}</p>
      </div>

      {/* Vertical divider */}
      <div className="w-px h-8 bg-neutral-800 flex-shrink-0" />

      {/* Vitals row */}
      <div className="flex-1 flex items-center gap-4 min-w-0">
        {vitals.map(({ label, value, color }) => (
          <div key={label} className="flex flex-col items-center gap-0.5 min-w-0">
            <span className={`text-sm font-bold tabular-nums leading-none ${color}`}>{value}</span>
            <span className="text-[9px] font-mono text-neutral-600 leading-none">{label}</span>
          </div>
        ))}

        {/* Vision summary */}
        {log.vision_summary && (
          <p className="hidden lg:block text-[10px] text-neutral-600 leading-snug line-clamp-1 flex-1 italic ml-2">
            {log.vision_summary}
          </p>
        )}
      </div>

      {/* Right side */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {log.seizure_suspected && (
          <span className="text-[9px] font-mono font-bold bg-red-950/60 text-red-300 border border-red-800 px-1.5 py-0.5 rounded">
            ⚠ crisis
          </span>
        )}
        {log.photo_count > 0 && (
          <span className={`text-[9px] font-mono px-2 py-0.5 rounded-full border ${
            log.has_urgent_vision
              ? 'border-orange-700 bg-orange-950/30 text-orange-300'
              : 'border-neutral-700 bg-neutral-800/60 text-neutral-500'
          }`}>
            📷 {log.photo_count}
            {log.avg_fgs != null && (
              <span className="ml-1 opacity-70">· {log.avg_fgs}</span>
            )}
          </span>
        )}
        <span className="text-neutral-700 group-hover:text-cyan-500 transition-colors text-sm">›</span>
      </div>
    </button>
  );
}

function AlertItem({ alert }) {
  const colors = {
    critical: 'border-red-700 bg-red-950/30 text-red-300',
    urgent:   'border-orange-700 bg-orange-950/30 text-orange-300',
    warning:  'border-amber-700 bg-amber-950/20 text-amber-300',
    info:     'border-neutral-700 bg-neutral-800/40 text-neutral-300',
  };
  const cls = colors[alert.level] || colors.info;
  return (
    <div className={`px-3 py-2 rounded-lg border text-xs ${cls}`}>
      {alert.message_es || alert.message}
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export default function SanjiDashboard() {
  const navigate = useNavigate();
  const [state, setState] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [copilotOpen, setCopilotOpen] = useState(false);

  const todayStr = new Date().toISOString().split('T')[0];

  useEffect(() => {
    Promise.all([
      fetch(`${API_BASE}/sanji/state`).then(r => r.json()),
      fetch(`${API_BASE}/sanji/history?days=30`).then(r => r.json()),
    ])
      .then(([stateData, historyData]) => {
        setState(stateData);
        setLogs(Array.isArray(historyData) ? historyData : []);
      })
      .catch(() => setState({ status: 'error' }))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
        <p className="text-neutral-400 font-mono text-sm animate-pulse">cargando sanji-rx…</p>
      </div>
    );
  }

  const ws = state?.week_stats || {};
  const meds = state?.medications_active || [];
  const alerts = [...(state?.alerts_unread || []), ...(state?.medication_alerts || [])];
  const logToday = state?.log_today;

  const historyContext = {
    log_today: logToday,
    week_stats: ws,
    recent_logs: logs.slice(0, 7),
    medications_active: meds,
    alerts_unread: state?.alerts_unread || [],
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-white flex">

      {/* ── Main area ─────────────────────────────────────────── */}
      <div className={`flex-1 min-w-0 transition-all duration-300 ${copilotOpen ? 'mr-80' : ''}`}>
        <div className="max-w-5xl mx-auto px-4 pt-8 pb-24">

          {/* ── Header ──────────────────────────────────────────── */}
          <div className="flex items-start justify-between mb-6">
            <div>
              <button onClick={() => navigate(-1)}
                className="text-xs font-mono text-neutral-500 hover:text-neutral-300 mb-2 flex items-center gap-1">
                ← volver
              </button>
              <h1 className="text-2xl font-bold tracking-tight">Sanji san</h1>
              <p className="text-neutral-500 text-sm font-mono mt-0.5">
                seguimiento neurológico · {todayStr}
              </p>
            </div>
            <div className="flex gap-2 items-center mt-6">
              <Link to="/sanji"
                className="px-4 py-2 bg-cyan-700 hover:bg-cyan-600 text-white rounded-lg text-xs font-mono font-bold uppercase tracking-wide transition-colors">
                + bitácora
              </Link>
              <button onClick={() => setCopilotOpen(o => !o)}
                className={`px-4 py-2 rounded-lg text-xs font-mono font-bold uppercase tracking-wide transition-colors border ${
                  copilotOpen
                    ? 'bg-cyan-900/40 text-cyan-300 border-cyan-700'
                    : 'bg-neutral-800 text-neutral-300 border-neutral-700 hover:border-cyan-700'
                }`}>
                ⬡ HERMES
              </button>
            </div>
          </div>

          {/* ── Error ───────────────────────────────────────────── */}
          {state?.status === 'error' && (
            <div className="p-3 mb-5 rounded border border-amber-700 bg-amber-950/30 text-amber-300 text-xs font-mono">
              No se pudo conectar con el backend (puerto 8001).
            </div>
          )}

          {/* ── Alertas (full width) ─────────────────────────────── */}
          {alerts.length > 0 && (
            <div className="mb-5 space-y-1.5">
              {alerts.slice(0, 4).map((a, i) => <AlertItem key={a.id || i} alert={a} />)}
            </div>
          )}

          {/* ── Today quick status ───────────────────────────────── */}
          {logToday && (
            <div className="mb-6">
              <p className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest mb-2">Estado hoy</p>
              <TodayStatusBar log={logToday} />
            </div>
          )}

          {/* ── Main 2-col grid ──────────────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_272px] gap-6 items-start">

            {/* ── LEFT: vectores + historial ──────────────────── */}
            <div className="space-y-6">

              {/* Vectores de hoy */}
              {logToday ? (
                <section>
                  <h2 className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest mb-3">Vectores de hoy</h2>
                  <div className="grid grid-cols-3 gap-2">
                    <VectorCard label="Apetito"      score={logToday.appetite_pct}        max={100} />
                    <VectorCard label="Hiperestesia" score={logToday.hyperesthesia_score}  max={5}   lowerIsBetter />
                    <VectorCard label="Ataxia"       score={logToday.ataxia_score}         max={5}   lowerIsBetter />
                    <VectorCard label="Sociabilidad" score={logToday.social_score}         max={5}   />
                    <VectorCard label="Sueño"        score={logToday.sleep_quality}        max={5}   />
                    <VectorCard label="Reactiv. sonido" score={logToday.sound_reactivity}  max={5}   lowerIsBetter />
                  </div>
                  {logToday.free_notes && (
                    <div className="mt-3 p-3 bg-neutral-900 border border-neutral-800 rounded-lg">
                      <p className="text-[10px] font-mono text-neutral-500 uppercase mb-1">Observaciones</p>
                      <p className="text-xs text-neutral-300 leading-relaxed">{logToday.free_notes}</p>
                    </div>
                  )}
                </section>
              ) : (
                <div className="p-5 rounded-xl border border-dashed border-neutral-700 text-center">
                  <p className="text-neutral-500 text-sm mb-1.5">Sin registro de hoy</p>
                  <Link to="/sanji" className="text-xs text-cyan-400 hover:text-cyan-300 font-mono">
                    → completar bitácora
                  </Link>
                </div>
              )}

              {/* Historial 30 días */}
              <section>
                <div className="flex items-baseline justify-between mb-3">
                  <h2 className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest">Historial · 30 días</h2>
                  <span className="text-[10px] font-mono text-neutral-600">{logs.length} entradas</span>
                </div>
                {logs.length === 0 ? (
                  <p className="text-sm text-neutral-600 font-mono">No hay bitácoras registradas todavía.</p>
                ) : (
                  <div className="space-y-1.5">
                    {logs.map(log => (
                      <LogRow
                        key={log.id || log.log_date}
                        log={log}
                        isToday={log.log_date === todayStr || log.log_date?.startsWith(todayStr)}
                        onClick={() => navigate(`/sanji/dia/${log.log_date}`)}
                      />
                    ))}
                  </div>
                )}
              </section>
            </div>

            {/* ── RIGHT: sidebar (sticky) ──────────────────────── */}
            <div className="space-y-5 lg:sticky lg:top-6">

              {/* KPIs semana */}
              <section>
                <h2 className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest mb-3">Semana</h2>
                <div className="grid grid-cols-2 gap-2">
                  <StatCard
                    label="Apetito"
                    value={ws.appetite_avg != null ? `${ws.appetite_avg}%` : '—'}
                    color={ws.appetite_avg >= 80 ? 'text-green-400' : ws.appetite_avg >= 50 ? 'text-amber-400' : 'text-red-400'}
                    icon="🍽"
                  />
                  <StatCard
                    label="Hiperestesia"
                    value={fmt(ws.hyperesthesia_avg)}
                    unit="/5"
                    color={ws.hyperesthesia_avg <= 2 ? 'text-green-400' : ws.hyperesthesia_avg <= 3 ? 'text-amber-400' : 'text-red-400'}
                    icon="⚡"
                  />
                  <StatCard
                    label="Adherencia"
                    value={ws.adherence_7d_pct != null ? `${ws.adherence_7d_pct}%` : '—'}
                    color={ws.adherence_7d_pct >= 90 ? 'text-green-400' : ws.adherence_7d_pct >= 70 ? 'text-amber-400' : 'text-red-400'}
                    icon="💊"
                  />
                  <StatCard label="Sociabilidad" value={fmt(ws.social_avg)} unit="/5" icon="🐾" />
                  <StatCard label="Sueño" value={fmt(ws.sleep_avg)} unit="/5" icon="💤" />
                  <StatCard
                    label="Días log."
                    value={`${ws.days_logged ?? 0}/7`}
                    color={ws.days_logged >= 6 ? 'text-green-400' : ws.days_logged >= 4 ? 'text-amber-400' : 'text-red-400'}
                    icon="📋"
                  />
                </div>
              </section>

              {/* Tendencia 7d sparklines */}
              {logs.length > 1 && (
                <section className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
                  <h2 className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest mb-3">Tendencia 7d</h2>
                  <div className="space-y-3">
                    {[
                      { label: 'Apetito',  field: 'appetite_pct',        good: 'high', max: 100 },
                      { label: 'Hiper.',   field: 'hyperesthesia_score',  good: 'low',  max: 5   },
                      { label: 'Social',   field: 'social_score',         good: 'high', max: 5   },
                      { label: 'Sueño',    field: 'sleep_quality',        good: 'high', max: 5   },
                    ].map(({ label, field, good, max }) => (
                      <div key={field} className="flex items-end gap-3">
                        <span className="text-[10px] font-mono text-neutral-500 w-12 flex-shrink-0 pb-0.5">{label}</span>
                        <SparkDots logs={logs} field={field} good={good} max={max} />
                      </div>
                    ))}
                    <p className="text-[9px] text-neutral-700 font-mono text-right pt-1">← más antiguo · hoy →</p>
                  </div>
                </section>
              )}

              {/* Medicación activa */}
              {meds.length > 0 && (
                <section>
                  <h2 className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest mb-3">Medicación activa</h2>
                  <div className="space-y-2">
                    {meds.map(med => (
                      <div key={med.id} className="flex items-center gap-2.5 p-2.5 bg-neutral-900 border border-neutral-800 rounded-lg">
                        <span className="text-base flex-shrink-0">💊</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-white truncate">{med.name}</p>
                          <p className="text-[10px] text-neutral-500 truncate">{med.dose_description}</p>
                        </div>
                        {med.days_remaining != null ? (
                          <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border flex-shrink-0 ${
                            med.days_remaining <= 2
                              ? 'text-red-300 border-red-700 bg-red-950/30'
                              : 'text-amber-300 border-amber-700 bg-amber-950/20'
                          }`}>
                            {med.days_remaining}d
                          </span>
                        ) : (
                          <span className="text-[10px] font-mono text-neutral-600 border border-neutral-700 px-1.5 py-0.5 rounded flex-shrink-0">∞</span>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              )}

            </div>
          </div>
        </div>
      </div>

      {/* ── Copilot panel (slide-in) ─────────────────────────────── */}
      {copilotOpen && (
        <div className="fixed right-0 top-0 bottom-0 w-80 z-50 shadow-2xl">
          <SanjiCopilotPanel
            historyContext={historyContext}
            onClose={() => setCopilotOpen(false)}
          />
        </div>
      )}

    </div>
  );
}

