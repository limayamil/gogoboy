import { formatShortDate } from './dates'
import { dateKeyInAppZone, mondayOf } from '../shared/expiry'
import type { Category, Task } from '../shared/types'

/** Las listas borradas dejan `categoryId` en null; stats las agrupa aca. */
export const UNCATEGORIZED_NAME = 'Sin categoría'

export const WEEKDAY_LONG = [
  'lunes',
  'martes',
  'miércoles',
  'jueves',
  'viernes',
  'sábado',
  'domingo',
] as const

export interface CategoryStat {
  categoryId: string | null
  name: string
  colorKey: string | null
  count: number
}

export interface WeekStat {
  monday: string
  sunday: string
  count: number
  /** Categorias distintas (null cuenta como una lista). */
  listCount: number
  isCurrent: boolean
}

export interface WeekdayStat {
  index: number
  label: string
  count: number
}

export interface WeekDetail {
  monday: string
  sunday: string
  total: number
  byCategory: CategoryStat[]
  weekdays: WeekdayStat[]
}

export interface TaskStats {
  total: number
  byCategory: CategoryStat[]
  weeks: WeekStat[]
  thisMonday: string
  lastMonday: string
  thisWeekCount: number
  lastWeekCount: number
  mostProductiveWeekdays: WeekdayStat[]
}

function addDaysToKey(dateKey: string, days: number): string {
  const [year, month, day] = dateKey.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  date.setUTCDate(date.getUTCDate() + days)
  const y = date.getUTCFullYear()
  const m = String(date.getUTCMonth() + 1).padStart(2, '0')
  const d = String(date.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** 0 = lunes. Aritmetica de dia calendario, igual que `mondayOf`. */
function weekdayIndex(dateKey: string): number {
  const [year, month, day] = dateKey.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return (date.getUTCDay() + 6) % 7
}

function categoryName(
  categoryId: string | null,
  byId: Map<string, Category>,
): { name: string; colorKey: string | null } {
  if (categoryId === null) {
    return { name: UNCATEGORIZED_NAME, colorKey: null }
  }
  const category = byId.get(categoryId)
  return {
    name: category?.name ?? UNCATEGORIZED_NAME,
    colorKey: category?.colorKey ?? null,
  }
}

function toCategoryStats(
  counts: Map<string | null, number>,
  byId: Map<string, Category>,
): CategoryStat[] {
  return [...counts.entries()]
    .map(([categoryId, count]) => ({
      categoryId,
      count,
      ...categoryName(categoryId, byId),
    }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'es'))
}

export function formatWeekSpan(monday: string, sunday: string): string {
  return `${formatShortDate(monday)} – ${formatShortDate(sunday)}`
}

export function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`
}

function completedDayKey(task: Task): string | null {
  if (task.status !== 'hecha' || !task.completedAt) return null
  return dateKeyInAppZone(new Date(task.completedAt))
}

/**
 * Totales historicos y por semana (lunes–domingo en la zona de la app).
 * Incluye hechas expiradas: Hoy/Listas las ocultan, aca siguen contando.
 */
export function computeTaskStats(
  tasks: Task[],
  categories: Category[],
  now: Date = new Date(),
): TaskStats {
  const completed = tasks.filter((task) => task.status === 'hecha')
  const byId = new Map(categories.map((category) => [category.id, category]))
  const thisMonday = mondayOf(dateKeyInAppZone(now))
  const lastMonday = addDaysToKey(thisMonday, -7)

  const categoryCounts = new Map<string | null, number>()
  const weekBuckets = new Map<string, { count: number; lists: Set<string | null> }>()
  const weekdayCounts = [0, 0, 0, 0, 0, 0, 0]

  for (const task of completed) {
    categoryCounts.set(task.categoryId, (categoryCounts.get(task.categoryId) ?? 0) + 1)

    const day = completedDayKey(task)
    if (!day) continue
    const monday = mondayOf(day)
    const bucket = weekBuckets.get(monday)
    if (bucket) {
      bucket.count += 1
      bucket.lists.add(task.categoryId)
    } else {
      weekBuckets.set(monday, { count: 1, lists: new Set([task.categoryId]) })
    }
    weekdayCounts[weekdayIndex(day)] += 1
  }

  const weeks: WeekStat[] = [...weekBuckets.entries()]
    .map(([monday, bucket]) => ({
      monday,
      sunday: addDaysToKey(monday, 6),
      count: bucket.count,
      listCount: bucket.lists.size,
      isCurrent: monday === thisMonday,
    }))
    .sort((a, b) => (a.monday < b.monday ? 1 : -1))

  const peak = Math.max(0, ...weekdayCounts)
  const mostProductiveWeekdays: WeekdayStat[] =
    peak === 0
      ? []
      : weekdayCounts.flatMap((count, index) =>
          count === peak ? [{ index, label: WEEKDAY_LONG[index], count }] : [],
        )

  return {
    total: completed.length,
    byCategory: toCategoryStats(categoryCounts, byId),
    weeks,
    thisMonday,
    lastMonday,
    thisWeekCount: weekBuckets.get(thisMonday)?.count ?? 0,
    lastWeekCount: weekBuckets.get(lastMonday)?.count ?? 0,
    mostProductiveWeekdays,
  }
}

/** Detalle de una semana puntual, con las mismas reglas que el total. */
export function computeWeekDetail(
  tasks: Task[],
  categories: Category[],
  monday: string,
): WeekDetail {
  const sunday = addDaysToKey(monday, 6)
  const byId = new Map(categories.map((category) => [category.id, category]))
  const categoryCounts = new Map<string | null, number>()
  const weekdayCounts = [0, 0, 0, 0, 0, 0, 0]

  for (const task of tasks) {
    const day = completedDayKey(task)
    if (!day || mondayOf(day) !== monday) continue
    categoryCounts.set(task.categoryId, (categoryCounts.get(task.categoryId) ?? 0) + 1)
    weekdayCounts[weekdayIndex(day)] += 1
  }

  return {
    monday,
    sunday,
    total: [...categoryCounts.values()].reduce((sum, count) => sum + count, 0),
    byCategory: toCategoryStats(categoryCounts, byId),
    weekdays: weekdayCounts.map((count, index) => ({
      index,
      label: WEEKDAY_LONG[index],
      count,
    })),
  }
}
