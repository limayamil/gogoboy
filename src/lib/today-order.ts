type HoyItem = {
  id: string
  status: string
  todayPosition?: number | null
}

function byTodayPosition(a: HoyItem, b: HoyItem): number {
  return (a.todayPosition ?? 0) - (b.todayPosition ?? 0)
}

/**
 * Orden de pantalla de Hoy. Con el ajuste prendido, las `hecha` bajan juntas
 * al final y cada grupo conserva el orden que ya tenía. No esconde nada:
 * "Ocultar hechas" es el filtro de las listas.
 */
export function orderHoyTasks<T extends HoyItem>(tasks: readonly T[], completedLast: boolean): T[] {
  const sorted = [...tasks].sort(byTodayPosition)
  if (!completedLast) return sorted
  return [
    ...sorted.filter((task) => task.status !== 'hecha'),
    ...sorted.filter((task) => task.status === 'hecha'),
  ]
}

/**
 * Recalcula `todayPosition` al soltar una fila de Hoy sobre otra.
 * Opera sobre el orden actual (incluye ocultas) para no pisar huecos.
 */
export function nextTodayPositions(
  orderedIds: string[],
  activeId: string,
  overId: string,
): { id: string; todayPosition: number }[] | null {
  const from = orderedIds.indexOf(activeId)
  const to = orderedIds.indexOf(overId)
  if (from < 0 || to < 0 || from === to) return null

  const next = orderedIds.slice()
  const [moved] = next.splice(from, 1)
  next.splice(to, 0, moved)

  return next.map((id, todayPosition) => ({ id, todayPosition }))
}

/**
 * Reordena dentro del orden que se está viendo. Si las hechas van al final,
 * un drop que las mezclaría con las pendientes no se guarda: vuelven al grupo.
 */
export function nextHoyPositions<T extends HoyItem>(
  tasks: readonly T[],
  completedLast: boolean,
  activeId: string,
  overId: string,
): { id: string; todayPosition: number }[] | null {
  const ordered = orderHoyTasks(tasks, completedLast)
  const moved = nextTodayPositions(
    ordered.map((task) => task.id),
    activeId,
    overId,
  )
  if (!moved) return null
  if (!completedLast) return moved

  const byId = new Map(ordered.map((task) => [task.id, task]))
  const grouped = orderHoyTasks(
    moved.map((item) => ({ ...byId.get(item.id)!, todayPosition: item.todayPosition })),
    true,
  )
  const same = grouped.every((task, index) => task.id === ordered[index]?.id)
  if (same) return null
  return grouped.map((task, todayPosition) => ({ id: task.id, todayPosition }))
}
