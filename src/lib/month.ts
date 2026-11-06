import { addDays, formatTodayHeading, fromDateKey, toDateKey } from './dates'
import { APP_TIME_ZONE, dateKeyInAppZone, mondayOf } from '../shared/expiry'

/**
 * Mes de la app, en America/Argentina/Buenos_Aires. El navegador puede estar en
 * otra zona: a las 23:30 de Argentina ya es el día siguiente en UTC, y el
 * calendario no tiene que adelantarse con el reloj del host.
 */

/** Cuántos puntos cabían cuando el mes marcaba cantidad y no el título. */
export const CALENDAR_DOT_CAP = 3

export interface CalendarCell {
  key: string
  inMonth: boolean
}

export interface CalendarMonth {
  year: number
  month: number
  today: string
}

export function calendarMonthInZone(now: Date, timeZone = APP_TIME_ZONE): CalendarMonth {
  const today = dateKeyInAppZone(now, timeZone)
  const [year, month] = today.split('-').map(Number)
  return { year, month, today }
}

export function shiftMonth(
  year: number,
  month: number,
  delta: number,
): { year: number; month: number } {
  const index = year * 12 + (month - 1) + delta
  const nextYear = Math.floor(index / 12)
  const nextMonth = index - nextYear * 12 + 1
  return { year: nextYear, month: nextMonth }
}

function dateKeyAddDays(key: string, days: number): string {
  return toDateKey(addDays(fromDateKey(key), days))
}

/** Sábado o domingo. Mes los esconde igual que Semana, hasta que se pida el fin de semana. */
export function isWeekendDay(dayKey: string): boolean {
  const weekday = fromDateKey(dayKey).getDay()
  return weekday === 0 || weekday === 6
}

/** La grilla de lunes a viernes. El fin de semana sigue en el mes, solo no se dibuja. */
export function withoutWeekend(days: readonly CalendarCell[]): CalendarCell[] {
  return days.filter((day) => !isWeekendDay(day.key))
}

/** Grilla de lunes a domingo. Completa las semanas con días de los meses vecinos. */
export function monthGrid(year: number, month: number): CalendarCell[] {
  const monthKey = `${year}-${String(month).padStart(2, '0')}`
  const first = `${monthKey}-01`
  const start = mondayOf(first)
  const next = shiftMonth(year, month, 1)
  const nextFirst = `${next.year}-${String(next.month).padStart(2, '0')}-01`
  const last = dateKeyAddDays(nextFirst, -1)
  const end = dateKeyAddDays(mondayOf(last), 6)

  const cells: CalendarCell[] = []
  let key = start
  while (key <= end) {
    cells.push({ key, inMonth: key.startsWith(`${monthKey}-`) })
    key = dateKeyAddDays(key, 1)
  }
  return cells
}

/** "Noviembre de 2026". */
export function formatMonthTitle(year: number, month: number): string {
  const raw = fromDateKey(`${year}-${String(month).padStart(2, '0')}-01`).toLocaleDateString(
    'es-AR',
    { month: 'long', year: 'numeric' },
  )
  return raw.charAt(0).toUpperCase() + raw.slice(1)
}

/**
 * Junta las tareas por el día de su deadline. Sin fecha no entran: no hay
 * casillero al que pertenezcan.
 */
export function groupTasksByDeadline<T extends { deadline: string | null }>(
  tasks: readonly T[],
): Map<string, T[]> {
  const grouped = new Map<string, T[]>()
  for (const task of tasks) {
    if (!task.deadline) continue
    const bucket = grouped.get(task.deadline)
    if (bucket) bucket.push(task)
    else grouped.set(task.deadline, [task])
  }
  return grouped
}

export function calendarDotCount(taskCount: number): number {
  if (taskCount <= 0) return 0
  return Math.min(taskCount, CALENDAR_DOT_CAP)
}

/** Nombre accesible del casillero: la fecha y cuántas tareas caen ese día. */
export function calendarDayLabel(dayKey: string, count: number): string {
  const when = formatTodayHeading(fromDateKey(dayKey))
  if (count <= 0) return `${when}, sin tareas`
  if (count === 1) return `${when}, 1 tarea`
  return `${when}, ${count} tareas`
}
