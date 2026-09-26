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
import { IconChevronLeft, IconChevronRight, IconEye, IconEyeOff } from '../components/Icons'
import { useColorOf } from '../lib/palette'
import {
  DAY_NAMES,
  addDays,
  formatDayNumber,
  formatShortDate,
  formatWeekRange,
  todayKey,
  weekKeys,
} from '../lib/dates'
import { useAppState, useUpdateTask } from '../lib/store'
import { toastUndo } from '../lib/toast'
import type { Category, Task } from '../shared/types'
import styles from './WeekView.module.css'

/** Semana de lunes a domingo. Solo aparecen las tareas que tienen deadline. */
export function WeekView() {
  const { data, isPending, error } = useAppState()
  const updateTask = useUpdateTask()

  const [anchor, setAnchor] = useState(() => new Date())
  const [dragging, setDragging] = useState<Task | null>(null)
  const [showWeekend, setShowWeekend] = useState(false)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  const tasks = data?.tasks ?? []
  const categories = data?.categories ?? []
  const days = useMemo(() => weekKeys(anchor), [anchor])
  const visibleDays = showWeekend ? days : days.slice(0, 5)

  const byDay = useMemo(() => {
    const map = new Map<string, Task[]>(days.map((day) => [day, []]))
    for (const task of tasks) {
      if (task.deadline && map.has(task.deadline)) map.get(task.deadline)!.push(task)
    }
    return map
  }, [tasks, days])

  const withoutDeadline = tasks.filter((task) => !task.deadline && task.status !== 'hecha').length
  const visibleTaskCount = visibleDays.reduce(
    (total, day) => total + (byDay.get(day)?.length ?? 0),
    0,
  )

  function handleDragEnd(event: DragEndEvent) {
    setDragging(null)
    const day = event.over?.id
    const task = tasks.find((t) => t.id === event.active.id)
    // Soltar en otra columna es, literalmente, mover el deadline a ese dia.
    if (task && typeof day === 'string' && task.deadline !== day) {
      const previous = task.deadline
      updateTask.mutate({ id: task.id, patch: { deadline: day } })
      // La columna destino puede quedar fuera de pantalla: el aviso confirma adonde
      // fue, y deja volver atras sin tener que buscar la tarjeta.
      toastUndo(`“${task.title}” pasó al ${formatShortDate(day)}`, () => {
        updateTask.mutate({ id: task.id, patch: { deadline: previous } })
      })
    }
  }

  function handleDragStart(event: DragStartEvent) {
    setDragging(tasks.find((task) => task.id === event.active.id) ?? null)
  }

  return (
    <div className={`${styles.page} pageEnter`}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>{formatWeekRange(anchor)}</h1>
          {withoutDeadline > 0 ? (
            <p className={styles.subtitle}>{withoutDeadline} sin fecha límite no se ven acá</p>
          ) : null}
        </div>

        <div className={styles.headerActions}>
          <button
            type="button"
            className={`${styles.weekendToggle} ${showWeekend ? styles.weekendToggleActive : ''}`}
            onClick={() => setShowWeekend((visible) => !visible)}
            aria-expanded={showWeekend}
            aria-controls="week-grid"
            title={showWeekend ? 'Ocultar fin de semana' : 'Ver fin de semana'}
            aria-label={showWeekend ? 'Ocultar fin de semana' : 'Ver fin de semana'}
          >
            {showWeekend ? <IconEyeOff size={18} /> : <IconEye size={18} />}
            <span className={styles.weekendLabel}>Fin de semana</span>
          </button>

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
        </div>
      </header>

      {/* El encabezado y la navegacion no dependen de los datos: solo se reemplaza el cuerpo. */}
      {isPending ? <LoadingState /> : null}
      {error ? <ErrorState error={error} /> : null}

      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        {visibleTaskCount === 0 && !isPending && !error ? (
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

        <div
          id="week-grid"
          className={`${styles.grid} ${showWeekend ? styles.gridWithWeekend : ''} stagger`}
        >
          {visibleDays.map((day, index) => (
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
  const { listeners, setNodeRef, isDragging } = useDraggable({ id: task.id })

  return (
    <li
      ref={setNodeRef}
      className={`${styles.card} ${isDragging ? styles.dragging : ''}`}
      style={{ backgroundColor: color.soft }}
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
        <span className={styles.cardCategory} style={{ backgroundColor: color.bg, color: color.ink }}>
          {category.name}
        </span>
      ) : null}
    </li>
  )
}
