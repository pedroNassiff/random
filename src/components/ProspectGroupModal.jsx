/**
 * ProspectGroupModal.jsx
 * 2-step wizard for AI-powered prospect group generation.
 *
 * Step 1 — Configure search (identity context + parameters)
 * Step 2 — Review generated prospects (accept / discard / bulk)
 */
import React, { useState, useEffect, useRef } from 'react'

const API = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:8000' : '')

// ── Score / Fit colors ────────────────────────────────────────────────────────
const SCORE_COLOR = (s) => {
  if (!s && s !== 0) return '#6b7280'
  if (s >= 80) return '#22c55e'
  if (s >= 60) return '#3b82f6'
  if (s >= 40) return '#f59e0b'
  return '#ef4444'
}
const FIT_COLOR = { high: '#22c55e', mid: '#f59e0b', low: '#ef4444' }
const FIT_LABEL = { high: 'HIGH FIT', mid: 'MID FIT', low: 'LOW FIT' }

// ── Tier colors ───────────────────────────────────────────────────────────────
const TIER_COLORS = { 1: '#a78bfa', 2: '#60a5fa', 3: '#34d399', 4: '#fbbf24' }

// ── Options ───────────────────────────────────────────────────────────────────
const SECTOR_OPTIONS = [
  { value: 'creative_studios', label: 'Creative Studios' },
  { value: 'institutions',     label: 'Institutions / Culture' },
  { value: 'scale_ups',        label: 'Scale-ups / SaaS' },
  { value: 'other',            label: 'Other tech' },
]

const FOCUS_OPTIONS = [
  { value: 'legacy',           label: 'Legacy modernization' },
  { value: 'ai_integration',   label: 'AI integration' },
  { value: '3d_visualization', label: '3D / WebGL' },
  { value: 'data_pipeline',    label: 'Data pipeline' },
  { value: 'automation',       label: 'Automation' },
]

const SIZE_OPTIONS = [
  { value: '5-15',    label: '5–15 employees' },
  { value: '15-80',   label: '15–80 employees' },
  { value: '80-200',  label: '80–200 employees' },
  { value: '200-500', label: '200–500 employees' },
]

// ── Helper: toggling array values ─────────────────────────────────────────────
function toggleArr(arr, val) {
  return arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val]
}

// ── Chip input for geo ────────────────────────────────────────────────────────
function ChipInput({ chips, onChange }) {
  const [input, setInput] = useState('')

  const add = () => {
    const v = input.trim()
    if (!v || chips.includes(v)) { setInput(''); return }
    onChange([...chips, v])
    setInput('')
  }

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, alignItems: 'center',
      background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: 7, padding: '6px 10px', minHeight: 36 }}>
      {chips.map(c => (
        <span key={c} style={{
          padding: '2px 8px', borderRadius: 20, background: 'rgba(139,92,246,0.15)',
          border: '1px solid rgba(139,92,246,0.3)', color: '#c4b5fd',
          fontSize: '0.6rem', fontFamily: 'monospace', display: 'flex', alignItems: 'center', gap: 4,
        }}>
          {c}
          <button onClick={() => onChange(chips.filter(x => x !== c))}
            style={{ background: 'none', border: 'none', color: 'rgba(196,181,253,0.5)',
              cursor: 'pointer', padding: 0, lineHeight: 1, fontSize: '0.7rem' }}>×</button>
        </span>
      ))}
      <input
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add() } }}
        placeholder="Add city + Enter…"
        style={{ background: 'none', border: 'none', outline: 'none', color: '#f1f5f9',
          fontSize: '0.6rem', fontFamily: 'monospace', minWidth: 100, flex: 1 }}
      />
    </div>
  )
}

// ── Multi-select chip buttons ─────────────────────────────────────────────────
function MultiChips({ options, selected, onChange }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
      {options.map(o => {
        const active = selected.includes(o.value)
        return (
          <button key={o.value} onClick={() => onChange(toggleArr(selected, o.value))}
            style={{
              padding: '3px 10px', borderRadius: 20, cursor: 'pointer',
              border: active ? '1px solid rgba(139,92,246,0.6)' : '1px solid rgba(255,255,255,0.1)',
              background: active ? 'rgba(139,92,246,0.15)' : 'transparent',
              color: active ? '#c4b5fd' : 'rgba(255,255,255,0.35)',
              fontSize: '0.6rem', fontFamily: 'monospace', fontWeight: active ? 700 : 400,
              transition: 'all 0.12s',
            }}>
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

// ── Prospect card (step 2) ────────────────────────────────────────────────────
function ProspectCard({ prospect, index, onAccept, onDiscard }) {
  const [expanded, setExpanded] = useState(false)
  const score     = prospect.ai_score || 0
  const scoreCol  = SCORE_COLOR(score)
  const fitCol    = FIT_COLOR[prospect.fit_category] || '#6b7280'
  const tierCol   = TIER_COLORS[prospect.tier] || '#6b7280'
  const ev        = prospect.entry_vector || {}
  const isAccepted  = prospect.status === 'accepted'
  const isDiscarded = prospect.status === 'discarded'

  return (
    <div style={{
      borderRadius: 10,
      border: `1px solid ${isAccepted ? 'rgba(34,197,94,0.35)' : isDiscarded ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.08)'}`,
      background: isAccepted ? 'rgba(34,197,94,0.04)' : isDiscarded ? 'rgba(239,68,68,0.03)' : 'rgba(255,255,255,0.025)',
      borderLeft: `3px solid ${isAccepted ? '#22c55e' : isDiscarded ? '#ef4444' : tierCol}`,
      opacity: isDiscarded ? 0.5 : 1,
      transition: 'all 0.15s',
    }}>
      {/* Card header */}
      <div style={{ padding: '12px 14px 10px', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        {/* Score */}
        <div style={{ textAlign: 'center', flexShrink: 0, minWidth: 42 }}>
          <div style={{ fontSize: '1.3rem', fontWeight: 800, color: scoreCol, fontFamily: 'monospace', lineHeight: 1 }}>
            {score}
          </div>
          <div style={{ fontSize: '0.45rem', color: 'rgba(255,255,255,0.3)', fontFamily: 'monospace', letterSpacing: '0.08em' }}>
            SCORE
          </div>
        </div>

        {/* Main info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3, flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#f1f5f9', fontFamily: 'monospace' }}>
              {prospect.company}
            </span>
            <span style={{
              fontSize: '0.5rem', color: fitCol, background: fitCol + '15',
              border: `1px solid ${fitCol}30`, borderRadius: 3, padding: '1px 5px',
              fontFamily: 'monospace', letterSpacing: '0.06em', fontWeight: 700,
            }}>
              {FIT_LABEL[prospect.fit_category] || 'FIT'}
            </span>
            <span style={{
              fontSize: '0.5rem', color: tierCol, background: tierCol + '12',
              border: `1px solid ${tierCol}25`, borderRadius: 3, padding: '1px 5px',
              fontFamily: 'monospace',
            }}>
              T{prospect.tier}
            </span>
          </div>
          <div style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.4)', fontFamily: 'monospace', marginBottom: 4 }}>
            📍 {prospect.location}
            {prospect.decision_maker && <span style={{ marginLeft: 8 }}>· 👤 {prospect.decision_maker}</span>}
          </div>

          {/* Entry vector highlight */}
          {ev.title && (
            <div style={{
              padding: '5px 8px', borderRadius: 5, marginBottom: 4,
              background: 'rgba(139,92,246,0.07)', border: '1px solid rgba(139,92,246,0.2)',
              fontSize: '0.58rem', color: '#c4b5fd', fontFamily: 'monospace',
            }}>
              ✦ {ev.title}
            </div>
          )}

          {/* Why — truncated */}
          <p style={{
            fontSize: '0.6rem', color: 'rgba(255,255,255,0.45)', fontFamily: 'monospace',
            lineHeight: 1.5, margin: 0, cursor: 'pointer',
            display: expanded ? 'block' : '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: expanded ? 'visible' : 'hidden',
          }} onClick={() => setExpanded(v => !v)}>
            {prospect.why}
          </p>

          {/* tags */}
          {prospect.tags?.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
              {prospect.tags.map(t => (
                <span key={t} style={{
                  fontSize: '0.5rem', padding: '1px 5px', borderRadius: 3,
                  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
                  color: 'rgba(255,255,255,0.3)', fontFamily: 'monospace',
                }}>{t}</span>
              ))}
            </div>
          )}
        </div>

        {/* Links */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flexShrink: 0 }}>
          {prospect.linkedin_url && (
            <a href={prospect.linkedin_url.startsWith('http') ? prospect.linkedin_url : `https://${prospect.linkedin_url}`}
              target="_blank" rel="noreferrer"
              onClick={e => e.stopPropagation()}
              style={{ fontSize: '0.55rem', color: '#60a5fa', fontFamily: 'monospace', textDecoration: 'none' }}>
              LinkedIn ↗
            </a>
          )}
          {prospect.website && (
            <a href={prospect.website.startsWith('http') ? prospect.website : `https://${prospect.website}`}
              target="_blank" rel="noreferrer"
              onClick={e => e.stopPropagation()}
              style={{ fontSize: '0.55rem', color: '#60a5fa', fontFamily: 'monospace', textDecoration: 'none' }}>
              Web ↗
            </a>
          )}
        </div>
      </div>

      {/* Accept / Discard row */}
      <div style={{
        padding: '8px 14px', borderTop: '1px solid rgba(255,255,255,0.05)',
        display: 'flex', gap: 8, alignItems: 'center',
      }}>
        <button
          onClick={() => onAccept(index)}
          style={{
            flex: 1, padding: '5px 0', borderRadius: 6, cursor: 'pointer',
            border: `1px solid ${isAccepted ? 'rgba(34,197,94,0.6)' : 'rgba(34,197,94,0.3)'}`,
            background: isAccepted ? 'rgba(34,197,94,0.18)' : 'rgba(34,197,94,0.06)',
            color: isAccepted ? '#86efac' : 'rgba(134,239,172,0.6)',
            fontSize: '0.58rem', fontFamily: 'monospace', fontWeight: 700, letterSpacing: '0.06em',
            transition: 'all 0.12s',
          }}>
          {isAccepted ? '✓ ACEPTADO' : '✓ ACEPTAR'}
        </button>
        <button
          onClick={() => onDiscard(index)}
          style={{
            flex: 1, padding: '5px 0', borderRadius: 6, cursor: 'pointer',
            border: `1px solid ${isDiscarded ? 'rgba(239,68,68,0.5)' : 'rgba(239,68,68,0.2)'}`,
            background: isDiscarded ? 'rgba(239,68,68,0.12)' : 'rgba(239,68,68,0.04)',
            color: isDiscarded ? '#fca5a5' : 'rgba(252,165,165,0.45)',
            fontSize: '0.58rem', fontFamily: 'monospace', fontWeight: 700, letterSpacing: '0.06em',
            transition: 'all 0.12s',
          }}>
          {isDiscarded ? '✕ DESCARTADO' : '✕ DESCARTAR'}
        </button>
      </div>
    </div>
  )
}


// ── Main ProspectGroupModal ───────────────────────────────────────────────────
export default function ProspectGroupModal({ onClose, onGroupSaved }) {
  const [step, setStep] = useState(1)

  // ── Step 1 config state ──
  const [groupName,       setGroupName]       = useState('')
  const [identityText,    setIdentityText]    = useState('')
  const [identityLoaded,  setIdentityLoaded]  = useState(false)
  const [extraContext,    setExtraContext]     = useState('')
  const [geo,             setGeo]             = useState(['Barcelona', 'Madrid'])
  const [sectors,         setSectors]         = useState(['creative_studios'])
  const [sizeRange,       setSizeRange]       = useState('15-80')
  const [focus,           setFocus]           = useState(['ai_integration', '3d_visualization'])
  const [minScore,        setMinScore]        = useState(65)
  const [batchSize,       setBatchSize]       = useState(15)
  const [useDbRefs,       setUseDbRefs]       = useState(true)
  const [showIdentity,    setShowIdentity]    = useState(false)
  const fileInputRef = useRef(null)

  // ── Generation state ──
  const [generating,      setGenerating]      = useState(false)
  const [genError,        setGenError]        = useState(null)
  const [tmpId,           setTmpId]           = useState(null)
  const [genConfig,       setGenConfig]       = useState(null)

  // ── Step 2 prospect state ──
  const [prospects,       setProspects]       = useState([])
  const [bulkThreshold,   setBulkThreshold]   = useState(75)
  const [saving,          setSaving]          = useState(false)
  const [saveError,       setSaveError]       = useState(null)

  // Load default identity on mount
  useEffect(() => {
    fetch(`${API}/prospecting/groups/identity-default`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d?.content) {
          setIdentityText(d.content)
          setIdentityLoaded(true)
        }
      })
      .catch(() => {})
  }, [])

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      setIdentityText(ev.target.result)
      setIdentityLoaded(false) // custom upload
    }
    reader.readAsText(file)
  }

  const generate = async () => {
    if (!groupName.trim()) { setGenError('Ingresá un nombre para el grupo'); return }
    if (sectors.length === 0) { setGenError('Elegí al menos un sector'); return }
    if (geo.length === 0) { setGenError('Ingresá al menos una ciudad'); return }
    setGenerating(true); setGenError(null)
    try {
      const res = await fetch(`${API}/prospecting/groups/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          group_name:       groupName.trim(),
          identity_context: identityText || undefined,
          extra_context:    extraContext || undefined,
          geo,
          sectors,
          size_range:       sizeRange,
          focus,
          min_score:        minScore,
          batch_size:       batchSize,
          use_db_references: useDbRefs,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.detail || `Error ${res.status}`)
      }
      const data = await res.json()
      setProspects(data.prospects || [])
      setTmpId(data.tmp_id)
      setGenConfig(data.config)
      setStep(2)
    } catch (err) {
      setGenError(err.message)
    } finally {
      setGenerating(false)
    }
  }

  const acceptProspect  = (i) => setProspects(ps => ps.map((p, idx) =>
    idx === i ? { ...p, status: p.status === 'accepted' ? 'pending' : 'accepted' } : p
  ))
  const discardProspect = (i) => setProspects(ps => ps.map((p, idx) =>
    idx === i ? { ...p, status: p.status === 'discarded' ? 'pending' : 'discarded' } : p
  ))

  const bulkAccept  = () => setProspects(ps =>
    ps.map(p => p.status !== 'discarded' && p.ai_score >= bulkThreshold
      ? { ...p, status: 'accepted' } : p)
  )
  const bulkDiscard = () => setProspects(ps =>
    ps.map(p => p.status !== 'accepted' && p.ai_score < bulkThreshold
      ? { ...p, status: 'discarded' } : p)
  )

  const saveGroup = async () => {
    const accepted = prospects.filter(p => p.status === 'accepted')
    if (accepted.length === 0) { setSaveError('Aceptá al menos un prospecto'); return }
    setSaving(true); setSaveError(null)
    try {
      const res = await fetch(`${API}/prospecting/groups`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name:      groupName,
          config:    genConfig || {},
          prospects, // all items, including discarded
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.detail || `Error ${res.status}`)
      }
      const data = await res.json()
      onGroupSaved?.(data)
      onClose()
    } catch (err) {
      setSaveError(err.message)
    } finally {
      setSaving(false)
    }
  }

  // Counts
  const accepted  = prospects.filter(p => p.status === 'accepted').length
  const discarded = prospects.filter(p => p.status === 'discarded').length
  const pending   = prospects.filter(p => p.status === 'pending').length

  // ── Styles ──
  const overlayStyle = {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 1300, padding: 16, backdropFilter: 'blur(8px)',
  }
  const modalStyle = {
    background: '#080b15', border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 16, width: '100%', maxWidth: step === 1 ? 900 : 1200,
    maxHeight: '95vh', display: 'flex', flexDirection: 'column',
    overflow: 'hidden',
  }
  const labelStyle = {
    fontSize: '0.55rem', color: 'rgba(255,255,255,0.35)', fontFamily: 'monospace',
    textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 6, display: 'block',
  }
  const inputStyle = {
    width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 7, padding: '8px 12px', color: '#f1f5f9', fontSize: '0.7rem',
    fontFamily: 'monospace', outline: 'none', boxSizing: 'border-box',
  }

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose() }} style={overlayStyle}>
      <div style={modalStyle}>

        {/* ── Header ── */}
        <div style={{
          padding: '14px 22px', borderBottom: '1px solid rgba(255,255,255,0.07)',
          background: 'rgba(139,92,246,0.08)', display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', flexShrink: 0,
        }}>
          <div>
            <div style={{ fontSize: '0.52rem', color: '#8b5cf6', fontFamily: 'monospace',
              letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 3 }}>
              {step === 1 ? 'Nuevo grupo de prospección · Paso 1 / 2' : `Revisión de prospectos · Paso 2 / 2`}
            </div>
            <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#f1f5f9', fontFamily: 'monospace' }}>
              {step === 1 ? 'Configurar búsqueda IA' : `"${groupName}" · ${prospects.length} generados`}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {step === 2 && (
              <button onClick={() => setStep(1)}
                style={{
                  padding: '5px 12px', borderRadius: 6,
                  border: '1px solid rgba(255,255,255,0.15)',
                  background: 'transparent', color: 'rgba(255,255,255,0.4)',
                  fontSize: '0.6rem', fontFamily: 'monospace', cursor: 'pointer',
                }}>
                ← Volver a config
              </button>
            )}
            <button onClick={onClose}
              style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.35)',
                fontSize: '1.3rem', cursor: 'pointer', padding: '2px 8px', lineHeight: 1 }}>×</button>
          </div>
        </div>

        {/* ── Step indicators ── */}
        <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.07)', flexShrink: 0 }}>
          {[
            { n: 1, label: '① Configurar', sub: 'identidad + parámetros' },
            { n: 2, label: '② Revisar',    sub: 'aceptar / descartar' },
          ].map(s => (
            <div key={s.n} style={{
              flex: 1, padding: '10px 16px',
              background: step === s.n ? 'rgba(139,92,246,0.08)' : 'transparent',
              borderBottom: step === s.n ? '2px solid #8b5cf6' : '2px solid transparent',
            }}>
              <div style={{
                fontSize: '0.68rem', fontWeight: step === s.n ? 700 : 400,
                color: step === s.n ? '#c4b5fd' : step > s.n ? 'rgba(167,139,250,0.5)' : 'rgba(255,255,255,0.2)',
                fontFamily: 'monospace',
              }}>
                {step > s.n ? '✓ ' : ''}{s.label}
              </div>
              <div style={{ fontSize: '0.5rem', color: 'rgba(255,255,255,0.25)', fontFamily: 'monospace', marginTop: 1 }}>
                {s.sub}
              </div>
            </div>
          ))}
        </div>

        {/* ── Body ── */}
        <div style={{ flex: 1, overflowY: 'auto' }}>

          {/* ════════════════════════════════════════════════════════════ STEP 1 */}
          {step === 1 && (
            <div style={{ display: 'flex', height: '100%' }}>

              {/* LEFT — Identity & context */}
              <div style={{
                width: 420, flexShrink: 0, padding: '20px 20px',
                borderRight: '1px solid rgba(255,255,255,0.06)',
                display: 'flex', flexDirection: 'column', gap: 14, overflowY: 'auto',
              }}>
                <div style={{ fontSize: '0.55rem', color: 'rgba(139,92,246,0.7)', fontFamily: 'monospace',
                  letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 4 }}>
                  Identidad & contexto de búsqueda
                </div>

                {/* Identity source */}
                <div>
                  <span style={labelStyle}>Documento de identidad</span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <div style={{
                      flex: 1, padding: '8px 12px', borderRadius: 7,
                      background: identityLoaded ? 'rgba(34,197,94,0.05)' : 'rgba(139,92,246,0.06)',
                      border: `1px solid ${identityLoaded ? 'rgba(34,197,94,0.25)' : 'rgba(139,92,246,0.25)'}`,
                      display: 'flex', alignItems: 'center', gap: 6,
                    }}>
                      <span style={{ fontSize: '0.6rem' }}>{identityLoaded ? '✓' : identityText ? '📄' : '⚪'}</span>
                      <span style={{ fontSize: '0.58rem', color: identityLoaded ? '#86efac' : identityText ? '#c4b5fd' : 'rgba(255,255,255,0.3)', fontFamily: 'monospace' }}>
                        {identityLoaded ? 'prospect-identity.md (default)' : identityText ? 'Documento custom cargado' : 'Sin documento'}
                      </span>
                    </div>
                    <button onClick={() => fileInputRef.current?.click()}
                      style={{
                        padding: '5px 10px', borderRadius: 6, cursor: 'pointer',
                        border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.05)',
                        color: 'rgba(255,255,255,0.45)', fontSize: '0.58rem', fontFamily: 'monospace',
                        whiteSpace: 'nowrap',
                      }}>
                      📤 Subir
                    </button>
                    <input ref={fileInputRef} type="file" accept=".md,.txt,.pdf"
                      style={{ display: 'none' }} onChange={handleFileUpload} />
                  </div>
                  <div style={{ marginTop: 5 }}>
                    <button onClick={() => setShowIdentity(v => !v)}
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: 'rgba(255,255,255,0.25)', fontSize: '0.55rem', fontFamily: 'monospace',
                        padding: 0, letterSpacing: '0.05em',
                      }}>
                      {showIdentity ? '▲ Ocultar contenido' : '▼ Ver / editar identidad'}
                    </button>
                    {showIdentity && (
                      <textarea
                        value={identityText}
                        onChange={e => { setIdentityText(e.target.value); setIdentityLoaded(false) }}
                        rows={12}
                        style={{ ...inputStyle, marginTop: 6, resize: 'vertical', lineHeight: 1.5, fontSize: '0.58rem' }}
                      />
                    )}
                  </div>
                </div>

                {/* Extra context */}
                <div>
                  <span style={labelStyle}>Contexto adicional (opcional)</span>
                  <textarea
                    rows={4}
                    value={extraContext}
                    onChange={e => setExtraContext(e.target.value)}
                    placeholder="Foco especial, restricciones, proyectos en mente, nicho específico…"
                    style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }}
                  />
                </div>

                {/* Use DB references */}
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <div
                    onClick={() => setUseDbRefs(v => !v)}
                    style={{
                      width: 32, height: 18, borderRadius: 9, cursor: 'pointer', flexShrink: 0,
                      background: useDbRefs ? '#8b5cf6' : 'rgba(255,255,255,0.1)',
                      border: useDbRefs ? '1px solid #7c3aed' : '1px solid rgba(255,255,255,0.15)',
                      position: 'relative', transition: 'background 0.15s',
                    }}>
                    <div style={{
                      position: 'absolute', top: 2, left: useDbRefs ? 15 : 2,
                      width: 12, height: 12, borderRadius: '50%',
                      background: 'white', transition: 'left 0.15s',
                    }} />
                  </div>
                  <div>
                    <div style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.6)', fontFamily: 'monospace' }}>
                      Usar referencias de la BD
                    </div>
                    <div style={{ fontSize: '0.52rem', color: 'rgba(255,255,255,0.25)', fontFamily: 'monospace', marginTop: 1 }}>
                      Lee prospectos existentes para calibrar scores y evitar duplicados
                    </div>
                  </div>
                </label>
              </div>

              {/* RIGHT — Search parameters */}
              <div style={{
                flex: 1, padding: '20px 22px',
                display: 'flex', flexDirection: 'column', gap: 16, overflowY: 'auto',
              }}>
                <div style={{ fontSize: '0.55rem', color: 'rgba(139,92,246,0.7)', fontFamily: 'monospace',
                  letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 4 }}>
                  Parámetros de búsqueda
                </div>

                {/* Group name */}
                <div>
                  <span style={labelStyle}>Nombre del grupo</span>
                  <input
                    value={groupName}
                    onChange={e => setGroupName(e.target.value)}
                    placeholder="Ej: Creative Studios BCN · Mayo 2026"
                    style={inputStyle}
                  />
                </div>

                {/* Sector */}
                <div>
                  <span style={labelStyle}>Sector / nicho</span>
                  <MultiChips options={SECTOR_OPTIONS} selected={sectors} onChange={setSectors} />
                </div>

                {/* Geo */}
                <div>
                  <span style={labelStyle}>Geografía — ciudades / países</span>
                  <ChipInput chips={geo} onChange={setGeo} />
                </div>

                {/* Size */}
                <div>
                  <span style={labelStyle}>Tamaño de empresa</span>
                  <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                    {SIZE_OPTIONS.map(o => (
                      <button key={o.value} onClick={() => setSizeRange(o.value)}
                        style={{
                          padding: '4px 10px', borderRadius: 6, cursor: 'pointer',
                          border: sizeRange === o.value ? '1px solid rgba(139,92,246,0.6)' : '1px solid rgba(255,255,255,0.1)',
                          background: sizeRange === o.value ? 'rgba(139,92,246,0.15)' : 'transparent',
                          color: sizeRange === o.value ? '#c4b5fd' : 'rgba(255,255,255,0.35)',
                          fontSize: '0.6rem', fontFamily: 'monospace', fontWeight: sizeRange === o.value ? 700 : 400,
                        }}>
                        {o.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Focus */}
                <div>
                  <span style={labelStyle}>Foco técnico</span>
                  <MultiChips options={FOCUS_OPTIONS} selected={focus} onChange={setFocus} />
                </div>

                {/* Score + Batch in a row */}
                <div style={{ display: 'flex', gap: 14 }}>
                  <div style={{ flex: 1 }}>
                    <span style={labelStyle}>Score mínimo ({minScore})</span>
                    <input
                      type="range" min={40} max={90} value={minScore}
                      onChange={e => setMinScore(+e.target.value)}
                      style={{ width: '100%', accentColor: '#8b5cf6' }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
                      <span style={{ fontSize: '0.5rem', color: 'rgba(255,255,255,0.2)', fontFamily: 'monospace' }}>40 (amplio)</span>
                      <span style={{ fontSize: '0.5rem', color: 'rgba(255,255,255,0.2)', fontFamily: 'monospace' }}>90 (strict)</span>
                    </div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <span style={labelStyle}>Cantidad de prospectos ({batchSize})</span>
                    <input
                      type="range" min={5} max={25} value={batchSize}
                      onChange={e => setBatchSize(+e.target.value)}
                      style={{ width: '100%', accentColor: '#8b5cf6' }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
                      <span style={{ fontSize: '0.5rem', color: 'rgba(255,255,255,0.2)', fontFamily: 'monospace' }}>5</span>
                      <span style={{ fontSize: '0.5rem', color: 'rgba(255,255,255,0.2)', fontFamily: 'monospace' }}>25</span>
                    </div>
                  </div>
                </div>

                {/* Info box */}
                <div style={{
                  padding: '10px 14px', borderRadius: 7, marginTop: 4,
                  background: 'rgba(139,92,246,0.05)', border: '1px solid rgba(139,92,246,0.15)',
                  fontSize: '0.58rem', color: 'rgba(255,255,255,0.35)', fontFamily: 'monospace', lineHeight: 1.6,
                }}>
                  ℹ El modelo generará empresas <strong style={{ color: 'rgba(196,181,253,0.7)' }}>reales y específicas</strong> basándose
                  en tu identidad de marca y los parámetros configurados.
                  Con referencias de BD activas, evitará duplicados y calibrará scores frente a tus contactos existentes.
                </div>

                {genError && (
                  <div style={{
                    padding: '8px 12px', borderRadius: 6,
                    background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
                    fontSize: '0.62rem', color: '#fca5a5', fontFamily: 'monospace',
                  }}>
                    ⚠ {genError}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════ STEP 2 */}
          {step === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

              {/* Bulk controls bar */}
              <div style={{
                padding: '10px 20px', borderBottom: '1px solid rgba(255,255,255,0.07)',
                background: 'rgba(0,0,0,0.2)', display: 'flex', alignItems: 'center',
                gap: 12, flexWrap: 'wrap', flexShrink: 0,
              }}>
                <div style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.4)', fontFamily: 'monospace' }}>
                  Bulk · score ≥
                </div>
                <input
                  type="number" min={0} max={100} value={bulkThreshold}
                  onChange={e => setBulkThreshold(+e.target.value)}
                  style={{ width: 50, ...inputStyle, padding: '3px 6px', fontSize: '0.62rem' }}
                />
                <button onClick={bulkAccept}
                  style={{
                    padding: '4px 12px', borderRadius: 6, cursor: 'pointer',
                    border: '1px solid rgba(34,197,94,0.4)', background: 'rgba(34,197,94,0.08)',
                    color: '#86efac', fontSize: '0.6rem', fontFamily: 'monospace', fontWeight: 700,
                  }}>
                  ✓ Aceptar todos ≥ {bulkThreshold}
                </button>
                <button onClick={bulkDiscard}
                  style={{
                    padding: '4px 12px', borderRadius: 6, cursor: 'pointer',
                    border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.06)',
                    color: '#fca5a5', fontSize: '0.6rem', fontFamily: 'monospace', fontWeight: 700,
                  }}>
                  ✕ Descartar &lt; {bulkThreshold}
                </button>
                <div style={{ marginLeft: 'auto', display: 'flex', gap: 10 }}>
                  {[
                    { label: `${accepted} aceptados`, color: '#22c55e' },
                    { label: `${discarded} descartados`, color: '#ef4444' },
                    { label: `${pending} pendientes`, color: '#6b7280' },
                  ].map(b => (
                    <span key={b.label} style={{
                      fontSize: '0.58rem', color: b.color, fontFamily: 'monospace',
                      background: b.color + '10', border: `1px solid ${b.color}25`,
                      borderRadius: 4, padding: '2px 8px',
                    }}>
                      {b.label}
                    </span>
                  ))}
                </div>
              </div>

              {/* Prospects grid */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
                {prospects.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px 0', color: 'rgba(255,255,255,0.2)',
                    fontSize: '0.7rem', fontFamily: 'monospace' }}>
                    No se generaron prospectos con este score mínimo.
                  </div>
                ) : (
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
                    gap: 10,
                  }}>
                    {prospects.map((p, i) => (
                      <ProspectCard
                        key={i}
                        prospect={p}
                        index={i}
                        onAccept={acceptProspect}
                        onDiscard={discardProspect}
                      />
                    ))}
                  </div>
                )}
              </div>

              {saveError && (
                <div style={{
                  margin: '0 20px 8px', padding: '8px 12px', borderRadius: 6,
                  background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
                  fontSize: '0.62rem', color: '#fca5a5', fontFamily: 'monospace', flexShrink: 0,
                }}>
                  ⚠ {saveError}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div style={{
          padding: '12px 22px', borderTop: '1px solid rgba(255,255,255,0.07)',
          background: 'rgba(0,0,0,0.2)', display: 'flex', gap: 8,
          alignItems: 'center', flexShrink: 0,
        }}>
          <button onClick={onClose}
            style={{
              padding: '8px 16px', borderRadius: 7, cursor: 'pointer',
              border: '1px solid rgba(255,255,255,0.1)', background: 'transparent',
              color: 'rgba(255,255,255,0.3)', fontSize: '0.62rem', fontFamily: 'monospace',
            }}>
            Cancelar
          </button>

          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            {step === 1 && (
              <button
                onClick={generate}
                disabled={generating}
                style={{
                  padding: '9px 22px', borderRadius: 8, cursor: generating ? 'not-allowed' : 'pointer',
                  border: '1px solid rgba(167,139,250,0.5)',
                  background: generating ? 'rgba(167,139,250,0.06)' : 'rgba(167,139,250,0.18)',
                  color: generating ? 'rgba(196,181,253,0.5)' : '#c4b5fd',
                  fontSize: '0.68rem', fontFamily: 'monospace', fontWeight: 700, letterSpacing: '0.1em',
                  display: 'flex', alignItems: 'center', gap: 8,
                }}>
                {generating
                  ? <><span style={{ display: 'inline-block', animation: 'spin 1s linear infinite' }}>⟳</span> GENERANDO…</>
                  : '→ GENERAR GRUPO'}
              </button>
            )}

            {step === 2 && (
              <button
                onClick={saveGroup}
                disabled={saving || accepted === 0}
                style={{
                  padding: '9px 22px', borderRadius: 8,
                  cursor: (saving || accepted === 0) ? 'not-allowed' : 'pointer',
                  border: `1px solid ${accepted > 0 ? 'rgba(34,197,94,0.5)' : 'rgba(255,255,255,0.08)'}`,
                  background: accepted > 0 ? 'rgba(34,197,94,0.16)' : 'rgba(255,255,255,0.03)',
                  color: accepted > 0 ? '#86efac' : 'rgba(255,255,255,0.2)',
                  fontSize: '0.68rem', fontFamily: 'monospace', fontWeight: 700, letterSpacing: '0.1em',
                }}>
                {saving ? '⟳ GUARDANDO…' : `✓ CONFIRMAR Y GUARDAR (${accepted} prospectos → kanban)`}
              </button>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
