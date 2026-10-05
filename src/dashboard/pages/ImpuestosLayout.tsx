import { NavLink, Outlet } from 'react-router-dom'
import { DOCUMENTOS, FACTURAS, IMPUESTOS, PERFIL, PLAZOS } from '../routes'

// `tour` = nombre con que la guía de inicio señala cada pestaña.
const TABS = [
  { to: IMPUESTOS, label: 'Calendario', tour: 'calendario', end: true },
  { to: FACTURAS, label: 'Facturas', tour: 'facturas' },
  { to: PLAZOS, label: 'Plazos', tour: 'plazos' },
  { to: PERFIL, label: 'Perfil fiscal', tour: 'perfil' },
  { to: DOCUMENTOS, label: 'Documentos', tour: 'documentos' },
]

export function ImpuestosLayout() {
  return (
    <>
      <h1 className="rd-title">Putos Impuestos</h1>
      <nav className="rd-tabs" aria-label="Secciones de impuestos">
        {TABS.map((t) => (
          <NavLink key={t.to} to={t.to} end={t.end} className="rd-tab" data-tour={t.tour}>
            {t.label}
          </NavLink>
        ))}
      </nav>
      <Outlet />
    </>
  )
}
