import { useMemo, useState } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { useModals } from '../app/modals'
import { ErrorState, LoadingState } from '../components/Feedback'
import { StatusToggle } from '../components/StatusToggle'
import { IconCalendar, IconChevronLeft, IconChevronRight } from '../components/Icons'
import { useColorOf } from '../lib/palette'
import {
  DAY_NAMES,
  addDays,
  formatDayNumber,
  formatWeekRange,
  todayKey,
  weekKeys,
} from '../lib/dates'
import { useAppState, useUpdateTask } from '../lib/store'
import type { Category, Task } from '../shared/types'
import styles from './WeekView.module.css'

/** Semana de lunes a domingo. Solo aparecen las tareas que tienen deadline. */
export function WeekView() {
  const { data, isPending, error } = useAppState()
  const updateTask = useUpdateTask()

  const [anchor, setAnchor] = useState(() => new Date())
  const [dragging, setDragging] = useState<Task | null>(null)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  const tasks = data?.tasks ?? []
  const categories = data?.categories ?? []
  const days = useMemo(() => weekKeys(anchor), [anchor])

  const byDay = useMemo(() => {
    const map = new Map<string, Task[]>(days.map((day) => [day, []]))
    for (const task of tasks) {
      if (task.deadline && map.has(task.deadline)) map.get(task.deadline)!.push(task)
    }
    return map
  }, [tasks, days])

  const withoutDeadline = tasks.filter((task) => !task.deadline && task.status !== 'hecha').length
  const weekTaskCount = days.reduce((total, day) => total + (byDay.get(day)?.length ?? 0), 0)

  function handleDragEnd(event: DragEndEvent) {
    setDragging(null)
    const day = event.over?.id
    const task = tasks.find((t) => t.id === event.active.id)
    // Soltar en otra columna es, literalmente, mover el deadline a ese dia.
    if (task && typeof day === 'string' && task.deadline !== day) {
      updateTask.mutate({ id: task.id, patch: { deadline: day } })
    }
  }

  function handleDragStart(event: DragStartEvent) {
    setDragging(tasks.find((task) => task.id === event.active.id) ?? null)
  }

  if (isPending) return <LoadingState />
  if (error) return <ErrorState error={error} />

  return (
    <div className={`${styles.page} pageEnter`}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>
            <IconCalendar size={22} />
            Semana
          </h1>
          <p className={styles.subtitle}>
            {formatWeekRange(anchor)}
            {withoutDeadline > 0 ? ` · ${withoutDeadline} tarea(s) sin fecha límite no se ven acá` : ''}
          </p>
        </div>

        <div className={styles.nav}>
          <button
            type="button"
            className={styles.navButton}
            onClick={() => setAnchor((date) => addDays(date, -7))}
            aria-label="Semana anterior"
          >
            <IconChevronLeft size={18} />
          </button>
          <button type="button" className={styles.navToday} onClick={() => setAnchor(new Date())}>
            Esta semana
          </button>
          <button
            type="button"
            className={styles.navButton}
            onClick={() => setAnchor((date) => addDays(date, 7))}
            aria-label="Semana siguiente"
          >
            <IconChevronRight size={18} />
          </button>
        </div>
      </header>

      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        {weekTaskCount === 0 ? (
          <div className={styles.weekEmpty}>
            <img
              className={styles.weekEmptyIllustration}
              src="/images/empty-week.webp"
              alt=""
              width="760"
              height="507"
            />
            <div>
              <p className={styles.weekEmptyTitle}>Una semana con espacio</p>
              <p className={styles.weekEmptyText}>
                Las tareas con fecha límite van a aparecer en el día que les corresponda.
              </p>
            </div>
          </div>
        ) : null}

        <div className={`${styles.grid} stagger`}>
          {days.map((day, index) => (
            <DayColumn
              key={day}
              dayKey={day}
              label={DAY_NAMES[index]}
              tasks={byDay.get(day) ?? []}
              categories={categories}
            />
          ))}
        </div>

        <DragOverlay dropAnimation={null}>
          {dragging ? <div className={styles.ghost}>{dragging.title}</div> : null}
        </DragOverlay>
      </DndContext>
    </div>
  )
}

function DayColumn({
  dayKey,
  label,
  tasks,
  categories,
}: {
  dayKey: string
  label: string
  tasks: Task[]
  categories: Category[]
}) {
  const { setNodeRef, isOver } = useDroppable({ id: dayKey })
  const isToday = dayKey === todayKey()

  return (
    <section
      ref={setNodeRef}
      className={`${styles.day} ${isOver ? styles.dayOver : ''} ${isToday ? styles.dayToday : ''}`}
    >
      <header className={styles.dayHeader}>
        <span className={styles.dayName}>{label}</span>
        <span className={styles.dayNumber}>{formatDayNumber(dayKey)}</span>
      </header>

      <ul className={styles.dayList}>
        {tasks.map((task) => (
          <WeekCard key={task.id} task={task} categories={categories} />
        ))}
      </ul>
    </section>
  )
}

/** Tarjeta de semana: titulo, categoria e indicador visual de status. */
function WeekCard({ task, categories }: { task: Task; categories: Category[] }) {
  const { openTask } = useModals()
  const updateTask = useUpdateTask()
  const category = categories.find((c) => c.id === task.categoryId)
  const color = useColorOf()(category?.colorKey)
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: task.id })

  return (
    <li
      ref={setNodeRef}
      className={`${styles.card} ${isDragging ? styles.dragging : ''}`}
      style={{ background: color.soft, borderLeftColor: color.dot }}
      {...attributes}
      {...listeners}
    >
      <div className={styles.cardTop}>
        <StatusToggle
          size="sm"
          status={task.status}
          onChange={(status) => updateTask.mutate({ id: task.id, patch: { status } })}
        />
        <button type="button" className={styles.cardTitle} onClick={() => openTask({ taskId: task.id })}>
          <span className={task.status === 'hecha' ? styles.done : undefined}>{task.title}</span>
        </button>
      </div>

      {category ? (
        <span className={styles.cardCategory} style={{ background: color.bg, color: color.ink }}>
          {category.name}
        </span>
      ) : null}
    </li>
  )
}
