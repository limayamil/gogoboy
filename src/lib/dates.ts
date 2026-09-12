/**
 * Fechas en hora local. Los deadlines son dias calendario ('YYYY-MM-DD'), no instantes,
 * asi que todo se hace con las partes locales de Date y nunca con toISOString(), que
 * convierte a UTC y corre el dia.
 */

export const DAY_NAMES = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'] as const

export function toDateKey(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function fromDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function todayKey(): string {
  return toDateKey(new Date())
}

/** Lunes de la semana que contiene `date`. */
export function startOfWeek(date: Date): Date {
  const result = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const weekday = (result.getDay() + 6) % 7 // 0 = lunes
  result.setDate(result.getDate() - weekday)
  return result
}

export function addDays(date: Date, days: number): Date {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

/** Las 7 claves de dia, de lunes a domingo, de la semana que contiene `anchor`. */
export function weekKeys(anchor: Date): string[] {
  const monday = startOfWeek(anchor)
  return Array.from({ length: 7 }, (_, index) => toDateKey(addDays(monday, index)))
}

export function formatDayNumber(key: string): string {
  return String(fromDateKey(key).getDate())
}

/** Etiqueta corta para el modal y las tarjetas: "11 sep". */
export function formatShortDate(key: string): string {
  return fromDateKey(key).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })
}

export function formatWeekRange(anchor: Date): string {
  const monday = startOfWeek(anchor)
  const sunday = addDays(monday, 6)
  const fmt = (date: Date) => date.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })
  return `${fmt(monday)} – ${fmt(sunday)}`
}

/** "Viernes, 11 de septiembre" — sin capitalizar el "de". */
export function formatTodayHeading(date: Date): string {
  const raw = date.toLocaleDateString('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
  return raw.charAt(0).toUpperCase() + raw.slice(1)
}
