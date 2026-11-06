import { useMemo, useState } from 'react'
import { useModals } from '../app/modals'
import { ErrorState, LoadingState } from '../components/Feedback'
import { IconChevronLeft, IconChevronRight } from '../components/Icons'
import { Modal } from '../components/Modal'
import { TaskListLabel } from '../components/TaskListLabel'
import { DAY_NAMES, formatDayNumber, formatTodayHeading, fromDateKey } from '../lib/dates'
import {
  calendarDayLabel,
  calendarMonthInZone,
  formatMonthTitle,
  groupTasksByDeadline,
  monthGrid,
  shiftMonth,
} from '../lib/month'
import { useColorOf } from '../lib/palette'
import { useAppState } from '../lib/store'
import type { Category, Status, Task } from '../shared/types'
import styles from './MonthView.module.css'

const STATUS_LABEL: Record<Status, string> = {
  pendiente: 'Pendiente',
  en_progreso: 'En progreso',
  hecha: 'Hecha',
}

/** Mes calendario. Cada tarea con fecha es una pastilla con el título. */
export function MonthView() {
  const { data, isPending, error } = useAppState()
  const [cursor, setCursor] = useState(() => {
    const { year, month } = calendarMonthInZone(new Date())
    return { year, month }
  })
  const [openDay, setOpenDay] = useState<string | null>(null)

  const tasks = data?.tasks ?? []
  const categories = data?.categories ?? []
  const colorOf = useColorOf()
  const today = calendarMonthInZone(new Date()).today
  const days = useMemo(() => monthGrid(cursor.year, cursor.month), [cursor])
  const byDay = useMemo(() => groupTasksByDeadline(tasks), [tasks])
  const withoutDeadline = tasks.filter((task) => !task.deadline && task.status !== 'hecha').length
  const title = formatMonthTitle(cursor.year, cursor.month)

  return (
    <div className={`${styles.page} pageEnter`}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>{title}</h1>
          <p className={styles.subtitle}>Tocá un día para ver sus tareas.</p>
          {withoutDeadline > 0 ? (
            <p className={styles.subtitle}>
              {withoutDeadline} sin fecha límite no se ven acá
            </p>
          ) : null}
        </div>

        <div className={styles.nav}>
          <button
            type="button"
            className={styles.navButton}
            onClick={() => setCursor((current) => shiftMonth(current.year, current.month, -1))}
            aria-label="Mes anterior"
          >
            <IconChevronLeft size={18} />
          </button>
          <button
            type="button"
            className={styles.navToday}
            onClick={() => {
              const { year, month } = calendarMonthInZone(new Date())
              setCursor({ year, month })
            }}
          >
            Este mes
          </button>
          <button
            type="button"
            className={styles.navButton}
            onClick={() => setCursor((current) => shiftMonth(current.year, current.month, 1))}
            aria-label="Mes siguiente"
          >
            <IconChevronRight size={18} />
          </button>
        </div>
      </header>

      {isPending ? <LoadingState /> : null}
      {error ? <ErrorState error={error} /> : null}

      <div className={styles.calendar}>
        <div className={styles.weekdays} aria-hidden="true">
          {DAY_NAMES.map((name) => (
            <span key={name}>{name}</span>
          ))}
        </div>
        <div className={styles.grid} role="group" aria-label={title}>
          {days.map((day) => {
            const dayTasks = byDay.get(day.key) ?? []
            const isToday = day.key === today
            return (
              <button
                key={day.key}
                type="button"
                className={`${styles.cell} ${day.inMonth ? '' : styles.outside} ${isToday ? styles.today : ''}`}
                aria-current={isToday ? 'date' : undefined}
                aria-label={calendarDayLabel(day.key, dayTasks.length)}
                onClick={() => setOpenDay(day.key)}
              >
                <span className={styles.number}>{formatDayNumber(day.key)}</span>
                {dayTasks.length > 0 ? (
                  <span className={styles.pills}>
                    {dayTasks.map((task) => {
                      const category = categories.find((item) => item.id === task.categoryId)
                      const color = colorOf(category?.colorKey)
                      return (
                        <span
                          key={task.id}
                          className={`${styles.pill} ${task.status === 'hecha' ? styles.pillDone : ''}`}
                          style={{ background: color.soft, color: color.ink }}
                          title={task.title}
                        >
                          {task.title}
                        </span>
                      )
                    })}
                  </span>
                ) : null}
              </button>
            )
          })}
        </div>
      </div>

      {openDay ? (
        <DayTasksModal
          dayKey={openDay}
          tasks={byDay.get(openDay) ?? []}
          categories={categories}
          onClose={() => setOpenDay(null)}
        />
      ) : null}
    </div>
  )
}

function DayTasksModal({
  dayKey,
  tasks,
  categories,
  onClose,
}: {
  dayKey: string
  tasks: Task[]
  categories: Category[]
  onClose: () => void
}) {
  const { openTask } = useModals()
  const colorOf = useColorOf()

  return (
    <Modal title={formatTodayHeading(fromDateKey(dayKey))} onClose={onClose}>
      {tasks.length === 0 ? (
        <p className={styles.empty}>Este día no tiene tareas con fecha límite.</p>
      ) : (
        <>
          <p className={styles.count}>{tasks.length === 1 ? 'Una tarea' : `${tasks.length} tareas`}</p>
          <ul className={styles.taskList}>
            {tasks.map((task) => {
              const category = categories.find((item) => item.id === task.categoryId)
              const color = colorOf(category?.colorKey)
              return (
                <li key={task.id}>
                  <button
                    type="button"
                    className={styles.task}
                    onClick={() => openTask({ taskId: task.id })}
                  >
                    <span className={styles.taskDot} style={{ background: color.dot }} />
                    <span className={styles.taskMain}>
                      <span className={task.status === 'hecha' ? styles.done : styles.taskTitle}>
                        {task.title}
                      </span>
                      <TaskListLabel listName={category?.name ?? null} />
                    </span>
                    <span className={styles.taskStatus}>{STATUS_LABEL[task.status]}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        </>
      )}
    </Modal>
  )
}
