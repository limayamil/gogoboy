import type { Status } from '../shared/types'

/**
 * La misma preferencia en el rail de Hoy y en Categorías.
 * La clave no cambia: si no, se pierde lo que Hoy ya guardó.
 * No viaja al servidor. Apagada salvo que el valor sea exactamente "true".
 */
export const HIDE_COMPLETED_ON_HOME_KEY = 'gogoboy.hideCompletedOnHome'

export function readHideCompletedOnHome(stored: string | null): boolean {
  return stored === 'true'
}

/**
 * Filtro de pantalla de las listas de Hoy y de Categorías. No toca tareas guardadas.
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
