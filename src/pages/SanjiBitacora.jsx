import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import SanjiCopilotPanel from '../components/SanjiCopilotPanel';
import DayVisionGallery from '../components/DayVisionGallery';
import { ResponsiveGridLayout, useContainerWidth } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import '../styles/Analytics.css';

const API_BASE = import.meta.env.VITE_SANJI_API || 'http://localhost:8001';

const SANJI_STORAGE_KEY = 'sanji_bitacora_layout';
const DEFAULT_LAYOUT = {
  lg: [
    { i: 'digestivo',    x: 0, y: 0,  w: 8, h: 8, minW: 5, minH: 6 },
    { i: 'medicacion',   x: 8, y: 0,  w: 4, h: 8, minW: 3, minH: 5 },
    { i: 'sensorial',    x: 0, y: 8,  w: 4, h: 6, minW: 3, minH: 5 },
    { i: 'motor',        x: 4, y: 8,  w: 4, h: 5, minW: 3, minH: 4 },
    { i: 'semana',       x: 8, y: 8,  w: 4, h: 6, minW: 3, minH: 5 },
    { i: 'emocional',    x: 0, y: 14, w: 4, h: 6, minW: 3, minH: 5 },
    { i: 'suenio',       x: 4, y: 14, w: 4, h: 5, minW: 3, minH: 4 },
    { i: 'coregulacion', x: 8, y: 14, w: 4, h: 5, minW: 3, minH: 4 },
    { i: 'flags',        x: 0, y: 19, w: 8, h: 7, minW: 5, minH: 6 },
    { i: 'fotos',        x: 8, y: 19, w: 4, h: 9, minW: 3, minH: 6 },
  ]
};

// ─── helpers ────────────────────────────────────────────────────────────────

const today = () => new Date().toISOString().split('T')[0];

function ScoreSlider({ label, name, min = 0, max = 5, step = 0.5, value, onChange, hint }) {
  return (
    <div className="mb-4">
      <div className="flex justify-between items-baseline mb-1">
        <label className="text-xs font-mono text-neutral-400 uppercase tracking-widest">{label}</label>
        <span className="text-base font-bold text-white tabular-nums">{value ?? '—'}</span>
      </div>
      <input
        type="range"
        name={name}
        min={min}
        max={max}
        step={step}
        value={value ?? min}
        onChange={e => onChange(name, parseFloat(e.target.value))}
        className="w-full accent-cyan-400 cursor-pointer"
      />
      {hint && <p className="text-[10px] text-neutral-600 mt-0.5">{hint}</p>}
    </div>
  );
}

// sentiment: 'good' = verde cuando activo | 'bad' = rojo cuando activo | 'neutral' = cyan cuando activo
function Toggle({ label, name, value, onChange, sentiment = 'neutral' }) {
  const active = {
    good:    'bg-green-900/40 text-green-300 border-green-700',
    bad:     'bg-red-900/40 text-red-300 border-red-700',
    warning: 'bg-amber-900/40 text-amber-300 border-amber-700',
    neutral: 'bg-cyan-900/40 text-cyan-300 border-cyan-700',
  };
  const dot = {
    good: 'bg-green-400', bad: 'bg-red-400', warning: 'bg-amber-400', neutral: 'bg-cyan-400',
  };
  return (
    <button
      type="button"
      onClick={() => onChange(name, !value)}
      className={`flex items-center gap-2 px-3 py-1.5 rounded text-xs font-mono transition-colors border ${
        value ? active[sentiment] : 'bg-neutral-800 text-neutral-500 border-neutral-700'
      }`}
    >
      <span className={`w-2 h-2 rounded-full ${value ? dot[sentiment] : 'bg-neutral-600'}`} />
      {label}
    </button>
  );
}

function MedCard({ med, givenSlots, onToggleSlot, onTimeChange }) {
  const hours = med.schedule_hours || [];
  const dosesPerDay = hours.length || 1;
  const givenCount = hours.filter(h => givenSlots[`${med.id}_${h}`]).length;
  const allGiven = givenCount === dosesPerDay;

  return (
    <div className={`p-3 rounded border transition-all ${
      allGiven ? 'border-green-700 bg-green-900/20' : 'border-neutral-700 bg-neutral-800'
    }`}>
      <div className="flex justify-between items-start mb-2">
        <div>
          <p className="text-sm font-semibold text-neutral-200">{med.name}</p>
          <p className="text-xs text-neutral-500 mt-0.5">{med.dose_description} · {dosesPerDay}x/día</p>
          {med.days_remaining != null && (
            <p className="text-xs text-amber-500 mt-0.5">⚠ {med.days_remaining} días restantes</p>
          )}
        </div>
        <span className="text-xs font-mono text-neutral-500">{givenCount}/{dosesPerDay}</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {hours.map(hour => {
          const key = `${med.id}_${hour}`;
          const isGiven = !!givenSlots[key];
          return (
            <div key={key} className="flex flex-col gap-1 items-start">
              <button
                type="button"
                onClick={() => onToggleSlot(key)}
                className={`px-3 py-1.5 rounded text-xs font-mono border transition-all ${
                  isGiven
                    ? 'bg-green-900/30 border-green-700 text-green-300'
                    : 'bg-neutral-900 border-neutral-700 text-neutral-400 hover:border-cyan-600'
                }`}
              >
                {isGiven ? '✓' : '○'} {String(hour).padStart(2,'0')}:00
              </button>
              {isGiven && (
                <input
                  type="time"
                  value={givenSlots[key]}
                  onChange={e => onTimeChange(key, e.target.value)}
                  className="text-[11px] font-mono bg-neutral-900 border border-green-800 rounded px-1.5 py-0.5 text-green-300 w-[72px]"
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AlertBanner({ alerts }) {
  if (!alerts?.length) return null;
  const critical = alerts.filter(a => a.level === 'critical' || a.level === 'urgent');
  if (!critical.length) return null;
  return (
    <div className="mb-4 p-3 rounded border border-red-700 bg-red-950/40">
      {critical.map((a, i) => (
        <p key={a.id ?? `${a.kind ?? a.level}-${i}`} className="text-red-300 text-xs font-mono">
          ⚠ {a.message_es ?? a.message}
        </p>
      ))}
    </div>
  );
}

// ─── main page ───────────────────────────────────────────────────────────────

export default function SanjiBitacora() {
  const navigate = useNavigate();
  const [state, setState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedOk, setSavedOk] = useState(false);
  const [copilotOpen, setCopilotOpen] = useState(false);
  const [form, setForm] = useState({
    // Digestivo
    appetite_pct: 80,
    vomit_count: 0,
    stool_quality: 3,
    food_accepted: true,
    food_visits: 0,       // cuántas veces se acercó al plato
    water_visits: 0,      // cuántas veces fue al bebedero (indicador PU/PD fenobarbital)
    // Sensorial
    hyperesthesia_score: 0,
    visual_tracking: false,
    sound_reactivity: 2,
    // Motor
    ataxia_score: 0,
    grooming: true,
    jump_attempt: false,
    // Emocional / conductual
    social_score: 3,
    hiding: false,
    play_interest: false,
    vocalization_count: 0,
    // Sueño
    sleep_quality: 3,
    sleep_hours: 14,
    // Co-regulación
    caretaker_state: { stress: 3, sleep: 6, notes: '' },
    // Seizure flag
    seizure_suspected: false,
    // Observaciones libres
    free_notes: '',
  });
  const [medGiven, setMedGiven] = useState({});

  // ── fetch state ────────────────────────────────────────────────────────────
  useEffect(() => {
    fetch(`${API_BASE}/sanji/state`)
      .then(r => r.json())
      .then(data => {
        setState(data);
        // Pre-marcar meds ya dadas hoy (por slot de hora)
        const alreadyGiven = {};
        (data.administrations_today || []).forEach(a => {
          if (a.given) {
            const hour = new Date(a.scheduled_at).getHours();
            const givenDate = a.given_at ? new Date(a.given_at) : new Date(a.scheduled_at);
            const hhmm = `${String(givenDate.getHours()).padStart(2,'0')}:${String(givenDate.getMinutes()).padStart(2,'0')}`;
            alreadyGiven[`${a.medication_id}_${hour}`] = hhmm;
          }
        });
        setMedGiven(alreadyGiven);
        // Pre-rellenar form con el log de hoy si ya existe
        if (data.log_today) {
          const l = data.log_today;
          setForm(f => ({
            ...f,
            appetite_pct:        l.appetite_pct        ?? f.appetite_pct,
            vomit_count:         l.vomit_count         ?? f.vomit_count,
            stool_quality:       l.stool_quality       ?? f.stool_quality,
            food_accepted:       l.food_accepted       ?? f.food_accepted,
            food_visits:         l.food_visits         ?? f.food_visits,
            water_visits:        l.water_visits        ?? f.water_visits,
            hyperesthesia_score: l.hyperesthesia_score ?? f.hyperesthesia_score,
            visual_tracking:     l.visual_tracking     ?? f.visual_tracking,
            sound_reactivity:    l.sound_reactivity    ?? f.sound_reactivity,
            ataxia_score:        l.ataxia_score        ?? f.ataxia_score,
            grooming:            l.grooming            ?? f.grooming,
            jump_attempt:        l.jump_attempt        ?? f.jump_attempt,
            social_score:        l.social_score        ?? f.social_score,
            hiding:              l.hiding              ?? f.hiding,
            play_interest:       l.play_interest       ?? f.play_interest,
            vocalization_count:  l.vocalization_count  ?? f.vocalization_count,
            sleep_quality:       l.sleep_quality       ?? f.sleep_quality,
            sleep_hours:         l.sleep_hours         ?? f.sleep_hours,
            seizure_suspected:   l.seizure_suspected   ?? f.seizure_suspected,
            free_notes:          l.observations        || f.free_notes,
            caretaker_state:     (typeof l.caretaker_state === 'string'
              ? (() => { try { return JSON.parse(l.caretaker_state); } catch { return f.caretaker_state; } })()
              : l.caretaker_state) || f.caretaker_state,
          }));
        }
      })
      .catch(() => setState({ status: 'error' }))
      .finally(() => setLoading(false));
  }, []);

  const setField = (name, value) => setForm(f => ({ ...f, [name]: value }));

  const nowHHMM = () => {
    const n = new Date();
    return `${String(n.getHours()).padStart(2,'0')}:${String(n.getMinutes()).padStart(2,'0')}`;
  };

  const toggleDose = (key) =>
    setMedGiven(prev => ({ ...prev, [key]: prev[key] ? null : nowHHMM() }));

  const setDoseTime = (key, hhmm) =>
    setMedGiven(prev => ({ ...prev, [key]: hhmm }));

  // ── grid layout ────────────────────────────────────────────────────────────
  const { containerRef: gridRef, width: gridWidth } = useContainerWidth();
  const [layouts, setLayouts] = useState(() => {
    try {
      const saved = localStorage.getItem(SANJI_STORAGE_KEY);
      if (!saved) return DEFAULT_LAYOUT;
      const parsed = JSON.parse(saved);
      const items = parsed.lg ?? [];
      const isValid = items.length === DEFAULT_LAYOUT.lg.length &&
        items.every(item => item.w >= 2 && item.h >= 2);
      if (!isValid) {
        localStorage.removeItem(SANJI_STORAGE_KEY);
        return DEFAULT_LAYOUT;
      }
      return parsed;
    } catch { return DEFAULT_LAYOUT; }
  });

  const handleLayoutChange = useCallback((_, allLayouts) => {
    setLayouts(allLayouts);
    localStorage.setItem(SANJI_STORAGE_KEY, JSON.stringify(allLayouts));
  }, []);

  const resetLayout = () => {
    setLayouts(DEFAULT_LAYOUT);
    localStorage.removeItem(SANJI_STORAGE_KEY);
  };

  const DragHandle = ({ title }) => (
    <div className="widget-drag-handle">
      <span className="widget-title">{title}</span>
      <span className="drag-hint">⠿</span>
    </div>
  );

  // ── submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = async e => {
    e.preventDefault();
    setSaving(true);
    setSavedOk(false);
    try {
      // 1. Log diario
      await fetch(`${API_BASE}/sanji/log`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          log_date: today(),
          ...form,
          observations: form.free_notes,        // mapeo correcto al campo del backend
          caretaker_state: form.caretaker_state,
        }),
      });

      // 2. Medicaciones dadas — una llamada por slot de hora marcado
      const meds = state?.medications_active || [];
      for (const med of meds) {
        for (const hour of (med.schedule_hours || [])) {
          const key = `${med.id}_${hour}`;
          if (medGiven[key]) {
            const scheduledAt = new Date();
            scheduledAt.setHours(hour, 0, 0, 0);
            const givenAt = new Date();
            const [gh, gm] = medGiven[key].split(':').map(Number);
            givenAt.setHours(gh, gm, 0, 0);
            await fetch(`${API_BASE}/sanji/medications/${med.id}/give`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                scheduled_at: scheduledAt.toISOString(),
                given_at: givenAt.toISOString(),
              }),
            });
          }
        }
      }

      setSavedOk(true);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
        <p className="text-neutral-400 font-mono text-sm animate-pulse">cargando sanji-rx…</p>
      </div>
    );
  }

  const meds = state?.medications_active || [];
  const alerts = [
    ...(state?.alerts_unread || []),
    ...(state?.medication_alerts || []),
  ];

  return (
    <div className="min-h-screen bg-neutral-950 text-white flex">
      <div className={`flex-1 min-w-0 transition-all duration-300 ${copilotOpen ? 'mr-80' : ''}`}>
        <div className="max-w-7xl mx-auto px-4 pt-8 pb-24">

          {/* ── Header ──────────────────────────────────────────── */}
          <div className="flex items-start justify-between mb-5">
            <div>
              <button type="button" onClick={() => navigate(-1)}
                className="text-xs font-mono text-neutral-500 hover:text-neutral-300 mb-2 flex items-center gap-1">
                ← volver
              </button>
              <h1 className="text-2xl font-bold tracking-tight">El Día de Sanji</h1>
              <p className="text-neutral-500 text-sm mt-0.5 font-mono">
                {today()}{state?.log_today ? ' · editando registro existente' : ''}
              </p>
            </div>
            <div className="flex gap-2 items-center mt-6">
              <Link to="/sanji/dashboard"
                className="text-xs font-mono text-neutral-400 hover:text-cyan-400 border border-neutral-700 hover:border-cyan-700 px-3 py-1.5 rounded transition-colors">
                dashboard →
              </Link>
              <button type="button" onClick={resetLayout} className="reset-layout-btn">
                ↺ layout
              </button>
              <button type="button" onClick={() => setCopilotOpen(o => !o)}
                className={`px-3 py-1.5 rounded text-xs font-mono font-bold uppercase border transition-colors ${
                  copilotOpen
                    ? 'bg-cyan-900/40 text-cyan-300 border-cyan-700'
                    : 'bg-neutral-800 text-neutral-400 border-neutral-700 hover:border-cyan-700'
                }`}>
                ⬡ HERMES
              </button>
            </div>
          </div>

          {/* ── Alertas + error (full width) ────────────────────── */}
          <AlertBanner alerts={alerts} />
          {state?.status === 'error' && (
            <div className="p-3 mb-4 rounded border border-amber-700 bg-amber-950/30 text-amber-300 text-xs font-mono">
              No se pudo conectar con el backend (puerto 8001). ¿Está corriendo?
            </div>
          )}

          {/* ── Widget Grid ──────────────────────────────────────── */}
          <form onSubmit={handleSubmit}>
            <div ref={gridRef} className="dashboard-grid">
              <ResponsiveGridLayout
                width={gridWidth}
                layouts={layouts}
                onLayoutChange={handleLayoutChange}
                breakpoints={{ lg: 1200, md: 996, sm: 768 }}
                cols={{ lg: 12, md: 10, sm: 6 }}
                rowHeight={60}
                draggableHandle=".widget-drag-handle"
                draggableCancel="input,textarea,button,select,label,a"
                margin={[16, 16]}
                containerPadding={[0, 0]}
                useCSSTransforms
              >
                {/* DIGESTIVO */}
                <div key="digestivo" className="widget">
                  <DragHandle title="Sistema Digestivo" />
                  <div className="widget-body widget-scroll">
                    <div className="grid grid-cols-2 gap-x-6">
                      <ScoreSlider label="Apetito" name="appetite_pct"
                        min={0} max={100} step={5} value={form.appetite_pct} onChange={setField}
                        hint="100 = todo · 0 = nada" />
                      <ScoreSlider label="Calidad heces" name="stool_quality"
                        min={1} max={5} step={1} value={form.stool_quality} onChange={setField}
                        hint="1=diarrea · 5=normal" />
                      <ScoreSlider label="Vómitos" name="vomit_count"
                        min={0} max={10} step={1} value={form.vomit_count} onChange={setField} />
                      <div className="flex flex-col justify-center gap-2 pb-4">
                        <Toggle label="Aceptó comida" name="food_accepted" value={form.food_accepted} onChange={setField} sentiment="good" />
                      </div>
                      <ScoreSlider label="Visitas al plato" name="food_visits"
                        min={0} max={20} step={1} value={form.food_visits} onChange={setField}
                        hint="# de veces" />
                      <ScoreSlider label="Visitas al bebedero" name="water_visits"
                        min={0} max={30} step={1} value={form.water_visits} onChange={setField}
                        hint="↑ = PU/PD fenobarbital" />
                    </div>
                  </div>
                </div>

                {/* SENSORIAL */}
                <div key="sensorial" className="widget">
                  <DragHandle title="Sensorial" />
                  <div className="widget-body widget-scroll">
                    <ScoreSlider label="Hiperestesia" name="hyperesthesia_score"
                      min={0} max={5} step={1} value={form.hyperesthesia_score} onChange={setField}
                      hint="0=ninguna · 5=severa" />
                    <ScoreSlider label="Reactividad sonido" name="sound_reactivity"
                      min={0} max={5} step={1} value={form.sound_reactivity} onChange={setField} />
                    <Toggle label="Seguimiento visual" name="visual_tracking" value={form.visual_tracking} onChange={setField} sentiment="good" />
                  </div>
                </div>

                {/* MOTOR */}
                <div key="motor" className="widget">
                  <DragHandle title="Motor" />
                  <div className="widget-body widget-scroll">
                    <ScoreSlider label="Ataxia" name="ataxia_score"
                      min={0} max={5} step={1} value={form.ataxia_score} onChange={setField}
                      hint="0=normal · 5=no camina" />
                    <div className="flex flex-wrap gap-2 mt-3">
                      <Toggle label="Se acicala" name="grooming" value={form.grooming} onChange={setField} sentiment="good" />
                      <Toggle label="Intentó saltar" name="jump_attempt" value={form.jump_attempt} onChange={setField} sentiment="good" />
                    </div>
                  </div>
                </div>

                {/* EMOCIONAL */}
                <div key="emocional" className="widget">
                  <DragHandle title="Emocional / Conductual" />
                  <div className="widget-body widget-scroll">
                    <ScoreSlider label="Sociabilidad" name="social_score"
                      min={0} max={5} step={1} value={form.social_score} onChange={setField}
                      hint="0=aislamiento · 5=busca compañía" />
                    <ScoreSlider label="Vocalizaciones" name="vocalization_count"
                      min={0} max={20} step={1} value={form.vocalization_count} onChange={setField} />
                    <div className="flex flex-wrap gap-2 mt-2">
                      <Toggle label="Se esconde" name="hiding" value={form.hiding} onChange={setField} sentiment="bad" />
                      <Toggle label="Interés en juego" name="play_interest" value={form.play_interest} onChange={setField} sentiment="good" />
                    </div>
                  </div>
                </div>

                {/* SUEÑO */}
                <div key="suenio" className="widget">
                  <DragHandle title="Sueño" />
                  <div className="widget-body widget-scroll">
                    <ScoreSlider label="Calidad" name="sleep_quality"
                      min={0} max={5} step={1} value={form.sleep_quality} onChange={setField}
                      hint="5=profundo tranquilo · 0=inquieto" />
                    <ScoreSlider label="Horas durmiendo" name="sleep_hours"
                      min={0} max={24} step={0.5} value={form.sleep_hours} onChange={setField} />
                  </div>
                </div>

                {/* CO-REGULACIÓN */}
                <div key="coregulacion" className="widget">
                  <DragHandle title="Co-regulación (Pedro)" />
                  <div className="widget-body widget-scroll">
                    <div className="grid grid-cols-2 gap-x-6">
                      <ScoreSlider label="Estrés (1-5)" name="stress"
                        min={1} max={5} step={1}
                        value={form.caretaker_state.stress}
                        onChange={(_, v) => setForm(f => ({ ...f, caretaker_state: { ...f.caretaker_state, stress: v } }))} />
                      <ScoreSlider label="Horas de sueño" name="sleep"
                        min={0} max={12} step={0.5}
                        value={form.caretaker_state.sleep}
                        onChange={(_, v) => setForm(f => ({ ...f, caretaker_state: { ...f.caretaker_state, sleep: v } }))} />
                    </div>
                    <textarea rows={2}
                      placeholder="¿Cómo estás hoy?"
                      className="w-full bg-neutral-800 border border-neutral-700 rounded p-2 text-sm text-white placeholder-neutral-600 resize-none focus:border-cyan-600 outline-none"
                      value={form.caretaker_state.notes}
                      onChange={e => setForm(f => ({ ...f, caretaker_state: { ...f.caretaker_state, notes: e.target.value } }))}
                    />
                  </div>
                </div>

                {/* FLAGS + OBSERVACIONES + SUBMIT */}
                <div key="flags" className="widget">
                  <DragHandle title="⚠ Flags · Observaciones · Guardar" />
                  <div className="widget-body widget-scroll space-y-4">
                    <div>
                      <h2 className="text-[10px] font-mono text-red-500 uppercase tracking-widest mb-3">⚠ Flags clínicas</h2>
                      <Toggle label="¿Posible crisis epiléptica?" name="seizure_suspected"
                        value={form.seizure_suspected} onChange={setField} sentiment="bad" />
                      <p className="text-[10px] text-neutral-600 mt-1">
                        Sacudidas, mirada fija, pérdida de conciencia o movimientos involuntarios.
                      </p>
                    </div>
                    <div>
                      <label className="block text-[10px] font-mono text-neutral-500 uppercase tracking-widest mb-2">
                        Observaciones libres
                      </label>
                      <textarea rows={3}
                        placeholder="Describe con tus palabras cómo estuvo Sanji hoy…"
                        className="w-full bg-neutral-800 border border-neutral-700 rounded p-2 text-sm text-white placeholder-neutral-600 resize-none focus:border-cyan-600 outline-none"
                        value={form.free_notes}
                        onChange={e => setField('free_notes', e.target.value)}
                      />
                    </div>
                    <button type="submit" disabled={saving}
                      className="w-full py-3 rounded font-mono text-sm font-bold uppercase tracking-widest transition-all bg-cyan-700 hover:bg-cyan-600 text-white disabled:opacity-50">
                      {saving ? 'Guardando…' : 'Guardar bitácora del día'}
                    </button>
                    {savedOk && (
                      <p className="text-center text-green-400 text-sm font-mono">
                        ✓ {state?.log_today ? 'Bitácora actualizada.' : 'Guardada correctamente.'}
                      </p>
                    )}
                  </div>
                </div>

                {/* MEDICACIÓN */}
                <div key="medicacion" className="widget">
                  <DragHandle title="Medicación de hoy" />
                  <div className="widget-body widget-scroll">
                    {meds.length > 0 ? (
                      <div className="space-y-2">
                        {meds.map(med => (
                          <MedCard key={med.id} med={med} givenSlots={medGiven} onToggleSlot={toggleDose} onTimeChange={setDoseTime} />
                        ))}
                      </div>
                    ) : (
                      <p className="text-neutral-600 text-xs font-mono">Sin medicaciones activas.</p>
                    )}
                  </div>
                </div>

                {/* STATS SEMANA */}
                <div key="semana" className="widget">
                  <DragHandle title="Semana" />
                  <div className="widget-body widget-scroll">
                    {state?.week_stats ? (
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          ['Apetito', state.week_stats.appetite_avg != null ? `${state.week_stats.appetite_avg}%` : '—'],
                          ['Hiperestesia', state.week_stats.hyperesthesia_avg ?? '—'],
                          ['Sociabilidad', state.week_stats.social_avg ?? '—'],
                          ['Sueño', state.week_stats.sleep_avg ?? '—'],
                          ['Adherencia', `${state.week_stats.adherence_7d_pct ?? '—'}%`],
                          ['Días log.', `${state.week_stats.days_logged ?? 0}/7`],
                        ].map(([label, val]) => (
                          <div key={label} className="bg-neutral-800 rounded-lg p-2.5">
                            <p className="text-[9px] text-neutral-500 font-mono uppercase">{label}</p>
                            <p className="text-base font-bold text-white mt-0.5 tabular-nums">{val}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-neutral-600 text-xs font-mono">Sin datos de semana.</p>
                    )}
                  </div>
                </div>

                {/* FOTOS */}
                <div key="fotos" className="widget">
                  <DragHandle title="Fotos del día" />
                  <div className="widget-body widget-scroll">
                    <DayVisionGallery date={today()} />
                  </div>
                </div>
              </ResponsiveGridLayout>
            </div>
          </form>
        </div>
      </div>

      {/* ── Copilot panel ─────────────────────────────────────── */}
      {copilotOpen && (
        <div className="fixed right-0 top-0 bottom-0 w-80 z-50 shadow-2xl">
          <SanjiCopilotPanel
            historyContext={{
              log_today: state?.log_today,
              week_stats: state?.week_stats,
              medications_active: state?.medications_active,
              alerts_unread: state?.alerts_unread,
            }}
            logDate={today()}
            onClose={() => setCopilotOpen(false)}
          />
        </div>
      )}
    </div>
  );
}
