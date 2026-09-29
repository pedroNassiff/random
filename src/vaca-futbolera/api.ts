import type {
  CurrentMatch,
  History,
  ResultForm,
  ResultInput,
  MatchView,
  Me,
  Player,
  PlayerConstraint,
  PlayerInput,
  Skill,
  SkillInput,
  TeamEvaluation,
  TeamsView,
} from './types'

const BASE = '/api/futbol'

export class ApiError extends Error {
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function errorMessage(res: Response): Promise<string> {
  try {
    const body: unknown = await res.json()
    const detail = (body as { detail?: unknown }).detail
    if (typeof detail === 'string') return detail
  } catch {
    /* cuerpo vacío o no JSON */
  }
  return res.status === 422 ? 'Revisá los datos e intentá de nuevo.' : 'Algo salió mal. Intentá de nuevo.'
}

async function send(path: string, method: string, body?: unknown): Promise<Response> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    credentials: 'include',
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (!res.ok) throw new ApiError(res.status, await errorMessage(res))
  return res
}

async function request<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  return (await (await send(path, method, body)).json()) as T
}

/** Endpoints sin cuerpo de respuesta (202/204). */
async function command(path: string, method: string, body?: unknown): Promise<void> {
  await send(path, method, body)
}

export const api = {
  requestLink: (email: string) => command('/auth/request', 'POST', { email }),
  verifyLink: (token: string) => request<Me>('/auth/verify', 'POST', { token }),
  login: (email: string, password: string) => request<Me>('/auth/login', 'POST', { email, password }),
  setPassword: (password: string) => request<Me>('/auth/password', 'PUT', { password }),
  logout: () => command('/auth/logout', 'POST'),
  me: () => request<Me>('/me'),
  skills: () => request<Skill[]>('/skills'),
  createSkill: (s: SkillInput) => request<Skill>('/skills', 'POST', s),
  updateSkill: (id: string, s: SkillInput) => request<Skill>(`/skills/${id}`, 'PUT', s),
  players: () => request<Player[]>('/players'),
  createPlayer: (p: PlayerInput) => request<Player>('/players', 'POST', p),
  updatePlayer: (id: string, p: PlayerInput) => request<Player>(`/players/${id}`, 'PUT', p),
  myRatings: (playerId: string) => request<Record<string, number>>(`/players/${playerId}/ratings`),
  currentMatch: () => request<CurrentMatch>('/matches/current'),
  signup: (matchId: string, playerId?: string) =>
    request<MatchView>(`/matches/${matchId}/signup`, 'POST', playerId ? { player_id: playerId } : undefined),
  withdraw: (matchId: string, playerId?: string) =>
    request<MatchView>(
      `/matches/${matchId}/withdraw`,
      'POST',
      playerId ? { player_id: playerId } : undefined,
    ),
  teams: (matchId: string) => request<TeamsView>(`/matches/${matchId}/teams`),
  generateTeams: (matchId: string) => request<TeamsView>(`/matches/${matchId}/teams/generate`, 'POST'),
  evaluateTeams: (matchId: string, team_a: string[], team_b: string[]) =>
    request<TeamEvaluation>(`/matches/${matchId}/teams/evaluate`, 'POST', { team_a, team_b }),
  publishTeams: (matchId: string, team_a: string[], team_b: string[]) =>
    request<TeamsView>(`/matches/${matchId}/teams/publish`, 'POST', { team_a, team_b }),
  constraints: () => request<PlayerConstraint[]>('/constraints'),
  addConstraint: (player_a: string, player_b: string, kind: PlayerConstraint['kind']) =>
    request<PlayerConstraint>('/constraints', 'POST', { player_a, player_b, kind }),
  deleteConstraint: (id: string) => command(`/constraints/${id}`, 'DELETE'),
  history: () => request<History>('/matches/history'),
  resultForm: (matchId: string) => request<ResultForm>(`/matches/${matchId}/result`),
  saveResult: (matchId: string, body: ResultInput) =>
    request<ResultForm>(`/matches/${matchId}/result`, 'PUT', body),
  rate: (playerId: string, ratings: Record<string, number>) =>
    command(`/players/${playerId}/ratings`, 'PUT', { ratings }),
}

export const errorText = (e: unknown): string =>
  e instanceof Error ? e.message : 'Algo salió mal. Intentá de nuevo.'
