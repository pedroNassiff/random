export type Role = 'admin' | 'member'
export type Position = 'POR' | 'DEF' | 'MED' | 'DEL'
export const POSITION_LABELS: Record<Position, string> = {
  POR: 'Portero',
  DEF: 'Defensor',
  MED: 'Medio',
  DEL: 'Delantero',
}
export type ScoreSource = 'peers' | 'admin' | 'imputed'

export interface Me {
  email: string
  role: Role
  player_id: string | null
  has_password: boolean
}

export interface Skill {
  id: string
  key: string
  name: string
  description: string
  weight: number
  is_active: boolean
  sort_order: number
}

export interface SkillScore {
  name: string
  value: number
  n_raters: number
  source: ScoreSource
  /** Autoevaluación del jugador: el admin la ve, pero no cuenta en el puntaje. */
  self_value: number | null
}

export const SOURCE_LABELS: Record<ScoreSource, string> = {
  peers: 'Pares',
  admin: 'Admin',
  imputed: 'Sin datos (5)',
}

export interface Player {
  id: string
  display_name: string
  nickname: string | null
  email: string | null
  preferred_position: Position | null
  can_play_gk: boolean
  is_guest: boolean
  guest_level: number | null
  active: boolean
  /** Solo lo devuelve la API al admin. */
  scoring?: { composite: number; skills: Record<string, SkillScore> }
}

export type PlayerInput = Omit<Player, 'id' | 'scoring'>
export type SkillInput = Omit<Skill, 'id'>

export type MatchStatus = 'open' | 'closed' | 'teams_published' | 'played' | 'cancelled'
export type SignupStatus = 'confirmed' | 'waitlist'

export interface SignupEntry {
  player_id: string
  display_name: string
  preferred_position: Position | null
  late_withdrawal: boolean
}

export interface MatchView {
  match: { id: string; starts_at: string; signup_closes_at: string; status: MatchStatus }
  capacity: number
  signup_open: boolean
  closes_text: string
  confirmed: SignupEntry[]
  waitlist: SignupEntry[]
  my_status: SignupStatus | null
  share_text: string
}

export type CurrentMatch = MatchView | { match: null }

export interface TeamEvaluation {
  team_a: string[]
  team_b: string[]
  cost: number
  breakdown: Record<string, number>
  strength_a: number
  strength_b: number
  win_pct_a: number
  win_pct_b: number
}

export interface TeamPlayer {
  id: string
  display_name: string
  preferred_position: Position | null
  /** Solo admin. */
  strength: number | null
}

/** Quién juega en cada equipo. Es lo único que reciben los miembros de los equipos publicados. */
export interface Lineup {
  team_a: string[]
  team_b: string[]
}

/** Equipos publicados: el admin recibe además %, fuerza y costo (TeamEvaluation). */
export type PublishedTeams = Lineup & Partial<TeamEvaluation>

export interface TeamsView {
  match: { id: string; starts_at: string; status: MatchStatus }
  team_names: [string, string]
  players: Record<string, TeamPlayer>
  proposals: TeamEvaluation[]
  published: PublishedTeams | null
  share_text: string | null
}

export interface PlayerConstraint {
  id: string
  player_a: string
  player_b: string
  kind: 'apart' | 'together'
}

export interface LineupPlayer {
  id: string
  display_name: string
  preferred_position: Position | null
  /** Goles en ese partido (opcional; null = no se cargó). */
  goals?: number | null
}

export interface MatchResult {
  goals_a: number
  goals_b: number
  notes: string
}

export interface HistoryEntry {
  match: { id: string; starts_at: string; status: MatchStatus }
  result: MatchResult
  /** "Parejo": diferencia ≤ 2 goles. */
  close: boolean
  team_a: LineupPlayer[]
  team_b: LineupPlayer[]
}

export interface History {
  team_names: [string, string]
  matches: HistoryEntry[]
}

export interface ResultForm {
  match: { id: string; starts_at: string; status: MatchStatus }
  team_names: [string, string]
  team_a: LineupPlayer[]
  team_b: LineupPlayer[]
  result: MatchResult | null
  roster: LineupPlayer[]
}

export interface ResultInput extends MatchResult {
  team_a: string[]
  team_b: string[]
  player_goals: Record<string, number>
}
