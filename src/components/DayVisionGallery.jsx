/**
 * DayVisionGallery — Muestra las fotos del día con sus análisis clínicos,
 * y permite generar un análisis conjunto.
 */
import React, { useState, useEffect, useCallback } from 'react';
import VisionAnalysisCard from './VisionAnalysisCard';

const API_BASE = import.meta.env.VITE_SANJI_API || 'http://localhost:8001';

function PainBadge({ level }) {
  const colors = {
    none: 'bg-green-900/40 text-green-400 border-green-700',
    mild: 'bg-yellow-900/40 text-yellow-400 border-yellow-700',
    moderate: 'bg-orange-900/40 text-orange-400 border-orange-700',
    severe: 'bg-red-900/40 text-red-400 border-red-700',
    not_evaluable: 'bg-neutral-800 text-neutral-500 border-neutral-700',
  };
  if (!level) return null;
  return (
    <span className={`text-[9px] font-mono uppercase px-1.5 py-0.5 rounded border ${colors[level] ?? colors.not_evaluable}`}>
      {level}
    </span>
  );
}

function FgsScoreOverlay({ score }) {
  if (score == null) return null;
  const color = score <= 2 ? '#4ade80' : score <= 4 ? '#facc15' : score <= 6 ? '#fb923c' : '#f87171';
  return (
    <div
      className="absolute top-1 right-1 text-[10px] font-bold font-mono px-1 py-0.5 rounded bg-black/70"
      style={{ color }}
    >
      {score.toFixed(1)}
    </div>
  );
}

function UrgentDot({ flags }) {
  if (!flags?.length) return null;
  return (
    <div className="absolute top-1 left-1 w-2 h-2 rounded-full bg-red-500 animate-pulse" title={flags.join(', ')} />
  );
}

function ImageThumbnail({ item, isSelected, onSelect }) {
  const imgUrl = item.image_path
    ? `${API_BASE}${item.image_path}`
    : null;
  const time = item.captured_at
    ? new Date(item.captured_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
    : '?';

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`relative rounded-lg overflow-hidden border-2 transition-all ${
        isSelected
          ? 'border-cyan-500 scale-[1.03]'
          : 'border-neutral-700 hover:border-neutral-500'
      }`}
    >
      {imgUrl ? (
        <img
          src={imgUrl}
          alt={`Sanji ${time}`}
          className="w-full h-24 object-cover"
        />
      ) : (
        <div className="w-full h-24 bg-neutral-800 flex items-center justify-center">
          <span className="text-neutral-600 text-xs font-mono">sin img</span>
        </div>
      )}
      <FgsScoreOverlay score={item.fgs_score} />
      <UrgentDot flags={item.urgent_flags} />
      <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-1 py-0.5 text-[9px] font-mono text-neutral-300 flex items-center justify-between">
        <span>{time}</span>
        <PainBadge level={item.fgs_pain_level} />
      </div>
    </button>
  );
}

function CombinedSummary({ summary, loading, onRequest }) {
  if (loading) {
    return (
      <div className="mt-4 rounded-xl border border-neutral-700 bg-neutral-900 p-4 text-xs text-neutral-400 font-mono animate-pulse">
        Generando análisis conjunto…
      </div>
    );
  }
  if (!summary) {
    return (
      <div className="mt-4">
        <button
          type="button"
          onClick={onRequest}
          className="w-full py-2.5 rounded-lg border border-cyan-800 bg-cyan-950/30 text-cyan-400 text-xs font-mono font-bold uppercase tracking-widest hover:bg-cyan-900/40 transition-colors"
        >
          ⬡ Análisis conjunto del día
        </button>
        <p className="text-[10px] text-neutral-600 text-center mt-1 font-mono">
          Síntesis longitudinal de todas las imágenes del día
        </p>
      </div>
    );
  }
  return (
    <div className="mt-4 rounded-xl border border-cyan-800/50 bg-cyan-950/20 p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-cyan-400 text-xs font-mono font-bold uppercase tracking-widest">⬡ Síntesis del día</span>
        <button
          type="button"
          onClick={onRequest}
          className="ml-auto text-[9px] text-neutral-500 hover:text-cyan-400 font-mono border border-neutral-700 hover:border-cyan-700 px-1.5 py-0.5 rounded transition-colors"
        >
          regenerar
        </button>
      </div>
      <p className="text-sm text-neutral-200 leading-relaxed whitespace-pre-line">{summary}</p>
    </div>
  );
}

export default function DayVisionGallery({ date }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [combinedSummary, setCombinedSummary] = useState(null);
  const [combinedLoading, setCombinedLoading] = useState(false);

  const fetchDay = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/sanji/vision/day/${date}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setItems(Array.isArray(data) ? data : []);
    } catch (err) {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [date]);

  const fetchSummary = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/sanji/vision/day-summary/${date}`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.summary) setCombinedSummary(data.summary);
    } catch (_) {
      // silently ignore — summary just won't pre-load
    }
  }, [date]);

  useEffect(() => {
    fetchDay();
    fetchSummary();
  }, [fetchDay, fetchSummary]);

  // Listen for new images saved from Hermes panel
  useEffect(() => {
    const handler = (e) => {
      if (e.detail?.date === date) fetchDay();
    };
    window.addEventListener('sanji-vision-saved', handler);
    return () => window.removeEventListener('sanji-vision-saved', handler);
  }, [date, fetchDay]);

  const requestCombined = async () => {
    setCombinedLoading(true);
    setCombinedSummary(null);
    try {
      const res = await fetch(`${API_BASE}/sanji/vision/day-summary/${date}`, { method: 'POST' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setCombinedSummary(data.summary ?? data.error ?? 'Sin respuesta');
    } catch (err) {
      setCombinedSummary(`Error: ${err.message}`);
    } finally {
      setCombinedLoading(false);
    }
  };

  if (loading) {
    return (
      <section className="mt-8 border-t border-neutral-800 pt-6">
        <h2 className="text-xs font-mono text-neutral-500 uppercase tracking-widest mb-3">
          Fotos del día
        </h2>
        <p className="text-[11px] text-neutral-600 font-mono animate-pulse">cargando…</p>
      </section>
    );
  }

  if (!items.length) {
    return (
      <section className="mt-8 border-t border-neutral-800 pt-6">
        <h2 className="text-xs font-mono text-neutral-500 uppercase tracking-widest mb-1">
          Fotos del día
        </h2>
        <p className="text-[11px] text-neutral-600 font-mono">
          Sin fotos aún. Usá el botón 📷 en Hermes para subir imágenes de Sanji.
        </p>
      </section>
    );
  }

  const selectedItem = selectedIndex != null ? items[selectedIndex] : null;

  // Reconstruct analysis object from flat DB row
  function rowToAnalysis(row) {
    if (!row) return null;
    const raw = row.llm_raw;
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) return raw;
    return {
      image_quality: row.image_quality,
      fgs: {
        orbital_tightening: row.fgs_orbital,
        ear_position_score: row.fgs_ears,
        muzzle_tension: row.fgs_muzzle,
        whisker_position: row.fgs_whiskers,
        head_position: row.fgs_head,
        score: row.fgs_score,
        pain_level: row.fgs_pain_level,
      },
      eyes: row.eye_details ?? {
        pupil_symmetry: row.pupil_symmetry,
        left: { third_eyelid: row.third_eyelid_left, discharge: row.discharge_left },
        right: { third_eyelid: row.third_eyelid_right, discharge: row.discharge_right },
      },
      neurological: {
        head_tilt_deg: row.head_tilt_deg,
        ear_position: row.ear_position,
        whisker_state: row.whisker_state,
      },
      posture: {
        type: row.posture_type,
        coat_condition: row.coat_condition,
      },
      urgent_flags: row.urgent_flags ?? [],
      clinical_notes: row.clinical_notes,
      uncertainty: row.uncertainty,
    };
  }

  return (
    <section className="mt-8 border-t border-neutral-800 pt-6">
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-xs font-mono text-neutral-500 uppercase tracking-widest">
          Fotos del día · {items.length}
        </h2>
        <span className="text-[10px] font-mono text-neutral-600">{date}</span>
      </div>

      {/* Thumbnail grid */}
      <div className="grid grid-cols-3 gap-2">
        {items.map((item, i) => (
          <ImageThumbnail
            key={item.id}
            item={item}
            isSelected={selectedIndex === i}
            onSelect={() => setSelectedIndex(prev => prev === i ? null : i)}
          />
        ))}
      </div>

      {/* Expanded analysis */}
      {selectedItem && (
        <div className="mt-4 rounded-xl border border-neutral-700 bg-neutral-900 p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-mono text-neutral-500 uppercase">
              Foto {selectedIndex + 1} ·{' '}
              {selectedItem.captured_at
                ? new Date(selectedItem.captured_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
                : '?'}
            </span>
            <button
              type="button"
              onClick={() => setSelectedIndex(null)}
              className="text-neutral-600 hover:text-neutral-400 text-sm leading-none"
            >
              ✕
            </button>
          </div>
          {selectedItem.image_path && (
            <img
              src={`${API_BASE}${selectedItem.image_path}`}
              alt="Sanji"
              className="w-full rounded-lg mb-3 max-h-60 object-contain bg-black"
            />
          )}
          <VisionAnalysisCard
            analysis={rowToAnalysis(selectedItem)}
            model={selectedItem.model_used}
          />
        </div>
      )}

      {/* Combined day analysis */}
      {items.length >= 2 && (
        <CombinedSummary
          summary={combinedSummary}
          loading={combinedLoading}
          onRequest={requestCombined}
        />
      )}
    </section>
  );
}
