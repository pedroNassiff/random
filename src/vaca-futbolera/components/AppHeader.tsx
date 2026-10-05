import { Link } from 'react-router-dom'
import { BASE, LAVACA_LOGO } from '../routes'

/** Marca .RANDOM(🐄), como el Navbar de Random. La cuenta vive en la barra de pestañas. */
export function AppHeader() {
  return (
    <header className="vf-header">
      {/* <span className="vf-header__title">Fútbol Vaquero</span> */}
      <Link to={BASE} className="vf-header__brand" aria-label="Fútbol Vaquero, inicio">
        <span aria-hidden="true">.RANDOM(</span>
        <img src={LAVACA_LOGO} alt="" width={40} height={31} />
        <span aria-hidden="true">)</span>
      </Link>
    </header>
  )
}
