import type { Status } from '../shared/types'

/**
 * Filtro de pantalla del rail de Hoy. No toca tareas guardadas.
 * null: la lista no se dibuja porque todas sus tareas están hechas.
 * Una lista vacía no es "toda hecha" (no desaparece una categoría recién creada).
 * Una lista mixta sigue, pero sin las hechas.
 */
export function tasksForHomeRail<T extends { status: Status }>(
  tasks: T[],
  hideCompleted: boolean,
): T[] | null {
  if (!hideCompleted) return tasks
  if (tasks.length > 0 && tasks.every((task) => task.status === 'hecha')) return null
  return tasks.filter((task) => task.status !== 'hecha')
}
