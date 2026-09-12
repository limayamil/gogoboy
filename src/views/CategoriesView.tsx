import { useModals } from '../app/modals'
import { ErrorState, LoadingState } from '../components/Feedback'
import { StatusToggle } from '../components/StatusToggle'
import {
  IconCalendar,
  IconFlag,
  IconGrid,
  IconList,
  IconPaperclip,
  IconPlus,
  IconSun,
} from '../components/Icons'
import { useColorOf } from '../lib/palette'
import { formatShortDate } from '../lib/dates'
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

  if (isPending) return <LoadingState />
  if (error) return <ErrorState error={error} />

  const categories = data?.categories ?? []
  const tasks = data?.tasks ?? []
  const uncategorized = tasks.filter((task) => task.categoryId === null)

  return (
    <div className={`${styles.page} pageEnter`}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>
            <IconGrid size={22} />
            Categorías
          </h1>
          <p className={styles.subtitle}>Todo lo que tenés anotado, ordenado por color.</p>
        </div>
        <button type="button" className={styles.newCategory} onClick={() => openCategory(null)}>
          <IconPlus size={16} />
          Nueva categoría
        </button>
      </header>

      {categories.length === 0 && uncategorized.length === 0 ? (
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
          return (
            <section key={category.id} className={styles.card} style={{ background: color.bg }}>
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

              {own.length === 0 ? (
                <p className={styles.cardEmpty}>Sin tareas todavía</p>
              ) : (
                <ul className={styles.taskList}>
                  {own.map((task) => (
                    <TaskCard key={task.id} task={task} tint={color.soft} dot={color.dot} />
                  ))}
                </ul>
              )}
            </section>
          )
        })}

        {uncategorized.length > 0 ? (
          <section className={styles.card} style={{ background: 'var(--surface-2)' }}>
            <header className={styles.cardHeader}>
              <span className={styles.cardTitle}>
                Sin categoría
                <span className={styles.cardCount}>{uncategorized.length}</span>
              </span>
            </header>
            <ul className={styles.taskList}>
              {uncategorized.map((task) => (
                <TaskCard key={task.id} task={task} tint="var(--surface)" dot="var(--ink-faint)" />
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </div>
  )
}

/** Tarjeta con mas detalle que la fila de Hoy: urgencia, deadline y progreso de subtareas. */
function TaskCard({ task, tint, dot }: { task: Task; tint: string; dot: string }) {
  const { openTask } = useModals()
  const updateTask = useUpdateTask()
  const doneSubtasks = task.subtasks.filter((subtask) => subtask.done).length

  return (
    <li className={styles.task} style={{ background: tint }}>
      <div className={styles.taskMain}>
        <StatusToggle
          size="sm"
          status={task.status}
          onChange={(status) => updateTask.mutate({ id: task.id, patch: { status } })}
        />
        <button type="button" className={styles.taskTitle} onClick={() => openTask({ taskId: task.id })}>
          <span className={task.status === 'hecha' ? styles.done : undefined}>{task.title}</span>
        </button>
        {task.inToday ? (
          <span className={styles.inToday} style={{ background: dot }} title="En Hoy">
            <IconSun size={11} />
          </span>
        ) : null}
      </div>

      {task.description ? <p className={styles.taskDescription}>{task.description}</p> : null}

      <div className={styles.meta}>
        <span className={`${styles.badge} ${styles[`urgency_${task.urgency}`]}`}>
          <IconFlag size={11} />
          {URGENCY_LABEL[task.urgency]}
        </span>
        {task.deadline ? (
          <span className={styles.badge}>
            <IconCalendar size={11} />
            {formatShortDate(task.deadline)}
          </span>
        ) : null}
        {task.subtasks.length > 0 ? (
          <span className={styles.badge}>
            <IconList size={11} />
            {doneSubtasks}/{task.subtasks.length}
          </span>
        ) : null}
        {task.attachments.length > 0 ? (
          <span className={styles.badge}>
            <IconPaperclip size={11} />
            {task.attachments.length} adjuntos
          </span>
        ) : null}
      </div>
    </li>
  )
}
