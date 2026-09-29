import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api, errorText } from '../api'
import { useAuth } from '../auth'
import { Button } from '../components/Button'
import { BASE, PASSWORD } from '../routes'

function PasswordForm({ onForgot }: { onForgot: () => void }) {
  const navigate = useNavigate()
  const { setMe } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      setMe(await api.login(email, password))
      navigate(BASE, { replace: true })
    } catch (err) {
      setError(errorText(err))
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit}>
      <label className="vf-label" htmlFor="email">
        Tu email
      </label>
      <input
        id="email"
        className="vf-input"
        type="email"
        required
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <label className="vf-label" htmlFor="password">
        Contraseña
      </label>
      <input
        id="password"
        className="vf-input"
        type="password"
        required
        autoComplete="current-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      {error && <p className="vf-error">{error}</p>}
      <p>
        <Button type="submit" disabled={busy || !email || !password}>
          Entrar
        </Button>
      </p>
      <p>
        <button type="button" className="vf-link" onClick={onForgot}>
          ¿Primera vez o te olvidaste la contraseña?
        </button>
      </p>
    </form>
  )
}

function LinkForm({ onBack }: { onBack: () => void }) {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await api.requestLink(email)
      setSent(true)
    } catch (err) {
      setError(errorText(err))
    } finally {
      setBusy(false)
    }
  }

  if (sent) {
    return (
      <p>
        Si tu email está en el grupo, te llegó un link. Abrilo para crear tu contraseña: vale 15 minutos y se
        usa una sola vez.
      </p>
    )
  }
  return (
    <form onSubmit={submit}>
      <p>Te mandamos un link por email para crear (o cambiar) tu contraseña.</p>
      <label className="vf-label" htmlFor="link-email">
        Tu email
      </label>
      <input
        id="link-email"
        className="vf-input"
        type="email"
        required
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      {error && <p className="vf-error">{error}</p>}
      <p>
        <Button type="submit" disabled={busy || !email}>
          Enviar link
        </Button>
      </p>
      <p>
        <button type="button" className="vf-link" onClick={onBack}>
          Ya tengo contraseña
        </button>
      </p>
    </form>
  )
}

function Forms({ startWithLink = false }: { startWithLink?: boolean }) {
  const [mode, setMode] = useState<'password' | 'link'>(startWithLink ? 'link' : 'password')
  return mode === 'password' ? (
    <PasswordForm onForgot={() => setMode('link')} />
  ) : (
    <LinkForm onBack={() => setMode('password')} />
  )
}

export function LoginPage() {
  const [params] = useSearchParams()
  const token = params.get('token')
  const navigate = useNavigate()
  const { setMe } = useAuth()
  const [error, setError] = useState<string | null>(null)
  // StrictMode ejecuta los efectos dos veces y el link es de un solo uso: canjearlo una sola vez.
  const started = useRef(false)

  useEffect(() => {
    if (!token || started.current) return
    started.current = true
    api
      .verifyLink(token)
      .then((me) => {
        setMe(me)
        // El link sirve para crear o cambiar la contraseña.
        navigate(PASSWORD, { replace: true })
      })
      .catch((e: unknown) => setError(errorText(e)))
  }, [token, setMe, navigate])

  return (
    <div className="vf-container">
      <h1 className="vf-title">Entrar a Fútbol Vaquero</h1>
      {token && !error && <p role="status">Entrando…</p>}
      {token && error && <p className="vf-error">{error}</p>}
      {(!token || error) && <Forms startWithLink={Boolean(error)} />}
    </div>
  )
}
