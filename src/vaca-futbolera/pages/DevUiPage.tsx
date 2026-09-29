import { Button } from '../components/Button'
import { NavTabs } from '../components/NavTabs'
import { PlayerChip } from '../components/PlayerChip'
import { SectionHeader } from '../components/SectionHeader'
import { ShareSheet } from '../components/ShareSheet'
import { SkillPicker } from '../components/SkillPicker'
import type { SheetTeam } from '../components/TeamSheet'
import { Toast } from '../components/Toast'
import { BASE } from '../routes'
import { useState } from 'react'

const DEMO_TEAMS: [SheetTeam, SheetTeam] = [
  {
    name: 'Blancos',
    tone: 'light',
    players: [
      { name: 'Marc', position: 'POR' },
      { name: 'Juan', position: 'DEF' },
      { name: 'Pedro', position: 'DEF' },
      { name: 'Martín', position: 'MED' },
      { name: 'Lucho', position: 'DEL' },
      { name: 'Nico', position: 'MED' },
    ],
  },
  {
    name: 'Negros',
    tone: 'dark',
    players: [
      { name: 'Fede', position: 'POR' },
      { name: 'Pau', position: 'DEF' },
      { name: 'Leo', position: 'MED' },
      { name: 'Gonza', position: 'MED' },
      { name: 'Jordi', position: 'DEL' },
      { name: 'Álex', position: 'DEF' },
    ],
  },
]

/** Catálogo de los componentes base de DESIGN §5 (checklist M0). */
export function DevUiPage() {
  const [skill, setSkill] = useState<number | null>(7)
  return (
    <div className="vf-container">
      <h1 className="vf-title">Componentes base</h1>

      <SectionHeader>Button</SectionHeader>
      <div className="vf-card vf-row">
        <Button>Voy</Button>
        <Button variant="secondary">Me bajo</Button>
        <Button disabled>Deshabilitado</Button>
      </div>

      <SectionHeader>NavTabs</SectionHeader>
      <div className="vf-card">
        <NavTabs
          tabs={[
            { to: BASE, label: 'Partido', end: true },
            { to: `${BASE}/jugadores`, label: 'Jugadores' },
          ]}
        />
      </div>

      <SectionHeader>PlayerChip</SectionHeader>
      <div className="vf-card vf-grid">
        <PlayerChip name="Juan" position="DEF" />
        <PlayerChip name="Pedro" position="MED" team="A" rating={27.1} />
        <PlayerChip name="Fede" position="DEL" team="B" rating={26.4} />
      </div>

      <SectionHeader>SkillPicker</SectionHeader>
      <div className="vf-card">
        <SkillPicker
          label="Pase y visión"
          description="Precisión de pase y lectura del juego."
          value={skill}
          onChange={setSkill}
        />
      </div>

      <SectionHeader>TeamSheet (compartir equipos)</SectionHeader>
      <div className="vf-card">
        <ShareSheet
          heading="MIÉ 30 SEP · 19:00H"
          teams={DEMO_TEAMS}
          text={
            '⚽ Fútbol miércoles 30/09 — 19:00\n⬜ BLANCOS\nMarc, Juan, Pedro, Martín, Lucho, Nico\n⬛ NEGROS\nFede, Pau, Leo, Gonza, Jordi, Álex'
          }
        />
      </div>

      <SectionHeader>Toast</SectionHeader>
      <div className="vf-card">
        <Toast message="Puntajes guardados" onDone={() => undefined} ms={1e9} />
        <p className="vf-muted">El toast aparece abajo en el centro.</p>
      </div>
    </div>
  )
}
