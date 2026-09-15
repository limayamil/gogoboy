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
