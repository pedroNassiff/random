import { useCallback, useState } from 'react'
import { useLoad } from '../../vaca-futbolera/useLoad'
import { api, errorText } from '../api'
import { ClientForm } from '../components/ClientForm'
import { formatDate } from '../format'
import type { Client, ClientType, Operacion } from '../types'

const TIPO: Record<ClientType, string> = {
  empresa: 'Empresa',
  autonomo: 'Autónomo',
  particular: 'Particular',
}
const OPERACION: Record<Operacion, string> = {
  nacional: 'España',
  intracomunitaria: 'Unión Europea',
  extracomunitaria: 'Fuera de la UE',
}

function viesLabel(c: Client): { text: string; tone: string } | null {
  if (!c.requiere_vies) return null
  if (c.vies_ok === null) return { text: 'VIES sin comprobar', tone: 'warn' }
  const when = c.vies_checked_at ? ` (${formatDate(c.vies_checked_at.slice(0, 10))})` : ''
  return c.vies_ok
    ? { text: `VIES válido${when}`, tone: 'ok' }
    : { text: `VIES no válido${when}`, tone: 'vencida' }
}

/** Datos del cliente y lo que implican para facturarle. */
function Details({ client, error }: { client: Client; error: string | null }) {
  const vies = viesLabel(client)
  return (
    <div className="rd-row-main">
      <p className="rd-row-title">
        {client.nombre} <span className="rd-tag">{OPERACION[client.operacion]}</span>
        {vies && <span className={`rd-tag rd-tag--${vies.tone}`}>{vies.text}</span>}
        {client.vinculada && <span className="rd-tag rd-tag--warn">Vinculada</span>}
        {!client.activo && <span className="rd-tag">Archivado</span>}
      </p>
      <p className="rd-muted">
        {client.tax_id ?? 'Sin NIF/VAT'} · {client.direccion || 'Sin domicilio'}
        {client.email ? ` · ${client.email}` : ''}
      </p>
      <p className="rd-source">
        {client.casillas}
        {client.mencion ? ` · Mención: ${client.mencion}` : ''}
      </p>
      {client.vies_nombre && <p className="rd-muted">Nombre en VIES: {client.vies_nombre}</p>}
      {client.observaciones.map((o) => (
        <p key={o} className="rd-issue">
          {o}
        </p>
      ))}
      {error && (
        <p role="alert" className="rd-error">
          {error}
        </p>
      )}
    </div>
  )
}

function Row({ client, onEdit, onChanged }: { client: Client; onEdit: () => void; onChanged: () => void }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const code = `C-${String(client.codigo).padStart(3, '0')}`

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true)
    setError(null)
    try {
      await action()
      onChanged()
    } catch (err) {
      setError(errorText(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <li
      className={`rd-row ${client.observaciones.length ? 'rd-row--T-5' : ''} ${client.activo ? '' : 'rd-row--off'}`}
    >
      <div className="rd-row-date">
        <strong>{code}</strong>
        <span className="rd-tag">{client.pais}</span>
        <span className="rd-muted">{TIPO[client.tipo]}</span>
      </div>
      <Details client={client} error={error} />
      <div className="rd-status">
        <span className="rd-muted">
          {client.moneda} · retención {Number(client.retencion_pct)} %
          {client.dias_pago === null ? '' : ` · pago a ${client.dias_pago} días`}
        </span>
        {client.requiere_vies && (
          <button
            type="button"
            className="rd-btn"
            disabled={busy}
            onClick={() => void run(() => api.checkVies(client.id))}
          >
            Comprobar VIES de {client.nombre}
          </button>
        )}
        <button type="button" className="rd-link" onClick={onEdit}>
          Editar {client.nombre}
        </button>
        <button
          type="button"
          className="rd-link"
          disabled={busy}
          onClick={() => void run(() => api.archiveClient(client.id, !client.activo))}
        >
          {client.activo ? 'Archivar' : 'Reactivar'} {client.nombre}
        </button>
      </div>
    </li>
  )
}

export function ClientsPage() {
  const [archived, setArchived] = useState(false)
  // 'new' = formulario de alta; un id = edición de ese cliente; null = solo la lista.
  const [editing, setEditing] = useState<string | null>(null)
  const load = useCallback(() => api.clients(archived), [archived])
  const { data, error, loading, reload } = useLoad(load)

  if (loading) return <p role="status">Cargando clientes…</p>
  if (error)
    return (
      <p role="alert" className="rd-error">
        {error}
      </p>
    )
  const clients = data ?? []
  const current = clients.find((c) => c.id === editing) ?? null
  const saved = () => {
    setEditing(null)
    reload()
  }

  return (
    <>
      <h1 className="rd-title">Clientes</h1>
      <p className="rd-muted">
        De cada cliente sale cómo se le factura: con o sin IVA, con qué mención legal y a qué casilla del 303
        va. También podés pedirle a NEO que los cargue desde tus facturas.
      </p>
      <div className="rd-doc-actions rd-toolbar">
        <button type="button" className="rd-btn rd-btn--primary" onClick={() => setEditing('new')}>
          Nuevo cliente
        </button>
        <label className="rd-check">
          <input type="checkbox" checked={archived} onChange={(e) => setArchived(e.target.checked)} />
          Mostrar archivados
        </label>
      </div>
      {editing !== null && (
        <ClientForm key={editing} client={current} onSaved={saved} onCancel={() => setEditing(null)} />
      )}
      {clients.length === 0 ? (
        <div className="rd-card">
          <p>Todavía no hay clientes. Creá el primero o pedile a NEO que los saque de tus facturas.</p>
        </div>
      ) : (
        <ul className="rd-list">
          {clients.map((c) => (
            <Row key={c.id} client={c} onEdit={() => setEditing(c.id)} onChanged={reload} />
          ))}
        </ul>
      )}
    </>
  )
}
