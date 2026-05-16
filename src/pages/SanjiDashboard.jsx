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

function VectorCard({ label, score, max = 5, color, description }) {
  const barColor = score >= max * 0.7 ? 'bg-green-500' : score >= max * 0.4 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div className="bg-neutral-900 rounded-lg p-3 border border-neutral-800">
      <div className="flex justify-between items-center">
        <span className="text-[11px] font-mono text-neutral-400">{label}</span>
        <span className="text-sm font-bold text-white tabular-nums">{fmt(score)}<span className="text-neutral-600">/{max}</span></span>
      </div>
      {score != null && <MiniBar value={score} max={max} color={barColor} />}
      {description && <p className="text-[10px] text-neutral-600 mt-1.5">{description}</p>}
    </div>
  );
}

function LogRow({ log, isToday }) {
  const date = new Date(log.log_date);
  const label = date.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' });
  const appetite = log.appetite_pct;
  const appetiteColor = appetite >= 80 ? 'text-green-400' : appetite >= 50 ? 'text-amber-400' : 'text-red-400';

  return (
    <div className={`flex items-center gap-3 px-3 py-2 rounded-lg border transition-colors
      ${isToday ? 'border-cyan-800 bg-cyan-950/20' : 'border-neutral-800 bg-neutral-900/40 hover:border-neutral-700'}`}>
      <div className="w-20 flex-shrink-0">
        <p className="text-[11px] font-mono text-neutral-400">{label}</p>
        {isToday && <p className="text-[9px] text-cyan-500 font-mono">hoy</p>}
      </div>
      <div className="flex-1 grid grid-cols-4 gap-2">
        <div>
          <p className="text-[9px] text-neutral-600 font-mono">apetito</p>
          <p className={`text-xs font-bold ${appetiteColor}`}>{fmt(appetite, '%')}</p>
        </div>
        <div>
          <p className="text-[9px] text-neutral-600 font-mono">hiper.</p>
          <p className="text-xs font-bold text-white">{fmt(log.hyperesthesia_score)}</p>
        </div>
        <div>
          <p className="text-[9px] text-neutral-600 font-mono">social</p>
          <p className="text-xs font-bold text-white">{fmt(log.social_score)}</p>
        </div>
        <div>
          <p className="text-[9px] text-neutral-600 font-mono">sueño</p>
          <p className="text-xs font-bold text-white">{fmt(log.sleep_quality)}</p>
        </div>
      </div>
      {log.seizure_suspected && (
        <span className="text-[10px] bg-red-900/40 text-red-300 border border-red-800 px-1.5 py-0.5 rounded font-mono flex-shrink-0">
          crisis
        </span>
      )}
    </div>
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
      fetch(`${API_BASE}/sanji/log?days=14`).then(r => r.json()),
    ])
      .then(([stateData, logsData]) => {
        setState(stateData);
        setLogs(Array.isArray(logsData) ? logsData : logsData.logs || []);
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

  // Contexto para el copiloto (historial resumido de los últimos 7 días)
  const historyContext = {
    log_today: logToday,
    week_stats: ws,
    recent_logs: logs.slice(0, 7),
    medications_active: meds,
    alerts_unread: state?.alerts_unread || [],
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-white flex">

      {/* ── Main column ─────────────────────────────────────────── */}
      <div className={`flex-1 transition-all duration-300 ${copilotOpen ? 'mr-80' : ''}`}>
        <div className="max-w-2xl mx-auto px-4 pt-8 pb-24">

          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <button onClick={() => navigate(-1)}
                className="text-xs font-mono text-neutral-500 hover:text-neutral-300 mb-3 flex items-center gap-1">
                ← volver
              </button>
              <h1 className="text-2xl font-bold">Sanji san</h1>
              <p className="text-neutral-500 text-sm font-mono mt-0.5">
                Panel de seguimiento neurológico
              </p>
            </div>
            <div className="flex flex-col gap-2 items-end">
              <Link to="/sanji"
                className="px-4 py-2 bg-cyan-700 hover:bg-cyan-600 text-white rounded-lg text-xs font-mono font-bold uppercase transition-colors">
                + bitácora hoy
              </Link>
              <button onClick={() => setCopilotOpen(o => !o)}
                className={`px-4 py-2 rounded-lg text-xs font-mono font-bold uppercase transition-colors border ${
                  copilotOpen
                    ? 'bg-cyan-900/40 text-cyan-300 border-cyan-700'
                    : 'bg-neutral-800 text-neutral-300 border-neutral-700 hover:border-cyan-700'
                }`}>
                ⬡ HERMES
              </button>
            </div>
          </div>

          {/* Error */}
          {state?.status === 'error' && (
            <div className="p-3 mb-4 rounded border border-amber-700 bg-amber-950/30 text-amber-300 text-xs">
              No se pudo conectar con el backend (puerto 8001).
            </div>
          )}

          {/* Alertas activas */}
          {alerts.length > 0 && (
            <section className="mb-6">
              <h2 className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest mb-2">Alertas activas</h2>
              <div className="space-y-1.5">
                {alerts.slice(0, 5).map((a, i) => <AlertItem key={a.id || i} alert={a} />)}
              </div>
            </section>
          )}

          {/* KPIs semana */}
          <section className="mb-6">
            <h2 className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest mb-3">Últimos 7 días</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <StatCard
                label="Apetito prom."
                value={ws.appetite_avg != null ? `${ws.appetite_avg}%` : '—'}
                color={ws.appetite_avg >= 80 ? 'text-green-400' : ws.appetite_avg >= 50 ? 'text-amber-400' : 'text-red-400'}
                icon="🍽"
              />
              <StatCard
                label="Hiperestesia prom."
                value={fmt(ws.hyperesthesia_avg)}
                unit="/5"
                color={ws.hyperesthesia_avg <= 2 ? 'text-green-400' : ws.hyperesthesia_avg <= 3 ? 'text-amber-400' : 'text-red-400'}
                icon="⚡"
              />
              <StatCard
                label="Adherencia med."
                value={ws.adherence_7d_pct != null ? `${ws.adherence_7d_pct}%` : '—'}
                color={ws.adherence_7d_pct >= 90 ? 'text-green-400' : ws.adherence_7d_pct >= 70 ? 'text-amber-400' : 'text-red-400'}
                icon="💊"
              />
              <StatCard label="Sociabilidad prom." value={fmt(ws.social_avg)} unit="/5" icon="🐾" />
              <StatCard label="Calidad sueño prom." value={fmt(ws.sleep_avg)} unit="/5" icon="💤" />
              <StatCard
                label="Días registrados"
                value={`${ws.days_logged ?? 0}/7`}
                color={ws.days_logged >= 6 ? 'text-green-400' : ws.days_logged >= 4 ? 'text-amber-400' : 'text-red-400'}
                icon="📋"
              />
            </div>
          </section>

          {/* Estado de hoy */}
          {logToday && (
            <section className="mb-6">
              <h2 className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest mb-3">Vectores de hoy</h2>
              <div className="grid grid-cols-2 gap-2">
                <VectorCard label="Apetito" score={logToday.appetite_pct} max={100} />
                <VectorCard label="Hiperestesia" score={logToday.hyperesthesia_score} max={5} />
                <VectorCard label="Ataxia" score={logToday.ataxia_score} max={5} />
                <VectorCard label="Sociabilidad" score={logToday.social_score} max={5} />
                <VectorCard label="Calidad sueño" score={logToday.sleep_quality} max={5} />
                <VectorCard label="Interacción social" score={logToday.social_score} max={5} />
              </div>
              {logToday.free_notes && (
                <div className="mt-3 p-3 bg-neutral-900 border border-neutral-800 rounded-lg">
                  <p className="text-[10px] font-mono text-neutral-500 uppercase mb-1">Observaciones</p>
                  <p className="text-xs text-neutral-300 leading-relaxed">{logToday.free_notes}</p>
                </div>
              )}
            </section>
          )}

          {/* Medicaciones */}
          {meds.length > 0 && (
            <section className="mb-6">
              <h2 className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest mb-3">Medicación activa</h2>
              <div className="space-y-2">
                {meds.map(med => (
                  <div key={med.id} className="flex items-center gap-3 p-3 bg-neutral-900 border border-neutral-800 rounded-lg">
                    <span className="text-lg flex-shrink-0">💊</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{med.name}</p>
                      <p className="text-[11px] text-neutral-500">{med.dose_description} · cada {med.frequency_hours}h</p>
                    </div>
                    {med.days_remaining != null && (
                      <span className={`text-[10px] font-mono px-2 py-0.5 rounded border flex-shrink-0 ${
                        med.days_remaining <= 2
                          ? 'text-red-300 border-red-700 bg-red-950/30'
                          : 'text-amber-300 border-amber-700 bg-amber-950/20'
                      }`}>
                        {med.days_remaining}d
                      </span>
                    )}
                    {med.days_remaining == null && (
                      <span className="text-[10px] font-mono text-neutral-500 border border-neutral-700 px-2 py-0.5 rounded flex-shrink-0">∞</span>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Historial de logs */}
          <section>
            <h2 className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest mb-3">Historial (14 días)</h2>
            {logs.length === 0 ? (
              <p className="text-sm text-neutral-600">No hay bitácoras registradas todavía.</p>
            ) : (
              <div className="space-y-1.5">
                {logs.map(log => (
                  <LogRow
                    key={log.id || log.log_date}
                    log={log}
                    isToday={log.log_date === todayStr || log.log_date?.startsWith(todayStr)}
                  />
                ))}
              </div>
            )}
          </section>

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
