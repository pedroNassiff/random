/**
 * VisionAnalysisCard — Muestra el resultado del análisis clínico visual de Hermes.
 * Recibe el objeto `analysis` del endpoint /sanji/vision/analyze.
 */
import React, { useState } from 'react';

const FGS_LABELS = ['none', 'mild', 'moderate', 'severe'];
const FGS_COLORS = {
  none: 'text-green-400',
  mild: 'text-yellow-400',
  moderate: 'text-orange-400',
  severe: 'text-red-400',
  not_evaluable: 'text-neutral-500',
};

const UAF_NAMES = {
  orbital_tightening: 'Tensión orbital',
  ear_position_score: 'Orejas',
  muzzle_tension: 'Muzzle',
  whisker_position: 'Vibrisas',
  head_position: 'Posición cabeza',
};

function FGSBar({ score, max = 10 }) {
  if (score == null) return <span className="text-[10px] text-neutral-500 font-mono">no evaluable</span>;
  const pct = (score / max) * 100;
  const color = score <= 2 ? '#4ade80' : score <= 4 ? '#facc15' : score <= 6 ? '#fb923c' : '#f87171';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-neutral-700 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <span className="text-[11px] font-mono" style={{ color }}>{score.toFixed(1)}/10</span>
    </div>
  );
}

function UAFRow({ label, value }) {
  const isNA = value === 'not_evaluable' || value == null;
  const dots = isNA ? null : [0, 1, 2].map(i => (
    <span key={i} className={`w-2.5 h-2.5 rounded-full inline-block ${
      i <= value ? 'bg-orange-400' : 'bg-neutral-700'
    }`} />
  ));
  return (
    <div className="flex items-center justify-between">
      <span className="text-[10px] text-neutral-400">{label}</span>
      <div className="flex items-center gap-1">
        {isNA
          ? <span className="text-[9px] text-neutral-600 font-mono">—</span>
          : dots
        }
      </div>
    </div>
  );
}

function EyeInfo({ side, data }) {
  if (!data) return null;
  const hasIssue = data.third_eyelid && data.third_eyelid !== 'not_visible' && data.third_eyelid !== 'not_evaluable';
  const hasDischarge = data.discharge && data.discharge !== 'none' && data.discharge !== 'not_evaluable';
  return (
    <div className="text-[10px]">
      <span className="text-neutral-500 font-mono uppercase text-[9px]">{side}</span>
      {hasIssue && <span className="ml-1 text-yellow-400">3er parp: {data.third_eyelid}</span>}
      {hasDischarge && <span className="ml-1 text-orange-400">descarga: {data.discharge}</span>}
      {!hasIssue && !hasDischarge && <span className="ml-1 text-neutral-600">ok</span>}
    </div>
  );
}

export default function VisionAnalysisCard({ analysis, model, imagePreview }) {
  const [expanded, setExpanded] = useState(false);

  if (!analysis) return null;

  if (analysis.error) {
    return (
      <div className="rounded-xl bg-neutral-800 border border-neutral-700 px-3 py-2.5 text-[11px] text-neutral-400">
        No se pudo analizar la imagen: <span className="text-red-400">{analysis.reason || analysis.error}</span>
      </div>
    );
  }

  const fgs = analysis.fgs || {};
  const eyes = analysis.eyes || {};
  const neuro = analysis.neurological || {};
  const posture = analysis.posture || {};
  const urgentFlags = analysis.urgent_flags || [];
  const hasUrgent = urgentFlags.length > 0;

  const qualityColor = {
    good: 'text-green-400', acceptable: 'text-yellow-400', poor: 'text-red-400'
  }[analysis.image_quality] || 'text-neutral-500';

  return (
    <div className={`rounded-xl border overflow-hidden ${
      hasUrgent ? 'border-red-500/50 bg-red-900/10' : 'border-neutral-700 bg-neutral-800'
    }`}>
      {/* Header */}
      <div className="px-3 py-2 flex items-center justify-between border-b border-neutral-700/60">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-cyan-400 bg-cyan-900/30 px-1.5 py-0.5 rounded">
            ⬡ VISIÓN
          </span>
          {hasUrgent && (
            <span className="text-[9px] font-mono text-red-400 bg-red-900/30 px-1.5 py-0.5 rounded animate-pulse">
              ALERTA
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-[9px] font-mono ${qualityColor}`}>
            img: {analysis.image_quality || '?'}
          </span>
          <button
            onClick={() => setExpanded(e => !e)}
            className="text-[10px] text-neutral-500 hover:text-white font-mono"
          >
            {expanded ? '▲' : '▼'}
          </button>
        </div>
      </div>

      {/* Urgent flags */}
      {hasUrgent && (
        <div className="px-3 py-1.5 space-y-0.5">
          {urgentFlags.map((f, i) => (
            <div key={i} className="flex items-start gap-1.5">
              <span className="text-red-400 text-[10px] flex-shrink-0 mt-0.5">⚠</span>
              <span className="text-[11px] text-red-300">{f}</span>
            </div>
          ))}
        </div>
      )}

      {/* FGS score */}
      <div className="px-3 py-2 space-y-1.5">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] text-neutral-400 font-mono uppercase tracking-wide">FGS (dolor)</span>
          <span className={`text-[10px] font-mono ${FGS_COLORS[fgs.pain_level] || 'text-neutral-400'}`}>
            {fgs.pain_level || '—'}
            {fgs.confidence && <span className="text-neutral-600 ml-1">({fgs.confidence})</span>}
          </span>
        </div>
        <FGSBar score={fgs.score} />
      </div>

      {/* Clinical notes */}
      {analysis.clinical_notes && (
        <div className="px-3 pb-2">
          <p className="text-[11px] text-white/75 leading-relaxed">{analysis.clinical_notes}</p>
        </div>
      )}

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-neutral-700/60 px-3 py-2 space-y-3">

          {/* FGS breakdown */}
          {fgs.evaluable_count > 0 && (
            <div>
              <p className="text-[9px] font-mono text-neutral-500 uppercase mb-1.5">FGS por UAF</p>
              <div className="space-y-1">
                {Object.entries(UAF_NAMES).map(([key, label]) => (
                  <UAFRow key={key} label={label} value={fgs[key]} />
                ))}
              </div>
            </div>
          )}

          {/* Neurológico */}
          <div>
            <p className="text-[9px] font-mono text-neutral-500 uppercase mb-1.5">Neurológico</p>
            <div className="space-y-1 text-[10px]">
              <div className="flex justify-between">
                <span className="text-neutral-400">Simetría pupilar</span>
                <span className={eyes.pupil_symmetry === 'marked_asymmetry' ? 'text-red-400' :
                  eyes.pupil_symmetry === 'mild_asymmetry' ? 'text-yellow-400' : 'text-green-400'}>
                  {eyes.pupil_symmetry || '—'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-400">Head tilt</span>
                <span className={neuro.head_tilt_deg > 10 ? 'text-red-400' :
                  neuro.head_tilt_deg > 5 ? 'text-yellow-400' : 'text-neutral-300'}>
                  {neuro.head_tilt_deg != null ? `${neuro.head_tilt_deg}° ${neuro.head_tilt_direction || ''}` : '—'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-400">Simetría facial</span>
                <span className={neuro.facial_symmetry === 'marked_asymmetry' ? 'text-red-400' :
                  neuro.facial_symmetry === 'mild_asymmetry' ? 'text-yellow-400' : 'text-neutral-300'}>
                  {neuro.facial_symmetry || '—'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-400">Orejas</span>
                <span className="text-neutral-300">{neuro.ear_position || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-400">Vibrisas</span>
                <span className="text-neutral-300">{neuro.whisker_state || '—'}</span>
              </div>
            </div>
          </div>

          {/* Ojos detalle */}
          <div>
            <p className="text-[9px] font-mono text-neutral-500 uppercase mb-1.5">Ojos</p>
            <EyeInfo side="izq" data={eyes.left} />
            <EyeInfo side="der" data={eyes.right} />
          </div>

          {/* Postura */}
          <div>
            <p className="text-[9px] font-mono text-neutral-500 uppercase mb-1.5">Postura</p>
            <div className="flex justify-between text-[10px]">
              <span className="text-neutral-400">{posture.type || '—'}</span>
              <span className={posture.coat_condition === 'poor' ? 'text-orange-400' :
                posture.coat_condition === 'fair' ? 'text-yellow-400' : 'text-neutral-300'}>
                pelo: {posture.coat_condition || '—'}
              </span>
            </div>
          </div>

          {/* Incertidumbre */}
          {analysis.uncertainty && (
            <div>
              <p className="text-[9px] font-mono text-neutral-500 uppercase mb-1">Limitaciones</p>
              <p className="text-[10px] text-neutral-500 italic">{analysis.uncertainty}</p>
            </div>
          )}

          {/* Modelo */}
          {model && (
            <p className="text-[9px] text-neutral-700 font-mono">{model}</p>
          )}
        </div>
      )}
    </div>
  );
}
