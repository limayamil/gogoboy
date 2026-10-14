/**
 * El picker de categoría ordena por cuántas veces se eligió cada una.
 * La cuenta va en una cookie porque así lo pidió Yamil, no en localStorage.
 * "Sin categoría" no tiene id en la base y el JSON exige una clave string.
 */
export const CATEGORY_USAGE_COOKIE = 'gogoboy.categoryUsage'
export const UNCATEGORIZED_USAGE_KEY = ''
export const COLLAPSED_CATEGORY_LIMIT = 4

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
 * Las `limit` más usadas. Si la seleccionada no entra, ocupa el lugar de la
 * menos usada de esas y el grupo se vuelve a ordenar con la misma regla.
 */
export function collapsedCategories<T extends { id: string }>(
  choices: readonly T[],
  usage: CategoryUsage,
  selectedId: string,
  limit = COLLAPSED_CATEGORY_LIMIT,
): T[] {
  const ranked = rankCategoriesByUsage(choices, usage)
  if (ranked.length <= limit) return ranked
  const head = ranked.slice(0, limit)
  if (head.some((choice) => choice.id === selectedId)) return head
  const selected = ranked.find((choice) => choice.id === selectedId)
  if (!selected) return head
  return rankCategoriesByUsage([...head.slice(0, limit - 1), selected], usage)
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
