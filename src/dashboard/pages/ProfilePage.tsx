import { useState, type FormEvent } from 'react'
import { useLoad } from '../../vaca-futbolera/useLoad'
import { api, errorText } from '../api'
import type { Profile, ProfileInput, RegimenIrpf, RegimenIva } from '../types'

const EMPTY: ProfileInput = {
  nif: '',
  fecha_alta: '',
  iae: '',
  regimen_iva: 'general',
  regimen_irpf: 'directa_simplificada',
  roi: false,
  tarifa_plana_hasta: null,
  domicilio_fiscal: '',
  municipio: '',
  comunidad: '',
}

const IVA: { value: RegimenIva; label: string }[] = [
  { value: 'general', label: 'Régimen general' },
  { value: 'recargo_equivalencia', label: 'Recargo de equivalencia' },
  { value: 'exento', label: 'Exento' },
]
const IRPF: { value: RegimenIrpf; label: string }[] = [
  { value: 'directa_simplificada', label: 'Estimación directa simplificada' },
  { value: 'directa_normal', label: 'Estimación directa normal' },
  { value: 'objetiva', label: 'Estimación objetiva (módulos)' },
]

type TextField = 'nif' | 'iae' | 'domicilio_fiscal' | 'municipio' | 'comunidad'

function Text({
  field,
  label,
  form,
  onChange,
}: {
  field: TextField
  label: string
  form: ProfileInput
  onChange: (patch: Partial<ProfileInput>) => void
}) {
  return (
    <>
      <label className="rd-label" htmlFor={`rd-${field}`}>
        {label}
      </label>
      <input
        id={`rd-${field}`}
        className="rd-input"
        required
        value={form[field]}
        onChange={(e) => onChange({ [field]: e.target.value })}
      />
    </>
  )
}

function ProfileForm({ initial }: { initial: Profile | null }) {
  const [form, setForm] = useState<ProfileInput>(initial ?? EMPTY)
  const [version, setVersion] = useState(initial?.version ?? 0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const change = (patch: Partial<ProfileInput>) => {
    setSaved(false)
    setForm((f) => ({ ...f, ...patch }))
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const profile = await api.saveProfile(form)
      setVersion(profile.version)
      setSaved(true)
    } catch (err) {
      setError(errorText(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="rd-card rd-form" onSubmit={submit}>
      <p className="rd-muted">
        {version > 0
          ? `Versión ${version}. Cada cambio guarda una versión nueva; las anteriores no se pisan.`
          : 'Estos son los datos de tu 036/037. De acá salen tus obligaciones y sus fechas.'}
      </p>
      <Text field="nif" label="NIF" form={form} onChange={change} />
      <label className="rd-label" htmlFor="rd-fecha-alta">
        Fecha de alta
      </label>
      <input
        id="rd-fecha-alta"
        className="rd-input"
        type="date"
        required
        value={form.fecha_alta}
        onChange={(e) => change({ fecha_alta: e.target.value })}
      />
      <Text field="iae" label="Epígrafe IAE" form={form} onChange={change} />
      <label className="rd-label" htmlFor="rd-iva">
        Régimen de IVA
      </label>
      <select
        id="rd-iva"
        className="rd-input"
        value={form.regimen_iva}
        onChange={(e) => change({ regimen_iva: e.target.value as RegimenIva })}
      >
        {IVA.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <label className="rd-label" htmlFor="rd-irpf">
        Régimen de IRPF
      </label>
      <select
        id="rd-irpf"
        className="rd-input"
        value={form.regimen_irpf}
        onChange={(e) => change({ regimen_irpf: e.target.value as RegimenIrpf })}
      >
        {IRPF.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <label className="rd-check">
        <input type="checkbox" checked={form.roi} onChange={(e) => change({ roi: e.target.checked })} />
        Alta en el ROI (operaciones con clientes de la UE)
      </label>
      <label className="rd-label" htmlFor="rd-tarifa">
        Tarifa plana hasta (opcional)
      </label>
      <input
        id="rd-tarifa"
        className="rd-input"
        type="date"
        value={form.tarifa_plana_hasta ?? ''}
        onChange={(e) => change({ tarifa_plana_hasta: e.target.value || null })}
      />
      <Text field="domicilio_fiscal" label="Domicilio fiscal" form={form} onChange={change} />
      <Text field="municipio" label="Municipio" form={form} onChange={change} />
      <Text field="comunidad" label="Comunidad autónoma" form={form} onChange={change} />
      {error && (
        <p role="alert" className="rd-error">
          {error}
        </p>
      )}
      {saved && <p role="status">Perfil guardado (versión {version}).</p>}
      <button type="submit" className="rd-btn rd-btn--primary" disabled={busy}>
        Guardar perfil
      </button>
    </form>
  )
}

export function ProfilePage() {
  const { data, error, loading } = useLoad(api.profile)
  if (loading) return <p role="status">Cargando perfil…</p>
  if (error)
    return (
      <p role="alert" className="rd-error">
        {error}
      </p>
    )
  return <ProfileForm initial={data} />
}
