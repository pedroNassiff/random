import { useCallback, useState } from 'react'
import { Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './auth'
import { useLoad } from '../vaca-futbolera/useLoad'
import { api } from './api'
import { AgentChat } from './components/AgentChat'
import { NextStep } from './components/NextStep'
import { OnboardingTour } from './components/OnboardingTour'
import { Sidebar } from './components/Sidebar'
import { CalendarPage } from './pages/CalendarPage'
import { ClientsPage } from './pages/ClientsPage'
import { DeadlinesPage } from './pages/DeadlinesPage'
import { DocumentsPage } from './pages/DocumentsPage'
import { InvoicesPage } from './pages/InvoicesPage'
import { ImpuestosLayout } from './pages/ImpuestosLayout'
import { LoginPage } from './pages/LoginPage'
import { MovementsPage } from './pages/MovementsPage'
import { ProfilePage } from './pages/ProfilePage'
import { markTourSeen, tourSeen } from './remember'
import { APP, BASE, IMPUESTOS, LOGIN } from './routes'
import { tourSteps } from './tour'
import './dashboard.css'

/** Parte privada del dashboard: guía de primer ingreso, aviso de siguiente paso, páginas y NEO. */
function Workspace({ email, onLogout }: { email: string; onLogout: () => void }) {
  // Cuando se guarda algo desde NEO, la página abierta se vuelve a montar y recarga sus datos.
  const [version, setVersion] = useState(0)
  const [neoOpen, setNeoOpen] = useState(false)
  // null = decide el estado (primera vez sin perfil); true/false = la persona la abrió o la cerró.
  const [tourOpen, setTourOpen] = useState<boolean | null>(null)
  const loadOnboarding = useCallback(() => api.onboarding(), [])
  const { data: onboarding, reload } = useLoad(loadOnboarding)

  const firstTime = onboarding?.siguiente === 'perfil' && !tourSeen()
  const showTour = onboarding !== null && (tourOpen ?? firstTime)
  const closeTour = (openNeo: boolean) => {
    markTourSeen()
    setTourOpen(false)
    if (openNeo) setNeoOpen(true)
  }
  const onChanged = () => {
    setVersion((v) => v + 1)
    reload()
  }

  return (
    <div className="rd-shell">
      <Sidebar email={email} onLogout={onLogout} />
      <main className="rd-main">
        {onboarding && (
          <NextStep
            onboarding={onboarding}
            onAskNeo={() => setNeoOpen(true)}
            onShowGuide={() => setTourOpen(true)}
          />
        )}
        <Outlet key={version} />
      </main>
      <AgentChat open={neoOpen} onOpenChange={setNeoOpen} onChanged={onChanged} />
      {showTour && onboarding && (
        <OnboardingTour
          steps={tourSteps(onboarding)}
          onFinish={() => closeTour(true)}
          onSkip={() => closeTour(false)}
        />
      )}
    </div>
  )
}

function Shell() {
  const { me, loading, logout } = useAuth()
  if (loading)
    return (
      <p role="status" className="rd-center">
        Cargando…
      </p>
    )
  if (!me) return <Navigate to={LOGIN} replace />
  // Sesión válida (p. ej. de Fútbol Vaquero) pero sin permiso para el dashboard.
  if (!me.apps.includes(APP))
    return (
      <main className="rd-center">
        <div className="rd-card">
          <h1 className="rd-title">Sin acceso</h1>
          <p>{me.email} no tiene acceso al dashboard.</p>
          <button type="button" className="rd-btn" onClick={() => void logout()}>
            Salir
          </button>
        </div>
      </main>
    )
  return <Workspace email={me.email} onLogout={() => void logout()} />
}

export default function Dashboard() {
  return (
    <div className="rdash">
      <AuthProvider>
        <Routes>
          <Route path="entrar" element={<LoginPage />} />
          <Route element={<Shell />}>
            <Route index element={<Navigate to={IMPUESTOS} replace />} />
            <Route path="impuestos" element={<ImpuestosLayout />}>
              <Route index element={<CalendarPage />} />
              <Route path="facturas" element={<InvoicesPage />} />
              <Route path="plazos" element={<DeadlinesPage />} />
              <Route path="perfil" element={<ProfilePage />} />
              <Route path="documentos" element={<DocumentsPage />} />
            </Route>
            <Route path="clientes" element={<ClientsPage />} />
            <Route path="ingresos-y-gastos" element={<MovementsPage />} />
            <Route path="*" element={<Navigate to={BASE} replace />} />
          </Route>
        </Routes>
      </AuthProvider>
    </div>
  )
}
