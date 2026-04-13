/**
 * PlanningProspeccion — /planning-prospeccion
 *
 * B2B outreach CRM kanban — Random Lab
 * v2: + AI Analysis Modal (scraping + LLM analysis + entry vectors)
 */
import React, { useState, useCallback, useEffect, useRef } from 'react'
import Navbar from '../components/Navbar'

const API = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:8000' : '')
const LS_KEY = 'prospeccion_board_fallback_v1'

// ── Tier system (hardcoded until login) ──────────────────────────────────────
const CURRENT_TIER = 'free' // 'free' | 'paid'
const TIER_LIMITS  = { free: 5, paid: 20 }
const TIER_MODEL   = { free: 'claude-haiku-4-5', paid: 'claude-sonnet-4-6' }

const getUsageKey   = () => `ai_analysis_usage_${new Date().toDateString()}`
const getUsageCount = () => { try { return parseInt(localStorage.getItem(getUsageKey()) || '0') } catch { return 0 } }
const incUsage      = () => { try { localStorage.setItem(getUsageKey(), String(getUsageCount() + 1)) } catch {} }
const usageLeft     = () => Math.max(0, TIER_LIMITS[CURRENT_TIER] - getUsageCount())

// ── Default analysis prompt ───────────────────────────────────────────────────
const buildDefaultPrompt = (contact, scrapedContent = '') => `
Sos un consultor experto en estrategia de negocio, marketing digital B2B, ingeniería de producto, arquitectura de software y ventas. Analizá en profundidad la siguiente empresa y generá un reporte de oportunidades estratégicas para Random Lab.

SOBRE RANDOM LAB:
Consultora técnica especializada en: arquitectura de sistemas complejos, modernización legacy (PHP→FastAPI/NestJS), integración de IA (embeddings, búsqueda semántica, modelos custom, visión computacional), desarrollo 3D/WebGL/Three.js, procesamiento de datos en tiempo real (GPS, EEG, IoT), automatización de procesos, pipelines de datos. Stack: NestJS, FastAPI, Python, Vue 3, React, Three.js, PostgreSQL/pgvector, InfluxDB, GCP.

EMPRESA A ANALIZAR:
- Nombre: ${contact.company}
- Ubicación: ${contact.location || 'N/A'}
- Decision maker: ${contact.decision_maker || 'N/A'}
- Tier: ${contact.tier ? `T${contact.tier} — ${['', 'BCN Studio', 'Institución', 'Intl Studio', 'Red / Evento'][contact.tier]}` : 'N/A'}
- Contexto / notas: ${contact.notes || 'Sin notas adicionales'}
${scrapedContent ? `\nINFORMACIÓN SCRAPEADA DE WEB:\n${scrapedContent}` : ''}

INSTRUCCIONES:
Identificá vectores de entrada concretos y oportunidades reales. Sé específico, no genérico. Pensá como un consultor que va a entrar a hacer un pitch.

Respondé ÚNICAMENTE con este JSON (sin markdown, sin backticks, sin texto extra):
{
  "score": <número 0-100>,
  "fit_category": "<high|mid|low>",
  "summary": "<resumen ejecutivo 2-3 oraciones>",
  "entry_vectors": [
    { "title": "<nombre corto>", "description": "<descripción concreta de la solución>", "priority": "<high|mid|low>", "category": "<product|infra|ai|marketing|sales>" }
  ],
  "pain_points": ["<pain point concreto 1>", "<pain point 2>", ...],
  "opportunities": {
    "product": ["<oportunidad de producto/feature concreta>"],
    "tech_infra": ["<mejora de infra/modernización>"],
    "ai_integration": ["<caso de uso de IA específico>"],
    "marketing": ["<ángulo de marketing/posicionamiento>"],
    "sales": ["<táctica de venta/entrada comercial>"]
  },
  "recommended_approach": "<primeros 3 pasos concretos para entrar con este cliente>",
  "pitch_angle": "<una frase de pitch para el primer mensaje>"
}
`.trim()

// ── Stage config ──────────────────────────────────────────────────────────────
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

const SCORE_COLOR = (s) => {
  if (!s && s !== 0) return '#6b7280'
  if (s >= 80) return '#22c55e'
  if (s >= 60) return '#3b82f6'
  if (s >= 40) return '#f59e0b'
  return '#ef4444'
}

const FIT_LABEL = { high: 'HIGH FIT', mid: 'MID FIT', low: 'LOW FIT' }
const FIT_COLOR = { high: '#22c55e', mid: '#f59e0b', low: '#ef4444' }

const CAT_COLORS = {
  product:       { color: '#a78bfa', label: 'Producto' },
  tech_infra:    { color: '#60a5fa', label: 'Infra / Tech' },
  ai_integration:{ color: '#f472b6', label: 'IA' },
  marketing:     { color: '#fb923c', label: 'Marketing' },
  sales:         { color: '#34d399', label: 'Ventas' },
}

const CAT_ICON = {
  product: '◈', tech_infra: '⬡', ai_integration: '✦', marketing: '◉', sales: '▶'
}

// ── New contact blank template ─────────────────────────────────────────────────
const NEW_CONTACT_TEMPLATE = {
  id: null, company: '', tier: 1, location: '', focus: '',
  linkedin_url: '', website: '', decision_maker: '', email: '',
  why: '', stage: 'identificado', notes: '',
  follow_up_count: 0, responded: false,
  last_action: null, next_action: null, ai_analysis: null,
}

// ── API helpers ───────────────────────────────────────────────────────────────
async function apiGet() {
  const res = await fetch(`${API}/prospecting/contacts`)
  if (!res.ok) throw new Error('API error')
  const json = await res.json()
  return Array.isArray(json) ? json : (json.contacts ?? [])
}

async function apiCreate(data) {
  const res = await fetch(`${API}/prospecting/contacts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error('API error')
  return res.json() // { status, contact }
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

async function apiScrape(urls) {
  const res = await fetch(`${API}/prospecting/scrape`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ urls }),
  })
  if (!res.ok) throw new Error(`Scraping error: ${res.status}`)
  return res.json() // { results: [{ url, content, status }] }
}

async function apiAnalyze(payload) {
  const res = await fetch(`${API}/prospecting/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error(`Analysis error: ${res.status}`)
  return res.json()
}

async function apiSendPitch(payload) {
  const res = await fetch(`${API}/prospecting/pitch/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || `Send error: ${res.status}`)
  }
  return res.json()
}

async function apiPitchStats(contactId) {
  const res = await fetch(`${API}/prospecting/pitch/stats/${contactId}`)
  if (!res.ok) throw new Error('Stats error')
  return res.json()
}

// ── Pitch template builders ───────────────────────────────────────────────────
function buildEmailTemplate(contact, analysis) {
  const topVector = analysis?.entry_vectors?.[0]
  const pitchLine = analysis?.pitch_angle || `Me gustaría explorar cómo Random Lab puede colaborar con ${contact.company}.`
  const approach  = analysis?.recommended_approach || ''
  const dm        = contact.decision_maker || 'Equipo'

  const text = `Hola ${dm},

${pitchLine}

Soy Pedro de Random Lab — consultora técnica especializada en arquitectura de sistemas, integración de IA y desarrollo 3D/WebGL.${topVector ? `\n\nIdentifiqué una oportunidad concreta para ${contact.company}: ${topVector.title} — ${topVector.description}` : ''}

${approach ? `Mi approach:\n${approach}\n` : ''}¿Tendría 20 minutos esta semana para una llamada exploratoria?

Saludos,
Pedro Nassiff
Random Lab
`.trim()

  const html = `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0d0f1a;font-family:'Courier New',monospace;color:#e2e8f0;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0d0f1a;padding:40px 20px;">
    <tr><td>
      <table width="600" cellpadding="0" cellspacing="0" align="center"
        style="background:#10121e;border:1px solid rgba(139,92,246,0.3);border-radius:12px;overflow:hidden;max-width:600px;width:100%;">
        <!-- Header -->
        <tr>
          <td style="padding:28px 32px 20px;border-bottom:1px solid rgba(255,255,255,0.07);background:linear-gradient(135deg,rgba(139,92,246,0.12) 0%,transparent 100%);">
            <div style="font-size:10px;color:#8b5cf6;letter-spacing:0.25em;text-transform:uppercase;margin-bottom:8px;">Random Lab · Outreach</div>
            <div style="font-size:22px;font-weight:700;color:#f1f5f9;letter-spacing:-0.02em;">Propuesta de colaboración</div>
            <div style="font-size:12px;color:rgba(255,255,255,0.35);margin-top:6px;">Para: ${contact.company}</div>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:28px 32px;">
            <p style="font-size:14px;color:rgba(255,255,255,0.75);line-height:1.7;margin:0 0 18px;">Hola ${dm},</p>
            <p style="font-size:14px;color:rgba(255,255,255,0.75);line-height:1.7;margin:0 0 18px;font-style:italic;border-left:3px solid #8b5cf6;padding-left:14px;color:#c4b5fd;">"${pitchLine}"</p>
            <p style="font-size:13px;color:rgba(255,255,255,0.55);line-height:1.7;margin:0 0 18px;">Soy Pedro de <strong style="color:#f1f5f9;">Random Lab</strong> — consultora técnica especializada en arquitectura de sistemas, integración de IA y desarrollo 3D/WebGL.</p>
            ${topVector ? `
            <table width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;">
              <tr>
                <td style="background:rgba(167,139,250,0.07);border:1px solid rgba(167,139,250,0.2);border-left:3px solid #8b5cf6;border-radius:8px;padding:16px 20px;">
                  <div style="font-size:10px;color:#a78bfa;letter-spacing:0.15em;text-transform:uppercase;margin-bottom:8px;">Oportunidad identificada</div>
                  <div style="font-size:14px;font-weight:700;color:#f1f5f9;margin-bottom:6px;">${topVector.title}</div>
                  <div style="font-size:13px;color:rgba(255,255,255,0.55);line-height:1.6;">${topVector.description}</div>
                </td>
              </tr>
            </table>` : ''}
            ${approach ? `<p style="font-size:13px;color:rgba(255,255,255,0.5);line-height:1.7;margin:0 0 18px;">${approach}</p>` : ''}
            <p style="font-size:14px;color:rgba(255,255,255,0.75);line-height:1.7;margin:0 0 24px;">¿Tendría 20 minutos esta semana para una llamada exploratoria?</p>
            <table cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
              <tr>
                <td style="background:rgba(139,92,246,0.2);border:1px solid rgba(139,92,246,0.5);border-radius:8px;padding:12px 24px;">
                  <a href="https://random-lab.es" style="color:#c4b5fd;text-decoration:none;font-size:13px;font-weight:700;letter-spacing:0.08em;">Ver portfolio →</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="padding:18px 32px;border-top:1px solid rgba(255,255,255,0.07);background:rgba(0,0,0,0.2);">
            <div style="font-size:12px;color:rgba(255,255,255,0.5);">Pedro Nassiff · <a href="https://random-lab.es" style="color:#8b5cf6;text-decoration:none;">random-lab.es</a></div>
            <div style="font-size:10px;color:rgba(255,255,255,0.2);margin-top:4px;letter-spacing:0.05em;">RANDOM LAB · CREATIVE TECH CONSULTANCY</div>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`

  return { text, html, subject: `Propuesta Random Lab × ${contact.company}` }
}

function buildDMTemplate(contact, analysis) {
  const pitchLine = analysis?.pitch_angle || `Me gustaría explorar cómo colaborar con ${contact.company}.`
  const topVector = analysis?.entry_vectors?.[0]
  const dm        = contact.decision_maker?.split('/')[0]?.split('(')[0]?.trim() || ''

  return `${dm ? `Hola ${dm}! ` : ''}Vi el trabajo de ${contact.company} y quedé muy impresionado.

${pitchLine}

Trabajo con Three.js/WebGL + IA en instalaciones y experiencias interactivas. ${topVector ? `Específicamente, creo que hay una oportunidad en ${topVector.title}.` : ''}

¿Les interesa explorar algo juntos? Puedo compartir mi portfolio.

Pedro · Random Lab`
}

// ── PitchModal ────────────────────────────────────────────────────────────────
function PitchModal({ contact, analysis, onClose }) {
  const [tab, setTab]               = useState('email')  // 'email' | 'dm'
  const [toEmail, setToEmail]       = useState(contact.email || '')
  const [subject, setSubject]       = useState('')
  const [bodyHtml, setBodyHtml]     = useState('')
  const [bodyText, setBodyText]     = useState('')
  const [dmText, setDmText]         = useState('')
  const [sending, setSending]       = useState(false)
  const [sendError, setSendError]   = useState(null)
  const _pitchKey = `pitch_sent_${contact.id}`
  const [sent, setSent]               = useState(() => { try { const c = JSON.parse(localStorage.getItem(`pitch_sent_${contact.id}`)); return !!c?.trackingId } catch { return false } })
  const [trackingId, setTrackingId]   = useState(() => { try { const c = JSON.parse(localStorage.getItem(`pitch_sent_${contact.id}`)); return c?.trackingId || null } catch { return null } })
  const [sentTo, setSentTo]           = useState(() => { try { const c = JSON.parse(localStorage.getItem(`pitch_sent_${contact.id}`)); return c?.sentTo || '' } catch { return '' } })
  const [sentAt, setSentAt]           = useState(() => { try { const c = JSON.parse(localStorage.getItem(`pitch_sent_${contact.id}`)); return c?.sentAt || null } catch { return null } })
  const [trackingLocal, setTrackingLocal] = useState(() => { try { const c = JSON.parse(localStorage.getItem(`pitch_sent_${contact.id}`)); return c?.trackingLocal ?? true } catch { return true } })
  const [pixelUrl, setPixelUrl]           = useState(() => { try { const c = JSON.parse(localStorage.getItem(`pitch_sent_${contact.id}`)); return c?.pixelUrl || null } catch { return null } })
  const [tunnelUrl, setTunnelUrl]         = useState(() => { try { return localStorage.getItem('pitch_tunnel_url') || '' } catch { return '' } })
  const [stats, setStats]             = useState(null)
  const [statsLoading, setStatsLoading] = useState(false)
  const [copied, setCopied]           = useState(false)

  useEffect(() => {
    const email = buildEmailTemplate(contact, analysis)
    setSubject(email.subject)
    setBodyHtml(email.html)
    setBodyText(email.text)
    setDmText(buildDMTemplate(contact, analysis))
  }, [])

  useEffect(() => {
    if (sent && trackingId) {
      const fetchStats = async () => {
        setStatsLoading(true)
        try { const data = await apiPitchStats(contact.id); setStats(data) } catch {}
        finally { setStatsLoading(false) }
      }
      fetchStats()
      const poll = setInterval(fetchStats, 8000)
      return () => clearInterval(poll)
    }
  }, [sent, trackingId])

  const send = async () => {
    if (!toEmail.trim()) { setSendError('Ingresá el email del destinatario'); return }
    setSending(true); setSendError(null)
    try {
      const res = await apiSendPitch({
        contact_id:        contact.id,
        to_email:          toEmail.trim(),
        subject,
        body_html:         bodyHtml,
        body_text:         bodyText,
        pitch_type:        'email',
        company:           contact.company,
        override_app_url:  tunnelUrl.trim() || undefined,
      })
      setTrackingId(res.tracking_id)
      setSent(true)
      setSentTo(toEmail.trim())
      const now = Date.now()
      setSentAt(now)
      const isLocal = res.tracking_local ?? true
      setTrackingLocal(isLocal)
      setPixelUrl(res.pixel_url || null)
      try { localStorage.setItem(_pitchKey, JSON.stringify({ trackingId: res.tracking_id, sentTo: toEmail.trim(), sentAt: now, trackingLocal: isLocal, pixelUrl: res.pixel_url || null })) } catch {}
    } catch (err) {
      setSendError(err.message)
    } finally {
      setSending(false)
    }
  }

  const copyDM = () => {
    navigator.clipboard.writeText(dmText).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const baseStyle = {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 1200, padding: 16, backdropFilter: 'blur(8px)',
  }
  const modalStyle = {
    background: '#080b15', border: '1px solid rgba(139,92,246,0.3)',
    borderRadius: 14, width: '100%', maxWidth: 800,
    maxHeight: '90vh', display: 'flex', flexDirection: 'column',
    overflow: 'hidden', boxShadow: '0 0 80px rgba(139,92,246,0.2)',
  }
  const inputStyle = {
    width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 7, padding: '8px 12px', color: '#f1f5f9', fontSize: '0.72rem',
    fontFamily: 'monospace', outline: 'none', boxSizing: 'border-box',
  }
  const labelStyle = {
    fontSize: '0.55rem', color: 'rgba(255,255,255,0.35)', fontFamily: 'monospace',
    textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 5, display: 'block',
  }

  const latestPitch = stats?.pitches?.[0]

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose() }} style={baseStyle}>
      <div style={modalStyle}>
        {/* Header */}
        <div style={{
          padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.07)',
          background: 'rgba(139,92,246,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
        }}>
          <div>
            <div style={{ fontSize: '0.52rem', color: '#8b5cf6', fontFamily: 'monospace', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 3 }}>
              Pitch builder
            </div>
            <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#f1f5f9', fontFamily: 'monospace' }}>
              {contact.company}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* Tracking stats badge */}
            {latestPitch && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '5px 10px', borderRadius: 6,
                background: latestPitch.open_count > 0 ? 'rgba(34,197,94,0.08)' : 'rgba(255,255,255,0.03)',
                border: `1px solid ${latestPitch.open_count > 0 ? 'rgba(34,197,94,0.3)' : 'rgba(255,255,255,0.08)'}`,
              }}>
                <span style={{ fontSize: '0.75rem' }}>{latestPitch.open_count > 0 ? '✉️' : '📨'}</span>
                <div style={{ fontSize: '0.55rem', fontFamily: 'monospace' }}>
                  <div style={{ color: latestPitch.open_count > 0 ? '#86efac' : 'rgba(255,255,255,0.4)' }}>
                    {latestPitch.open_count > 0 ? `Abierto ${latestPitch.open_count}×` : 'Enviado · sin abrir'}
                  </div>
                  {latestPitch.last_opened && (
                    <div style={{ color: 'rgba(255,255,255,0.25)', marginTop: 1 }}>
                      Últ: {new Date(latestPitch.last_opened).toLocaleDateString('es')}
                    </div>
                  )}
                </div>
              </div>
            )}
            <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.35)', fontSize: '1.3rem', cursor: 'pointer', padding: '2px 8px', lineHeight: 1 }}>×</button>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.07)', flexShrink: 0 }}>
          {[
            { id: 'email', label: '✉️ Email', sub: 'envío directo + tracking' },
            { id: 'dm',    label: '💬 DM',    sub: 'LinkedIn / IG / copy' },
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              flex: 1, padding: '12px 16px', background: tab === t.id ? 'rgba(139,92,246,0.1)' : 'transparent',
              border: 'none', borderBottom: tab === t.id ? '2px solid #8b5cf6' : '2px solid transparent',
              color: tab === t.id ? '#c4b5fd' : 'rgba(255,255,255,0.3)',
              cursor: 'pointer', fontFamily: 'monospace',
            }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 700 }}>{t.label}</div>
              <div style={{ fontSize: '0.52rem', opacity: 0.6, marginTop: 2, letterSpacing: '0.08em' }}>{t.sub}</div>
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>

          {tab === 'email' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {sent ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {/* Sent confirmation */}
                  <div style={{
                    padding: '14px 18px', borderRadius: 10, background: 'rgba(34,197,94,0.06)',
                    border: '1px solid rgba(34,197,94,0.2)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: '1rem' }}>✅</span>
                      <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#86efac', fontFamily: 'monospace' }}>
                        Email enviado a {sentTo || toEmail}
                      </span>
                    </div>
                    {sentAt && (
                      <div style={{ fontSize: '0.55rem', color: 'rgba(255,255,255,0.3)', fontFamily: 'monospace', paddingLeft: 28 }}>
                        {new Date(sentAt).toLocaleString('es', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </div>
                    )}
                  </div>

                  {/* Tunnel URL — always editable */}
                  <div style={{
                    padding: '10px 14px', borderRadius: 8,
                    background: trackingLocal ? 'rgba(251,191,36,0.06)' : 'rgba(255,255,255,0.02)',
                    border: `1px solid ${trackingLocal ? 'rgba(251,191,36,0.2)' : 'rgba(255,255,255,0.07)'}`,
                    fontSize: '0.58rem', fontFamily: 'monospace',
                  }}>
                    <div style={{ fontWeight: 700, marginBottom: 6, color: trackingLocal ? '#fde68a' : 'rgba(255,255,255,0.4)' }}>
                      {trackingLocal ? '⚠ Tracking inactivo — pegá la URL del túnel' : '🌐 URL del túnel cloudflare'}
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <input
                        value={tunnelUrl}
                        onChange={e => {
                          setTunnelUrl(e.target.value)
                          try { localStorage.setItem('pitch_tunnel_url', e.target.value) } catch {}
                        }}
                        placeholder="https://xxxx.trycloudflare.com"
                        style={{
                          flex: 1, background: 'rgba(0,0,0,0.3)',
                          border: `1px solid ${trackingLocal ? 'rgba(251,191,36,0.3)' : 'rgba(255,255,255,0.1)'}`,
                          borderRadius: 5, padding: '5px 9px',
                          color: trackingLocal ? '#fde68a' : 'rgba(255,255,255,0.6)',
                          fontSize: '0.6rem', fontFamily: 'monospace', outline: 'none',
                        }}
                      />
                      {tunnelUrl && <span style={{ color: '#86efac', fontSize: '0.7rem', lineHeight: '28px' }}>✓</span>}
                    </div>
                    {trackingLocal && (
                      <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.52rem', marginTop: 5 }}>
                        <code style={{ color: '#a5b4fc' }}>./init-tunner-cloudflare.sh</code> → copiá la URL que aparece → pegala arriba → re-enviá
                      </div>
                    )}
                  </div>

                  {/* Pixel test link */}
                  {pixelUrl && (
                    <div style={{ padding: '8px 12px', borderRadius: 7, background: 'rgba(165,180,252,0.04)', border: '1px solid rgba(165,180,252,0.12)', fontSize: '0.55rem', fontFamily: 'monospace', color: 'rgba(255,255,255,0.3)', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ color: '#a5b4fc' }}>🔗 test pixel:</span>
                      <a href={pixelUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#a5b4fc', textDecoration: 'underline', wordBreak: 'break-all' }}>{pixelUrl}</a>
                    </div>
                  )}

                  {/* Opens stats */}
                  <div style={{
                    padding: '14px 18px', borderRadius: 10,
                    background: !trackingLocal && stats?.pitches?.[0]?.open_count > 0 ? 'rgba(34,197,94,0.06)' : 'rgba(255,255,255,0.02)',
                    border: `1px solid ${!trackingLocal && stats?.pitches?.[0]?.open_count > 0 ? 'rgba(34,197,94,0.2)' : 'rgba(255,255,255,0.07)'}`,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                      <span style={{ fontSize: '0.55rem', color: 'rgba(255,255,255,0.3)', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.12em' }}>
                        tracking de aperturas {statsLoading ? '· actualizando…' : `· polling 8s`}
                      </span>
                      <button onClick={async () => { setStatsLoading(true); try { setStats(await apiPitchStats(contact.id)) } catch {} finally { setStatsLoading(false) } }}
                        style={{ background: 'none', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 4, color: 'rgba(255,255,255,0.3)', fontSize: '0.52rem', fontFamily: 'monospace', cursor: 'pointer', padding: '2px 7px' }}>
                        ⟳ refresh
                      </button>
                    </div>
                    {statsLoading && !stats ? (
                      <div style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.2)', fontFamily: 'monospace' }}>cargando…</div>
                    ) : stats?.pitches?.[0] ? (
                      <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: '2rem', fontWeight: 800, fontFamily: 'monospace', color: stats.pitches[0].open_count > 0 ? '#22c55e' : '#4b5563', lineHeight: 1 }}>
                            {stats.pitches[0].open_count}
                          </div>
                          <div style={{ fontSize: '0.5rem', color: 'rgba(255,255,255,0.25)', textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: 3 }}>aperturas</div>
                        </div>
                        <div style={{ flex: 1, fontSize: '0.58rem', fontFamily: 'monospace', color: 'rgba(255,255,255,0.35)', lineHeight: 1.8 }}>
                          {stats.pitches[0].open_count > 0 ? (
                            <>
                              <div style={{ color: '#86efac' }}>📬 Abierto {stats.pitches[0].open_count}× veces</div>
                              {stats.pitches[0].last_opened && (
                                <div>Último open: {new Date(stats.pitches[0].last_opened).toLocaleString('es', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</div>
                              )}
                            </>
                          ) : (
                            <div>{trackingLocal ? 'Tracking inactivo en local' : '📭 Sin aperturas registradas aún'}</div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.2)', fontFamily: 'monospace' }}>Sin datos de tracking todavía</div>
                    )}
                  </div>

                  <button onClick={() => { setSent(false); setTrackingId(null); setSentTo(''); setSentAt(null); setStats(null); setPixelUrl(null); try { localStorage.removeItem(_pitchKey) } catch {} }} style={{
                    padding: '6px 12px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.08)',
                    background: 'transparent', color: 'rgba(255,255,255,0.3)', fontSize: '0.58rem',
                    fontFamily: 'monospace', cursor: 'pointer', alignSelf: 'flex-start',
                  }}>
                    ← Re-enviar pitch nuevo
                  </button>
                </div>
              ) : (
                <>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    <span style={labelStyle}>Para (email)</span>
                    <input value={toEmail} onChange={e => setToEmail(e.target.value)}
                      placeholder="contacto@empresa.com"
                      style={inputStyle} />
                  </label>

                  <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    <span style={labelStyle}>Asunto</span>
                    <input value={subject} onChange={e => setSubject(e.target.value)} style={inputStyle} />
                  </label>

                  <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    <span style={labelStyle}>Cuerpo (texto plano)</span>
                    <textarea rows={12} value={bodyText} onChange={e => setBodyText(e.target.value)}
                      style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6 }} />
                  </label>

                  <div style={{
                    padding: '10px 14px', borderRadius: 7, background: 'rgba(96,165,250,0.05)',
                    border: '1px solid rgba(96,165,250,0.15)', fontSize: '0.6rem', color: 'rgba(255,255,255,0.35)',
                    fontFamily: 'monospace', lineHeight: 1.6,
                  }}>
                    ℹ El texto se envía en ambos formatos (plain + HTML). Para editar el diseño HTML abrí el botón de abajo.
                    El tracking pixel se inyecta automáticamente.
                  </div>

                  {sendError && (
                    <div style={{ padding: '8px 12px', borderRadius: 6, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', fontSize: '0.65rem', color: '#fca5a5', fontFamily: 'monospace' }}>
                      ⚠ {sendError}
                    </div>
                  )}

                  <button onClick={send} disabled={sending} style={{
                    width: '100%', padding: '11px', borderRadius: 9,
                    border: '1px solid rgba(139,92,246,0.5)', background: sending ? 'rgba(139,92,246,0.08)' : 'rgba(139,92,246,0.18)',
                    color: '#c4b5fd', fontSize: '0.72rem', fontFamily: 'monospace', fontWeight: 700,
                    cursor: sending ? 'not-allowed' : 'pointer', letterSpacing: '0.1em',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  }}>
                    {sending ? '⟳ ENVIANDO...' : '✉ ENVIAR PITCH EMAIL'}
                  </button>
                </>
              )}
            </div>
          )}

          {tab === 'dm' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.3)', fontFamily: 'monospace', lineHeight: 1.6 }}>
                Mensaje para LinkedIn DM, IG, o cualquier red. Editalo y copialo.
              </div>

              <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <span style={labelStyle}>Mensaje DM</span>
                <textarea rows={12} value={dmText} onChange={e => setDmText(e.target.value)}
                  style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.7 }} />
              </label>

              <div style={{ display: 'flex', gap: 8 }}>
                {contact.linkedin_url && (
                  <a href={`https://${contact.linkedin_url.replace(/^https?:\/\//, '')}`} target="_blank" rel="noreferrer"
                    style={{
                      flex: 1, padding: '10px', borderRadius: 8,
                      border: '1px solid rgba(96,165,250,0.35)', background: 'rgba(96,165,250,0.08)',
                      color: '#60a5fa', fontSize: '0.65rem', fontFamily: 'monospace', fontWeight: 700,
                      cursor: 'pointer', letterSpacing: '0.08em', textDecoration: 'none',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    }}>
                    ↗ Abrir LinkedIn
                  </a>
                )}
                <button onClick={copyDM} style={{
                  flex: 1, padding: '10px', borderRadius: 8,
                  border: `1px solid ${copied ? 'rgba(34,197,94,0.5)' : 'rgba(139,92,246,0.4)'}`,
                  background: copied ? 'rgba(34,197,94,0.1)' : 'rgba(139,92,246,0.12)',
                  color: copied ? '#86efac' : '#c4b5fd',
                  fontSize: '0.65rem', fontFamily: 'monospace', fontWeight: 700,
                  cursor: 'pointer', letterSpacing: '0.08em',
                }}>
                  {copied ? '✓ COPIADO' : '⎘ COPIAR DM'}
                </button>
              </div>

              <div style={{
                padding: '10px 14px', borderRadius: 7, background: 'rgba(251,191,36,0.04)',
                border: '1px solid rgba(251,191,36,0.15)', fontSize: '0.6rem', color: 'rgba(255,255,255,0.3)',
                fontFamily: 'monospace', lineHeight: 1.6,
              }}>
                ℹ El tracking de apertura no está disponible en DMs (LinkedIn/IG bloquean píxeles externos).
                Para saber si responden, registrá manualmente la etapa en el kanban.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── useContacts hook ──────────────────────────────────────────────────────────
function useContacts() {
  const [contacts, setContacts] = useState([])
  const [loading, setLoading]   = useState(true)
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
    if (apiOnline) { try { await apiUpdate(id, payload) } catch { setContacts(prev) } }
  }, [contacts, apiOnline])

  const updateContact = useCallback(async (id, data) => {
    const updated = contacts.map(c => c.id === id ? { ...c, ...data } : c)
    setContacts(updated)
    try { localStorage.setItem(LS_KEY, JSON.stringify(updated)) } catch {}
    if (apiOnline) { try { await apiUpdate(id, data) } catch {} }
  }, [contacts, apiOnline])

  const createContact = useCallback(async (data) => {
    if (apiOnline) {
      try {
        const res = await apiCreate(data)
        const newContact = res.contact || { ...data, id: Date.now() }
        const updated = [...contacts, newContact]
        setContacts(updated)
        try { localStorage.setItem(LS_KEY, JSON.stringify(updated)) } catch {}
        return newContact
      } catch {}
    }
    // offline fallback
    const newContact = { ...data, id: Date.now(), created_at: new Date().toISOString() }
    const updated = [...contacts, newContact]
    setContacts(updated)
    try { localStorage.setItem(LS_KEY, JSON.stringify(updated)) } catch {}
    return newContact
  }, [contacts, apiOnline])

  return { contacts, loading, apiOnline, moveContact, updateContact, createContact }
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

// ── AI Analysis Icon ──────────────────────────────────────────────────────────
function AIIcon({ size = 12, color = '#a78bfa' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
      <path d="M8 1L9.5 5.5H14L10.25 8.5L11.5 13L8 10.5L4.5 13L5.75 8.5L2 5.5H6.5L8 1Z"
        fill={color} fillOpacity="0.9" />
    </svg>
  )
}

// ── Contact Card ──────────────────────────────────────────────────────────────
function ContactCard({ contact, onEdit, onMove }) {
  const tierColor = TIER_COLORS[contact.tier] || '#6b7280'
  const daysSince = contact.last_action
    ? Math.floor((Date.now() - new Date(contact.last_action)) / 86400000)
    : null
  const stale = contact.stage !== 'cerrado' && contact.stage !== 'descartado' && daysSince !== null && daysSince > 10
  const hasAnalysis = contact.ai_analysis && contact.ai_analysis.score != null

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
        border: `1px solid ${stale ? 'rgba(245,158,11,0.35)' : hasAnalysis ? 'rgba(167,139,250,0.2)' : 'rgba(255,255,255,0.08)'}`,
        borderLeft: `3px solid ${tierColor}`,
        borderRadius: 8,
        padding: '10px 12px',
        cursor: 'grab',
        marginBottom: 8,
        userSelect: 'none',
        transition: 'transform 0.12s, border-color 0.12s, box-shadow 0.12s',
        position: 'relative',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.transform = 'translateY(-1px)'
        e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.4)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.transform = 'translateY(0)'
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

      {/* AI Score strip (if analyzed) */}
      {hasAnalysis && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          marginBottom: 6,
          padding: '4px 6px',
          background: 'rgba(167,139,250,0.06)',
          border: '1px solid rgba(167,139,250,0.15)',
          borderRadius: 5,
        }}>
          <AIIcon size={9} color={SCORE_COLOR(contact.ai_analysis.score)} />
          <span style={{ fontSize: '0.58rem', color: SCORE_COLOR(contact.ai_analysis.score), fontFamily: 'monospace', fontWeight: 700 }}>
            {contact.ai_analysis.score}/100
          </span>
          <span style={{ fontSize: '0.52rem', color: FIT_COLOR[contact.ai_analysis.fit_category], fontFamily: 'monospace', marginLeft: 2 }}>
            {FIT_LABEL[contact.ai_analysis.fit_category]}
          </span>
          {contact.ai_analysis.entry_vectors?.length > 0 && (
            <span style={{ fontSize: '0.52rem', color: 'rgba(255,255,255,0.25)', fontFamily: 'monospace', marginLeft: 'auto' }}>
              {contact.ai_analysis.entry_vectors.length} vectores
            </span>
          )}
        </div>
      )}

      {/* Footer badges */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
        {contact.responded && <Badge label="RESP" color="#10b981" small />}
        {contact.follow_up_count > 0 && <Badge label={`FU×${contact.follow_up_count}`} color="#f59e0b" small />}
        {stale && <Badge label={`${daysSince}d`} color="#f59e0b" small />}
        {!stale && daysSince !== null && daysSince <= 3 && <Badge label={`${daysSince}d`} color="#6b7280" small />}

        {/* AI Analysis button */}
        <button
          onClick={e => { e.stopPropagation(); onEdit(contact) }}
          title={hasAnalysis ? 'Re-analizar con IA' : 'Analizar con IA'}
          style={{
            marginLeft: 'auto',
            display: 'flex',
            alignItems: 'center',
            gap: 3,
            padding: '2px 7px',
            borderRadius: 4,
            border: hasAnalysis ? '1px solid rgba(167,139,250,0.4)' : '1px solid rgba(167,139,250,0.2)',
            background: hasAnalysis ? 'rgba(167,139,250,0.12)' : 'rgba(167,139,250,0.06)',
            color: hasAnalysis ? '#c4b5fd' : 'rgba(167,139,250,0.6)',
            cursor: 'pointer',
            transition: 'all 0.15s',
            fontSize: '0.52rem',
            fontFamily: 'monospace',
            letterSpacing: '0.05em',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(167,139,250,0.22)'; e.currentTarget.style.color = '#c4b5fd' }}
          onMouseLeave={e => {
            e.currentTarget.style.background = hasAnalysis ? 'rgba(167,139,250,0.12)' : 'rgba(167,139,250,0.06)'
            e.currentTarget.style.color = hasAnalysis ? '#c4b5fd' : 'rgba(167,139,250,0.6)'
          }}
        >
          <AIIcon size={8} color="currentColor" />
          {hasAnalysis ? 'RE-ANALIZAR' : 'ANALIZAR'}
        </button>
      </div>
    </div>
  )
}

// ── Stage Column ──────────────────────────────────────────────────────────────
function StageColumn({ stage, contacts, onEdit, onMove }) {
  const [dragOver, setDragOver] = useState(false)

  const handleDragOver  = e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDragOver(true) }
  const handleDragLeave = () => setDragOver(false)
  const handleDrop      = e => {
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

// ── Glitch New Button ────────────────────────────────────────────────────────
function GlitchNewButton({ onClick }) {
  const [glitch, setGlitch] = useState(false)
  const chars = '✦◈⬡◉▶'
  const [label, setLabel] = useState('+ NUEVA PROSPECCIÓN')
  const timerRef = useRef(null)

  const startGlitch = () => {
    setGlitch(true)
    let count = 0
    timerRef.current = setInterval(() => {
      const scrambled = '+ NUEVA PROSPECCIÓN'.split('').map(c =>
        c === ' ' ? ' ' : (count % 3 === 0 ? chars[Math.floor(Math.random() * chars.length)] : c)
      ).join('')
      setLabel(scrambled)
      count++
      if (count > 6) {
        clearInterval(timerRef.current)
        setLabel('+ NUEVA PROSPECCIÓN')
        setGlitch(false)
      }
    }, 60)
  }

  const stopGlitch = () => {
    clearInterval(timerRef.current)
    setLabel('+ NUEVA PROSPECCIÓN')
    setGlitch(false)
  }

  return (
    <button
      onClick={onClick}
      onMouseEnter={startGlitch}
      onMouseLeave={stopGlitch}
      style={{
        padding: '5px 14px', borderRadius: 7,
        border: '1px solid rgba(167,139,250,0.45)',
        background: glitch ? 'rgba(167,139,250,0.18)' : 'rgba(167,139,250,0.08)',
        color: glitch ? '#e9d5ff' : '#a78bfa',
        fontSize: '0.62rem', fontFamily: 'monospace', fontWeight: 700,
        cursor: 'pointer', letterSpacing: '0.1em',
        transition: 'background 0.12s, color 0.12s',
        whiteSpace: 'nowrap',
        textShadow: glitch ? '0 0 8px rgba(167,139,250,0.8)' : 'none',
        boxShadow: glitch ? '0 0 12px rgba(139,92,246,0.3)' : 'none',
      }}
    >
      {label}
    </button>
  )
}

// ── Contact Modal (Edit + AI Analysis unified) ────────────────────────────────
function ContactModal({ contact, onSave, onClose, isNew = false }) {
  // ── Edit state ──
  const [form, setForm] = useState({ ...contact })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  // ── AI state ──
  const [notes, setNotes]                   = useState(contact.notes || '')
  const [urls, setUrls]                     = useState(() => {
    const i = []
    if (contact.website) i.push(contact.website)
    if (contact.linkedin_url && !i.includes(contact.linkedin_url)) i.push(contact.linkedin_url)
    return i
  })
  const [urlInput, setUrlInput]             = useState('')
  const cacheKey = `scrape_cache_${contact.id}`
  const [scrapedContent, setScrapedContent] = useState(() => {
    try { const c = JSON.parse(localStorage.getItem(`scrape_cache_${contact.id}`)); if (c && Date.now() - c.ts < 86400000) return c.content } catch {}
    return ''
  })
  const [scrapeStatus, setScrapeStatus]     = useState(() => {
    try { const c = JSON.parse(localStorage.getItem(`scrape_cache_${contact.id}`)); if (c && Date.now() - c.ts < 86400000) return c.statuses } catch {}
    return {}
  })
  const [cacheTs, setCacheTs]               = useState(() => {
    try { const c = JSON.parse(localStorage.getItem(`scrape_cache_${contact.id}`)); if (c && Date.now() - c.ts < 86400000) return c.ts } catch {}
    return null
  })
  const [prompt, setPrompt]                 = useState(buildDefaultPrompt(contact, ''))
  const pitchSent = (() => { try { return !!JSON.parse(localStorage.getItem(`pitch_sent_${contact.id}`))?.trackingId } catch { return false } })()
  const [showPrompt, setShowPrompt]         = useState(false)
  const [analyzing, setAnalyzing]           = useState(false)
  const [scraping, setScraping]             = useState(false)
  const [analysis, setAnalysis]             = useState(contact.ai_analysis || null)
  const [aiError, setAiError]               = useState(null)
  const [remaining, setRemaining]           = useState(usageLeft())
  const [showPitch, setShowPitch]           = useState(false)

  useEffect(() => {
    setPrompt(buildDefaultPrompt({ ...contact, notes }, scrapedContent))
  }, [notes, scrapedContent])

  const addUrl = () => {
    const u = urlInput.trim()
    if (!u || urls.includes(u)) return
    setUrls(p => [...p, u])
    setUrlInput('')
  }
  const removeUrl = u => setUrls(p => p.filter(x => x !== u))

  const runScrape = async () => {
    if (urls.length === 0) return
    setScraping(true); setAiError(null)
    const statuses = {}
    urls.forEach(u => { statuses[u] = { status: 'loading', message: '' } })
    setScrapeStatus({ ...statuses })
    try {
      const data = await apiScrape(urls)
      const results = data.results || []
      let combined = ''
      const ns = {}
      results.forEach(r => {
        const isOk = r.status === 'ok'
        ns[r.url] = { status: isOk ? 'ok' : 'error', message: isOk ? '' : r.status }
        if (r.content) combined += `\n\n--- ${r.url} ---\n${r.content.slice(0, 8000)}`
      })
      setScrapeStatus(ns)
      const trimmed = combined.trim()
      setScrapedContent(trimmed)
      const now = Date.now()
      setCacheTs(now)
      try { localStorage.setItem(cacheKey, JSON.stringify({ content: trimmed, statuses: ns, ts: now })) } catch {}
    } catch (err) {
      setAiError(`Error scrapeando: ${err.message}`)
      const fs = {}; urls.forEach(u => { fs[u] = { status: 'error', message: err.message } }); setScrapeStatus(fs)
    } finally { setScraping(false) }
  }

  const runAnalysis = async () => {
    if (remaining <= 0) { setAiError('Límite diario alcanzado.'); return }
    setAnalyzing(true); setAiError(null)
    try {
      const data = await apiAnalyze({
        company: contact.company, contact_id: contact.id,
        notes, scraped_content: scrapedContent,
        custom_prompt: prompt, tier: CURRENT_TIER, model: TIER_MODEL[CURRENT_TIER],
      })
      const result = data.analysis || data
      setAnalysis(result)
      incUsage(); setRemaining(usageLeft())
      onSave(contact.id, { ai_analysis: result })
    } catch (err) { setAiError(`Error: ${err.message}`) }
    finally { setAnalyzing(false) }
  }

  const priorityColor = { high: '#ef4444', mid: '#f59e0b', low: '#6b7280' }
  const priorityLabel = { high: 'ALTA', mid: 'MEDIA', low: 'BAJA' }
  const tierColor = TIER_COLORS[contact.tier] || '#6b7280'

  const fieldStyle = {
    width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 7, padding: '7px 10px', color: '#f1f5f9', fontSize: '0.72rem',
    fontFamily: 'monospace', outline: 'none', boxSizing: 'border-box',
  }
  const labelStyle = {
    fontSize: '0.58rem', color: 'rgba(255,255,255,0.4)', fontFamily: 'monospace',
    textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4, display: 'block',
  }
  const aiLabelStyle = {
    fontSize: '0.55rem', color: 'rgba(255,255,255,0.35)', fontFamily: 'monospace',
    textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 5, display: 'block',
  }
  const aiInputStyle = {
    width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 7, padding: '8px 10px', color: '#f1f5f9', fontSize: '0.7rem',
    fontFamily: 'monospace', outline: 'none', boxSizing: 'border-box', resize: 'vertical', lineHeight: 1.5,
  }

  return (
    <>
    <div onClick={e => { if (e.target === e.currentTarget) onClose() }} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1100, padding: 16, backdropFilter: 'blur(6px)',
    }}>
      <div style={{
        background: '#080a12', border: '1px solid rgba(167,139,250,0.2)',
        borderRadius: 16, width: '100%', maxWidth: 1400,
        height: '92vh', display: 'flex', flexDirection: 'column',
        overflow: 'hidden', boxShadow: '0 0 60px rgba(139,92,246,0.15)',
      }}>

        {/* ── Header ── */}
        <div style={{
          padding: '14px 22px', borderBottom: '1px solid rgba(255,255,255,0.07)',
          background: 'rgba(139,92,246,0.06)', display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: tierColor, flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: '0.55rem', color: '#a78bfa', fontFamily: 'monospace', letterSpacing: '0.2em', textTransform: 'uppercase' }}>
                {isNew ? 'Nuevo contacto' : `T${contact.tier} · ${TIER_LABELS[contact.tier] || ''} · ${contact.location}`}
              </div>
              <div style={{ fontSize: '1rem', fontWeight: 700, color: '#f1f5f9', fontFamily: 'monospace', marginTop: 2 }}>
                {isNew ? (form.company || '— empresa —') : contact.company}
              </div>
            </div>
            {analysis && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 12 }}>
                <span style={{ fontSize: '1.1rem', fontWeight: 800, color: SCORE_COLOR(analysis.score), fontFamily: 'monospace' }}>
                  {analysis.score}/100
                </span>
                <span style={{
                  fontSize: '0.58rem', fontWeight: 700, color: FIT_COLOR[analysis.fit_category],
                  background: FIT_COLOR[analysis.fit_category] + '18', border: `1px solid ${FIT_COLOR[analysis.fit_category]}35`,
                  borderRadius: 4, padding: '2px 7px', fontFamily: 'monospace', letterSpacing: '0.08em',
                }}>
                  {FIT_LABEL[analysis.fit_category]}
                </span>
              </div>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              fontSize: '0.55rem', color: remaining <= 1 ? '#ef4444' : 'rgba(255,255,255,0.25)',
              fontFamily: 'monospace', padding: '4px 8px', borderRadius: 5,
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
            }}>
              {CURRENT_TIER.toUpperCase()} · {TIER_LIMITS[CURRENT_TIER] - remaining}/{TIER_LIMITS[CURRENT_TIER]} usados hoy
            </div>
            <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.35)', fontSize: '1.3rem', cursor: 'pointer', padding: '2px 8px', lineHeight: 1 }}>×</button>
          </div>
        </div>

        {/* ── Body: 3 columns ── */}
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', minHeight: 0 }}>

          {/* ── LEFT: Edit form ── */}
          <div style={{
            width: 310, flexShrink: 0, overflowY: 'auto',
            padding: '16px 18px', borderRight: '1px solid rgba(255,255,255,0.06)',
            display: 'flex', flexDirection: 'column', gap: 0,
          }}>
            <div style={{ fontSize: '0.55rem', color: 'rgba(255,255,255,0.25)', fontFamily: 'monospace', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 12 }}>
              {isNew ? 'Nuevo prospecto' : 'Editar contacto'}
          </div>
            {/* Stage */}
            <div style={{ marginBottom: 12 }}>
              <span style={labelStyle}>Etapa</span>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {STAGES.map(s => (
                  <button key={s.id} onClick={() => set('stage', s.id)} style={{
                    padding: '3px 7px', borderRadius: 5,
                    border: `1px solid ${form.stage === s.id ? s.color : 'rgba(255,255,255,0.08)'}`,
                    background: form.stage === s.id ? s.color + '22' : 'transparent',
                    color: form.stage === s.id ? s.color : 'rgba(255,255,255,0.35)',
                    fontSize: '0.58rem', fontFamily: 'monospace', cursor: 'pointer',
                  }}>{s.short}</button>
                ))}
              </div>
            </div>

            {/* Tier */}
            <div style={{ marginBottom: 14 }}>
              <span style={labelStyle}>Tier</span>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {[1, 2, 3, 4].map(t => (
                  <button key={t} onClick={() => set('tier', t)} style={{
                    padding: '3px 8px', borderRadius: 5,
                    border: `1px solid ${form.tier === t ? TIER_COLORS[t] : 'rgba(255,255,255,0.08)'}`,
                    background: form.tier === t ? TIER_COLORS[t] + '18' : 'transparent',
                    color: form.tier === t ? TIER_COLORS[t] : 'rgba(255,255,255,0.35)',
                    fontSize: '0.58rem', fontFamily: 'monospace', cursor: 'pointer',
                  }}>T{t}</button>
                ))}
              </div>
            </div>

            {/* Fields */}
            {[
              { key: 'company',         label: 'Empresa' },
              { key: 'location',        label: 'Ubicación' },
              { key: 'decision_maker',  label: 'Decision maker' },
              { key: 'email',           label: 'Email' },
              { key: 'linkedin_url',    label: 'LinkedIn' },
              { key: 'website',         label: 'Website' },
              { key: 'last_action',     label: 'Última acción' },
              { key: 'next_action',     label: 'Próxima acción' },
              { key: 'follow_up_count', label: 'Follow-ups', type: 'number' },
            ].map(({ key, label, type }) => (
              <label key={key} style={{ display: 'flex', flexDirection: 'column', marginBottom: 10 }}>
                <span style={labelStyle}>{label}</span>
                <input type={type || 'text'} value={form[key] ?? ''} onChange={e => set(key, type === 'number' ? +e.target.value : e.target.value)} style={fieldStyle} />
              </label>
            ))}

            <label style={{ display: 'flex', flexDirection: 'column', marginBottom: 10 }}>
              <span style={labelStyle}>Por qué (fit)</span>
              <input value={form.why ?? ''} onChange={e => set('why', e.target.value)} style={fieldStyle} />
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', marginBottom: 10 }}>
              <span style={labelStyle}>Notas</span>
              <textarea rows={3} value={form.notes ?? ''} onChange={e => set('notes', e.target.value)} style={{ ...fieldStyle, resize: 'vertical', lineHeight: 1.5 }} />
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, cursor: 'pointer' }}>
              <input type="checkbox" checked={!!form.responded} onChange={e => set('responded', e.target.checked)} style={{ accentColor: '#10b981', width: 13, height: 13 }} />
              <span style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.5)', fontFamily: 'monospace' }}>Respondió</span>
            </label>

            <button
              onClick={() => { onSave(contact.id, form); if (!isNew) onClose() }}
              style={{
                width: '100%', padding: '9px', borderRadius: 8,
                border: `1px solid ${isNew ? 'rgba(34,197,94,0.5)' : 'rgba(139,92,246,0.5)'}`,
                background: isNew ? 'rgba(34,197,94,0.12)' : 'rgba(139,92,246,0.15)',
                color: isNew ? '#86efac' : '#a78bfa',
                fontSize: '0.68rem', fontFamily: 'monospace', fontWeight: 700,
                cursor: 'pointer', letterSpacing: '0.1em', transition: 'all 0.15s',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = isNew ? 'rgba(34,197,94,0.25)' : 'rgba(139,92,246,0.3)'
                e.currentTarget.style.color = isNew ? '#bbf7d0' : '#c4b5fd'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = isNew ? 'rgba(34,197,94,0.12)' : 'rgba(139,92,246,0.15)'
                e.currentTarget.style.color = isNew ? '#86efac' : '#a78bfa'
              }}
            >
              {isNew ? '+ CREAR CONTACTO' : 'GUARDAR'}
            </button>
          </div>

          {/* ── MIDDLE: AI inputs ── */}
          <div style={{
            width: 300, flexShrink: 0, overflowY: 'auto',
            padding: '16px 18px', borderRight: '1px solid rgba(255,255,255,0.06)',
          }}>
            <div style={{ fontSize: '0.55rem', color: 'rgba(167,139,250,0.6)', fontFamily: 'monospace', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 12 }}>
              Análisis IA — inputs
            </div>

            {/* Context notes */}
            <div style={{ marginBottom: 16 }}>
              <span style={aiLabelStyle}>📝 Contexto additional</span>
              <textarea rows={4} value={notes} onChange={e => setNotes(e.target.value)}
                placeholder="Pain points, contexto extra, proyectos actuales..." style={aiInputStyle} />
            </div>

            {/* URLs */}
            <div style={{ marginBottom: 16 }}>
              <span style={aiLabelStyle}>🌐 URLs para scraping</span>
              <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                <input value={urlInput} onChange={e => setUrlInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addUrl()}
                  placeholder="https://empresa.com"
                  style={{ ...aiInputStyle, flex: 1, resize: 'none', padding: '6px 10px' }} />
                <button onClick={addUrl} style={{
                  padding: '6px 10px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)',
                  background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.5)',
                  fontSize: '0.65rem', fontFamily: 'monospace', cursor: 'pointer',
                }}>+</button>
              </div>
              {urls.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 8 }}>
                  {urls.map(u => (
                    <React.Fragment key={u}>
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px', borderRadius: 5,
                        background: 'rgba(255,255,255,0.03)',
                        border: `1px solid ${scrapeStatus[u]?.status === 'ok' ? 'rgba(34,197,94,0.3)' : scrapeStatus[u]?.status === 'error' ? 'rgba(239,68,68,0.3)' : scrapeStatus[u]?.status === 'loading' ? 'rgba(167,139,250,0.3)' : 'rgba(255,255,255,0.07)'}`,
                      }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                          background: scrapeStatus[u]?.status === 'ok' ? '#22c55e' : scrapeStatus[u]?.status === 'error' ? '#ef4444' : scrapeStatus[u]?.status === 'loading' ? '#a78bfa' : '#374151' }} />
                        <span style={{ fontSize: '0.58rem', color: 'rgba(255,255,255,0.4)', fontFamily: 'monospace', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u}</span>
                        <button onClick={() => removeUrl(u)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.2)', cursor: 'pointer', fontSize: '0.75rem', padding: '0 2px' }}>×</button>
                      </div>
                      {scrapeStatus[u]?.status === 'error' && scrapeStatus[u]?.message && (
                        <div style={{ fontSize: '0.52rem', color: '#f87171', fontFamily: 'monospace', padding: '2px 8px 4px 20px', lineHeight: 1.4, opacity: 0.8 }}>
                          {scrapeStatus[u].message.replace(/^error:\s*/i, '').replace(/\n[\s\S]*/g, '').slice(0, 140)}
                        </div>
                      )}
                    </React.Fragment>
                  ))}
                </div>
              )}
              <button onClick={runScrape} disabled={scraping || urls.length === 0} style={{
                width: '100%', padding: '7px', borderRadius: 6, border: '1px solid rgba(96,165,250,0.3)',
                background: scraping ? 'rgba(96,165,250,0.05)' : 'rgba(96,165,250,0.1)',
                color: urls.length === 0 ? 'rgba(255,255,255,0.15)' : '#60a5fa',
                fontSize: '0.62rem', fontFamily: 'monospace', fontWeight: 700,
                cursor: urls.length === 0 || scraping ? 'not-allowed' : 'pointer', letterSpacing: '0.06em',
              }}>
                {scraping ? '⟳ SCRAPEANDO...' : scrapedContent ? '⟳ RE-SCRAPEAR' : '⬡ SCRAPEAR URLS'}
              </button>
              {scrapedContent && (
                <div style={{ marginTop: 8, fontSize: '0.58rem', fontFamily: 'monospace', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#22c55e' }}>✓ {scrapedContent.length} chars scrapeados</span>
                  {cacheTs && (
                    <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: '0.5rem' }}>
                      guardado hace {Math.round((Date.now() - cacheTs) / 60000) < 60
                        ? `${Math.round((Date.now() - cacheTs) / 60000)}m`
                        : `${Math.round((Date.now() - cacheTs) / 3600000)}h`}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Prompt */}
            <div style={{ marginBottom: 16 }}>
              <button onClick={() => setShowPrompt(p => !p)} style={{
                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '6px 10px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.07)',
                background: 'rgba(255,255,255,0.02)', color: 'rgba(255,255,255,0.35)',
                fontSize: '0.58rem', fontFamily: 'monospace', cursor: 'pointer',
              }}>
                <span>Prompt personalizado</span>
                <span>{showPrompt ? '▲' : '▼'}</span>
              </button>
              {showPrompt && (
                <textarea rows={8} value={prompt} onChange={e => setPrompt(e.target.value)}
                  style={{ ...aiInputStyle, marginTop: 6 }} />
              )}
            </div>

            {/* Run analysis button */}
            {aiError && (
              <div style={{ marginBottom: 10, padding: '8px 10px', borderRadius: 6, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', fontSize: '0.62rem', color: '#fca5a5', fontFamily: 'monospace' }}>
                ⚠ {aiError}
              </div>
            )}
            <button onClick={runAnalysis} disabled={analyzing || remaining <= 0} style={{
              width: '100%', padding: '10px', borderRadius: 8,
              border: `1px solid ${remaining <= 0 ? 'rgba(255,255,255,0.08)' : 'rgba(167,139,250,0.5)'}`,
              background: analyzing ? 'rgba(167,139,250,0.08)' : remaining <= 0 ? 'rgba(255,255,255,0.03)' : 'rgba(167,139,250,0.15)',
              color: remaining <= 0 ? 'rgba(255,255,255,0.2)' : '#c4b5fd',
              fontSize: '0.68rem', fontFamily: 'monospace', fontWeight: 700,
              cursor: analyzing || remaining <= 0 ? 'not-allowed' : 'pointer',
              letterSpacing: '0.08em', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
            }}>
              <AIIcon size={11} color="currentColor" />
              {analyzing ? 'ANALIZANDO...' : analysis ? 'RE-ANALIZAR' : 'RUN ANALYSIS'}
            </button>

            {/* ── PITCH button */}
            <button
              onClick={() => setShowPitch(true)}
              disabled={!analysis && !pitchSent}
              title={!analysis && !pitchSent ? 'Primero ejecutá el análisis IA' : 'Construir pitch email / DM'}
              style={{
                marginTop: 8, width: '100%', padding: '9px', borderRadius: 8,
                border: `1px solid ${pitchSent ? 'rgba(34,197,94,0.45)' : analysis ? 'rgba(251,191,36,0.45)' : 'rgba(255,255,255,0.07)'}`,
                background: pitchSent ? 'rgba(34,197,94,0.1)' : analysis ? 'rgba(251,191,36,0.1)' : 'rgba(255,255,255,0.02)',
                color: pitchSent ? '#86efac' : analysis ? '#fde68a' : 'rgba(255,255,255,0.18)',
                fontSize: '0.65rem', fontFamily: 'monospace', fontWeight: 700,
                cursor: (analysis || pitchSent) ? 'pointer' : 'not-allowed',
                letterSpacing: '0.08em', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}
            >
              {pitchSent ? '✉ VER TRACKING PITCH' : analysis ? '✦ CONSTRUIR PITCH' : '✦ PITCH (requiere análisis)'}
            </button>
          </div>

          {/* ── RIGHT: AI output ── */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px 22px' }}>
            <div style={{ fontSize: '0.55rem', color: 'rgba(167,139,250,0.6)', fontFamily: 'monospace', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 12 }}>
              Análisis IA — output
            </div>

            {!analysis ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60%', gap: 12, color: 'rgba(255,255,255,0.15)' }}>
                <AIIcon size={32} color="rgba(167,139,250,0.2)" />
                <div style={{ fontSize: '0.7rem', fontFamily: 'monospace', textAlign: 'center', lineHeight: 1.6 }}>
                  Sin análisis todavía.<br />
                  Agregá URLs + contexto y ejecutá<br />
                  <span style={{ color: '#a78bfa' }}>Run Analysis →</span>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {/* Summary */}
                {analysis.summary && (
                  <div style={{ padding: '12px 14px', borderRadius: 8, background: 'rgba(167,139,250,0.06)', border: '1px solid rgba(167,139,250,0.15)' }}>
                    <div style={{ fontSize: '0.52rem', color: '#a78bfa', fontFamily: 'monospace', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 7 }}>Resumen ejecutivo</div>
                    <p style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.65)', fontFamily: 'monospace', lineHeight: 1.6, margin: 0 }}>{analysis.summary}</p>
                  </div>
                )}

                {/* Entry vectors */}
                {analysis.entry_vectors?.length > 0 && (
                  <div>
                    <div style={{ fontSize: '0.52rem', color: 'rgba(255,255,255,0.3)', fontFamily: 'monospace', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 8 }}>
                      Vectores de entrada ({analysis.entry_vectors.length})
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                      {analysis.entry_vectors.map((v, i) => {
                        const cat = CAT_COLORS[v.category] || { color: '#6b7280', label: v.category }
                        const pColor = priorityColor[v.priority] || '#6b7280'
                        return (
                          <div key={i} style={{ padding: '10px 12px', borderRadius: 7, background: 'rgba(255,255,255,0.025)', border: `1px solid ${cat.color}25`, borderLeft: `3px solid ${cat.color}` }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                              <span style={{ fontSize: '0.78rem', color: cat.color }}>{CAT_ICON[v.category] || '◈'}</span>
                              <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#f1f5f9', fontFamily: 'monospace', flex: 1 }}>{v.title}</span>
                              <span style={{ fontSize: '0.52rem', color: pColor, background: pColor + '15', border: `1px solid ${pColor}30`, borderRadius: 3, padding: '1px 5px', fontFamily: 'monospace', letterSpacing: '0.06em' }}>{priorityLabel[v.priority] || v.priority}</span>
                              <span style={{ fontSize: '0.5rem', color: cat.color, fontFamily: 'monospace', letterSpacing: '0.06em', opacity: 0.7 }}>{cat.label}</span>
                            </div>
                            <p style={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.45)', fontFamily: 'monospace', lineHeight: 1.5, margin: 0 }}>{v.description}</p>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Opportunities grid */}
                {analysis.opportunities && (
                  <div>
                    <div style={{ fontSize: '0.52rem', color: 'rgba(255,255,255,0.3)', fontFamily: 'monospace', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 8 }}>Oportunidades</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      {Object.entries(analysis.opportunities).map(([key, items]) => {
                        if (!items?.length) return null
                        const cat = CAT_COLORS[key] || { color: '#6b7280', label: key }
                        return (
                          <div key={key} style={{ padding: '10px 12px', borderRadius: 7, background: cat.color + '06', border: `1px solid ${cat.color}20` }}>
                            <div style={{ fontSize: '0.52rem', color: cat.color, fontFamily: 'monospace', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>
                              {CAT_ICON[key]} {cat.label}
                            </div>
                            <ul style={{ margin: 0, padding: '0 0 0 14px' }}>
                              {items.map((item, i) => (
                                <li key={i} style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.45)', fontFamily: 'monospace', lineHeight: 1.5, marginBottom: 3 }}>{item}</li>
                              ))}
                            </ul>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Pain points */}
                {analysis.pain_points?.length > 0 && (
                  <div>
                    <div style={{ fontSize: '0.52rem', color: 'rgba(255,255,255,0.3)', fontFamily: 'monospace', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 8 }}>Pain points</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {analysis.pain_points.map((p, i) => (
                        <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '6px 10px', borderRadius: 5, background: 'rgba(239,68,68,0.04)', border: '1px solid rgba(239,68,68,0.12)' }}>
                          <span style={{ color: '#ef4444', fontSize: '0.65rem', marginTop: 1, flexShrink: 0 }}>⚡</span>
                          <span style={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.5)', fontFamily: 'monospace', lineHeight: 1.5 }}>{p}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Recommended approach */}
                {analysis.recommended_approach && (
                  <div style={{ padding: '12px 14px', borderRadius: 7, background: 'rgba(20,184,166,0.05)', border: '1px solid rgba(20,184,166,0.18)' }}>
                    <div style={{ fontSize: '0.52rem', color: '#14b8a6', fontFamily: 'monospace', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 7 }}>▶ Approach recomendado</div>
                    <p style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.55)', fontFamily: 'monospace', lineHeight: 1.6, margin: 0 }}>{analysis.recommended_approach}</p>
                  </div>
                )}

                {/* Pitch angle */}
                {analysis.pitch_angle && (
                  <div style={{ padding: '12px 14px', borderRadius: 7, background: 'rgba(251,191,36,0.05)', border: '1px solid rgba(251,191,36,0.2)' }}>
                    <div style={{ fontSize: '0.52rem', color: '#fbbf24', fontFamily: 'monospace', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 7 }}>✦ Pitch angle</div>
                    <p style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.7)', fontFamily: 'monospace', lineHeight: 1.6, margin: 0, fontStyle: 'italic' }}>"{analysis.pitch_angle}"</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>

    {/* Pitch modal — stacks on top of ContactModal */}
    {showPitch && (
      <PitchModal
        contact={contact}
        analysis={analysis}
        onClose={() => setShowPitch(false)}
      />
    )}
    </>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
const PlanningProspeccion = () => {
  const { contacts, loading, apiOnline, moveContact, updateContact, createContact } = useContacts()
  const [editTarget,     setEditTarget]     = useState(null)
  const [showNew,        setShowNew]        = useState(false)
  const [tierFilter,     setTierFilter]     = useState(0)

  const visible = contacts.filter(c => tierFilter === 0 || c.tier === tierFilter)
  const byStage = stage => visible.filter(c => c.stage === stage.id)

  const total        = contacts.length
  const active       = contacts.filter(c => ['siguiendo','engagement','pitch','follow_up','respondio'].includes(c.stage)).length
  const responded    = contacts.filter(c => c.responded).length
  const calls        = contacts.filter(c => c.stage === 'call').length
  const closed       = contacts.filter(c => c.stage === 'cerrado').length
  const analyzed     = contacts.filter(c => c.ai_analysis?.score != null).length
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

            <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'center' }}>
              {[
                { label: 'Total',        value: total,              color: '#6b7280' },
                { label: 'Activos',      value: active,             color: '#8b5cf6' },
                { label: 'Respondieron', value: responded,          color: '#10b981' },
                { label: 'Calls',        value: calls,              color: '#14b8a6' },
                { label: 'Cerrados',     value: closed,             color: '#22c55e' },
                { label: 'Response %',   value: `${responseRate}%`, color: '#f59e0b' },
                { label: 'Analizados IA',value: analyzed,           color: '#a78bfa' },
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
              const pct   = total > 0 ? (count / total) * 100 : 0
              return (
                <div key={s.id} title={`${s.label}: ${count}`} style={{
                  flex: pct, background: s.color, opacity: count > 0 ? 1 : 0.12,
                  transition: 'flex 0.5s', minWidth: count > 0 ? 4 : 2,
                }} />
              )
            })}
          </div>

          {/* Tier filter + New button */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.3)', fontFamily: 'monospace', marginRight: 4 }}>TIER</span>
            {[0, 1, 2, 3, 4].map(t => (
              <button key={t} onClick={() => setTierFilter(t)} style={{
                padding: '4px 10px', borderRadius: 6,
                border: `1px solid ${tierFilter === t ? (TIER_COLORS[t] || '#6b7280') : 'rgba(255,255,255,0.08)'}`,
                background: tierFilter === t ? (TIER_COLORS[t] || '#6b7280') + '20' : 'transparent',
                color: tierFilter === t ? (TIER_COLORS[t] || '#aaa') : 'rgba(255,255,255,0.35)',
                fontSize: '0.62rem', fontFamily: 'monospace', cursor: 'pointer', transition: 'all 0.12s',
              }}>
                {t === 0 ? 'TODOS' : `T${t} — ${TIER_LABELS[t]}`}
              </button>
            ))}
            </div>
            <GlitchNewButton onClick={() => setShowNew(true)} />
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
            { stage: 'Pitch (sem 3)',      tip: '"Admiro X de su trabajo. Trabajo con Three.js/WebGL en arte + data. ¿Puedo compartir mi portfolio?"', color: '#8b5cf6' },
            { stage: 'Follow-up',          tip: 'Máx 3 follow-ups espaciados 7 días. Cada uno añade valor nuevo: proyecto, artículo, referencia.', color: '#f59e0b' },
            { stage: 'Daily routine',      tip: '20 min/día: revisar 5 perfiles, comentar 3 posts, enviar 1 DM. Consistencia > volumen.', color: '#10b981' },
          ].map(h => (
            <div key={h.stage} style={{
              background: h.color + '08', border: `1px solid ${h.color}20`,
              borderLeft: `3px solid ${h.color}`, borderRadius: 8, padding: '12px 16px',
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

      {/* Contact modal (edit + AI analysis unified) */}
      {editTarget && (
        <ContactModal
          contact={editTarget}
          onSave={updateContact}
          onClose={() => setEditTarget(null)}
        />
      )}

      {/* New contact modal */}
      {showNew && (
        <ContactModal
          contact={NEW_CONTACT_TEMPLATE}
          isNew
          onSave={async (_, data) => { await createContact(data); setShowNew(false) }}
          onClose={() => setShowNew(false)}
        />
      )}
    </div>
  )
}

export default PlanningProspeccion;