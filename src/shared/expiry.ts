import type { Status, Task } from './types'

/**
 * Calendario de la app, no el UTC del host: Vercel corre en UTC y si
 * recortamos la semana ahi, el domingo a la noche en Argentina se adelantaria.
 * El servidor puede pisarlo con GOGOBOY_TZ; el front usa este default.
 */
export const APP_TIME_ZONE = 'America/Argentina/Buenos_Aires'

/** YYYY-MM-DD en la zona de la app. `en-CA` es el unico locale ISO estable. */
export function dateKeyInAppZone(date: Date, timeZone = APP_TIME_ZONE): string {
  return date.toLocaleDateString('en-CA', { timeZone })
}

/**
 * Lunes de la semana ISO (lunes–domingo) que contiene `dateKey`.
 * Aritmetica en UTC sobre un dia calendario, sin instantes.
 */
export function mondayOf(dateKey: string): string {
  const [year, month, day] = dateKey.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  const weekday = (date.getUTCDay() + 6) % 7
  date.setUTCDate(date.getUTCDate() - weekday)
  const y = date.getUTCFullYear()
  const m = String(date.getUTCMonth() + 1).padStart(2, '0')
  const d = String(date.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/**
 * Una hecha vence cuando termina la semana en que se completo.
 * Sin `completedAt` se considera vieja (tareas hechas de antes de este campo).
 */
export function shouldExpireCompleted(
  status: Status | string,
  completedAt: string | null,
  now: Date = new Date(),
  timeZone = APP_TIME_ZONE,
): boolean {
  if (status !== 'hecha') return false
  if (!completedAt) return true
  const completedDay = dateKeyInAppZone(new Date(completedAt), timeZone)
  return completedDay < mondayOf(dateKeyInAppZone(now, timeZone))
}

/** Persistido o calculado: Hoy y Categorias ocultan; Semana no usa esto. */
export function isExpiredCompleted(
  task: Pick<Task, 'expired' | 'status' | 'completedAt'>,
  now: Date = new Date(),
  timeZone = APP_TIME_ZONE,
): boolean {
  return task.expired || shouldExpireCompleted(task.status, task.completedAt, now, timeZone)
}
