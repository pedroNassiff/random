/** Formato de fechas del partido en la zona del grupo y cuenta regresiva (DESIGN §4). */

export const TIMEZONE = 'Europe/Madrid'
const URGENT_MS = 12 * 60 * 60 * 1000

function parts(iso: string, options: Intl.DateTimeFormatOptions): Record<string, string> {
  const out: Record<string, string> = {}
  for (const p of new Intl.DateTimeFormat('es-ES', { timeZone: TIMEZONE, ...options }).formatToParts(
    new Date(iso),
  )) {
    out[p.type] = p.value
  }
  return out
}

/** "MIÉ 30 SEP" */
export function matchDay(iso: string): string {
  const p = parts(iso, { weekday: 'short', day: 'numeric', month: 'short' })
  const clean = (s = '') => s.replace('.', '').slice(0, 3).toUpperCase()
  return `${clean(p.weekday)} ${p.day} ${clean(p.month)}`
}

/** "20:00H" */
export function matchTime(iso: string): string {
  const p = parts(iso, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
  return `${p.hour}:${p.minute}H`
}

/** "Cierra en 2d 04h" · "Cierra en 3h 05m" · urgente si faltan < 12 h. */
export function countdown(closesIso: string, nowMs: number): { text: string; urgent: boolean } {
  const ms = new Date(closesIso).getTime() - nowMs
  if (ms <= 0) return { text: 'Inscripción cerrada', urgent: false }
  const minutes = Math.floor(ms / 60000)
  const d = Math.floor(minutes / 1440)
  const h = Math.floor((minutes % 1440) / 60)
  const m = minutes % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  const text = d > 0 ? `Cierra en ${d}d ${pad(h)}h` : `Cierra en ${h}h ${pad(m)}m`
  return { text, urgent: ms < URGENT_MS }
}
