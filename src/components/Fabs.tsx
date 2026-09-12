import { useEffect, useRef, useState } from 'react'
import { IconBolt, IconPlus, IconTrash } from './Icons'
import { useModals } from '../app/modals'
import {
  useAppState,
  useCreateQuickTask,
  useDeleteQuickTask,
  useUpdateQuickTask,
} from '../lib/store'
import styles from './Fabs.module.css'

/**
 * Los dos FABs del boceto: el rayo abre el checklist de tareas rápidas por encima
 * del botón, y el más abre el formulario completo de tarea.
 */
export function Fabs() {
  const { openTask } = useModals()
  const { data } = useAppState()
  const quickTasks = data?.quickTasks ?? []

  const createQuickTask = useCreateQuickTask()
  const updateQuickTask = useUpdateQuickTask()
  const deleteQuickTask = useDeleteQuickTask()

  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const container = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: MouseEvent) => {
      if (!container.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const pending = quickTasks.filter((q) => !q.done).length

  function add() {
    const title = draft.trim()
    if (!title) return
    createQuickTask.mutate(title)
    setDraft('')
  }

  return (
    <div className={styles.dock} ref={container}>
      {open ? (
        <div className={styles.popover} role="dialog" aria-label="Tareas rápidas">
          <header className={styles.popHeader}>
            <h3 className={styles.popTitle}>Tareas rápidas</h3>
            <span className={styles.popCount}>{pending} pendientes</span>
          </header>

          {quickTasks.length === 0 ? (
            <p className={styles.empty}>
              <IconBolt size={20} />
              Nada por acá. Anotá algo suelto y listo.
            </p>
          ) : (
            <ul className={styles.list}>
              {quickTasks.map((quick) => (
                <li key={quick.id} className={styles.item}>
                  <label className={styles.itemLabel}>
                    <input
                      type="checkbox"
                      className={styles.checkbox}
                      checked={quick.done}
                      onChange={(e) =>
                        updateQuickTask.mutate({ id: quick.id, patch: { done: e.target.checked } })
                      }
                    />
                    <span className={quick.done ? styles.itemDone : undefined}>{quick.title}</span>
                  </label>
                  <button
                    type="button"
                    className={styles.itemDelete}
                    onClick={() => deleteQuickTask.mutate(quick.id)}
                    aria-label={`Eliminar ${quick.title}`}
                  >
                    <IconTrash size={14} />
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className={styles.addRow}>
            <input
              className={styles.addInput}
              placeholder="Agregar tarea rápida"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') add()
              }}
            />
            <button type="button" className={styles.addButton} onClick={add} aria-label="Agregar">
              <IconPlus size={16} />
            </button>
          </div>
        </div>
      ) : null}

      <div className={styles.buttons}>
        <button
          type="button"
          className={`${styles.fab} ${styles.fabQuick} ${open ? styles.fabQuickOpen : ''}`}
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-label="Tareas rápidas"
        >
          <IconBolt size={21} />
          {pending > 0 ? <span className={styles.badge}>{pending}</span> : null}
        </button>

        <button
          type="button"
          className={`${styles.fab} ${styles.fabAdd}`}
          onClick={() => openTask({ taskId: null })}
          aria-label="Nueva tarea"
        >
          <IconPlus size={24} />
        </button>
      </div>
    </div>
  )
}
