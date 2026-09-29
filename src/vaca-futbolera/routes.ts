export const BASE = '/vaca-futbolera'
export const LOGIN = `${BASE}/entrar`
export const PASSWORD = `${BASE}/contrasena`
/** Logo de La Vaca (permiso de uso confirmado, 29/09/2026). Versión liviana de static/lavaca.png. */
export const LAVACA_LOGO = '/lavaca-256.png'
export const teamsPath = (matchId: string) => `${BASE}/partidos/${matchId}/equipos`
export const HISTORY = `${BASE}/partidos`
export const resultPath = (matchId: string) => `${BASE}/partidos/${matchId}/resultado`
