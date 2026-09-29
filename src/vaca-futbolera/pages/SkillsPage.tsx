import { useState, type FormEvent } from 'react'
import { api, errorText } from '../api'
import { Button } from '../components/Button'
import { SectionHeader } from '../components/SectionHeader'
import type { Skill } from '../types'
import { useLoad } from '../useLoad'

function SkillRow({ skill, onSaved }: { skill: Skill; onSaved: () => void }) {
  const [weight, setWeight] = useState(String(skill.weight))
  const [active, setActive] = useState(skill.is_active)
  const [error, setError] = useState<string | null>(null)

  const save = async () => {
    setError(null)
    try {
      await api.updateSkill(skill.id, {
        key: skill.key,
        name: skill.name,
        description: skill.description,
        sort_order: skill.sort_order,
        weight: Number(weight),
        is_active: active,
      })
      onSaved()
    } catch (e) {
      setError(errorText(e))
    }
  }

  return (
    <div className="vf-card">
      <div className="vf-row">
        <strong>{skill.name}</strong>
        <span className="vf-muted">{skill.key}</span>
      </div>
      <label className="vf-label" htmlFor={`w-${skill.id}`}>
        Peso (0–3)
      </label>
      <input
        id={`w-${skill.id}`}
        className="vf-input"
        type="number"
        min={0}
        max={3}
        step={0.25}
        value={weight}
        onChange={(e) => setWeight(e.target.value)}
      />
      <label className="vf-row vf-label">
        <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> Activa
      </label>
      {error && <p className="vf-error">{error}</p>}
      <Button onClick={save}>Guardar</Button>
    </div>
  )
}

function NewSkillForm({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState('')
  const [key, setKey] = useState('')
  const [description, setDescription] = useState('')
  const [weight, setWeight] = useState('1')
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    try {
      await api.createSkill({
        key,
        name,
        description,
        weight: Number(weight),
        is_active: true,
        sort_order: 100,
      })
      setName('')
      setKey('')
      setDescription('')
      onCreated()
    } catch (err) {
      setError(errorText(err))
    }
  }

  return (
    <form onSubmit={submit} className="vf-card">
      <h3 className="vf-title">Nueva skill</h3>
      <label className="vf-label" htmlFor="s-name">
        Nombre
      </label>
      <input
        id="s-name"
        className="vf-input"
        required
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <label className="vf-label" htmlFor="s-key">
        Clave (minúsculas, ej. juego_aereo)
      </label>
      <input id="s-key" className="vf-input" required value={key} onChange={(e) => setKey(e.target.value)} />
      <label className="vf-label" htmlFor="s-desc">
        Descripción
      </label>
      <input
        id="s-desc"
        className="vf-input"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />
      <label className="vf-label" htmlFor="s-weight">
        Peso (0–3)
      </label>
      <input
        id="s-weight"
        className="vf-input"
        type="number"
        min={0}
        max={3}
        step={0.25}
        value={weight}
        onChange={(e) => setWeight(e.target.value)}
      />
      {error && <p className="vf-error">{error}</p>}
      <p>
        <Button type="submit">Crear skill</Button>
      </p>
    </form>
  )
}

export function SkillsPage() {
  const { data, error, loading, reload } = useLoad(api.skills)
  return (
    <div className="vf-container">
      <h1 className="vf-title">Skills</h1>
      <NewSkillForm onCreated={reload} />
      <SectionHeader>Skills del grupo</SectionHeader>
      {loading && <p role="status">Cargando…</p>}
      {error && <p className="vf-error">{error}</p>}
      <div className="vf-grid">
        {data?.map((s) => (
          <SkillRow key={s.id} skill={s} onSaved={reload} />
        ))}
      </div>
    </div>
  )
}
