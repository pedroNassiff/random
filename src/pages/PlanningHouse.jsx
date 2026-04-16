/**
 * PlanningProspeccion — /planning-prospeccion
 *
 * B2B outreach CRM kanban — Random Lab
 * API-backed (FastAPI /prospecting/contacts) with localStorage fallback.
 */
import React, { useState, useCallback, useEffect, useRef } from 'react'
import Navbar from '../components/Navbar'

const API = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:8000' : '')
const LS_KEY = 'prospeccion_board_fallback_v1'

const STAGES = [
  { id: 'identificado', label: 'Identificado',  short: 'ID',    color: '#6b7280', desc: 'En lista, sin acción' },
  { id: 'siguiendo',   label: 'Siguiendo',      short: 'WARM',  color: '#3b82f6', desc: 'Conectado / siguiendo' },
  { id: 'engagement',  label: 'Engagement',     short: 'ENG',   color: '#06b6d4', desc: 'Comentando / interactuando' },
  { id: 'pitch',       label: 'Pitch enviado',  short: 'PITCH', color: '#8b5cf6', desc: 'DM o email enviado' },
  { id: 'follow_up',   label: 'Follow-up',      short: 'FUP',   color: '#f59e0b', desc: 'En seguimiento activo' },
  { id: 'respondio',   label: 'Respondió',      short: 'RESP',  color: '#10b981', desc: 'Hay conversación!' },
  { id: 'call',        label: 'Call',           short: 'CALL',  color: '#14b8a6', desc: 'Call agendada o hecha' },
  { id: 'cerrado',     label: 'Cerrado',        short: 'WIN',   color: '#22c55e', desc: 'Deal / colaboración' },
  { id: 'descartado',  label: 'Descartado',     short: 'OUT',   color: '#ef4444', desc: 'No interesado' },
]

const TIER_COLORS = { 1: '#a78bfa', 2: '#60a5fa', 3: '#34d399', 4: '#fbbf24' }
const TIER_LABELS = { 1: 'BCN Studio', 2: 'Institución', 3: 'Intl Studio', 4: 'Red / Evento' }

// ── API helpers ───────────────────────────────────────────────────────────────
async function apiGet() {
  const res = await fetch(`${API}/prospecting/contacts`)
  if (!res.ok) throw new Error('API error')
  const json = await res.json()
  return Array.isArray(json) ? json : (json.contacts ?? [])
}

async function apiUpdate(id, data) {
  const res = await fetch(`${API}/prospecting/contacts/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error('API error')
  return res.json()
}

// ── useContacts hook ──────────────────────────────────────────────────────────
function useContacts() {
  const [contacts, setContacts] = useState([])
  const [loading, setLoading] = useState(true)
  const [apiOnline, setApiOnline] = useState(false)

  useEffect(() => {
    apiGet()
      .then(data => {
        setContacts(data)
        setApiOnline(true)
        try { localStorage.setItem(LS_KEY, JSON.stringify(data)) } catch {}
      })
      .catch(() => {
        try {
          const saved = localStorage.getItem(LS_KEY)
          if (saved) setContacts(JSON.parse(saved))
        } catch {}
        setApiOnline(false)
      })
      .finally(() => setLoading(false))
  }, [])

  const moveContact = useCallback(async (id, newStage) => {
    const prev = contacts
    const payload = { stage: newStage, last_action: new Date().toISOString().split('T')[0] }
    const updated = contacts.map(c => c.id === id ? { ...c, ...payload } : c)
    setContacts(updated)
    try { localStorage.setItem(LS_KEY, JSON.stringify(updated)) } catch {}
    if (apiOnline) {
      try { await apiUpdate(id, payload) }
      catch { setContacts(prev) }
    }
  }, [contacts, apiOnline])

  const updateContact = useCallback(async (id, data) => {
    const updated = contacts.map(c => c.id === id ? { ...c, ...data } : c)
    setContacts(updated)
    try { localStorage.setItem(LS_KEY, JSON.stringify(updated)) } catch {}
    if (apiOnline) {
      try { await apiUpdate(id, data) } catch {}
    }
  }, [contacts, apiOnline])

  return { contacts, loading, apiOnline, moveContact, updateContact }
}

// ── Badge ─────────────────────────────────────────────────────────────────────
function Badge({ label, color, small }) {
  return (
    <span style={{
      fontSize: small ? '0.52rem' : '0.58rem',
      fontFamily: 'monospace',
      color,
      background: color + '18',
      border: `1px solid ${color}35`,
      borderRadius: 4,
      padding: small ? '1px 4px' : '2px 6px',
      letterSpacing: '0.06em',
      textTransform: 'uppercase',
      fontWeight: 600,
      whiteSpace: 'nowrap',
    }}>
      {label}
    </span>
  )
}

// ── Contact Card ──────────────────────────────────────────────────────────────
function ContactCard({ contact, onEdit, onMove }) {
  const tierColor = TIER_COLORS[contact.tier] || '#6b7280'
  const daysSince = contact.last_action
    ? Math.floor((Date.now() - new Date(contact.last_action)) / 86400000)
    : null
  const stale = contact.stage !== 'cerrado' && contact.stage !== 'descartado' && daysSince !== null && daysSince > 10

  const handleDragStart = e => {
    e.dataTransfer.setData('text/plain', JSON.stringify({ contactId: contact.id, fromStage: contact.stage }))
    e.dataTransfer.effectAllowed = 'move'
    setTimeout(() => { if (e.target) e.target.style.opacity = '0.4' }, 0)
  }
  const handleDragEnd = e => { if (e.target) e.target.style.opacity = '1' }

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onClick={() => onEdit(contact)}
      title="Click para editar · Arrastrá para mover"
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: `1px solid ${stale ? 'rgba(245,158,11,0.35)' : 'rgba(255,255,255,0.08)'}`,
        borderLeft: `3px solid ${tierColor}`,
        borderRadius: 8,
        padding: '10px 12px',
        cursor: 'grab',
        marginBottom: 8,
        userSelect: 'none',
        transition: 'transform 0.12s, border-color 0.12s, box-shadow 0.12s',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.transform = 'translateY(-1px)'
        e.currentTarget.style.borderColor = stale ? 'rgba(245,158,11,0.65)' : 'rgba(255,255,255,0.22)'
        e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.4)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.transform = 'translateY(0)'
        e.currentTarget.style.borderColor = stale ? 'rgba(245,158,11,0.35)' : 'rgba(255,255,255,0.08)'
        e.currentTarget.style.boxShadow = 'none'
      }}
    >
      {/* Company + tier */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 6, marginBottom: 5 }}>
        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#f1f5f9', fontFamily: 'monospace', lineHeight: 1.2, flex: 1 }}>
          {contact.company}
        </div>
        <Badge label={`T${contact.tier}`} color={tierColor} small />
      </div>
      {/* Location */}
      <div style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.32)', fontFamily: 'monospace', marginBottom: 4 }}>
        {contact.location}
      </div>
      {/* Decision maker */}
      {contact.decision_maker && (
        <div style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.45)', fontFamily: 'monospace', marginBottom: 4 }}>
          👤 {contact.decision_maker.length > 30 ? contact.decision_maker.slice(0, 30) + '…' : contact.decision_maker}
        </div>
      )}
      {/* Notes preview */}
      {contact.notes && (
        <div style={{
          fontSize: '0.58rem',
          color: 'rgba(255,255,255,0.28)',
          fontFamily: 'monospace',
          fontStyle: 'italic',
          lineHeight: 1.35,
          marginBottom: 6,
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}>
          {contact.notes}
        </div>
      )}
      {/* Footer badges */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
        {contact.responded && <Badge label="RESP" color="#10b981" small />}
        {contact.follow_up_count > 0 && <Badge label={`FU×${contact.follow_up_count}`} color="#f59e0b" small />}
        {stale && <Badge label={`${daysSince}d`} color="#f59e0b" small />}
        {!stale && daysSince !== null && daysSince <= 3 && <Badge label={`${daysSince}d`} color="#6b7280" small />}
      </div>
    </div>
  )
}

// ── Stage Column ──────────────────────────────────────────────────────────────
function StageColumn({ stage, contacts, onEdit, onMove }) {
  const [dragOver, setDragOver] = useState(false)

  const handleDragOver = e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDragOver(true) }
  const handleDragLeave = () => setDragOver(false)
  const handleDrop = e => {
    e.preventDefault()
    setDragOver(false)
    try {
      const { contactId, fromStage } = JSON.parse(e.dataTransfer.getData('text/plain'))
      if (fromStage !== stage.id) onMove(contactId, stage.id)
    } catch {}
  }

  return (
    <div style={{
      minWidth: 230,
      width: 230,
      flexShrink: 0,
      display: 'flex',
      flexDirection: 'column',
      background: dragOver ? `${stage.color}10` : 'rgba(255,255,255,0.02)',
      border: dragOver ? `1.5px dashed ${stage.color}80` : '1px solid rgba(255,255,255,0.06)',
      borderRadius: 12,
      transition: 'background 0.15s, border-color 0.15s',
      maxHeight: 'calc(100vh - 260px)',
    }}>
      {/* Header */}
      <div style={{ padding: '12px 14px 10px', borderBottom: '1px solid rgba(255,255,255,0.05)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: stage.color, flexShrink: 0 }} />
            <span style={{ fontSize: '0.68rem', fontWeight: 700, color: stage.color, fontFamily: 'monospace', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
              {stage.short}
            </span>
          </div>
          <span style={{
            fontSize: '0.6rem',
            color: contacts.length > 0 ? stage.color : 'rgba(255,255,255,0.2)',
            fontFamily: 'monospace',
            background: contacts.length > 0 ? stage.color + '15' : 'transparent',
            border: contacts.length > 0 ? `1px solid ${stage.color}30` : '1px solid transparent',
            borderRadius: 10,
            padding: '1px 7px',
          }}>
            {contacts.length}
          </span>
        </div>
        <div style={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.3)', fontFamily: 'monospace' }}>
          {stage.label}
        </div>
      </div>

      {/* Cards */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        style={{ flex: 1, overflowY: 'auto', padding: '10px 10px 6px', minHeight: 80 }}
      >
        {contacts.map(c => (
          <ContactCard key={c.id} contact={c} onEdit={onEdit} onMove={onMove} />
        ))}
        {contacts.length === 0 && (
          <div style={{ textAlign: 'center', padding: '20px 0', fontSize: '0.58rem', color: 'rgba(255,255,255,0.15)', fontFamily: 'monospace' }}>
            {dragOver ? 'Soltar aquí' : stage.desc}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Edit Modal ────────────────────────────────────────────────────────────────
function EditModal({ contact, onSave, onClose }) {
  const [form, setForm] = useState({ ...contact })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const fieldStyle = {
    width: '100%',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 7,
    padding: '7px 10px',
    color: '#f1f5f9',
    fontSize: '0.72rem',
    fontFamily: 'monospace',
    outline: 'none',
    boxSizing: 'border-box',
  }
  const labelStyle = {
    fontSize: '0.58rem',
    color: 'rgba(255,255,255,0.4)',
    fontFamily: 'monospace',
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    marginBottom: 4,
    display: 'block',
  }

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.75)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000, padding: 20,
        backdropFilter: 'blur(4px)',
      }}
    >
      <div style={{
        background: '#0e101a',
        border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: 14,
        width: '100%', maxWidth: 600,
        maxHeight: '90vh', overflowY: 'auto',
        padding: '24px 28px',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: '0.6rem', color: '#8b5cf6', fontFamily: 'monospace', letterSpacing: '0.2em', textTransform: 'uppercase' }}>
              Editar contacto
            </div>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f1f5f9', fontFamily: 'monospace', marginTop: 3 }}>
              {contact.company}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: '1.2rem', cursor: 'pointer', padding: '4px 8px' }}>×</button>
        </div>

        {/* Stage select */}
        <div style={{ marginBottom: 16 }}>
          <span style={labelStyle}>Etapa</span>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {STAGES.map(s => (
              <button
                key={s.id}
                onClick={() => set('stage', s.id)}
                style={{
                  padding: '5px 10px',
                  borderRadius: 6,
                  border: `1px solid ${form.stage === s.id ? s.color : 'rgba(255,255,255,0.1)'}`,
                  background: form.stage === s.id ? s.color + '25' : 'transparent',
                  color: form.stage === s.id ? s.color : 'rgba(255,255,255,0.4)',
                  fontSize: '0.62rem',
                  fontFamily: 'monospace',
                  cursor: 'pointer',
                  transition: 'all 0.12s',
                }}
              >
                {s.short}
              </button>
            ))}
          </div>
        </div>

        {/* Tier select */}
        <div style={{ marginBottom: 16 }}>
          <span style={labelStyle}>Tier</span>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {[1, 2, 3, 4].map(t => (
              <button
                key={t}
                onClick={() => set('tier', t)}
                style={{
                  padding: '5px 12px',
                  borderRadius: 6,
                  border: `1px solid ${form.tier === t ? TIER_COLORS[t] : 'rgba(255,255,255,0.1)'}`,
                  background: form.tier === t ? TIER_COLORS[t] + '20' : 'transparent',
                  color: form.tier === t ? TIER_COLORS[t] : 'rgba(255,255,255,0.4)',
                  fontSize: '0.62rem',
                  fontFamily: 'monospace',
                  cursor: 'pointer',
                }}
              >
                T{t} — {TIER_LABELS[t]}
              </button>
            ))}
          </div>
        </div>

        {/* Fields grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 20px', marginBottom: 16 }}>
          {[
            { key: 'company',        label: 'Empresa' },
            { key: 'location',       label: 'Ubicación' },
            { key: 'decision_maker', label: 'Decision maker' },
            { key: 'linkedin_url',   label: 'LinkedIn' },
            { key: 'website',        label: 'Website' },
            { key: 'last_action',    label: 'Última acción (YYYY-MM-DD)' },
            { key: 'next_action',    label: 'Próxima acción (YYYY-MM-DD)' },
            { key: 'follow_up_count',label: 'Nº follow-ups', type: 'number' },
          ].map(({ key, label, type }) => (
            <label key={key} style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={labelStyle}>{label}</span>
              <input
                type={type || 'text'}
                value={form[key] ?? ''}
                onChange={e => set(key, type === 'number' ? +e.target.value : e.target.value)}
                style={fieldStyle}
              />
            </label>
          ))}
        </div>

        {/* Why / fit */}
        <label style={{ display: 'flex', flexDirection: 'column', marginBottom: 14 }}>
          <span style={labelStyle}>Por qué (fit)</span>
          <input value={form.why ?? ''} onChange={e => set('why', e.target.value)} style={fieldStyle} />
        </label>

        {/* Notes */}
        <label style={{ display: 'flex', flexDirection: 'column', marginBottom: 14 }}>
          <span style={labelStyle}>Notas</span>
          <textarea
            rows={4}
            value={form.notes ?? ''}
            onChange={e => set('notes', e.target.value)}
            style={{ ...fieldStyle, resize: 'vertical', lineHeight: 1.5 }}
          />
        </label>

        {/* Responded toggle */}
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={!!form.responded}
            onChange={e => set('responded', e.target.checked)}
            style={{ accentColor: '#10b981', width: 14, height: 14 }}
          />
          <span style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.6)', fontFamily: 'monospace' }}>
            Respondió / hay conversación activa
          </span>
        </label>

        {/* Save */}
        <button
          onClick={() => { onSave(contact.id, form); onClose() }}
          style={{
            width: '100%',
            padding: '10px',
            borderRadius: 8,
            border: '1px solid rgba(139,92,246,0.5)',
            background: 'rgba(139,92,246,0.15)',
            color: '#a78bfa',
            fontSize: '0.72rem',
            fontFamily: 'monospace',
            fontWeight: 700,
            cursor: 'pointer',
            letterSpacing: '0.1em',
            transition: 'all 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(139,92,246,0.3)'; e.currentTarget.style.color = '#c4b5fd' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(139,92,246,0.15)'; e.currentTarget.style.color = '#a78bfa' }}
        >
          GUARDAR CAMBIOS
        </button>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
const PlanningProspeccion = () => {
  const { contacts, loading, apiOnline, moveContact, updateContact } = useContacts()
  const [editTarget, setEditTarget] = useState(null)
  const [tierFilter, setTierFilter] = useState(0)

  const visible = contacts.filter(c => tierFilter === 0 || c.tier === tierFilter)
  const byStage = stage => visible.filter(c => c.stage === stage.id)

  // Metrics
  const total    = contacts.length
  const active   = contacts.filter(c => ['siguiendo','engagement','pitch','follow_up','respondio'].includes(c.stage)).length
  const responded = contacts.filter(c => c.responded).length
  const calls    = contacts.filter(c => c.stage === 'call').length
  const closed   = contacts.filter(c => c.stage === 'cerrado').length
  const responseRate = total > 0 ? Math.round((responded / total) * 100) : 0

  return (
    <div style={{ minHeight: '100vh', background: '#070709', color: '#f1f5f9', fontFamily: 'system-ui, sans-serif' }}>
      <Navbar />

      {/* ── Header ── */}
      <div style={{
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        padding: '80px 24px 20px',
        background: 'linear-gradient(180deg, rgba(139,92,246,0.06) 0%, transparent 100%)',
      }}>
        <div style={{ maxWidth: 1800, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, marginBottom: 20 }}>
            <div>
              <div style={{ fontSize: '0.62rem', fontFamily: 'monospace', color: '#8b5cf6', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 6 }}>
                Random Lab · Outreach OS{!apiOnline ? ' · LOCAL' : ''}
              </div>
              <h1 style={{ fontSize: 'clamp(1.6rem, 3vw, 2.4rem)', fontWeight: 700, margin: 0, letterSpacing: '-0.03em', lineHeight: 1, fontFamily: 'monospace' }}>
                PLANNING PROSPECCIÓN
              </h1>
              <p style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.3)', marginTop: 8, fontFamily: 'monospace' }}>
                B2B studios · instituciones culturales · red creativa
              </p>
            </div>

            {/* Metrics */}
            <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'center' }}>
              {[
                { label: 'Total',        value: total,            color: '#6b7280' },
                { label: 'Activos',      value: active,           color: '#8b5cf6' },
                { label: 'Respondieron', value: responded,        color: '#10b981' },
                { label: 'Calls',        value: calls,            color: '#14b8a6' },
                { label: 'Cerrados',     value: closed,           color: '#22c55e' },
                { label: 'Response %',   value: `${responseRate}%`, color: '#f59e0b' },
              ].map(m => (
                <div key={m.label} style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '1.5rem', fontWeight: 700, color: m.color, fontFamily: 'monospace', lineHeight: 1 }}>
                    {m.value}
                  </div>
                  <div style={{ fontSize: '0.55rem', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: 3, fontFamily: 'monospace' }}>
                    {m.label}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Funnel bar */}
          <div style={{ display: 'flex', gap: 2, height: 4, borderRadius: 4, overflow: 'hidden', marginBottom: 16 }}>
            {STAGES.filter(s => s.id !== 'descartado').map(s => {
              const count = contacts.filter(c => c.stage === s.id).length
              const pct = total > 0 ? (count / total) * 100 : 0
              return (
                <div
                  key={s.id}
                  title={`${s.label}: ${count}`}
                  style={{ flex: pct, background: s.color, opacity: count > 0 ? 1 : 0.12, transition: 'flex 0.5s', minWidth: count > 0 ? 4 : 2 }}
                />
              )
            })}
          </div>

          {/* Tier filter */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.3)', fontFamily: 'monospace', marginRight: 4 }}>TIER</span>
            {[0, 1, 2, 3, 4].map(t => (
              <button
                key={t}
                onClick={() => setTierFilter(t)}
                style={{
                  padding: '4px 10px',
                  borderRadius: 6,
                  border: `1px solid ${tierFilter === t ? (TIER_COLORS[t] || '#6b7280') : 'rgba(255,255,255,0.08)'}`,
                  background: tierFilter === t ? (TIER_COLORS[t] || '#6b7280') + '20' : 'transparent',
                  color: tierFilter === t ? (TIER_COLORS[t] || '#aaa') : 'rgba(255,255,255,0.35)',
                  fontSize: '0.62rem',
                  fontFamily: 'monospace',
                  cursor: 'pointer',
                  transition: 'all 0.12s',
                }}
              >
                {t === 0 ? 'TODOS' : `T${t} — ${TIER_LABELS[t]}`}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Kanban ── */}
      <div style={{ padding: '20px 24px 60px', maxWidth: 1800, margin: '0 auto' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: 'rgba(255,255,255,0.3)', fontFamily: 'monospace', fontSize: '0.8rem' }}>
            Cargando contactos…
          </div>
        ) : (
          <div style={{ overflowX: 'auto', paddingBottom: 12 }}>
            <div style={{ display: 'flex', gap: 12, minWidth: 'max-content', alignItems: 'flex-start' }}>
              {STAGES.map(stage => (
                <StageColumn
                  key={stage.id}
                  stage={stage}
                  contacts={byStage(stage)}
                  onEdit={setEditTarget}
                  onMove={moveContact}
                />
              ))}
            </div>
          </div>
        )}

        {/* Strategy hints */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12, marginTop: 32 }}>
          {[
            { stage: 'Warm-up (sem 1–2)', tip: 'Seguir en LinkedIn/IG. Comentar 2–3 posts con valor real. NO vender todavía.', color: '#3b82f6' },
            { stage: 'Pitch (sem 3)', tip: '"Admiro X de su trabajo. Trabajo con Three.js/WebGL en arte + data. ¿Puedo compartir mi portfolio?"', color: '#8b5cf6' },
            { stage: 'Follow-up', tip: 'Máx 3 follow-ups espaciados 7 días. Cada uno añade valor nuevo: proyecto, artículo, referencia.', color: '#f59e0b' },
            { stage: 'Daily routine', tip: '20 min/día: revisar 5 perfiles, comentar 3 posts, enviar 1 DM. Consistencia > volumen.', color: '#10b981' },
          ].map(h => (
            <div key={h.stage} style={{
              background: h.color + '08',
              border: `1px solid ${h.color}20`,
              borderLeft: `3px solid ${h.color}`,
              borderRadius: 8,
              padding: '12px 16px',
            }}>
              <div style={{ fontSize: '0.6rem', fontWeight: 700, color: h.color, fontFamily: 'monospace', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 6 }}>
                {h.stage}
              </div>
              <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.42)', fontFamily: 'monospace', lineHeight: 1.5 }}>
                {h.tip}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Edit modal */}
      {editTarget && (
        <EditModal
          contact={editTarget}
          onSave={updateContact}
          onClose={() => setEditTarget(null)}
        />
      )}
    </div>
  )
}

export default PlanningProspeccion
