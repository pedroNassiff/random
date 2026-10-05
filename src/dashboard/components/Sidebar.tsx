import { NavLink } from 'react-router-dom'
import { CLIENTES, IMPUESTOS, MOVIMIENTOS } from '../routes'

interface Section {
  to: string
  label: string
}

/** Las pestañas del CRM. Sumar una sección nueva es agregar una fila acá y su ruta en Dashboard.tsx. */
const SECTIONS: Section[] = [
  { to: IMPUESTOS, label: 'Putos Impuestos' },
  { to: MOVIMIENTOS, label: 'Ingresos y gastos' },
  { to: CLIENTES, label: 'Clientes' },
]

export function Sidebar({ email, onLogout }: { email: string; onLogout: () => void }) {
  return (
    <aside className="rd-sidebar">
      <p className="rd-brand">Random</p>
      <nav aria-label="Secciones del dashboard" className="rd-nav">
        {SECTIONS.map((s) => (
          <NavLink key={s.to} to={s.to} className="rd-nav-link">
            {s.label}
          </NavLink>
        ))}
      </nav>
      <div className="rd-account">
        <span className="rd-muted">{email}</span>
        <button type="button" className="rd-link" onClick={onLogout}>
          Salir
        </button>
      </div>
    </aside>
  )
}
