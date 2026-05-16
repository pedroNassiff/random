/**
 * auditApi.js
 * Audit Express — API service layer.
 * Mirrors the pattern of analyticsApi.js and prospecting helpers.
 */

const API = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:8000' : '')

async function _fetch(path, options = {}) {
  const res = await fetch(`${API}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  })
  if (!res.ok) {
    const msg = await res.text().catch(() => res.statusText)
    throw new Error(`${res.status}: ${msg}`)
  }
  return res.json()
}

export const auditApi = {
  // ── Runs ────────────────────────────────────────────────────────────────────
  launchAudit({ root_url, contact_id, sku = 'health_check', config = {}, trigger = 'manual' }) {
    return _fetch('/audit/runs', {
      method: 'POST',
      body: JSON.stringify({ root_url, contact_id, sku, config, trigger }),
    })
  },

  listRuns({ contact_id, limit = 50 } = {}) {
    const qs = new URLSearchParams()
    if (contact_id != null) qs.set('contact_id', contact_id)
    if (limit)             qs.set('limit', limit)
    return _fetch(`/audit/runs?${qs}`)
  },

  getRun(runId) {
    return _fetch(`/audit/runs/${runId}`)
  },

  /** Poll until status is completed | failed (max ~5 min). */
  async pollRun(runId, { interval = 3000, maxAttempts = 100 } = {}) {
    for (let i = 0; i < maxAttempts; i++) {
      const run = await auditApi.getRun(runId)
      if (['completed', 'failed', 'cancelled'].includes(run.status)) return run
      await new Promise(r => setTimeout(r, interval))
    }
    throw new Error('Audit polling timed out')
  },

  getFindings(runId, { severity, category } = {}) {
    const qs = new URLSearchParams()
    if (severity) qs.set('severity', severity)
    if (category) qs.set('category', category)
    return _fetch(`/audit/runs/${runId}/findings?${qs}`)
  },

  getReport(runId) {
    return _fetch(`/audit/runs/${runId}/report`)
  },

  cancelRun(runId) {
    return _fetch(`/audit/runs/${runId}/cancel`, { method: 'POST' })
  },

  // ── Contact integration ─────────────────────────────────────────────────────
  setContactAuditType(contactId, auditType) {
    return _fetch(`/audit/contacts/${contactId}/audit-type`, {
      method: 'PATCH',
      body: JSON.stringify({ audit_type: auditType }),
    })
  },

  // ── Probe catalog ───────────────────────────────────────────────────────────
  listProbes() {
    return _fetch('/audit/probes')
  },
}
