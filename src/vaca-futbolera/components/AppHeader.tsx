import { Link } from 'react-router-dom'
import { BASE, LAVACA_LOGO } from '../routes'
import { AccountMenu } from './AccountMenu'

/** Marca al centro (.RANDOM(🐄), como el Navbar de Random) y la cuenta en un círculo con menú a la derecha. */
export function AppHeader({ email, onLogout }: { email: string; onLogout: () => void }) {
  return (
    <header className="vf-header">
      {/* <span className="vf-header__title">Fútbol Vaquero</span> */}
      <Link to={BASE} className="vf-header__brand" aria-label="Fútbol Vaquero, inicio">
        <span aria-hidden="true">.RANDOM(</span>
        <img src={LAVACA_LOGO} alt="" width={40} height={31} />
        <span aria-hidden="true">)</span>
      </Link>
      <div className="vf-header__actions">
        <AccountMenu email={email} onLogout={onLogout} />
      </div>
    </header>
  )
}
