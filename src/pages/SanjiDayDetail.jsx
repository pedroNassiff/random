/**
 * SanjiDayDetail — Vista de un día específico del historial de Sanji.
 * Ruta: /sanji/dia/:date
 */
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import DayVisionGallery from '../components/DayVisionGallery';

const API_BASE = import.meta.env.VITE_SANJI_API || 'http://localhost:8001';

// ─── small helpers ────────────────────────────────────────────────────────────

function fmt(val, suffix = '') {
  if (val == null) return '—';
  return `${val}${suffix}`;
}

function ScoreBar({ value, max = 5, lowerIsBetter = false }) {
  if (value == null) return <div className="h-1.5 w-full bg-neutral-800 rounded-full" />;
  const ratio = Math.min(1, value / max);
  const isGood = lowerIsBetter ? ratio <= 0.4 : ratio >= 0.6;
  const isBad  = lowerIsBetter ? ratio >= 0.7 : ratio <= 0.3;
  const color  = isBad ? 'bg-red-500' : isGood ? 'bg-green-500' : 'bg-amber-500';
  return (
    <div className="h-1.5 w-full bg-neutral-800 rounded-full overflow-hidden">
      <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${ratio * 100}%` }} />
    </div>
  );
}

function VectorCard({ label, value, max = 5, unit = '', lowerIsBetter = false, sub }) {
  const ratio = value != null ? value / max : null;
  const isGood = ratio != null && (lowerIsBetter ? ratio <= 0.4 : ratio >= 0.6);
  const isBad  = ratio != null && (lowerIsBetter ? ratio >= 0.7 : ratio <= 0.3);
  const valColor = value == null ? 'text-neutral-600'
    : isBad ? 'text-red-400' : isGood ? 'text-green-400' : 'text-amber-400';
  return (
    <div className="bg-neutral-900 rounded-xl border border-neutral-800 p-4 flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <span className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest">{label}</span>
        <span className={`text-2xl font-bold tabular-nums leading-none ${valColor}`}>
          {value ?? '—'}
          {value != null && <span className="text-neutral-600 text-xs font-normal ml-0.5">{unit}/{max}{unit}</span>}
        </span>
      </div>
      <ScoreBar value={value} max={max} lowerIsBetter={lowerIsBetter} />
      {sub && <p className="text-[9px] text-neutral-700 font-mono">{sub}</p>}
    </div>
  );
}

function CountCard({ label, value, icon, bad = false, neutral = false }) {
  return (
    <div className={`rounded-xl border p-4 flex flex-col gap-1 ${
      bad && value > 0 ? 'border-red-800/60 bg-red-950/20' : 'border-neutral-800 bg-neutral-900'
    }`}>
      <div className="flex items-center gap-1.5">
        <span className="text-base">{icon}</span>
        <span className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest">{label}</span>
      </div>
      <p className={`text-3xl font-bold tabular-nums ${
        bad && value > 0 ? 'text-red-400' : neutral ? 'text-neutral-400' : 'text-white'
      }`}>{value ?? '—'}</p>
    </div>
  );
}

function BoolPill({ label, value, goodWhenTrue = true }) {
  if (value == null) return null;
  const isGood = goodWhenTrue ? value : !value;
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-mono border ${
      isGood
        ? 'border-green-800/60 bg-green-950/30 text-green-400'
        : 'border-red-800/60 bg-red-950/30 text-red-400'
    }`}>
      <span className={`w-1.5 h-1.5 rounded-full ${isGood ? 'bg-green-400' : 'bg-red-400'}`} />
      {label}
    </span>
  );
}

// ─── page ─────────────────────────────────────────────────────────────────────

export default function SanjiDayDetail() {
  const { date } = useParams();
  const navigate = useNavigate();
  const [log, setLog] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const todayStr = new Date().toISOString().split('T')[0];
  const isToday = date === todayStr;

  const formatted = (() => {
    try {
      return new Date(date + 'T12:00:00').toLocaleDateString('es-ES', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
      });
    } catch { return date; }
  })();

  useEffect(() => {
    fetch(`${API_BASE}/sanji/log/${date}`)
      .then(r => r.json())
      .then(data => {
        if (!data || data.status === 'not_found') { setLog(null); return; }
        const raw = data.log ?? data;
        if (raw.caretaker_state && typeof raw.caretaker_state === 'string') {
          try { raw.caretaker_state = JSON.parse(raw.caretaker_state); } catch { raw.caretaker_state = null; }
        }
        setLog(raw);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [date]);

  return (
    <div className="min-h-screen bg-neutral-950 text-white">
      <div className="max-w-5xl mx-auto px-4 pt-8 pb-24">

        {/* ── Header ─────────────────────────────────────────── */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <button onClick={() => navigate('/sanji/dashboard')}
              className="text-xs font-mono text-neutral-600 hover:text-neutral-300 mb-3 flex items-center gap-1 transition-colors">
              ← historial
            </button>
            <h1 className="text-3xl font-bold tracking-tight capitalize">{formatted}</h1>
            {isToday && (
              <span className="text-sm font-mono text-cyan-400 mt-1 block">hoy</span>
            )}
          </div>
          <div className="mt-8">
            <Link
              to="/sanji"
              className="px-4 py-2 rounded-lg text-xs font-mono font-bold border border-cyan-700 text-cyan-400 hover:bg-cyan-950/40 transition-colors"
            >
              {isToday ? '✎ editar' : '✎ editar este día'}
            </Link>
          </div>
        </div>

        {/* ── Loading / error ─────────────────────────────────── */}
        {loading && (
          <div className="flex items-center gap-3 text-neutral-500 font-mono text-sm">
            <span className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse" />
            cargando…
          </div>
        )}
        {error && (
          <div className="p-4 rounded-xl border border-red-800 bg-red-950/20 text-red-400 text-sm font-mono">
            Error al cargar: {error}
          </div>
        )}

        {!loading && !log && !error && (
          <div className="py-16 text-center border border-dashed border-neutral-800 rounded-2xl">
            <p className="text-neutral-500 text-sm mb-1">Sin bitácora para este día.</p>
            <Link to="/sanji" className="text-xs text-cyan-400 hover:text-cyan-300 font-mono">
              → registrar ahora
            </Link>
          </div>
        )}

        {log && (
          <div className="space-y-6">

            {/* Crisis alert */}
            {log.seizure_suspected && (
              <div className="flex items-center gap-3 p-4 rounded-xl border border-red-700 bg-red-950/30 text-red-300 font-mono animate-pulse">
                <span className="text-xl">⚠</span>
                <div>
                  <p className="text-sm font-bold">Crisis epiléptica sospechada</p>
                  {log.seizure_notes && <p className="text-xs mt-0.5 opacity-80">{log.seizure_notes}</p>}
                </div>
              </div>
            )}

            {/* ── Vectores clínicos 2×2 + apetito full width ── */}
            <div>
              <h2 className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest mb-3">Vectores clínicos</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
                <VectorCard label="Apetito"      value={log.appetite_pct}        max={100} unit="%" />
                <VectorCard label="Hiperestesia" value={log.hyperesthesia_score} max={5}   lowerIsBetter sub="0=ninguna · 5=severa" />
                <VectorCard label="Sociabilidad" value={log.social_score}        max={5}   sub="5=busca compañía" />
                <VectorCard label="Sueño"        value={log.sleep_quality}       max={5}   sub="5=profundo" />
              </div>
            </div>

            {/* ── Conteos + comportamentales ── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <h2 className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest mb-3">Conteos</h2>
                <div className="grid grid-cols-3 gap-3">
                  <CountCard label="Vómitos"  value={log.vomit_count}  icon="🤢" bad={log.vomit_count > 2} />
                  <CountCard label="Bebedero" value={log.water_visits} icon="💧" />
                  <CountCard label="Plato"    value={log.food_visits}  icon="🍽" />
                </div>
              </div>
              <div>
                <h2 className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest mb-3">Comportamiento</h2>
                <div className="flex flex-wrap gap-2">
                  <BoolPill label="Se acicala"   value={log.purr_observed}      goodWhenTrue />
                  <BoolPill label="Head tilt"    value={log.head_tilt_observed} goodWhenTrue={false} />
                  <BoolPill label="Ataxia"       value={log.ataxia_observed}    goodWhenTrue={false} />
                </div>
              </div>
            </div>

            {/* ── Observaciones ── */}
            {log.observations && (
              <div className="bg-neutral-900/60 rounded-xl border border-neutral-800 p-5">
                <h2 className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest mb-3">Observaciones</h2>
                <p className="text-sm text-neutral-300 leading-relaxed whitespace-pre-line">{log.observations}</p>
              </div>
            )}

            {/* ── Co-regulación ── */}
            {log.caretaker_state && (log.caretaker_state.stress != null || log.caretaker_state.sleep != null) && (
              <div className="bg-neutral-900/40 rounded-xl border border-neutral-800 p-5">
                <h2 className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest mb-4">Co-regulación · Pedro</h2>
                <div className="grid grid-cols-2 gap-4">
                  <VectorCard label="Estrés" value={log.caretaker_state.stress} max={5} lowerIsBetter />
                  <VectorCard label="Sueño"  value={log.caretaker_state.sleep}  max={12} unit="h" />
                </div>
                {log.caretaker_state.notes && (
                  <p className="text-xs text-neutral-500 mt-4 italic border-t border-neutral-800 pt-3">
                    "{log.caretaker_state.notes}"
                  </p>
                )}
              </div>
            )}

            {/* ── Fotos + análisis visual ── */}
            <div>
              <DayVisionGallery date={date} />
            </div>

          </div>
        )}
      </div>
    </div>
  );
}


