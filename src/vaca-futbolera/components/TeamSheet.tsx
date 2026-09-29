import { forwardRef } from 'react'
import { POSITION_LABELS, type Position } from '../types'
import { CowAvatar } from './CowAvatar'

export interface SheetPlayer {
  name: string
  position: Position | null
}

export interface SheetTeam {
  name: string
  tone: 'light' | 'dark'
  players: SheetPlayer[]
}

interface Props {
  heading: string
  teams: [SheetTeam, SheetTeam]
  avatarSrc?: string
}

function Row({
  player,
  tone,
  mirrored,
  avatarSrc,
}: {
  player: SheetPlayer
  tone: SheetTeam['tone']
  mirrored: boolean
  avatarSrc?: string
}) {
  return (
    <li className={`vf-sheet__row ${mirrored ? 'vf-sheet__row--mirror' : ''}`}>
      <CowAvatar size={52} src={avatarSrc} />
      <span className={`vf-sheet__pill vf-sheet__pill--${tone}`}>
        <strong>{player.name}</strong>
        <span>{player.position ? POSITION_LABELS[player.position] : '—'}</span>
      </span>
    </li>
  )
}

/**
 * Tarjeta de formación para compartir (spec §7): equipo A · VS · equipo B.
 * Sin % de victoria: la ve todo el grupo y no queremos sesgar quién "va a ganar".
 */
export const TeamSheet = forwardRef<HTMLDivElement, Props>(function TeamSheet(
  { heading, teams, avatarSrc },
  ref,
) {
  const [a, b] = teams
  return (
    <div ref={ref} className="vf-sheet" role="group" aria-label={`${a.name} contra ${b.name}`}>
      <p className="vf-sheet__heading vf-pixel">{heading}</p>
      <div className="vf-sheet__grid">
        {[a, b].map((team, i) => (
          <section key={team.name} className={`vf-sheet__team vf-sheet__team--${i === 0 ? 'left' : 'right'}`}>
            <h3 className={`vf-sheet__name vf-sheet__pill--${team.tone}`}>{team.name}</h3>
            <ol className="vf-sheet__list">
              {team.players.map((p) => (
                <Row key={p.name} player={p} tone={team.tone} mirrored={i === 1} avatarSrc={avatarSrc} />
              ))}
            </ol>
          </section>
        ))}
        <div className="vf-sheet__vs vf-pixel" aria-hidden="true">
          VS
        </div>
      </div>
    </div>
  )
})
