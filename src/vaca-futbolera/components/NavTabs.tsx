import { NavLink } from 'react-router-dom'

export interface Tab {
  to: string
  label: string
  end?: boolean
}

export function NavTabs({ tabs }: { tabs: Tab[] }) {
  return (
    <nav className="vf-tabs" aria-label="Secciones">
      {tabs.map((t) => (
        <NavLink key={t.to} to={t.to} end={t.end} className="vf-tab">
          {t.label}
        </NavLink>
      ))}
    </nav>
  )
}
