import { describe, expect, it } from 'vitest'
import { countdown, matchDay, matchTime } from './match'

describe('formato del partido (Europe/Madrid)', () => {
  it('día y hora locales, también con cambio de horario', () => {
    expect(matchDay('2026-09-30T18:00:00Z')).toBe('MIÉ 30 SEP')
    expect(matchTime('2026-09-30T18:00:00Z')).toBe('20:00H')
    expect(matchTime('2026-10-28T19:00:00Z')).toBe('20:00H') // invierno: UTC+1
  })

  it('cuenta regresiva en días/horas, horas/minutos, urgente y cerrada', () => {
    const closes = '2026-09-27T21:59:00Z'
    const at = (iso: string) => new Date(iso).getTime()
    expect(countdown(closes, at('2026-09-25T17:59:00Z'))).toEqual({ text: 'Cierra en 2d 04h', urgent: false })
    expect(countdown(closes, at('2026-09-27T18:54:00Z'))).toEqual({ text: 'Cierra en 3h 05m', urgent: true })
    expect(countdown(closes, at('2026-09-27T09:58:00Z')).urgent).toBe(false) // justo 12 h + 1 min
    expect(countdown(closes, at('2026-09-27T21:59:00Z'))).toEqual({
      text: 'Inscripción cerrada',
      urgent: false,
    })
  })
})
