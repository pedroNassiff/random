import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api, errorText } from '../api'
import { useAuth } from '../auth'
import { Button } from '../components/Button'
import { BASE } from '../routes'

const MIN_LENGTH = 8

export function PasswordPage() {
  const { me, setMe } = useAuth()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [repeat, setRepeat] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const isNew = !me?.has_password

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (password.length < MIN_LENGTH) return setError(`Usá al menos ${MIN_LENGTH} caracteres.`)
    if (password !== repeat) return setError('Las contraseñas no coinciden.')
    setBusy(true)
    try {
      setMe(await api.setPassword(password))
      navigate(BASE, { replace: true })
    } catch (err) {
      setError(errorText(err))
      setBusy(false)
    }
  }

  return (
    <div className="vf-container">
      <h1 className="vf-title">{isNew ? 'Creá tu contraseña' : 'Cambiar contraseña'}</h1>
      {isNew && (
        <p>Es la última vez que usás el link: de ahora en más entrás con tu email y esta contraseña.</p>
      )}
      <form onSubmit={submit} className="vf-card">
        <label className="vf-label" htmlFor="new-password">
          Contraseña nueva (mínimo {MIN_LENGTH} caracteres)
        </label>
        <input
          id="new-password"
          className="vf-input"
          type="password"
          required
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <label className="vf-label" htmlFor="repeat-password">
          Repetila
        </label>
        <input
          id="repeat-password"
          className="vf-input"
          type="password"
          required
          autoComplete="new-password"
          value={repeat}
          onChange={(e) => setRepeat(e.target.value)}
        />
        {error && <p className="vf-error">{error}</p>}
        <div className="vf-row">
          <Button type="submit" disabled={busy}>
            Guardar contraseña
          </Button>
          {!isNew && <Link to={BASE}>Seguir sin cambiarla</Link>}
        </div>
      </form>
    </div>
  )
}
