import { isExpiredCompleted } from '../shared/expiry'
import type { Task } from '../shared/types'

/** Apagado si la clave no está o no es exactamente "true". */
export const SHOW_LIST_ON_TASK_KEY = 'gogoboy.showListOnTask'

/** Prendido salvo que la clave sea "false": el default es sugerir. */
export const SUGGEST_DUE_TODAY_KEY = 'gogoboy.suggestDueToday'

type StorageRead = (key: string) => string | null

export function readShowListOnTask(read: StorageRead): boolean {
  return read(SHOW_LIST_ON_TASK_KEY) === 'true'
}

export function readSuggestDueToday(read: StorageRead): boolean {
  return read(SUGGEST_DUE_TODAY_KEY) !== 'false'
}

/** Nombre bajo el título. Sin ajuste, o sin lista, no hay línea. */
export function visibleListLabel(showList: boolean, listName: string | null | undefined): string | null {
  if (!showList) return null
  const name = listName?.trim() ?? ''
  return name.length > 0 ? name : null
}

export function categoryListName(
  categoryId: string | null,
  categories: readonly { id: string; name: string }[],
): string | null {
  if (!categoryId) return null
  const name = categories.find((category) => category.id === categoryId)?.name
  return name?.trim() ? name : null
}

export type TodayPanelMembership = Pick<
  Task,
  'inToday' | 'hiddenInToday' | 'expired' | 'status' | 'completedAt'
>

/**
 * La misma condición con la que el panel de Hoy decide dibujar una fila:
 * en Hoy, no vencida, y visible (el ojito la esconde salvo que el panel muestre ocultas).
 */
export function isShownInTodayPanel(
  task: TodayPanelMembership,
  showHidden: boolean,
  now: Date = new Date(),
): boolean {
  if (isExpiredCompleted(task, now)) return false
  return task.inToday && (showHidden || !task.hiddenInToday)
}

export type SuggestableTask = TodayPanelMembership & Pick<Task, 'deadline'>

export function tasksToSuggestForToday<T extends SuggestableTask>(
  tasks: readonly T[],
  today: string,
  showHidden: boolean,
  now: Date = new Date(),
): T[] {
  return tasks.filter(
    (task) =>
      task.deadline === today &&
      task.status !== 'hecha' &&
      !isShownInTodayPanel(task, showHidden, now),
  )
}

/** Sin filas no hay franja: ajuste apagado y "nadie califica" se ven igual. */
export function suggestionStripTasks<T extends SuggestableTask>(
  tasks: readonly T[],
  today: string,
  showHidden: boolean,
  enabled: boolean,
  now: Date = new Date(),
): T[] {
  if (!enabled) return []
  return tasksToSuggestForToday(tasks, today, showHidden, now)
}

/** El mismo parche que soltar una tarea de las listas sobre el panel de Hoy. */
export function addToTodayPatch(): { inToday: true; hiddenInToday: false } {
  return { inToday: true, hiddenInToday: false }
}
