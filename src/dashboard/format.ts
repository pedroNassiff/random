import type { Aviso, Estado } from './types'

const DATE = new Intl.DateTimeFormat('es-ES', {
  weekday: 'short',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  timeZone: 'UTC',
})

/** '2026-10-20' → 'mar, 20/10/2026'. Las fechas fiscales no tienen hora: se formatean en UTC. */
export function formatDate(iso: string): string {
  return DATE.format(new Date(`${iso}T00:00:00Z`))
}

export function daysLabel(days: number): string {
  if (days === 0) return 'vence hoy'
  if (days === 1) return 'vence mañana'
  if (days === -1) return 'venció ayer'
  return days > 0 ? `faltan ${days} días` : `venció hace ${-days} días`
}

export const ESTADO_LABEL: Record<Estado, string> = {
  pendiente: 'Pendiente',
  preparado: 'Preparado',
  presentado: 'Presentado',
  pagado: 'Pagado',
}

export const AVISO_LABEL: Record<Aviso, string> = {
  sin_aviso: '',
  'T-15': 'Preparar datos',
  'T-5': 'Revisar borrador',
  'T-1': 'Último aviso',
  T: 'Vence hoy',
  vencida: 'Vencida',
}

export const isClosed = (estado: Estado): boolean => estado === 'presentado' || estado === 'pagado'

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// En español los miles de cuatro cifras no se agrupan por defecto ("1840,00"): se fuerza el punto.
const MONEY = new Intl.NumberFormat('es-ES', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  useGrouping: 'always',
})

/** '1840.00' → '1.840,00 €'. Los importes llegan como texto para no perder decimales. */
export function formatMoney(amount: string, currency = 'EUR'): string {
  return `${MONEY.format(Number(amount))} ${currency === 'EUR' ? '€' : currency}`
}
