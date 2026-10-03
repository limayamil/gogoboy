/**
 * Como se elige la categoria al tomar. La UI lo usa para la marca "se va a
 * crear" y el servidor para armar la unica sentencia de escritura: si la
 * regla viviera solo en SQL, el paso Tomar podria prometer una cosa y la
 * base hacer otra.
 *
 * Orden, a proposito:
 * 1. id presente y la categoria sigue ahi: esa, sin renombrar ni duplicar.
 * 2. nombre vacio: sin categoria.
 * 3. nombre que ya existe (sin distinguir mayusculas): la de menor position.
 * 4. si no coincide con ninguna: hay que crearla.
 */
export interface CategoryPick {
  id: string
  name: string
  position: number
}

export type AcceptCategoryPlan =
  | { kind: 'existing'; categoryId: string }
  | { kind: 'none' }
  | { kind: 'create'; name: string }

const CATEGORY_NAME_MAX = 60

export function resolveAcceptCategory(
  input: { categoryId?: string | null; categoryName?: string | null },
  categories: CategoryPick[],
): AcceptCategoryPlan {
  if (input.categoryId) {
    const found = categories.find((item) => item.id === input.categoryId)
    if (found) return { kind: 'existing', categoryId: found.id }
  }

  const name = input.categoryName?.trim() ?? ''
  if (!name) return { kind: 'none' }

  const match = categories
    .filter((item) => item.name.toLowerCase() === name.toLowerCase())
    .sort((a, b) => a.position - b.position || a.id.localeCompare(b.id))[0]

  if (match) return { kind: 'existing', categoryId: match.id }
  return { kind: 'create', name: name.slice(0, CATEGORY_NAME_MAX) }
}
