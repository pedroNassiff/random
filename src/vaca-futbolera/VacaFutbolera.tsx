import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './auth'
import { AppHeader } from './components/AppHeader'
import { NavTabs, type Tab } from './components/NavTabs'
import { DevUiPage } from './pages/DevUiPage'
import { HistoryPage } from './pages/HistoryPage'
import { HomePage } from './pages/HomePage'
import { LoginPage } from './pages/LoginPage'
import { PasswordPage } from './pages/PasswordPage'
import { PlayersPage } from './pages/PlayersPage'
import { RatePlayerPage } from './pages/RatePlayerPage'
import { ResultPage } from './pages/ResultPage'
import { SkillsPage } from './pages/SkillsPage'
import { TeamsPage } from './pages/TeamsPage'
import { BASE, LOGIN, PASSWORD } from './routes'
import './vaca.css'

function Shell() {
  const { me, loading, logout } = useAuth()
  const { pathname } = useLocation()
  if (loading)
    return (
      <p role="status" className="vf-container">
        Cargando…
      </p>
    )
  if (!me) return <Navigate to={LOGIN} replace />
  // Primer acceso por magic link: hay que crear la contraseña antes de usar la app.
  if (!me.has_password && pathname !== PASSWORD) return <Navigate to={PASSWORD} replace />

  const tabs: Tab[] = [
    { to: BASE, label: 'Partido', end: true },
    { to: `${BASE}/partidos`, label: 'Partidos', end: true },
    { to: `${BASE}/jugadores`, label: 'Jugadores' },
    ...(me.role === 'admin' ? [{ to: `${BASE}/skills`, label: 'Skills' }] : []),
  ]
  return (
    <>
      <AppHeader email={me.email} onLogout={() => void logout()} />
      <NavTabs tabs={tabs} />
      <Outlet />
    </>
  )
}

function AdminOnly() {
  const { me } = useAuth()
  return me?.role === 'admin' ? <Outlet /> : <Navigate to={BASE} replace />
}

export default function VacaFutbolera() {
  return (
    <div className="vaca">
      <AuthProvider>
        <Routes>
          <Route path="entrar" element={<LoginPage />} />
          <Route path="dev/ui" element={<DevUiPage />} />
          <Route element={<Shell />}>
            <Route index element={<HomePage />} />
            <Route path="contrasena" element={<PasswordPage />} />
            <Route path="partidos" element={<HistoryPage />} />
            <Route path="jugadores" element={<PlayersPage />} />
            <Route path="jugadores/:id/puntuar" element={<RatePlayerPage />} />
            <Route element={<AdminOnly />}>
              <Route path="skills" element={<SkillsPage />} />
              <Route path="partidos/:id/equipos" element={<TeamsPage />} />
              <Route path="partidos/:id/resultado" element={<ResultPage />} />
            </Route>
            <Route path="*" element={<Navigate to={BASE} replace />} />
          </Route>
        </Routes>
      </AuthProvider>
    </div>
  )
}
