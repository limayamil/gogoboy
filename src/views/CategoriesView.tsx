import { useState } from 'react'
import { useModals } from '../app/modals'
import { ErrorState, LoadingState } from '../components/Feedback'
import { TaskListLabel } from '../components/TaskListLabel'
import { StatusToggle } from '../components/StatusToggle'
import {
  IconCalendar,
  IconEye,
  IconEyeOff,
  IconFlag,
  IconList,
  IconPaperclip,
  IconPlus,
  IconSun,
} from '../components/Icons'
import {
  HIDE_COMPLETED_ON_HOME_KEY,
  readHideCompletedOnHome,
  tasksForHomeRail,
} from '../lib/home-rail'
import { useColorOf } from '../lib/palette'
import { formatShortDate } from '../lib/dates'
import { richTextExcerpt } from '../lib/rich-text'
import { isExpiredCompleted } from '../shared/expiry'
import { useAppState, useUpdateTask } from '../lib/store'
import type { Task, Urgency } from '../shared/types'
import styles from './CategoriesView.module.css'

const URGENCY_LABEL: Record<Urgency, string> = { baja: 'Baja', media: 'Media', alta: 'Alta' }

/**
 * Mosaico tipo Pinterest: cada tarjeta es una categoria con sus tareas.
 * El masonry sale de `columns` en CSS, sin librerias.
 */
export function CategoriesView() {
  const { data, isPending, error } = useAppState()
  const { openTask, openCategory } = useModals()
  const colorOf = useColorOf()
  const [hideCompleted, setHideCompleted] = useState(() =>
    readHideCompletedOnHome(localStorage.getItem(HIDE_COMPLETED_ON_HOME_KEY)),
  )

  const categories = data?.categories ?? []
  const tasks = (data?.tasks ?? []).filter((task) => !isExpiredCompleted(task))
  const uncategorized = tasks.filter((task) => task.categoryId === null)
  const visibleUncategorized = tasksForHomeRail(uncategorized, hideCompleted)
  const hideLabel = hideCompleted ? 'Ver tareas hechas' : 'Ocultar tareas hechas'

  return (
    <div className={`${styles.page} pageEnter`}>
      <header className={styles.header}>
        <h1 className="visuallyHidden">Categorías</h1>
        <div className={styles.headerActions}>
          <button
            type="button"
            className={styles.hideCompleted}
            aria-pressed={hideCompleted}
            aria-label={hideLabel}
            title={hideLabel}
            onClick={() => {
              const next = !hideCompleted
              localStorage.setItem(HIDE_COMPLETED_ON_HOME_KEY, String(next))
              setHideCompleted(next)
            }}
          >
            {hideCompleted ? <IconEye size={15} /> : <IconEyeOff size={15} />}
            {hideCompleted ? 'Ver hechas' : 'Ocultar hechas'}
          </button>
          <button
            type="button"
            className={styles.newCategory}
            onClick={() => openCategory(null)}
            aria-label="Nueva categoría"
          >
            <IconPlus size={16} />
            Nueva
          </button>
        </div>
      </header>

      {/* El encabezado no depende de los datos: dejarlo montado evita que la pantalla
          salte de un spinner centrado a la grilla entera. */}
      {isPending ? <LoadingState /> : null}
      {error ? <ErrorState error={error} /> : null}

      {!isPending && !error && categories.length === 0 && uncategorized.length === 0 ? (
        <div className={styles.empty}>
          <img
            className={styles.emptyIllustration}
            src="/images/empty-categories.webp"
            alt=""
            width="480"
            height="480"
          />
          <p className={styles.emptyTitle}>Todavía no hay categorías</p>
          <p className={styles.emptyText}>
            Creá una (Casa, Trabajo, Estudio...) y elegile un color pastel.
          </p>
        </div>
      ) : null}

      <div className={`${styles.masonry} staggerFade`}>
        {categories.map((category) => {
          const color = colorOf(category.colorKey)
          const own = tasks.filter((task) => task.categoryId === category.id)
          const visible = tasksForHomeRail(own, hideCompleted)
          if (!visible) return null
          return (
            <section key={category.id} className={styles.card} style={{ backgroundColor: color.bg }}>
              <header className={styles.cardHeader}>
                <button
                  type="button"
                  className={styles.cardTitle}
                  style={{ color: color.ink }}
                  onClick={() => openCategory(category.id)}
                >
                  {category.name}
                  <span className={styles.cardCount}>
                    {own.filter((task) => task.status !== 'hecha').length}
                  </span>
                </button>
                <button
                  type="button"
                  className={styles.cardAdd}
                  style={{ color: color.ink }}
                  aria-label={`Agregar tarea a ${category.name}`}
                  onClick={() => openTask({ taskId: null, defaults: { categoryId: category.id } })}
                >
                  <IconPlus size={16} />
                </button>
              </header>

              {visible.length === 0 ? (
                <p className={styles.cardEmpty}>Sin tareas todavía</p>
              ) : (
                <ul className={styles.taskList}>
                  {visible.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      tint={color.soft}
                      dot={color.dot}
                      listName={category.name}
                    />
                  ))}
                </ul>
              )}
            </section>
          )
        })}

        {visibleUncategorized && visibleUncategorized.length > 0 ? (
          <section className={styles.card} style={{ backgroundColor: 'var(--surface-2)' }}>
            <header className={styles.cardHeader}>
              <span className={styles.cardTitle}>
                Sin categoría
                <span className={styles.cardCount}>{visibleUncategorized.length}</span>
              </span>
            </header>
            <ul className={styles.taskList}>
              {visibleUncategorized.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  tint="var(--surface)"
                  dot="var(--ink-faint)"
                  listName={null}
                />
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </div>
  )
}

/** Tarjeta con mas detalle que la fila de Hoy: urgencia, deadline y progreso de subtareas. */
function TaskCard({
  task,
  tint,
  dot,
  listName,
}: {
  task: Task
  tint: string
  dot: string
  listName: string | null
}) {
  const { openTask } = useModals()
  const updateTask = useUpdateTask()
  const doneSubtasks = task.subtasks.filter((subtask) => subtask.done).length

  return (
    <li className={styles.task} style={{ backgroundColor: tint }}>
      <div className={styles.taskMain}>
        <StatusToggle
          size="sm"
          status={task.status}
          onChange={(status) => updateTask.mutate({ id: task.id, patch: { status } })}
        />
        <button type="button" className={styles.taskTitle} onClick={() => openTask({ taskId: task.id })}>
          <span className={task.status === 'hecha' ? styles.done : undefined}>{task.title}</span>
          <TaskListLabel listName={listName} />
        </button>
        {task.inToday ? (
          <span className={styles.inToday} style={{ background: dot }} title="En Hoy">
            <IconSun size={11} />
          </span>
        ) : null}
      </div>

      {(() => {
        const preview = richTextExcerpt(task.description, 160)
        return preview ? <p className={styles.taskDescription}>{preview}</p> : null
      })()}

      <div className={styles.meta}>
        <span
          className={`${styles.badge} ${styles[`urgency_${task.urgency}`]}`}
          title={URGENCY_LABEL[task.urgency]}
          aria-label={`Urgencia ${URGENCY_LABEL[task.urgency]}`}
        >
          <IconFlag size={11} />
        </span>
        {task.deadline ? (
          <span className={styles.badge}>
            <IconCalendar size={11} />
            {formatShortDate(task.deadline)}
          </span>
        ) : null}
        {task.subtasks.length > 0 ? (
          <span className={styles.badge} title="Subtareas">
            <IconList size={11} />
            {doneSubtasks}/{task.subtasks.length}
          </span>
        ) : null}
        {task.attachments.length > 0 ? (
          <span className={styles.badge} title="Adjuntos">
            <IconPaperclip size={11} />
            {task.attachments.length}
          </span>
        ) : null}
      </div>
    </li>
  )
}
