import {
  closestCenter,
  pointerWithin,
  type CollisionDetection,
  type Modifier,
} from '@dnd-kit/core'

/** La manija no arranca el reorder con un roce: hace falta este desplazamiento. */
export const HOY_HANDLE_ACTIVATION_PX = 8

export const HOY_PANEL_ID = 'zona-hoy'
export const LIST_PANEL_ID = 'zona-listas'

type Hit = { id: string | number }

function isHoyReorderDrag(active: { data: { current?: unknown } } | null): boolean {
  const current = active?.data.current
  if (!current || typeof current !== 'object') return false
  return 'sortable' in current && current.sortable != null
}

/**
 * La manija de Hoy solo sube y baja. El arrastre desde las listas
 * sigue cruzando en horizontal hasta el panel.
 */
export const restrictHoyReorderToVerticalAxis: Modifier = ({ active, transform }) => {
  if (!isHoyReorderDrag(active)) return transform
  return { ...transform, x: 0 }
}

/**
 * Mientras se reordena Hoy, Listas no es un destino. El puntero puede
 * irse de costado; la colisión se queda en la columna.
 * Desde las listas, el panel y la columna siguen siendo destinos.
 */
export function hitsWhileReorderingHoy<T extends Hit>(
  pointerHits: readonly T[],
  centerHits: readonly T[],
  draggingToday: boolean,
): T[] {
  if (!draggingToday) {
    const zone = pointerHits.find((hit) => hit.id === HOY_PANEL_ID || hit.id === LIST_PANEL_ID)
    if (zone) return [zone]
    return pointerHits.length > 0 ? [...pointerHits] : [...centerHits]
  }

  const itemHit = pointerHits.find((hit) => hit.id !== HOY_PANEL_ID && hit.id !== LIST_PANEL_ID)
  if (itemHit) return [itemHit]
  const inColumn = pointerHits.filter((hit) => hit.id !== LIST_PANEL_ID)
  if (inColumn.length > 0) return [...inColumn]
  return centerHits.filter((hit) => hit.id !== LIST_PANEL_ID)
}

export function makeHoyCollision(todayIds: Set<string>): CollisionDetection {
  return (args) => {
    const draggingToday = todayIds.has(String(args.active.id))
    return hitsWhileReorderingHoy(pointerWithin(args), closestCenter(args), draggingToday)
  }
}
