import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'

export interface Tab {
  to: string
  label: string
  end?: boolean
}

/**
 * Barra de navegación: pestañas a la izquierda y, opcionalmente, algo fijo a la derecha (la cuenta).
 * Solo las pestañas se desplazan en pantallas angostas; lo de la derecha queda siempre visible y su
 * menú desplegable no se recorta.
 */
export function NavTabs({ tabs, trailing }: { tabs: Tab[]; trailing?: ReactNode }) {
  return (
    <div className="vf-navbar">
      <nav className="vf-tabs" aria-label="Secciones">
        {tabs.map((t) => (
          <NavLink key={t.to} to={t.to} end={t.end} className="vf-tab">
            {t.label}
          </NavLink>
        ))}
      </nav>
      {trailing && <div className="vf-navbar__trailing">{trailing}</div>}
    </div>
  )
}
