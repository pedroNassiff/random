import { useState, type FormEvent } from 'react'
import { api, errorText } from '../api'
import { Button } from '../components/Button'
import { POSITION_LABELS, type Player, type Position } from '../types'

const POSITIONS = Object.keys(POSITION_LABELS) as Position[]

/** Admin: editar datos del jugador (nombre, apodo, email, puesto, arquero, activo). */
export function PlayerEditForm({ player, onSaved }: { player: Player; onSaved: () => void }) {
  const [form, setForm] = useState({
    display_name: player.display_name,
    nickname: player.nickname ?? '',
    email: player.email ?? '',
    preferred_position: player.preferred_position ?? '',
    can_play_gk: player.can_play_gk,
    active: player.active,
  })
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const id = (field: string) => `edit-${field}-${player.id}`
  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
    setSaved(false)
    setForm((f) => ({ ...f, [key]: value }))
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    try {
      await api.updatePlayer(player.id, {
        display_name: form.display_name,
        nickname: form.nickname || null,
        email: form.email || null,
        preferred_position: (form.preferred_position || null) as Position | null,
        can_play_gk: form.can_play_gk,
        is_guest: player.is_guest,
        guest_level: player.guest_level,
        active: form.active,
      })
      setSaved(true)
      onSaved()
    } catch (err) {
      setError(errorText(err))
    }
  }

  return (
    <form onSubmit={submit} className="vf-card vf-edit" aria-label={`Editar ${player.display_name}`}>
      <label className="vf-label" htmlFor={id('name')}>
        Nombre
      </label>
      <input
        id={id('name')}
        className="vf-input"
        required
        value={form.display_name}
        onChange={(e) => set('display_name', e.target.value)}
      />
      <label className="vf-label" htmlFor={id('nick')}>
        Apodo
      </label>
      <input
        id={id('nick')}
        className="vf-input"
        value={form.nickname}
        onChange={(e) => set('nickname', e.target.value)}
      />
      <label className="vf-label" htmlFor={id('email')}>
        Email
      </label>
      <input
        id={id('email')}
        className="vf-input"
        type="email"
        value={form.email}
        onChange={(e) => set('email', e.target.value)}
      />
      <label className="vf-label" htmlFor={id('pos')}>
        Puesto
      </label>
      <select
        id={id('pos')}
        className="vf-input"
        value={form.preferred_position}
        onChange={(e) => set('preferred_position', e.target.value as Position | '')}
      >
        <option value="">Sin definir</option>
        {POSITIONS.map((p) => (
          <option key={p} value={p}>
            {POSITION_LABELS[p]} ({p})
          </option>
        ))}
      </select>
      <label className="vf-row vf-label">
        <input
          type="checkbox"
          checked={form.can_play_gk}
          onChange={(e) => set('can_play_gk', e.target.checked)}
        />{' '}
        Puede atajar
      </label>
      <label className="vf-row vf-label">
        <input type="checkbox" checked={form.active} onChange={(e) => set('active', e.target.checked)} />{' '}
        Activo
      </label>
      {error && <p className="vf-error">{error}</p>}
      <div className="vf-row">
        <Button type="submit">Guardar cambios</Button>
        {saved && <span role="status">Jugador actualizado</span>}
      </div>
    </form>
  )
}
