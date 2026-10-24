import { visibleListLabel } from '../lib/settings'
import { useTaskSettings } from '../app/task-settings'
import styles from './TaskListLabel.module.css'

/** Línea chica bajo el título. No se dibuja si el ajuste está apagado o no hay lista. */
export function TaskListLabel({ listName }: { listName: string | null }) {
  const { showListOnTask } = useTaskSettings()
  const label = visibleListLabel(showListOnTask, listName)
  if (!label) return null
  return <span className={styles.label}>{label}</span>
}
