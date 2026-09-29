/** Convierte la vista de equipos en datos para la tarjeta de formación (spec §7). */
import type { SheetTeam } from './components/TeamSheet'
import type { Lineup, TeamsView } from './types'

export function sheetTeams(view: TeamsView, lineup: Lineup): [SheetTeam, SheetTeam] {
  const players = (ids: string[]) =>
    ids.map((id) => ({
      name: view.players[id]?.display_name ?? 'Jugador',
      position: view.players[id]?.preferred_position ?? null,
    }))
  const [a, b] = view.team_names
  return [
    { name: a, tone: 'light', players: players(lineup.team_a) },
    { name: b, tone: 'dark', players: players(lineup.team_b) },
  ]
}
