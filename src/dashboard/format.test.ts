import { describe, expect, it } from 'vitest'
import { daysLabel, formatDate, formatMoney, formatSize, isClosed } from './format'

describe('formato', () => {
  it('formatea la fecha con día de la semana, sin corrimiento de zona horaria', () => {
    expect(formatDate('2026-10-20')).toBe('mar, 20/10/2026')
    expect(formatDate('2027-02-01')).toBe('lun, 01/02/2027')
  })

  it('describe los días restantes', () => {
    expect(daysLabel(0)).toBe('vence hoy')
    expect(daysLabel(1)).toBe('vence mañana')
    expect(daysLabel(19)).toBe('faltan 19 días')
    expect(daysLabel(-1)).toBe('venció ayer')
    expect(daysLabel(-73)).toBe('venció hace 73 días')
  })

  it('solo presentado y pagado cierran', () => {
    expect((['pendiente', 'preparado', 'presentado', 'pagado'] as const).map(isClosed)).toEqual([
      false,
      false,
      true,
      true,
    ])
  })

  it('muestra el tamaño de un archivo en la unidad que corresponde', () => {
    expect(formatSize(900)).toBe('900 B')
    expect(formatSize(1024)).toBe('1 KB')
    expect(formatSize(350_000)).toBe('342 KB')
    expect(formatSize(1024 * 1024)).toBe('1.0 MB')
    expect(formatSize(4.6 * 1024 * 1024)).toBe('4.6 MB')
  })

  it('formatea importes en euros y en otra moneda', () => {
    expect(formatMoney('1840.00')).toBe('1.840,00 €')
    expect(formatMoney('2000.00', 'USD')).toBe('2.000,00 USD')
    expect(formatMoney('0.5')).toBe('0,50 €')
  })
})
