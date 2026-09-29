import { Link } from 'react-router-dom'
import { BASE, LAVACA_LOGO, PASSWORD } from '../routes'
import { Button } from './Button'

/** Marca al centro (.RANDOM(🐄), como el Navbar de Random) y acciones de cuenta a la derecha. */
export function AppHeader({ onLogout }: { onLogout: () => void }) {
  return (
    <header className="vf-header">
      {/* <span className="vf-header__title">Fútbol Vaquero</span> */}
      <Link to={BASE} className="vf-header__brand" aria-label="Fútbol Vaquero, inicio">
        <span aria-hidden="true">.RANDOM(</span>
        <img src={LAVACA_LOGO} alt="" width={40} height={31} />
        <span aria-hidden="true">)</span>
      </Link>
      <div className="vf-header__actions">
        <Link to={PASSWORD} className="vf-link">
          Contraseña
        </Link>
        <Button variant="secondary" onClick={onLogout}>
          Salir
        </Button>
      </div>
    </header>
  )
}
