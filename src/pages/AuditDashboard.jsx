/**
 * AuditDashboard.jsx — /audit
 *
 * Audit Express management panel.
 * Lists all runs, lets you launch new audits, view findings + scores.
 * Integrates with Planning Prospección — shows which contacts have audit_type set.
 */
import React, { useState, useEffect, useCallback, useRef } from 'react'
import Navbar from '../components/Navbar'
import { auditApi } from '../services/auditApi'

// ── PDF generator ─────────────────────────────────────────────────────────────
async function downloadAuditPDF(run, findings, report) {
  const { default: html2canvas } = await import('html2canvas')
  const { default: jsPDF }       = await import('jspdf')

  let domain = run.root_url
  try { domain = new URL(run.root_url.startsWith('http') ? run.root_url : 'https://' + run.root_url).hostname } catch {}

  const SEV_COLORS = {
    critical: '#ef4444', high: '#f97316', medium: '#f59e0b', low: '#3b82f6', info: '#6b7280',
  }
  const CAT_COLORS_MAP = {
    security: '#ef4444', performance: '#f59e0b', seo: '#3b82f6',
    accessibility: '#a78bfa', privacy: '#ec4899', cost_optimization: '#10b981', legal: '#06b6d4',
  }
  const scoreColor = s => s >= 80 ? '#10b981' : s >= 60 ? '#f59e0b' : s >= 40 ? '#f97316' : '#ef4444'

  // ── Scores donut SVGs ────────────────────────────────────────────────────────
  const donutSVG = (score, size = 48) => {
    const color = scoreColor(score ?? 0)
    return `<svg width="${size}" height="${size}" viewBox="0 0 36 36">
      <circle cx="18" cy="18" r="15.9155" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="3.5"/>
      <circle cx="18" cy="18" r="15.9155" fill="none" stroke="${color}" stroke-width="3.5"
        stroke-dasharray="${score ?? 0} 100" stroke-dashoffset="25" stroke-linecap="round"/>
      <text x="18" y="21" text-anchor="middle" fill="${color}" font-size="8" font-weight="700" font-family="monospace">${score ?? '--'}</text>
    </svg>`
  }

  // ── Build HTML ───────────────────────────────────────────────────────────────
  const findingBlocks = findings.map(f => {
    const sevCol  = SEV_COLORS[f.severity] || '#6b7280'
    const catCol  = CAT_COLORS_MAP[f.category] || '#6b7280'
    const refs = (f.refs || []).map(r => `<a href="${r.url}" style="color:#60a5fa;font-size:10px;margin-right:10px">${r.title || r.url}</a>`).join('')
    return `
      <div style="border:1px solid rgba(255,255,255,0.09);border-radius:8px;margin-bottom:10px;overflow:hidden;page-break-inside:avoid">
        <div style="display:flex;align-items:center;gap:10px;padding:10px 14px;background:rgba(255,255,255,0.03)">
          <span style="font-size:10px;font-family:monospace;padding:2px 7px;border-radius:4px;background:${sevCol}22;color:${sevCol};border:1px solid ${sevCol}44;text-transform:uppercase;letter-spacing:.08em;flex-shrink:0">${f.severity}</span>
          <span style="font-size:10px;color:${catCol};font-family:monospace;flex-shrink:0">${f.category}</span>
          <span style="font-size:12px;color:#e2e8f0;font-weight:600;flex:1">${f.title}</span>
          ${f.impact_eur_monthly > 0 ? `<span style="font-size:10px;color:#10b981;font-family:monospace;flex-shrink:0">~${Math.round(f.impact_eur_monthly)}€/mes</span>` : ''}
        </div>
        <div style="padding:12px 14px">
          <p style="font-size:11.5px;color:rgba(255,255,255,0.65);line-height:1.7;margin:0 0 10px">${f.description}</p>
          ${f.remediation ? `
            <div style="padding:10px 14px;background:rgba(34,197,94,0.06);border:1px solid rgba(34,197,94,0.18);border-left:3px solid rgba(34,197,94,0.5);border-radius:6px;margin-bottom:10px">
              <div style="font-size:9px;color:#86efac;font-family:monospace;letter-spacing:.1em;text-transform:uppercase;margin-bottom:5px">✓ Cómo resolverlo</div>
              <p style="font-size:11px;color:rgba(134,239,172,0.85);line-height:1.7;margin:0">${f.remediation}</p>
            </div>
          ` : ''}
          <div style="display:flex;gap:16px;flex-wrap:wrap">
            ${f.fix_effort ? `<span style="font-size:10px;color:rgba(255,255,255,0.4);font-family:monospace">Esfuerzo: <span style="color:#a78bfa">${f.fix_effort}</span></span>` : ''}
            ${f.impact_eur_monthly > 0 ? `<span style="font-size:10px;color:rgba(255,255,255,0.4);font-family:monospace">Impacto: <span style="color:#10b981">~${Math.round(f.impact_eur_monthly)}€/mes</span></span>` : ''}
          </div>
          ${refs ? `<div style="margin-top:8px">${refs}</div>` : ''}
        </div>
      </div>`
  }).join('')

  const scoreCats = report?.score_breakdown
    ? Object.entries(report.score_breakdown)
        .filter(([k]) => ['security','performance','seo','accessibility','privacy'].includes(k))
        .map(([cat, sc]) => `
          <div style="display:inline-flex;align-items:center;gap:6px;margin:4px 10px 4px 0">
            ${donutSVG(sc, 40)}
            <span style="font-size:11px;color:rgba(255,255,255,0.55);font-family:monospace">${cat}</span>
          </div>`)
        .join('')
    : ''

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0 }
  body { background: #080a12; color: #e2e8f0; font-family: 'SF Mono', 'Fira Code', monospace; padding: 48px 52px; font-size: 13px; line-height: 1.6; width: 1080px }
  a { color: inherit; text-decoration: none }
  .page-break { page-break-before: always }
</style>
</head>
<body>
  <!-- Cover / Header -->
  <div style="border-bottom:1px solid rgba(255,255,255,0.08);padding-bottom:28px;margin-bottom:32px">
    <div style="font-size:9px;color:#a78bfa;letter-spacing:.3em;text-transform:uppercase;margin-bottom:10px">
      Random Lab · Audit Express · ${new Date().toLocaleDateString('es-ES', { dateStyle: 'long' })}
    </div>
    <div style="font-size:26px;font-weight:800;color:#f1f5f9;letter-spacing:-.02em;margin-bottom:6px">Technical Health Audit</div>
    <div style="font-size:16px;color:#a78bfa;margin-bottom:16px">${domain}</div>
    <div style="display:flex;align-items:center;gap:24px;flex-wrap:wrap">
      ${report ? `
        <div style="display:flex;align-items:center;gap:12px">
          ${donutSVG(report.overall_score, 72)}
          <div>
            <div style="font-size:11px;color:rgba(255,255,255,0.3);text-transform:uppercase;letter-spacing:.12em">Score global</div>
            <div style="font-size:28px;font-weight:800;color:${scoreColor(report.overall_score)}">${report.overall_score}<span style="font-size:14px;color:rgba(255,255,255,0.3)">/100</span></div>
          </div>
        </div>
      ` : ''}
      <div>
        <div style="font-size:11px;color:rgba(255,255,255,0.3);text-transform:uppercase;letter-spacing:.12em;margin-bottom:4px">Hallazgos</div>
        <div style="display:flex;gap:10px;flex-wrap:wrap">
          ${['critical','high','medium','low','info'].map(s => {
            const cnt = findings.filter(f => f.severity === s).length
            if (!cnt) return ''
            return `<span style="font-size:10px;padding:2px 8px;border-radius:4px;background:${SEV_COLORS[s]}18;color:${SEV_COLORS[s]};border:1px solid ${SEV_COLORS[s]}30">${cnt}× ${s}</span>`
          }).join('')}
        </div>
      </div>
    </div>
  </div>

  <!-- Score breakdown -->
  ${scoreCats ? `
  <div style="margin-bottom:28px">
    <div style="font-size:9px;color:rgba(255,255,255,0.3);letter-spacing:.12em;text-transform:uppercase;margin-bottom:12px">Score por categoría</div>
    <div>${scoreCats}</div>
  </div>` : ''}

  <!-- Findings -->
  <div>
    <div style="font-size:9px;color:rgba(255,255,255,0.3);letter-spacing:.12em;text-transform:uppercase;margin-bottom:14px">
      Hallazgos detallados — ${findings.length} en total
    </div>
    ${findingBlocks}
  </div>

  <!-- Footer -->
  <div style="margin-top:40px;padding-top:20px;border-top:1px solid rgba(255,255,255,0.07);font-size:10px;color:rgba(255,255,255,0.2);display:flex;justify-content:space-between">
    <span>Random Lab · https://random-lab.es/ · signal@random-lab.es</span>
    <span>Generado el ${new Date().toLocaleString('es-ES')}</span>
  </div>
</body>
</html>`

  // ── Render hidden iframe → canvas → PDF ──────────────────────────────────────
  const iframe = document.createElement('iframe')
  iframe.style.cssText = 'position:fixed;left:-9999px;top:0;width:1100px;height:100vh;border:none;opacity:0'
  document.body.appendChild(iframe)
  iframe.contentDocument.open()
  iframe.contentDocument.write(html)
  iframe.contentDocument.close()

  // Wait for fonts/SVGs to settle
  await new Promise(r => setTimeout(r, 600))

  const body = iframe.contentDocument.body
  const totalH = body.scrollHeight

  const canvas = await html2canvas(body, {
    backgroundColor: '#080a12',
    scale: 2,
    width: 1100,
    height: totalH,
    windowWidth: 1100,
    windowHeight: totalH,
    useCORS: true,
    logging: false,
  })
  document.body.removeChild(iframe)

  const A4_W = 210, A4_H = 297  // mm
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pxPerMm = canvas.width / A4_W
  const pageHeightPx = A4_H * pxPerMm
  const pages = Math.ceil(canvas.height / pageHeightPx)

  for (let i = 0; i < pages; i++) {
    if (i > 0) pdf.addPage()
    const sliceCanvas = document.createElement('canvas')
    const sliceH = Math.min(pageHeightPx, canvas.height - i * pageHeightPx)
    sliceCanvas.width  = canvas.width
    sliceCanvas.height = sliceH
    const ctx = sliceCanvas.getContext('2d')
    ctx.drawImage(canvas, 0, i * pageHeightPx, canvas.width, sliceH, 0, 0, canvas.width, sliceH)
    pdf.addImage(sliceCanvas.toDataURL('image/png'), 'PNG', 0, 0, A4_W, sliceH / pxPerMm)
  }

  pdf.save(`audit-${domain}-${new Date().toISOString().slice(0, 10)}.pdf`)
}
// ── Constants ─────────────────────────────────────────────────────────────────
const SKU_OPTIONS = [
  { value: 'health_check',  label: 'Health Check',  desc: '3 probes · ~30s · gratuito/lead magnet' },
  { value: 'audit_express', label: 'Audit Express', desc: '5 probes · ~2min · Capa 1 completa' },
]

const SEVERITY_ORDER = ['critical', 'high', 'medium', 'low', 'info']
const SEVERITY_COLORS = {
  critical: '#ef4444',
  high:     '#f97316',
  medium:   '#f59e0b',
  low:      '#3b82f6',
  info:     '#6b7280',
}
const CATEGORY_COLORS = {
  security:          '#ef4444',
  performance:       '#f59e0b',
  seo:               '#3b82f6',
  accessibility:     '#a78bfa',
  privacy:           '#ec4899',
  cost_optimization: '#10b981',
  legal:             '#06b6d4',
}
const STATUS_COLORS = {
  pending:   '#6b7280',
  running:   '#3b82f6',
  completed: '#10b981',
  failed:    '#ef4444',
  cancelled: '#6b7280',
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const scoreColor = (s) => {
  if (s >= 80) return '#10b981'
  if (s >= 60) return '#f59e0b'
  if (s >= 40) return '#f97316'
  return '#ef4444'
}

function ScoreGauge({ score, size = 60 }) {
  const color = scoreColor(score)
  return (
    <div style={{ textAlign: 'center', width: size, flexShrink: 0 }}>
      <svg width={size} height={size} viewBox="0 0 36 36">
        <circle cx="18" cy="18" r="15.9155" fill="none"
          stroke="rgba(255,255,255,0.07)" strokeWidth="3.5" />
        <circle cx="18" cy="18" r="15.9155" fill="none"
          stroke={color} strokeWidth="3.5"
          strokeDasharray={`${score} 100`}
          strokeDashoffset="25"
          strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 0.6s ease' }}
        />
        <text x="18" y="20.5" textAnchor="middle"
          fill={color} fontSize="8" fontWeight="700" fontFamily="monospace">
          {score}
        </text>
      </svg>
    </div>
  )
}

function SeverityBadge({ severity }) {
  return (
    <span style={{
      fontSize: '0.55rem', fontFamily: 'monospace', letterSpacing: '0.1em',
      textTransform: 'uppercase', padding: '2px 6px', borderRadius: 4,
      background: SEVERITY_COLORS[severity] + '22',
      color: SEVERITY_COLORS[severity],
      border: `1px solid ${SEVERITY_COLORS[severity]}44`,
    }}>
      {severity}
    </span>
  )
}

function StatusDot({ status }) {
  const color = STATUS_COLORS[status] || '#6b7280'
  const pulse = status === 'running'
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
      <span style={{
        width: 7, height: 7, borderRadius: '50%',
        background: color,
        boxShadow: pulse ? `0 0 0 0 ${color}66` : 'none',
        animation: pulse ? 'pulse 1.5s infinite' : 'none',
        flexShrink: 0,
      }} />
      <span style={{ fontSize: '0.7rem', color, fontFamily: 'monospace' }}>{status}</span>
    </span>
  )
}

// ── Launch Modal ──────────────────────────────────────────────────────────────
const TARGET_LABELS = ['home', 'shop', 'product', 'cart', 'checkout', 'login', 'account', 'api', 'admin', 'custom']
const TARGET_CONTEXT = ['public', 'authenticated', 'checkout_flow']

const LABEL_SUGGESTIONS = {
  '/':          { label: 'home',     context: 'public' },
  '/shop':      { label: 'shop',     context: 'public' },
  '/store':     { label: 'shop',     context: 'public' },
  '/cart':      { label: 'cart',     context: 'public' },
  '/checkout':  { label: 'checkout', context: 'checkout_flow' },
  '/login':     { label: 'login',    context: 'public' },
  '/account':   { label: 'account',  context: 'authenticated' },
  '/cuenta':    { label: 'account',  context: 'authenticated' },
  '/admin':     { label: 'admin',    context: 'authenticated' },
  '/api':       { label: 'api',      context: 'public' },
}

function guessLabel(path) {
  const p = path.split('?')[0].toLowerCase()
  for (const [key, val] of Object.entries(LABEL_SUGGESTIONS)) {
    if (p === key || p.startsWith(key + '/')) return val
  }
  if (p.includes('product') || p.includes('producto') || p.includes('item')) return { label: 'product', context: 'public' }
  return { label: 'custom', context: 'public' }
}

function TargetRow({ target, idx, onChange, onRemove, rootDomain }) {
  const [pathInput, setPathInput] = useState(() => {
    try {
      const u = new URL(target.url)
      return u.pathname + u.search
    } catch { return target.url }
  })

  const commitPath = (raw) => {
    const path = raw.startsWith('/') ? raw : '/' + raw
    const full = rootDomain ? (rootDomain.replace(/\/$/, '') + path) : path
    const guess = guessLabel(path)
    onChange(idx, { ...target, url: full, ...(!target._labelTouched && guess) })
  }

  const inpStyle = {
    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 6, padding: '6px 9px', color: '#f1f5f9', fontSize: '0.72rem',
    fontFamily: 'monospace', outline: 'none', boxSizing: 'border-box',
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px 120px 28px', gap: 6, alignItems: 'center', marginBottom: 6 }}>
      {/* Path */}
      <input
        value={pathInput}
        onChange={e => setPathInput(e.target.value)}
        onBlur={e => commitPath(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && commitPath(pathInput)}
        placeholder="/checkout"
        style={inpStyle}
      />
      {/* Label */}
      <select
        value={target.label}
        onChange={e => onChange(idx, { ...target, label: e.target.value, _labelTouched: true })}
        style={{ ...inpStyle, cursor: 'pointer' }}
      >
        {TARGET_LABELS.map(l => <option key={l} value={l}>{l}</option>)}
      </select>
      {/* Context */}
      <select
        value={target.context}
        onChange={e => onChange(idx, { ...target, context: e.target.value })}
        style={{ ...inpStyle, cursor: 'pointer', fontSize: '0.65rem' }}
      >
        {TARGET_CONTEXT.map(c => <option key={c} value={c}>{c}</option>)}
      </select>
      {/* Remove */}
      <button
        onClick={() => onRemove(idx)}
        style={{ background: 'none', border: 'none', color: 'rgba(239,68,68,0.5)', cursor: 'pointer', fontSize: '0.9rem', padding: 0, lineHeight: 1 }}
        title="Eliminar target"
      >×</button>
    </div>
  )
}

function LaunchModal({ prefilledUrl = '', prefilledContactId = null, prefilledSku = 'health_check', prefilledTargets = [], onClose, onLaunched }) {
  const [url, setUrl]             = useState(prefilledUrl)
  const [sku, setSku]             = useState(prefilledSku)
  const [targets, setTargets]     = useState(prefilledTargets)
  const [showTargets, setShowTargets] = useState(prefilledTargets.length > 0)
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState(null)

  // When URL changes, rebuild the root for target rows
  let rootDomain = ''
  try { rootDomain = new URL(url.trim().startsWith('http') ? url.trim() : 'https://' + url.trim()).origin } catch {}

  const addTarget = () => {
    setTargets(prev => [...prev, { url: rootDomain + '/', label: 'home', context: 'public' }])
  }

  const addPresets = () => {
    const base = rootDomain || ('https://' + url.trim())
    const presets = [
      { url: base + '/',          label: 'home',     context: 'public' },
      { url: base + '/shop',      label: 'shop',     context: 'public' },
      { url: base + '/cart',      label: 'cart',     context: 'public' },
      { url: base + '/checkout',  label: 'checkout', context: 'checkout_flow' },
    ]
    setTargets(presets)
    setShowTargets(true)
  }

  const updateTarget = (idx, val) => setTargets(prev => prev.map((t, i) => i === idx ? val : t))
  const removeTarget = (idx) => setTargets(prev => prev.filter((_, i) => i !== idx))

  const launch = async () => {
    if (!url.trim()) { setError('Introduce un dominio o URL'); return }
    setLoading(true)
    setError(null)
    try {
      const config = targets.length > 0
        ? { targets: targets.map(({ _labelTouched, ...t }) => t) }
        : {}
      const result = await auditApi.launchAudit({
        root_url:   url.trim(),
        contact_id: prefilledContactId,
        sku,
        config,
      })
      onLaunched(result)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const inpStyle = {
    width: '100%', background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.1)', borderRadius: 7,
    padding: '10px 12px', color: '#f1f5f9', fontSize: '0.85rem',
    outline: 'none', boxSizing: 'border-box', fontFamily: 'monospace',
  }
  const lbl = {
    display: 'block', fontSize: '0.6rem', color: 'rgba(255,255,255,0.4)',
    fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6,
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1200, backdropFilter: 'blur(8px)', padding: 16,
    }}>
      <div style={{
        background: '#0d0f1a', border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 12, width: '100%', maxWidth: 560, padding: 32,
        maxHeight: '90vh', overflowY: 'auto',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div>
            <div style={{ fontSize: '0.55rem', color: '#a78bfa', fontFamily: 'monospace', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 4 }}>
              Random Lab
            </div>
            <h2 style={{ margin: 0, fontSize: '1.1rem', color: '#f1f5f9' }}>Nuevo Audit</h2>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '1.2rem' }}>✕</button>
        </div>

        {/* Root URL */}
        <label style={lbl}>Dominio / URL raíz</label>
        <input
          value={url}
          onChange={e => setUrl(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !showTargets && launch()}
          placeholder="ejemplo.com"
          autoFocus
          style={{ ...inpStyle, marginBottom: 20 }}
        />

        {/* SKU */}
        <label style={{ ...lbl, marginBottom: 8 }}>SKU</label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
          {SKU_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setSku(opt.value)}
              style={{
                background: sku === opt.value ? 'rgba(167,139,250,0.12)' : 'rgba(255,255,255,0.03)',
                border: `1px solid ${sku === opt.value ? 'rgba(167,139,250,0.5)' : 'rgba(255,255,255,0.08)'}`,
                borderRadius: 8, padding: '10px 14px', cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s',
              }}
            >
              <div style={{ fontSize: '0.8rem', color: '#f1f5f9', fontWeight: 600, marginBottom: 2 }}>{opt.label}</div>
              <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.4)', fontFamily: 'monospace' }}>{opt.desc}</div>
            </button>
          ))}
        </div>

        {/* Targets section */}
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: 20, marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <button
              onClick={() => setShowTargets(v => !v)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, padding: 0 }}
            >
              <span style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.4)', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                Páginas a auditar
              </span>
              {targets.length > 0 && (
                <span style={{ fontSize: '0.58rem', color: '#a78bfa', fontFamily: 'monospace', background: 'rgba(167,139,250,0.12)', padding: '1px 6px', borderRadius: 4 }}>
                  {targets.length}
                </span>
              )}
              <span style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.2)' }}>{showTargets ? '▲' : '▼'}</span>
            </button>
            <div style={{ display: 'flex', gap: 6 }}>
              {!showTargets && (
                <button
                  onClick={addPresets}
                  style={{
                    fontSize: '0.62rem', fontFamily: 'monospace', cursor: 'pointer',
                    padding: '4px 10px', borderRadius: 6,
                    border: '1px solid rgba(16,185,129,0.35)', background: 'rgba(16,185,129,0.08)',
                    color: '#34d399', transition: 'all 0.15s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(16,185,129,0.15)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'rgba(16,185,129,0.08)'}
                >
                  + Presets e-commerce
                </button>
              )}
            </div>
          </div>

          {showTargets && (
            <>
              <div style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.2)', fontFamily: 'monospace', marginBottom: 10, lineHeight: 1.6 }}>
                Sin targets → solo se audita la URL raíz. Con targets → cada página corre los probes de URL (headers, pagespeed...). Los probes de dominio (TLS, SPF, CT logs) corren una sola vez.
              </div>

              {/* Column headers */}
              {targets.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px 120px 28px', gap: 6, marginBottom: 4 }}>
                  {['Path', 'Label', 'Contexto', ''].map(h => (
                    <div key={h} style={{ fontSize: '0.52rem', color: 'rgba(255,255,255,0.2)', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{h}</div>
                  ))}
                </div>
              )}

              {targets.map((t, i) => (
                <TargetRow
                  key={i}
                  idx={i}
                  target={t}
                  rootDomain={rootDomain}
                  onChange={updateTarget}
                  onRemove={removeTarget}
                />
              ))}

              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button
                  onClick={addTarget}
                  style={{
                    fontSize: '0.65rem', fontFamily: 'monospace', cursor: 'pointer',
                    padding: '5px 12px', borderRadius: 6,
                    border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.04)',
                    color: 'rgba(255,255,255,0.5)', transition: 'all 0.15s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
                >
                  + Añadir página
                </button>
                <button
                  onClick={addPresets}
                  style={{
                    fontSize: '0.65rem', fontFamily: 'monospace', cursor: 'pointer',
                    padding: '5px 12px', borderRadius: 6,
                    border: '1px solid rgba(16,185,129,0.3)', background: 'rgba(16,185,129,0.06)',
                    color: '#34d399', transition: 'all 0.15s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(16,185,129,0.12)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'rgba(16,185,129,0.06)'}
                >
                  Cargar presets e-commerce
                </button>
                {targets.length > 0 && (
                  <button
                    onClick={() => setTargets([])}
                    style={{
                      fontSize: '0.65rem', fontFamily: 'monospace', cursor: 'pointer',
                      padding: '5px 10px', borderRadius: 6, marginLeft: 'auto',
                      border: '1px solid rgba(239,68,68,0.2)', background: 'none',
                      color: 'rgba(239,68,68,0.5)', transition: 'all 0.15s',
                    }}
                  >
                    Limpiar
                  </button>
                )}
              </div>
            </>
          )}
        </div>

        {error && (
          <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 7, padding: '8px 12px', marginBottom: 16, fontSize: '0.75rem', color: '#f87171' }}>
            {error}
          </div>
        )}

        <button
          onClick={launch}
          disabled={loading}
          style={{
            width: '100%', background: loading ? 'rgba(167,139,250,0.15)' : 'rgba(167,139,250,0.2)',
            border: '1px solid rgba(167,139,250,0.4)', borderRadius: 8,
            padding: '11px', color: '#c4b5fd', fontSize: '0.8rem', fontWeight: 700,
            cursor: loading ? 'not-allowed' : 'pointer', letterSpacing: '0.05em', transition: 'all 0.15s',
          }}
        >
          {loading ? 'Lanzando...' : `▶ Lanzar Audit${targets.length > 0 ? ` (${targets.length} páginas)` : ''}`}
        </button>
      </div>
    </div>
  )
}


// ── Finding Row ───────────────────────────────────────────────────────────────
function FindingRow({ finding }) {
  const [open, setOpen] = useState(false)
  const catColor = CATEGORY_COLORS[finding.category] || '#6b7280'

  return (
    <div style={{
      border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8,
      marginBottom: 6, overflow: 'hidden',
      background: open ? 'rgba(255,255,255,0.03)' : 'transparent',
    }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 10,
          padding: '10px 14px', background: 'none', border: 'none',
          cursor: 'pointer', textAlign: 'left',
        }}
      >
        <SeverityBadge severity={finding.severity} />
        <span style={{ fontSize: '0.75rem', color: catColor, fontFamily: 'monospace', flexShrink: 0 }}>
          {finding.category}
        </span>
        <span style={{ flex: 1, fontSize: '0.82rem', color: '#e2e8f0' }}>{finding.title}</span>
        {finding.impact_eur_monthly > 0 && (
          <span style={{ fontSize: '0.65rem', color: '#10b981', fontFamily: 'monospace', flexShrink: 0 }}>
            ~{finding.impact_eur_monthly.toFixed(0)}€/mes
          </span>
        )}
        <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.7rem', flexShrink: 0 }}>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div style={{ padding: '0 14px 14px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          {/* Problem description */}
          <p style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.65)', lineHeight: 1.7, margin: '12px 0 10px' }}>
            {finding.description}
          </p>

          {/* Remediation */}
          {finding.remediation && (
            <div style={{
              margin: '10px 0',
              padding: '10px 14px',
              background: 'rgba(34,197,94,0.06)',
              border: '1px solid rgba(34,197,94,0.18)',
              borderLeft: '3px solid rgba(34,197,94,0.5)',
              borderRadius: 6,
            }}>
              <div style={{ fontSize: '0.55rem', color: '#86efac', fontFamily: 'monospace', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 5 }}>
                ✓ Cómo resolverlo
              </div>
              <p style={{ fontSize: '0.75rem', color: 'rgba(134,239,172,0.85)', lineHeight: 1.7, margin: 0 }}>
                {finding.remediation}
              </p>
            </div>
          )}

          {/* Fix effort + impact */}
          <div style={{ display: 'flex', gap: 16, marginTop: 8, flexWrap: 'wrap' }}>
            {finding.fix_effort && (
              <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.4)', fontFamily: 'monospace' }}>
                Esfuerzo: <span style={{ color: '#a78bfa' }}>{finding.fix_effort}</span>
              </div>
            )}
            {finding.impact_eur_monthly > 0 && (
              <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.4)', fontFamily: 'monospace' }}>
                Impacto est.: <span style={{ color: '#10b981' }}>~{finding.impact_eur_monthly.toFixed(0)}€/mes</span>
              </div>
            )}
          </div>

          {/* References */}
          {finding.refs && finding.refs.length > 0 && (
            <div style={{ marginTop: 10, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {finding.refs.map((ref, i) => (
                <a key={i} href={ref.url} target="_blank" rel="noreferrer"
                  style={{
                    fontSize: '0.6rem', fontFamily: 'monospace',
                    color: '#60a5fa', textDecoration: 'none',
                    padding: '2px 7px', borderRadius: 4,
                    border: '1px solid rgba(96,165,250,0.25)',
                    background: 'rgba(96,165,250,0.06)',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(96,165,250,0.15)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'rgba(96,165,250,0.06)'}
                >
                  ↗ {ref.title || ref.url}
                </a>
              ))}
            </div>
          )}

          {/* Evidence (collapsible) */}
          {finding.evidence && Object.keys(finding.evidence).length > 0 && (
            <details style={{ marginTop: 10 }}>
              <summary style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.3)', cursor: 'pointer', fontFamily: 'monospace', letterSpacing: '0.08em' }}>
                ▶ Evidencia técnica
              </summary>
              <pre style={{
                fontSize: '0.6rem', color: 'rgba(255,255,255,0.35)', background: 'rgba(0,0,0,0.3)',
                borderRadius: 6, padding: '8px 10px', overflow: 'auto', maxHeight: 120,
                fontFamily: 'monospace', margin: '6px 0 0', whiteSpace: 'pre-wrap',
              }}>
                {JSON.stringify(finding.evidence, null, 2)}
              </pre>
            </details>
          )}
        </div>
      )}
    </div>
  )
}

// ── Email helpers ─────────────────────────────────────────────────────────────
const _API = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:8000' : '')

async function apiSendAuditEmail(payload) {
  const res = await fetch(`${_API}/prospecting/pitch/send`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.detail || `Error ${res.status}`) }
  return res.json()
}

async function apiTranslateEmail({ subject, text, html, lang }) {
  const res = await fetch(`${_API}/prospecting/translate-pitch`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subject, text, html, lang }),
  })
  if (!res.ok) throw new Error(`Translation error: ${res.status}`)
  return res.json()
}

const LANGS = [
  { value: 'es', label: '🇪🇸 Español' },
  { value: 'en', label: '🇬🇧 English' },
  { value: 'fr', label: '🇫🇷 Français' },
  { value: 'ca', label: '🏴 Català' },
]

// ── Branded HTML email builder ────────────────────────────────────────────────
function buildAuditEmailHtml(bodyText, domain, report) {
  const score = report?.overall_score
  const scoreColor = !score ? '#94a3b8' : score >= 80 ? '#10b981' : score >= 60 ? '#f59e0b' : '#ef4444'

  // Convert plain-text lines to HTML paragraphs with some light formatting
  const escape = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const lines = bodyText.split('\n')
  let html = ''
  for (const raw of lines) {
    const line = raw.trim()
    if (line === '') { html += '<div style="height:12px"></div>'; continue }
    if (line === '—') { html += '<hr style="border:none;border-top:1px solid rgba(255,255,255,0.08);margin:20px 0">'; continue }
    // Finding header lines: ① ② ③
    if (/^[①②③④⑤]/.test(line)) {
      html += `<div style="font-size:14px;font-weight:700;color:#f1f5f9;margin-top:16px;margin-bottom:4px">${escape(line)}</div>`
      continue
    }
    // Sub-bullet → lines
    if (line.startsWith('→')) {
      const content = escape(line.slice(1).trim())
      // highlight "Solución:" lines in green
      if (content.startsWith('Solución:')) {
        html += `<div style="padding:6px 12px;margin:4px 0;background:rgba(16,185,129,0.07);border-left:2px solid rgba(16,185,129,0.4);border-radius:4px;font-size:12.5px;color:#6ee7b7;line-height:1.6">${content}</div>`
      } else {
        html += `<div style="padding:2px 0 2px 12px;font-size:12.5px;color:rgba(255,255,255,0.6);line-height:1.6;border-left:2px solid rgba(255,255,255,0.1);margin:3px 0">${content}</div>`
      }
      continue
    }
    // Bullet points
    if (line.startsWith('•')) {
      html += `<div style="font-size:12.5px;color:rgba(255,255,255,0.65);line-height:1.7;padding-left:8px">• ${escape(line.slice(1).trim())}</div>`
      continue
    }
    // Greeting / first line
    if (line.startsWith('Hola ')) {
      html += `<p style="font-size:15px;color:#f1f5f9;font-weight:600;margin:0 0 6px">${escape(line)}</p>`
      continue
    }
    // Score line
    if (line.startsWith('Resultado global:')) {
      html += `<div style="display:inline-block;padding:8px 16px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);border-radius:8px;font-size:13px;color:rgba(255,255,255,0.7);margin:4px 0">${escape(line).replace(/\d+\/100/, m => `<span style="color:${scoreColor};font-weight:800;font-size:15px">${m}</span>`)}</div><div style="height:4px"></div>`
      continue
    }
    // Section headers (end with :)
    if (line.endsWith(':') && line.length < 80) {
      html += `<div style="font-size:11px;text-transform:uppercase;letter-spacing:0.12em;color:rgba(255,255,255,0.3);margin:16px 0 8px;font-family:'SF Mono',monospace">${escape(line)}</div>`
      continue
    }
    // Signature lines
    if (line.startsWith('Pedro') || line.startsWith('Random Lab') || line.startsWith('tech@') || line.startsWith('randomlab')) {
      html += `<div style="font-size:12.5px;color:rgba(255,255,255,0.45);line-height:1.8">${escape(line)}</div>`
      continue
    }
    html += `<p style="font-size:13.5px;color:rgba(255,255,255,0.75);line-height:1.75;margin:0 0 2px">${escape(line)}</p>`
  }

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Random Lab · Audit Report</title>
</head>
<body style="margin:0;padding:0;background:#0b0d16;font-family:'SF Mono','Fira Code','Courier New',monospace">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0b0d16;padding:32px 16px">
<tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px">

  <!-- Header / Logo bar -->
  <tr><td style="padding-bottom:28px">
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td>
          <!-- Wordmark -->
          <div style="display:inline-flex;align-items:center;gap:8px">
            <!-- Hex icon -->
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
              <polygon points="14,2 25,8 25,20 14,26 3,20 3,8" fill="none" stroke="#a78bfa" stroke-width="1.5"/>
              <polygon points="14,7 20,10.5 20,17.5 14,21 8,17.5 8,10.5" fill="rgba(167,139,250,0.12)"/>
              <circle cx="14" cy="14" r="2.5" fill="#a78bfa"/>
            </svg>
            <span style="font-size:15px;font-weight:800;color:#f1f5f9;letter-spacing:-0.02em">Random<span style="color:#a78bfa">Lab</span></span>
          </div>
        </td>
        <td align="right">
          <span style="font-size:10px;color:rgba(255,255,255,0.2);letter-spacing:0.15em;text-transform:uppercase">Audit Express</span>
        </td>
      </tr>
    </table>
  </td></tr>

  <!-- Score hero (only if score available) -->
  ${score != null ? `
  <tr><td style="padding-bottom:24px">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:10px;padding:16px 20px">
      <tr>
        <td>
          <div style="font-size:10px;color:rgba(255,255,255,0.3);text-transform:uppercase;letter-spacing:0.12em;margin-bottom:4px">Score técnico global</div>
          <div style="font-size:30px;font-weight:800;color:${scoreColor};line-height:1">${score}<span style="font-size:14px;color:rgba(255,255,255,0.2);font-weight:400">/100</span></div>
        </td>
        <td align="right" style="vertical-align:middle">
          <div style="font-size:11px;color:rgba(255,255,255,0.25);text-align:right">${domain}</div>
        </td>
      </tr>
    </table>
  </td></tr>` : ''}

  <!-- Body content -->
  <tr><td style="background:#0d0f1c;border:1px solid rgba(255,255,255,0.07);border-radius:10px;padding:28px 32px">
    ${html}
  </td></tr>

  <!-- Footer -->
  <tr><td style="padding-top:24px">
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td style="font-size:10px;color:rgba(255,255,255,0.2);font-family:monospace">
          Random Lab · <a href="https://random-lab.es" style="color:rgba(167,139,250,0.6);text-decoration:none">random-lab.es</a> · signal@random-lab.es
        </td>
        <td align="right" style="font-size:10px;color:rgba(255,255,255,0.15);font-family:monospace">
          ${new Date().toLocaleDateString('es-ES', { dateStyle: 'medium' })}
        </td>
      </tr>
    </table>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`
}

// Human-readable risk label for common finding titles
const FINDING_RISK_LABEL = {
  'No HSTS':                        'Tu sitio puede ser interceptado en conexiones HTTP — los navegadores no fuerzan HTTPS de forma permanente.',
  'No CSP':                         'Scripts de terceros comprometidos podrían inyectar código malicioso en tu página sin que lo detectes.',
  'No SPF record':                  'Cualquiera puede enviar emails que parezcan venir de tu dominio — incluyendo estafadores o phishing dirigido a tus clientes.',
  'No DMARC record':                'Sin DMARC, no recibes alertas cuando alguien suplanta tu dominio en campañas de spam o fraude.',
  'No DKIM record':                 'Tus emails legítimos pueden acabar en spam o ser modificados en tránsito sin que lo notes.',
  'Weak TLS':                       'Versiones antiguas de TLS permiten ataques de degradación que exponen datos de pago e información personal.',
  'TLS certificate expiring soon':  'Si el certificado expira, tu sitio mostrará error de seguridad a todos los visitantes — cero ventas hasta resolverlo.',
  'Poor LCP':                       'Tu página tarda más de 3 segundos en mostrar el contenido principal. Google penaliza esto en rankings y los usuarios abandonan antes de comprar.',
  'Poor CLS':                       'Los botones y formularios se mueven mientras la página carga — los usuarios hacen clic en el lugar equivocado, aumentando el abandono en checkout.',
  'Poor TTFB':                      'El servidor tarda demasiado en responder. En picos de tráfico (verano, eventos), esto puede traducirse en timeouts y pérdida de ventas.',
  'No X-Frame-Options':             'Tu página puede ser incrustada en sitios falsos para realizar ataques de clickjacking sobre tus usuarios.',
  'Server header exposed':          'La versión exacta de tu servidor es pública — simplifica el trabajo a cualquiera que quiera buscar vulnerabilidades conocidas.',
}

// Sector benchmark scores by dominant category
const SECTOR_BENCHMARK = {
  security:      { label: 'sector cultural/turismo',  avg: 71 },
  performance:   { label: 'tour operators Barcelona', avg: 65 },
  seo:           { label: 'sector turismo BCN',        avg: 68 },
  accessibility: { label: 'sector cultural EU',        avg: 58 },
  default:       { label: 'sector turismo Barcelona',  avg: 67 },
}

function buildAuditEmail(run, findings, report, contactName) {
  let domain = run.root_url
  try { domain = new URL(run.root_url.startsWith('http') ? run.root_url : 'https://' + run.root_url).hostname } catch {}
  const name = contactName?.trim() || `equipo de ${domain}`

  // Sort by priority: critical > high > medium, then by priority_score desc
  const SEV_RANK = { critical: 0, high: 1, medium: 2, low: 3, info: 4 }
  const sorted = [...findings].sort((a, b) =>
    (SEV_RANK[a.severity] ?? 4) - (SEV_RANK[b.severity] ?? 4) ||
    (b.priority_score ?? 0) - (a.priority_score ?? 0)
  )
  const spotlight = sorted.slice(0, 3)   // top 3 findings — expanded with context
  const rest      = sorted.slice(3)       // remaining — grouped by category

  const totalImpact  = findings.reduce((s, f) => s + (f.impact_eur_monthly || 0), 0)
  const score        = report?.overall_score
  const dominantCat  = (() => {
    const freq = {}
    findings.forEach(f => { freq[f.category] = (freq[f.category] || 0) + 1 })
    return Object.entries(freq).sort((a, b) => b[1] - a[1])[0]?.[0] || 'default'
  })()
  const benchmark = SECTOR_BENCHMARK[dominantCat] || SECTOR_BENCHMARK.default

  // Subject: business-language hook
  const subjectScore = score != null
    ? (score < benchmark.avg
        ? `${domain} — score ${score}/100 (sector: ${benchmark.avg}) — ${spotlight.length} riesgos prioritarios`
        : `${domain} — análisis técnico — ${spotlight.length} mejoras de alto impacto`)
    : `Análisis técnico de ${domain} — ${spotlight.length} hallazgos prioritarios`

  // Expanded finding block: risk label → consequence → effort
  const EFFORT_LABEL = { trivial: '~1h', low: '1–4h', medium: '1–3 días', high: '1–2 semanas' }
  const findingBlocks = spotlight.map((f, i) => {
    const num      = ['①', '②', '③'][i] || `${i + 1}.`
    const riskLine = FINDING_RISK_LABEL[f.title] || f.description || ''
    const effort   = f.fix_effort ? `Esfuerzo estimado: ${EFFORT_LABEL[f.fix_effort] || f.fix_effort}.` : ''
    const impact   = f.impact_eur_monthly > 10 ? `Impacto estimado: ~${Math.round(f.impact_eur_monthly)}€/mes.` : ''
    const remedy   = f.remediation ? `Solución: ${f.remediation}` : ''
    return [
      `${num} ${f.title}`,
      riskLine ? `   → ${riskLine}` : '',
      remedy   ? `   → ${remedy}` : '',
      (effort || impact) ? `   → ${[effort, impact].filter(Boolean).join(' ')}` : '',
    ].filter(Boolean).join('\n')
  }).join('\n\n')

  // Remaining findings grouped by category
  const restByCategory = rest.reduce((acc, f) => {
    acc[f.category] = (acc[f.category] || [])
    acc[f.category].push(f.title)
    return acc
  }, {})
  const restLines = Object.entries(restByCategory)
    .map(([cat, titles]) => `• ${titles.length}× ${cat}: ${titles.slice(0, 3).join(', ')}${titles.length > 3 ? '…' : ''}`)

  const lines = [
    `Hola ${name},`,
    '',
    `He analizado ${domain} como parte de un estudio del sector turístico de Barcelona. No encontrarás esto en Google — es una revisión técnica independiente.`,
    '',
    score != null
      ? `Resultado global: ${score}/100 — ${score < benchmark.avg ? `por debajo de la media del ${benchmark.label} (referencia: ${benchmark.avg}/100)` : `dentro del rango del ${benchmark.label} (referencia: ${benchmark.avg}/100)`}.`
      : '',
    '',
    `Los ${spotlight.length} hallazgos que me parecen más urgentes para tu caso concreto:`,
    '',
    findingBlocks,
    rest.length > 0 ? [
      '',
      `Los ${rest.length} hallazgos restantes (${restLines.join(' | ')}) los tengo documentados — algunos con impacto directo en conversión y cumplimiento RGPD/EAA.`,
    ].join('\n') : '',
    totalImpact > 20 ? `\nImpacto total estimado del conjunto: ~${Math.round(totalImpact)}€/mes.` : '',
    '',
    'Utilizo las mismas herramientas que usa Google, SSL Labs y la AEPD para sus auditorías — todo público, nada intrusivo.',
    '',
    '¿Sería útil compartir el informe completo? 15 minutos en vídeo o por correo — como prefieras.',
    '',
    '—',
    'Pedro Nassiff',
    'Random Lab · random-lab.es',
    'signal@random-lab.es',
  ].filter(l => l !== null && l !== undefined)

  return { subject: subjectScore, bodyText: lines.join('\n') }
}

// ── Audit Email Modal ─────────────────────────────────────────────────────────
function AuditEmailModal({ run, findings, report, onClose }) {
  const init = buildAuditEmail(run, findings, report, '')
  const [contactName, setContactName] = useState('')
  const [toEmail, setToEmail]         = useState('')
  const [lang, setLang]               = useState('es')
  const [subject, setSubject]         = useState(init.subject)
  const [bodyText, setBodyText]       = useState(init.bodyText)
  const [sending, setSending]         = useState(false)
  const [translating, setTranslating] = useState(false)
  const [sent, setSent]               = useState(false)
  const [error, setError]             = useState(null)

  // Rebuild when contactName changes (only while untranslated)
  const langRef = React.useRef('es')
  const rebuild = (name) => {
    if (langRef.current !== 'es') return
    const built = buildAuditEmail(run, findings, report, name)
    setSubject(built.subject)
    setBodyText(built.bodyText)
  }

  const translate = async () => {
    setTranslating(true); setError(null)
    try {
      const result = await apiTranslateEmail({ subject, text: bodyText, html: '', lang })
      setSubject(result.subject || subject)
      setBodyText(result.text || result.body_text || bodyText)
      langRef.current = lang
    } catch (e) { setError('Error al traducir: ' + e.message) }
    finally { setTranslating(false) }
  }

  const send = async () => {
    if (!toEmail.trim()) { setError('Email destinatario requerido'); return }
    setSending(true); setError(null)
    try {
      let domain = run.root_url
      try { domain = new URL(run.root_url.startsWith('http') ? run.root_url : 'https://' + run.root_url).hostname } catch {}
      const bodyHtml = buildAuditEmailHtml(bodyText, domain, report)
      await apiSendAuditEmail({
        contact_id: run.contact_id || null,
        to_email: toEmail.trim(),
        subject,
        body_html: bodyHtml,
        body_text: bodyText,
        pitch_type: 'audit_report',
        company: domain,
      })
      setSent(true)
    } catch (e) { setError('Error al enviar: ' + e.message) }
    finally { setSending(false) }
  }

  const inp = {
    width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 7, padding: '7px 10px', color: '#f1f5f9', fontSize: '0.72rem',
    fontFamily: 'monospace', outline: 'none', boxSizing: 'border-box',
  }
  const lbl = {
    fontSize: '0.55rem', color: 'rgba(255,255,255,0.35)', fontFamily: 'monospace',
    textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4, display: 'block',
  }

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose() }} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1300, backdropFilter: 'blur(8px)',
    }}>
      <div style={{
        width: 'calc(100% - 32px)', maxWidth: 1140, height: '92vh',
        background: '#08090f', border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 12, display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{ padding: '16px 22px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <div style={{ fontSize: '0.52rem', color: '#22d3ee', fontFamily: 'monospace', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 3 }}>
              Audit Express · Report Email
            </div>
            <div style={{ fontSize: '0.95rem', color: '#f1f5f9', fontWeight: 700 }}>Generar &amp; Enviar Report</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '1.3rem' }}>✕</button>
        </div>

        {sent ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
            <div style={{ fontSize: '2.5rem', color: '#22c55e' }}>✓</div>
            <div style={{ fontSize: '0.95rem', color: '#86efac', fontFamily: 'monospace' }}>Email enviado a {toEmail}</div>
            <button onClick={onClose} style={{ marginTop: 8, padding: '8px 24px', borderRadius: 8, border: '1px solid rgba(34,197,94,0.4)', background: 'rgba(34,197,94,0.1)', color: '#86efac', cursor: 'pointer', fontFamily: 'monospace', fontSize: '0.75rem', letterSpacing: '0.1em' }}>
              CERRAR
            </button>
          </div>
        ) : (
          <div style={{ flex: 1, overflow: 'hidden', display: 'flex', minHeight: 0 }}>
            {/* Left: form */}
            <div style={{ width: 280, flexShrink: 0, overflowY: 'auto', padding: '20px 18px', borderRight: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <label style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={lbl}>Nombre destinatario</span>
                <input value={contactName} onChange={e => { setContactName(e.target.value); rebuild(e.target.value) }}
                  placeholder="Pedro / equipo de Acme" style={inp} />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={lbl}>Email destinatario *</span>
                <input type="email" value={toEmail} onChange={e => setToEmail(e.target.value)}
                  placeholder="hola@empresa.com" style={inp} />
              </label>

              {/* Language */}
              <div>
                <span style={lbl}>Idioma</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {LANGS.map(l => (
                    <button key={l.value} onClick={() => setLang(l.value)} style={{
                      padding: '6px 10px', borderRadius: 6, textAlign: 'left',
                      border: lang === l.value ? '1px solid rgba(34,211,238,0.45)' : '1px solid rgba(255,255,255,0.08)',
                      background: lang === l.value ? 'rgba(34,211,238,0.1)' : 'transparent',
                      color: lang === l.value ? '#22d3ee' : 'rgba(255,255,255,0.45)',
                      cursor: 'pointer', fontSize: '0.72rem', fontFamily: 'monospace',
                    }}>{l.label}</button>
                  ))}
                </div>
              </div>

              {lang !== 'es' && (
                <button onClick={translate} disabled={translating} style={{
                  padding: '8px', borderRadius: 7, cursor: translating ? 'wait' : 'pointer',
                  border: '1px solid rgba(167,139,250,0.35)', background: 'rgba(167,139,250,0.1)',
                  color: '#c4b5fd', fontSize: '0.68rem', fontFamily: 'monospace', opacity: translating ? 0.6 : 1,
                }}>
                  {translating ? '⟳ Traduciendo...' : `Traducir a ${LANGS.find(l => l.value === lang)?.label}`}
                </button>
              )}

              <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {error && (
                  <div style={{ fontSize: '0.65rem', color: '#f87171', fontFamily: 'monospace', padding: '6px 8px', background: 'rgba(239,68,68,0.1)', borderRadius: 5 }}>
                    {error}
                  </div>
                )}
                <button onClick={send} disabled={sending || !toEmail} style={{
                  padding: '10px', borderRadius: 8,
                  cursor: (sending || !toEmail) ? 'not-allowed' : 'pointer',
                  border: '1px solid rgba(34,197,94,0.5)', background: 'rgba(34,197,94,0.15)',
                  color: '#86efac', fontSize: '0.75rem', fontFamily: 'monospace', fontWeight: 700,
                  opacity: (sending || !toEmail) ? 0.5 : 1, letterSpacing: '0.08em',
                }}>
                  {sending ? '⟳ Enviando...' : '✉ ENVIAR REPORT'}
                </button>
              </div>
            </div>

            {/* Right: email preview / edit */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ fontSize: '0.52rem', color: 'rgba(255,255,255,0.25)', fontFamily: 'monospace', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                Preview — editable antes de enviar
              </div>
              <label style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ ...lbl, marginBottom: 5 }}>Asunto</span>
                <input value={subject} onChange={e => setSubject(e.target.value)}
                  style={{ ...inp, fontSize: '0.8rem', fontWeight: 600 }} />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
                <span style={{ ...lbl, marginBottom: 5 }}>Cuerpo del email</span>
                <textarea value={bodyText} onChange={e => setBodyText(e.target.value)}
                  style={{ ...inp, flex: 1, minHeight: 420, resize: 'vertical', lineHeight: 1.75, fontSize: '0.72rem' }} />
              </label>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Run Detail Panel ──────────────────────────────────────────────────────────
function RunDetailPanel({ runId, onClose, onRerun = () => {} }) {
  const [run, setRun]                   = useState(null)
  const [findings, setFindings]         = useState([])
  const [report, setReport]             = useState(null)
  const [loading, setLoading]           = useState(true)
  const [sevFilter, setSevFilter]       = useState('')
  const [catFilter, setCatFilter]       = useState('')
  const [showEmailModal, setShowEmailModal] = useState(false)
  const [generatingPdf, setGeneratingPdf] = useState(false)
  const [editingUrl, setEditingUrl]     = useState(false)
  const [editUrlVal, setEditUrlVal]     = useState('')
  const [showRerunModal, setShowRerunModal] = useState(false)
  const pollRef = useRef(null)

  const load = useCallback(async () => {
    try {
      const [runData, findingsData] = await Promise.all([
        auditApi.getRun(runId),
        auditApi.getFindings(runId),
      ])
      setRun(runData)
      setFindings(findingsData.findings || [])

      if (runData.status === 'completed') {
        try { setReport(await auditApi.getReport(runId)) } catch {}
      }

      // Keep polling if still running
      if (['pending', 'running'].includes(runData.status)) {
        pollRef.current = setTimeout(load, 3000)
      }
    } catch (e) {
      console.error('Error loading run', e)
    } finally {
      setLoading(false)
    }
  }, [runId])

  useEffect(() => {
    load()
    return () => clearTimeout(pollRef.current)
  }, [load])

  const filteredFindings = findings.filter(f =>
    (!sevFilter || f.severity === sevFilter) &&
    (!catFilter || f.category === catFilter)
  )

  const severities = [...new Set(findings.map(f => f.severity))]
    .sort((a, b) => SEVERITY_ORDER.indexOf(a) - SEVERITY_ORDER.indexOf(b))
  const categories = [...new Set(findings.map(f => f.category))]

  if (loading) return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200 }}>
      <div style={{ color: '#a78bfa', fontFamily: 'monospace', fontSize: '0.85rem' }}>Cargando audit...</div>
    </div>
  )

  const isRunning = run && ['pending', 'running'].includes(run.status)

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1200, backdropFilter: 'blur(4px)',
    }}>
      <div style={{
        width: 'calc(100% - 32px)', maxWidth: 1400, height: 'calc(100vh - 32px)',
        background: '#08090f',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 12,
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '0.55rem', color: '#a78bfa', fontFamily: 'monospace', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 4 }}>
              {run?.sku} · {run?.id?.slice(0, 8)}
            </div>
            {editingUrl ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <input
                  autoFocus
                  value={editUrlVal}
                  onChange={e => setEditUrlVal(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && editUrlVal.trim()) { setEditingUrl(false); handleRerun(editUrlVal) }
                    if (e.key === 'Escape') { setEditingUrl(false) }
                  }}
                  style={{
                    flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(167,139,250,0.4)',
                    borderRadius: 6, padding: '5px 10px', color: '#f1f5f9', fontSize: '0.9rem',
                    fontWeight: 700, fontFamily: 'inherit', outline: 'none',
                  }}
                />
                <button
                  onClick={() => { if (editUrlVal.trim()) { setEditingUrl(false); handleRerun(editUrlVal) } }}
                  disabled={!editUrlVal.trim()}
                  style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid rgba(167,139,250,0.5)', background: 'rgba(167,139,250,0.15)', color: '#a78bfa', cursor: 'pointer', fontSize: '0.7rem', fontFamily: 'monospace', fontWeight: 700 }}
                >
                  ↵ Lanzar
                </button>
                <button
                  onClick={() => setEditingUrl(false)}
                  style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)', background: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '0.7rem', fontFamily: 'monospace' }}
                >
                  ✕
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                <span style={{ fontSize: '1rem', color: '#f1f5f9', fontWeight: 700, wordBreak: 'break-all' }}>{run?.root_url}</span>
                <button
                  onClick={() => { setEditUrlVal(run?.root_url || ''); setEditingUrl(true) }}
                  title="Editar URL y relanzar"
                  style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.25)', cursor: 'pointer', fontSize: '0.75rem', padding: '2px 4px', flexShrink: 0, transition: 'color 0.15s' }}
                  onMouseEnter={e => e.currentTarget.style.color = '#a78bfa'}
                  onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.25)'}
                >
                  ✎
                </button>
              </div>
            )}
            <div style={{ marginTop: 4 }}><StatusDot status={run?.status} /></div>
          </div>
          {report && <ScoreGauge score={report.overall_score} size={64} />}
          <div style={{ display: 'flex', gap: 8, flexShrink: 0, alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={() => setShowRerunModal(true)}
              disabled={!run?.root_url}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '7px 12px', borderRadius: 8,
                border: '1px solid rgba(251,191,36,0.35)',
                background: 'rgba(251,191,36,0.07)',
                color: '#fbbf24', cursor: 'pointer',
                fontSize: '0.68rem', fontFamily: 'monospace', fontWeight: 700,
                letterSpacing: '0.08em', transition: 'all 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(251,191,36,0.15)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(251,191,36,0.07)'}>
              ↺ RE-RUN
            </button>
          {run?.status === 'completed' && (
            <>
              <button
                onClick={() => setShowEmailModal(true)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '7px 14px', borderRadius: 8,
                  border: '1px solid rgba(34,211,238,0.4)',
                  background: 'rgba(34,211,238,0.08)',
                  color: '#22d3ee', cursor: 'pointer',
                  fontSize: '0.68rem', fontFamily: 'monospace', fontWeight: 700,
                  letterSpacing: '0.08em', transition: 'all 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(34,211,238,0.18)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(34,211,238,0.08)' }}
              >
                ✉ REPORT & EMAIL
              </button>
              <button
                onClick={async () => {
                  setGeneratingPdf(true)
                  try { await downloadAuditPDF(run, findings, report) } finally { setGeneratingPdf(false) }
                }}
                disabled={generatingPdf}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '7px 14px', borderRadius: 8,
                  border: '1px solid rgba(167,139,250,0.4)',
                  background: generatingPdf ? 'rgba(167,139,250,0.18)' : 'rgba(167,139,250,0.08)',
                  color: '#a78bfa', cursor: generatingPdf ? 'wait' : 'pointer',
                  fontSize: '0.68rem', fontFamily: 'monospace', fontWeight: 700,
                  letterSpacing: '0.08em', transition: 'all 0.15s',
                  opacity: generatingPdf ? 0.7 : 1,
                }}
                onMouseEnter={e => { if (!generatingPdf) e.currentTarget.style.background = 'rgba(167,139,250,0.18)' }}
                onMouseLeave={e => { if (!generatingPdf) e.currentTarget.style.background = 'rgba(167,139,250,0.08)' }}
              >
                {generatingPdf ? '⟳ Generando...' : '📄 PDF'}
              </button>
            </>
          )}
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '1.2rem', flexShrink: 0 }}>✕</button>
        </div>

        {showEmailModal && run && (
          <AuditEmailModal
            run={run}
            findings={findings}
            report={report}
            onClose={() => setShowEmailModal(false)}
          />
        )}

        {showRerunModal && run && (
          <LaunchModal
            prefilledUrl={run.root_url}
            prefilledContactId={run.contact_id ?? null}
            prefilledSku={run.sku}
            prefilledTargets={run.config?.targets || []}
            onClose={() => setShowRerunModal(false)}
            onLaunched={(result) => {
              setShowRerunModal(false)
              onRerun(result.run_id)
            }}
          />
        )}

        {isRunning && (
          <div style={{ padding: '12px 24px', background: 'rgba(59,130,246,0.08)', borderBottom: '1px solid rgba(59,130,246,0.2)', fontSize: '0.72rem', color: '#93c5fd', fontFamily: 'monospace' }}>
            ⟳ Audit en curso — los resultados aparecerán automáticamente
          </div>
        )}

        {/* Score breakdown */}
        {report?.score_breakdown && (
          <div style={{ padding: '16px 24px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ fontSize: '0.55rem', color: 'rgba(255,255,255,0.3)', fontFamily: 'monospace', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 10 }}>Score por categoría</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              {Object.entries(report.score_breakdown)
                .filter(([k]) => ['security','performance','seo','accessibility','privacy'].includes(k))
                .map(([cat, score]) => (
                  <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 28, height: 28 }}>
                      <ScoreGauge score={score} size={28} />
                    </div>
                    <span style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.5)', fontFamily: 'monospace' }}>{cat}</span>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Filters */}
        {findings.length > 0 && (
          <div style={{ padding: '10px 24px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <select value={sevFilter} onChange={e => setSevFilter(e.target.value)}
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, color: '#e2e8f0', padding: '4px 8px', fontSize: '0.7rem', cursor: 'pointer' }}>
              <option value="">Todas las severidades</option>
              {severities.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <select value={catFilter} onChange={e => setCatFilter(e.target.value)}
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, color: '#e2e8f0', padding: '4px 8px', fontSize: '0.7rem', cursor: 'pointer' }}>
              <option value="">Todas las categorías</option>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <span style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.3)', fontFamily: 'monospace', alignSelf: 'center' }}>
              {filteredFindings.length} hallazgos
            </span>
          </div>
        )}

        {/* Findings list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
          {filteredFindings.length === 0 && !isRunning && (
            <div style={{ color: 'rgba(255,255,255,0.25)', fontSize: '0.8rem', textAlign: 'center', paddingTop: 40 }}>
              {run?.status === 'failed' ? '⚠ El audit falló. Revisa la URL o inténtalo de nuevo.' : 'Sin hallazgos con los filtros actuales.'}
            </div>
          )}
          {filteredFindings.map(f => <FindingRow key={f.id} finding={f} />)}
        </div>

        {/* Executive MD */}
        {report?.executive_md && (
          <div style={{ padding: '16px 24px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <details>
              <summary style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontFamily: 'monospace', letterSpacing: '0.1em' }}>
                ▶ Executive Summary (markdown)
              </summary>
              <pre style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.5)', padding: '10px', background: 'rgba(0,0,0,0.3)', borderRadius: 6, overflow: 'auto', maxHeight: 200, fontFamily: 'monospace', margin: '8px 0 0', whiteSpace: 'pre-wrap' }}>
                {report.executive_md}
              </pre>
            </details>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Run Card ──────────────────────────────────────────────────────────────────
function RunCard({ run, onClick }) {
  const sev = run.severity_counts || {}
  const hasCritical = sev.critical > 0
  const hasHigh     = sev.high > 0

  return (
    <div
      onClick={onClick}
      style={{
        background: '#0d0f1a', border: `1px solid ${hasCritical ? 'rgba(239,68,68,0.2)' : hasHigh ? 'rgba(249,115,22,0.15)' : 'rgba(255,255,255,0.06)'}`,
        borderRadius: 10, padding: '16px 18px', cursor: 'pointer',
        transition: 'border-color 0.15s, background 0.15s',
      }}
      onMouseEnter={e => e.currentTarget.style.background = '#0f1120'}
      onMouseLeave={e => e.currentTarget.style.background = '#0d0f1a'}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
            <StatusDot status={run.status} />
            <span style={{ fontSize: '0.6rem', color: '#a78bfa', fontFamily: 'monospace', textTransform: 'uppercase' }}>{run.sku}</span>
          </div>
          <div style={{ fontSize: '0.9rem', color: '#f1f5f9', fontWeight: 600, wordBreak: 'break-all' }}>{run.root_url}</div>
          <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.3)', fontFamily: 'monospace', marginTop: 4 }}>
            {new Date(run.created_at).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' })}
          </div>
        </div>

        {run.report ? (
          <ScoreGauge score={run.report.overall_score} size={52} />
        ) : (
          <div style={{ width: 52, textAlign: 'center', fontSize: '0.6rem', color: 'rgba(255,255,255,0.2)', fontFamily: 'monospace', paddingTop: 8 }}>
            {run.status === 'running' ? '...' : '--'}
          </div>
        )}
      </div>

      {run.finding_count > 0 && (
        <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
          {SEVERITY_ORDER.filter(s => sev[s]).map(s => (
            <span key={s} style={{
              fontSize: '0.6rem', fontFamily: 'monospace', padding: '2px 7px', borderRadius: 4,
              background: SEVERITY_COLORS[s] + '18', color: SEVERITY_COLORS[s],
              border: `1px solid ${SEVERITY_COLORS[s]}30`,
            }}>
              {sev[s]}× {s}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
const AuditDashboard = () => {
  const [runs, setRuns]           = useState([])
  const [loading, setLoading]     = useState(true)
  const [showLaunch, setShowLaunch] = useState(false)
  const [activeRunId, setActiveRunId] = useState(null)
  const pollRef = useRef(null)

  const loadRuns = useCallback(async () => {
    try {
      const { runs: list } = await auditApi.listRuns({ limit: 100 })
      // Enrich with per-run summary (already included in list_runs)
      setRuns(list)
    } catch (e) {
      console.error('Error loading audit runs', e)
    } finally {
      setLoading(false)
    }
  }, [])

  // Reload full list every 5s if any run is active
  useEffect(() => {
    loadRuns()
    const tick = () => {
      loadRuns()
      pollRef.current = setTimeout(tick, 5000)
    }
    pollRef.current = setTimeout(tick, 5000)
    return () => clearTimeout(pollRef.current)
  }, [loadRuns])

  const handleLaunched = (result) => {
    setShowLaunch(false)
    setActiveRunId(result.run_id)
    loadRuns()
  }

  const stats = {
    total:     runs.length,
    running:   runs.filter(r => r.status === 'running').length,
    completed: runs.filter(r => r.status === 'completed').length,
    avgScore:  Math.round(
      runs.filter(r => r.report).reduce((a, r) => a + r.report.overall_score, 0) /
      Math.max(runs.filter(r => r.report).length, 1)
    ),
  }

  return (
    <div style={{ minHeight: '100vh', background: '#080a12' }}>
      <Navbar />

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '100px 20px 60px' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 40, flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ fontSize: '0.55rem', color: '#a78bfa', fontFamily: 'monospace', letterSpacing: '0.3em', textTransform: 'uppercase', marginBottom: 8 }}>
              Random Lab · Internal
            </div>
            <h1 style={{ margin: 0, fontSize: '2.2rem', fontWeight: 800, color: '#f1f5f9', letterSpacing: '-0.02em' }}>
              Audit Express
            </h1>
            <p style={{ margin: '6px 0 0', fontSize: '0.82rem', color: 'rgba(255,255,255,0.4)' }}>
              Tech Health Audit automatizado · Capa 1 (pasivo)
            </p>
          </div>
          <button
            onClick={() => setShowLaunch(true)}
            style={{
              background: 'rgba(167,139,250,0.15)', border: '1px solid rgba(167,139,250,0.4)',
              borderRadius: 9, padding: '10px 20px', color: '#c4b5fd',
              fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer',
              letterSpacing: '0.04em', transition: 'all 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(167,139,250,0.25)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(167,139,250,0.15)'}
          >
            + Nuevo Audit
          </button>
        </div>

        {/* Stats bar */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 32, flexWrap: 'wrap' }}>
          {[
            { label: 'Total audits',   value: stats.total },
            { label: 'En curso',       value: stats.running, color: '#3b82f6' },
            { label: 'Completados',    value: stats.completed, color: '#10b981' },
            { label: 'Score promedio', value: stats.total ? `${stats.avgScore}/100` : '—', color: scoreColor(stats.avgScore) },
          ].map(s => (
            <div key={s.label} style={{
              background: '#0d0f1a', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8,
              padding: '12px 18px', minWidth: 110,
            }}>
              <div style={{ fontSize: '0.55rem', color: 'rgba(255,255,255,0.3)', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>
                {s.label}
              </div>
              <div style={{ fontSize: '1.4rem', fontWeight: 700, color: s.color || '#f1f5f9', fontFamily: 'monospace' }}>
                {s.value}
              </div>
            </div>
          ))}
        </div>

        {/* Run list */}
        {loading ? (
          <div style={{ color: 'rgba(255,255,255,0.25)', fontSize: '0.8rem', textAlign: 'center', paddingTop: 60, fontFamily: 'monospace' }}>
            Cargando audits...
          </div>
        ) : runs.length === 0 ? (
          <div style={{
            textAlign: 'center', paddingTop: 60,
            color: 'rgba(255,255,255,0.2)', fontSize: '0.9rem',
          }}>
            <div style={{ fontSize: '2rem', marginBottom: 12 }}>⬡</div>
            Ningún audit todavía.<br />
            <button onClick={() => setShowLaunch(true)} style={{ marginTop: 16, background: 'none', border: 'none', color: '#a78bfa', cursor: 'pointer', fontSize: '0.85rem', textDecoration: 'underline' }}>
              Lanza el primero →
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 12 }}>
            {runs.map(run => (
              <RunCard
                key={run.id}
                run={run}
                onClick={() => setActiveRunId(run.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
      {showLaunch && (
        <LaunchModal
          onClose={() => setShowLaunch(false)}
          onLaunched={handleLaunched}
        />
      )}
      {activeRunId && (
        <RunDetailPanel
          runId={activeRunId}
          onClose={() => { setActiveRunId(null); loadRuns() }}
          onRerun={(newId) => setActiveRunId(newId)}
        />
      )}

      {/* Pulse animation */}
      <style>{`
        @keyframes pulse {
          0%   { box-shadow: 0 0 0 0 rgba(59,130,246,0.5) }
          70%  { box-shadow: 0 0 0 6px rgba(59,130,246,0) }
          100% { box-shadow: 0 0 0 0 rgba(59,130,246,0) }
        }
      `}</style>
    </div>
  )
}

export default AuditDashboard
