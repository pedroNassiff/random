import { useState, type FormEvent } from 'react'
import { api, errorText } from '../api'
import type { Client, ClientInput, ClientType } from '../types'

const EMPTY: ClientInput = {
  nombre: '',
  pais: 'ES',
  tipo: 'empresa',
  tax_id: null,
  direccion: '',
  email: null,
  moneda: 'EUR',
  retencion_pct: '0',
  dias_pago: null,
  vinculada: false,
  notas: '',
}
const TIPOS: { value: ClientType; label: string }[] = [
  { value: 'empresa', label: 'Empresa' },
  { value: 'autonomo', label: 'Autónomo o profesional' },
  { value: 'particular', label: 'Particular' },
]
const RETENCIONES = ['0', '7', '15']

const toInput = (c: Client): ClientInput => ({
  nombre: c.nombre,
  pais: c.pais,
  tipo: c.tipo,
  tax_id: c.tax_id,
  direccion: c.direccion,
  email: c.email,
  moneda: c.moneda,
  retencion_pct: String(Number(c.retencion_pct)),
  dias_pago: c.dias_pago,
  vinculada: c.vinculada,
  notas: c.notas,
})

interface Props {
  client: Client | null
  onSaved: () => void
  onCancel: () => void
}

export function ClientForm({ client, onSaved, onCancel }: Props) {
  const [form, setForm] = useState<ClientInput>(client ? toInput(client) : EMPTY)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const change = (patch: Partial<ClientInput>) => setForm((f) => ({ ...f, ...patch }))

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      if (client) await api.updateClient(client.id, form)
      else await api.createClient(form)
      onSaved()
    } catch (err) {
      setError(errorText(err))
      setBusy(false)
    }
  }

  return (
    <form
      className="rd-card rd-form rd-form--grid"
      onSubmit={submit}
      aria-label={client ? 'Editar cliente' : 'Nuevo cliente'}
    >
      <div className="rd-field rd-field--wide">
        <label className="rd-label" htmlFor="cl-nombre">
          Nombre o razón social
        </label>
        <input
          id="cl-nombre"
          className="rd-input"
          required
          value={form.nombre}
          onChange={(e) => change({ nombre: e.target.value })}
        />
      </div>
      <div className="rd-field">
        <label className="rd-label" htmlFor="cl-pais">
          País (código de 2 letras)
        </label>
        <input
          id="cl-pais"
          className="rd-input"
          required
          maxLength={2}
          value={form.pais}
          onChange={(e) => change({ pais: e.target.value.toUpperCase() })}
        />
      </div>
      <div className="rd-field">
        <label className="rd-label" htmlFor="cl-tipo">
          Tipo
        </label>
        <select
          id="cl-tipo"
          className="rd-input"
          value={form.tipo}
          onChange={(e) => change({ tipo: e.target.value as ClientType })}
        >
          {TIPOS.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>
      <div className="rd-field">
        <label className="rd-label" htmlFor="cl-tax">
          NIF / VAT
        </label>
        <input
          id="cl-tax"
          className="rd-input"
          value={form.tax_id ?? ''}
          onChange={(e) => change({ tax_id: e.target.value || null })}
        />
      </div>
      <div className="rd-field">
        <label className="rd-label" htmlFor="cl-email">
          Email de facturación
        </label>
        <input
          id="cl-email"
          className="rd-input"
          type="email"
          value={form.email ?? ''}
          onChange={(e) => change({ email: e.target.value || null })}
        />
      </div>
      <div className="rd-field rd-field--wide">
        <label className="rd-label" htmlFor="cl-direccion">
          Domicilio
        </label>
        <input
          id="cl-direccion"
          className="rd-input"
          value={form.direccion}
          onChange={(e) => change({ direccion: e.target.value })}
        />
      </div>
      <div className="rd-field">
        <label className="rd-label" htmlFor="cl-moneda">
          Moneda
        </label>
        <input
          id="cl-moneda"
          className="rd-input"
          required
          maxLength={3}
          value={form.moneda}
          onChange={(e) => change({ moneda: e.target.value.toUpperCase() })}
        />
      </div>
      <div className="rd-field">
        <label className="rd-label" htmlFor="cl-retencion">
          Retención de IRPF que te aplica
        </label>
        <select
          id="cl-retencion"
          className="rd-input"
          value={form.retencion_pct}
          onChange={(e) => change({ retencion_pct: e.target.value })}
        >
          {RETENCIONES.map((r) => (
            <option key={r} value={r}>
              {r} %
            </option>
          ))}
        </select>
      </div>
      <div className="rd-field">
        <label className="rd-label" htmlFor="cl-dias">
          Plazo de pago (días)
        </label>
        <input
          id="cl-dias"
          className="rd-input"
          type="number"
          min={0}
          max={365}
          value={form.dias_pago ?? ''}
          onChange={(e) => change({ dias_pago: e.target.value === '' ? null : Number(e.target.value) })}
        />
      </div>
      <label className="rd-check rd-field">
        <input
          type="checkbox"
          checked={form.vinculada}
          onChange={(e) => change({ vinculada: e.target.checked })}
        />
        Es una sociedad mía o de un familiar
      </label>
      <div className="rd-field rd-field--wide">
        <label className="rd-label" htmlFor="cl-notas">
          Notas
        </label>
        <input
          id="cl-notas"
          className="rd-input"
          value={form.notas}
          onChange={(e) => change({ notas: e.target.value })}
        />
      </div>
      {error && (
        <p role="alert" className="rd-error rd-field--wide">
          {error}
        </p>
      )}
      <div className="rd-doc-actions rd-field--wide">
        <button type="submit" className="rd-btn rd-btn--primary" disabled={busy}>
          {client ? 'Guardar cambios' : 'Crear cliente'}
        </button>
        <button type="button" className="rd-link" onClick={onCancel}>
          Cancelar
        </button>
      </div>
    </form>
  )
}
