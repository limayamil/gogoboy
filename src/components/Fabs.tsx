import { useEffect, useRef, useState } from 'react'
import { useLocation, useSearchParams } from 'react-router-dom'
import { IconBolt, IconPlus, IconTrash } from './Icons'
import { useModals } from '../app/modals'
import { composeKindFromFilter, PASSWORDS_FILTER } from '../lib/notes'
import { toastUndo } from '../lib/toast'
import {
  useAppState,
  useCreateQuickTask,
  useDeleteQuickTask,
  useUpdateQuickTask,
} from '../lib/store'
import type { QuickTask } from '../shared/types'
import styles from './Fabs.module.css'

/**
 * Los dos FABs: el rayo abre las tareas rápidas, y el más crea una tarea o,
 * si estás en Notas, una nota (o una contraseña, si el filtro reservado está activo).
 */
export function Fabs() {
  const { pathname } = useLocation()
  const [params] = useSearchParams()
  const onNotes = pathname === '/notas'
  const composeKind = composeKindFromFilter(
    onNotes && params.get('vista') === 'contrasenas' ? PASSWORDS_FILTER : null,
  )
  const { openTask, openNote } = useModals()
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

  /**
   * Borrar es de un click y sin confirmar, asi que el aviso trae el Deshacer. La
   * tarea vuelve con id nuevo — para un checklist suelto alcanza con recuperar el
   * texto y si estaba tildada.
   */
  function remove(quick: QuickTask) {
    deleteQuickTask.mutate(quick.id)
    toastUndo(`Se eliminó “${quick.title}”`, () => {
      createQuickTask.mutate(quick.title, {
        onSuccess: (restored) => {
          if (quick.done) updateQuickTask.mutate({ id: restored.id, patch: { done: true } })
        },
      })
    })
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
                    onClick={() => remove(quick)}
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
              // El flujo esta pensado para encadenar varias: al abrir, el cursor ya
              // esta donde se escribe.
              autoFocus
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
          onClick={() => (onNotes ? openNote(null, composeKind) : openTask({ taskId: null }))}
          aria-label={
            onNotes ? (composeKind === 'password' ? 'Nueva contraseña' : 'Nueva nota') : 'Nueva tarea'
          }
        >
          <IconPlus size={24} />
        </button>
      </div>
    </div>
  )
}
