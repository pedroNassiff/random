import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { api, errorText } from '../api'
import { useAuth } from '../auth'
import { rememberedEmail, rememberEmail } from '../remember'
import { BASE } from '../routes'

export function LoginPage() {
  const navigate = useNavigate()
  const { me, setMe } = useAuth()
  const [email, setEmail] = useState(rememberedEmail)
  const [remember, setRemember] = useState(true)
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (me) return <Navigate to={BASE} replace />

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      setMe(await api.login(email, password))
      rememberEmail(remember ? email.trim() : null)
      navigate(BASE, { replace: true })
    } catch (err) {
      setError(errorText(err))
      setBusy(false)
    }
  }

  return (
    <main className="rd-center">
      <form className="rd-card rd-login" onSubmit={submit}>
        <h1 className="rd-title">Entrar al dashboard</h1>
        <p className="rd-muted">Es el mismo usuario y contraseña de Fútbol Vaquero.</p>
        <label className="rd-label" htmlFor="rd-email">
          Email
        </label>
        <input
          id="rd-email"
          className="rd-input"
          name="username"
          type="email"
          required
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <label className="rd-label" htmlFor="rd-password">
          Contraseña
        </label>
        <input
          id="rd-password"
          className="rd-input"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <label className="rd-check">
          <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
          Recordar mi email en este equipo
        </label>
        {error && (
          <p role="alert" className="rd-error">
            {error}
          </p>
        )}
        <button type="submit" className="rd-btn rd-btn--primary" disabled={busy || !email || !password}>
          Entrar
        </button>
      </form>
    </main>
  )
}
