/**
 * El picker de categoría ordena por cuántas veces se eligió cada una.
 * La cuenta va en una cookie porque así lo pidió Yamil, no en localStorage.
 * "Sin categoría" no tiene id en la base y el JSON exige una clave string.
 */
export const CATEGORY_USAGE_COOKIE = 'gogoboy.categoryUsage'
export const UNCATEGORIZED_USAGE_KEY = ''
/** El colapsado puede ocupar dos filas. Lo que no entra queda detrás del chevron. */
export const COLLAPSED_CATEGORY_LINES = 2

/** Un pixel de margen: el redondeo del layout no debe mandar un chip a una tercera fila. */
const FIT_SLACK_PX = 1

/** Sin Max-Age la cookie muere con la sesión y el ranking se olvida al cerrar el navegador. */
const USAGE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365

export type CategoryUsage = Record<string, number>

export function usageKeyForCategory(categoryId: string | null): string {
  return categoryId ?? UNCATEGORIZED_USAGE_KEY
}

function countOf(usage: CategoryUsage, id: string): number {
  const value = usage[id]
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : 0
}

/**
 * Más usadas primero. Empate: se queda el orden de entrada, que es el de hoy
 * (Sin categoría y después `position`).
 */
export function rankCategoriesByUsage<T extends { id: string }>(
  choices: readonly T[],
  usage: CategoryUsage,
): T[] {
  return choices
    .map((choice, index) => ({ choice, index, count: countOf(usage, choice.id) }))
    .sort((a, b) => b.count - a.count || a.index - b.index)
    .map((item) => item.choice)
}

/**
 * Cuántos anchos entran en `maxLines` filas sin partir un chip.
 * Un chip más ancho que la fila ocupa la fila entera: el nombre se muestra
 * completo y no se recorta. Si todavía no hay ancho, no escondemos nada.
 */
export function chipsThatFit(
  widths: readonly number[],
  containerWidth: number,
  gap: number,
  maxLines = COLLAPSED_CATEGORY_LINES,
): number {
  if (widths.length === 0) return 0
  if (!(containerWidth > 0) || maxLines < 1) return widths.length
  let lines = 1
  let used = 0
  let count = 0
  for (const raw of widths) {
    const width = Math.min(Math.max(raw, 0), containerWidth)
    const slot = used === 0 ? width : gap + width
    if (used + slot <= containerWidth + FIT_SLACK_PX) {
      used += slot
      count += 1
      continue
    }
    if (lines >= maxLines) break
    lines += 1
    used = width
    count += 1
  }
  return count
}

/**
 * Las más usadas que entran en dos filas, nombre entero. Si la seleccionada
 * no entra, reemplaza a la menos usada del grupo visible y se reordena.
 * `widths` sigue el orden de `choices`, no el rankeado.
 */
export function collapsedCategories<T extends { id: string }>(
  choices: readonly T[],
  usage: CategoryUsage,
  selectedId: string,
  widths: readonly number[],
  containerWidth: number,
  gap: number,
  maxLines = COLLAPSED_CATEGORY_LINES,
): T[] {
  const ranked = rankCategoriesByUsage(choices, usage)
  if (!(containerWidth > 0)) return ranked
  const widthById = new Map(choices.map((choice, index) => [choice.id, widths[index] ?? 0]))
  const widthFor = (items: readonly T[]) => items.map((item) => widthById.get(item.id) ?? 0)
  const fits = (items: readonly T[]) =>
    chipsThatFit(widthFor(items), containerWidth, gap, maxLines) === items.length

  const count = chipsThatFit(widthFor(ranked), containerWidth, gap, maxLines)
  const head = ranked.slice(0, count)
  if (head.some((choice) => choice.id === selectedId)) return head
  const selected = ranked.find((choice) => choice.id === selectedId)
  if (!selected) return head

  let kept = head
  while (kept.length > 0) {
    const withoutLast = kept.slice(0, -1)
    const trial = ranked.filter((choice) => choice === selected || withoutLast.includes(choice))
    if (fits(trial)) return trial
    kept = withoutLast
  }
  return [selected]
}

export function parseCategoryUsage(raw: string | null | undefined): CategoryUsage {
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    const usage: CategoryUsage = {}
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === 'number' && Number.isInteger(value) && value > 0) usage[key] = value
    }
    return usage
  } catch {
    return {}
  }
}

export function bumpCategoryUsage(usage: CategoryUsage, id: string): CategoryUsage {
  return { ...usage, [id]: countOf(usage, id) + 1 }
}

export function categoryUsageSetCookie(usage: CategoryUsage): string {
  const value = encodeURIComponent(JSON.stringify(parseCategoryUsage(JSON.stringify(usage))))
  return `${CATEGORY_USAGE_COOKIE}=${value}; Path=/; SameSite=Lax; Max-Age=${USAGE_MAX_AGE_SECONDS}`
}

export function usageFromCookieHeader(header: string): CategoryUsage {
  for (const part of header.split(';')) {
    const trimmed = part.trim()
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    if (trimmed.slice(0, eq) !== CATEGORY_USAGE_COOKIE) continue
    const raw = trimmed.slice(eq + 1)
    try {
      return parseCategoryUsage(decodeURIComponent(raw))
    } catch {
      return parseCategoryUsage(raw)
    }
  }
  return {}
}

export function readCategoryUsage(): CategoryUsage {
  if (typeof document === 'undefined') return {}
  return usageFromCookieHeader(document.cookie)
}

export function writeCategoryUsage(usage: CategoryUsage): void {
  if (typeof document === 'undefined') return
  document.cookie = categoryUsageSetCookie(usage)
}
