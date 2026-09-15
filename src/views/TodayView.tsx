import { useMemo, useState } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCenter,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useModals } from '../app/modals'
import { ErrorState, LoadingState } from '../components/Feedback'
import { StatusToggle } from '../components/StatusToggle'
import {
  IconChevronDown,
  IconEye,
  IconEyeOff,
  IconFolder,
  IconPlus,
  IconSun,
} from '../components/Icons'
import { celebrateFromPointer, shouldCelebrateChecked } from '../lib/confetti'
import { formatTodayHeading } from '../lib/dates'
import { useColorOf } from '../lib/palette'
import { useAppState, useReorderToday, useUpdateSubtask, useUpdateTask } from '../lib/store'
import { nextTodayPositions } from '../lib/today-order'
import type { Category, Task } from '../shared/types'
import styles from './TodayView.module.css'

const TODAY_ZONE = 'zona-hoy'
const RAIL_ZONE = 'zona-listas'

export function TodayView() {
  const { data, isPending, error } = useAppState()
  const { openTask, openCategory } = useModals()
  const updateTask = useUpdateTask()
  const reorderToday = useReorderToday()

  const colorOf = useColorOf()
  const [showHidden, setShowHidden] = useState(false)
  const [dragging, setDragging] = useState<Task | null>(null)

  // Un drag recien arranca despues de 6px: asi un click simple sigue abriendo el modal.
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  const tasks = data?.tasks ?? []
  const categories = data?.categories ?? []

  const todayTasks = useMemo(
    () =>
      tasks
        .filter((task) => task.inToday && (showHidden || !task.hiddenInToday))
        .sort((a, b) => (a.todayPosition ?? 0) - (b.todayPosition ?? 0)),
    [tasks, showHidden],
  )

  const hiddenCount = tasks.filter((t) => t.inToday && t.hiddenInToday).length
  const uncategorized = tasks.filter((t) => t.categoryId === null)

  function handleDragStart(event: DragStartEvent) {
    setDragging(tasks.find((task) => task.id === event.active.id) ?? null)
  }

  function handleDragEnd(event: DragEndEvent) {
    setDragging(null)
    const overId = event.over?.id
    const task = tasks.find((t) => t.id === event.active.id)
    if (!task || overId == null) return
    const over = String(overId)

    // Soltar en las listas saca la tarea de Hoy; sigue viviendo en su categoria.
    if (over === RAIL_ZONE) {
      if (task.inToday) updateTask.mutate({ id: task.id, patch: { inToday: false } })
      return
    }

    if (!task.inToday) {
      if (over === TODAY_ZONE || todayTasks.some((item) => item.id === over)) {
        updateTask.mutate({ id: task.id, patch: { inToday: true, hiddenInToday: false } })
      }
      return
    }

    if (over === TODAY_ZONE) return

    const orderedIds = tasks
      .filter((item) => item.inToday)
      .sort((a, b) => (a.todayPosition ?? 0) - (b.todayPosition ?? 0))
      .map((item) => item.id)
    const positions = nextTodayPositions(orderedIds, task.id, over)
    if (positions) reorderToday.mutate(positions)
  }

  const collisionDetection = makeTodayCollision(new Set(todayTasks.map((task) => task.id)))

  if (isPending) return <LoadingState />
  if (error) return <ErrorState error={error} />

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className={`${styles.layout} pageEnter`}>
        <TodayPanel
          tasks={todayTasks}
          categories={categories}
          hiddenCount={hiddenCount}
          showHidden={showHidden}
          onToggleHidden={() => setShowHidden((value) => !value)}
        />

        <Rail
          categories={categories}
          tasks={tasks}
          uncategorized={uncategorized}
          onAddCategory={() => openCategory(null)}
          onAddTask={(categoryId) => openTask({ taskId: null, defaults: { categoryId } })}
        />
      </div>

      <DragOverlay dropAnimation={null}>
        {dragging ? (
          <div className={styles.ghost}>
            <span
              className={styles.dot}
              style={{ background: colorOf(categoryColorKey(categories, dragging)).dot }}
            />
            {dragging.title}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}

function categoryColorKey(categories: Category[], task: Task): string | null {
  return categories.find((c) => c.id === task.categoryId)?.colorKey ?? null
}

/**
 * Si estamos reordenando Hoy, una fila gana sobre el panel entero.
 * Si traemos desde las listas, el panel es el destino: si no, las filas se
 * apartarian como si insertaramos ahi, pero la tarea siempre entra al final.
 */
function makeTodayCollision(todayIds: Set<string>): CollisionDetection {
  return (args) => {
    const pointerHits = pointerWithin(args)
    const draggingToday = todayIds.has(String(args.active.id))

    if (draggingToday) {
      const itemHit = pointerHits.find((hit) => hit.id !== TODAY_ZONE && hit.id !== RAIL_ZONE)
      if (itemHit) return [itemHit]
      if (pointerHits.length > 0) return pointerHits
      return closestCenter(args)
    }

    const zone = pointerHits.find((hit) => hit.id === TODAY_ZONE || hit.id === RAIL_ZONE)
    if (zone) return [zone]
    return pointerHits.length > 0 ? pointerHits : closestCenter(args)
  }
}

// --- Panel de Hoy ---------------------------------------------------------

function TodayPanel({
  tasks,
  categories,
  hiddenCount,
  showHidden,
  onToggleHidden,
}: {
  tasks: Task[]
  categories: Category[]
  hiddenCount: number
  showHidden: boolean
  onToggleHidden: () => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: TODAY_ZONE })
  const today = formatTodayHeading(new Date())

  return (
    <section
      ref={setNodeRef}
      className={`${styles.today} ${isOver ? styles.todayOver : ''}`}
      aria-label="Tareas de hoy"
    >
      <header className={styles.todayHeader}>
        <div>
          <h1 className={styles.todayTitle}>
            <IconSun size={22} />
            Hoy
          </h1>
          <p className={styles.todayDate}>{today}</p>
        </div>

        {hiddenCount > 0 ? (
          <button type="button" className={styles.hiddenToggle} onClick={onToggleHidden}>
            {showHidden ? <IconEyeOff size={16} /> : <IconEye size={16} />}
            {showHidden ? 'Ocultar' : `Ver ${hiddenCount} oculta(s)`}
          </button>
        ) : null}
      </header>

      {tasks.length === 0 ? (
        <div className={styles.dropHint}>
          <img
            className={styles.emptyIllustration}
            src="/images/empty-today.webp"
            alt=""
            width="560"
            height="373"
          />
          <p className={styles.dropHintTitle}>Todavía no hay nada para hoy</p>
          <p className={styles.dropHintText}>
            <span className={styles.hintDesktop}>
              Arrastrá una tarea desde las listas de al costado, o creá una con el botón +.
            </span>
            <span className={styles.hintMobile}>
              Arrastrá una tarea desde las listas de abajo, o creá una con el botón +.
            </span>
          </p>
        </div>
      ) : (
        <SortableContext items={tasks.map((task) => task.id)} strategy={verticalListSortingStrategy}>
          <ul className={`${styles.todayList} stagger`}>
            {tasks.map((task) => (
              <TodayRow key={task.id} task={task} categories={categories} />
            ))}
          </ul>
        </SortableContext>
      )}
    </section>
  )
}

/** Fila de Hoy: solo titulo, color de categoria y status, como pide el boceto. */
function TodayRow({ task, categories }: { task: Task; categories: Category[] }) {
  const { openTask } = useModals()
  const updateTask = useUpdateTask()
  const color = useColorOf()(categoryColorKey(categories, task))
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
  })

  return (
    <li
      ref={setNodeRef}
      className={`${styles.todayRow} ${isDragging ? styles.dragging : ''} ${
        task.hiddenInToday ? styles.rowHidden : ''
      }`}
      style={{
        background: color.soft,
        borderColor: color.bg,
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      {...attributes}
      {...listeners}
    >
      <span className={styles.rowBar} style={{ background: color.dot }} />

      <StatusToggle
        status={task.status}
        onChange={(status) => updateTask.mutate({ id: task.id, patch: { status } })}
      />

      <button type="button" className={styles.rowTitle} onClick={() => openTask({ taskId: task.id })}>
        <span className={task.status === 'hecha' ? styles.rowDone : undefined}>{task.title}</span>
      </button>

      <button
        type="button"
        className={styles.rowEye}
        title={task.hiddenInToday ? 'Volver a mostrar en Hoy' : 'Ocultar de Hoy'}
        aria-label={task.hiddenInToday ? 'Volver a mostrar en Hoy' : 'Ocultar de Hoy'}
        onClick={(event) => {
          event.stopPropagation()
          updateTask.mutate({ id: task.id, patch: { hiddenInToday: !task.hiddenInToday } })
        }}
      >
        {task.hiddenInToday ? <IconEyeOff size={16} /> : <IconEye size={16} />}
      </button>
    </li>
  )
}

// --- Columna de listas ----------------------------------------------------

function Rail({
  categories,
  tasks,
  uncategorized,
  onAddCategory,
  onAddTask,
}: {
  categories: Category[]
  tasks: Task[]
  uncategorized: Task[]
  onAddCategory: () => void
  onAddTask: (categoryId: string | null) => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: RAIL_ZONE })

  return (
    <aside ref={setNodeRef} className={`${styles.rail} ${isOver ? styles.railOver : ''}`}>
      <header className={styles.railHeader}>
        <h2 className={styles.railTitle}>Listas</h2>
        <button type="button" className={styles.railAdd} onClick={onAddCategory}>
          <IconPlus size={15} />
          Categoría
        </button>
      </header>

      {categories.length === 0 && uncategorized.length === 0 ? (
        <p className={styles.railEmpty}>
          <IconFolder size={18} />
          Creá tu primera categoría para empezar a juntar tareas.
        </p>
      ) : null}

      {categories.map((category) => (
        <CategoryGroup
          key={category.id}
          name={category.name}
          colorKey={category.colorKey}
          tasks={tasks.filter((task) => task.categoryId === category.id)}
          onAddTask={() => onAddTask(category.id)}
        />
      ))}

      {uncategorized.length > 0 ? (
        <CategoryGroup
          name="Sin categoría"
          colorKey={null}
          tasks={uncategorized}
          onAddTask={() => onAddTask(null)}
        />
      ) : null}
    </aside>
  )
}

function CategoryGroup({
  name,
  colorKey,
  tasks,
  onAddTask,
}: {
  name: string
  colorKey: string | null
  tasks: Task[]
  onAddTask: () => void
}) {
  const [open, setOpen] = useState(true)
  const color = useColorOf()(colorKey)
  const pending = tasks.filter((task) => task.status !== 'hecha').length

  return (
    <section className={styles.group} style={{ background: color.bg }}>
      <header className={styles.groupHeader}>
        <button
          type="button"
          className={styles.groupToggle}
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          style={{ color: color.ink }}
        >
          <IconChevronDown size={16} className={open ? undefined : styles.chevronClosed} />
          {name}
          <span className={styles.groupCount}>{pending}</span>
        </button>

        <button
          type="button"
          className={styles.groupAdd}
          onClick={onAddTask}
          aria-label={`Agregar tarea a ${name}`}
          style={{ color: color.ink }}
        >
          <IconPlus size={15} />
        </button>
      </header>

      <div className={`${styles.groupBody} ${open ? styles.groupBodyOpen : ''}`}>
        <div>
          <ul className={styles.groupList}>
            {tasks.length === 0 ? <li className={styles.groupEmpty}>Sin tareas</li> : null}
            {tasks.map((task) => (
              <RailTask key={task.id} task={task} tint={color.soft} dot={color.dot} />
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}

function RailTask({ task, tint, dot }: { task: Task; tint: string; dot: string }) {
  const { openTask } = useModals()
  const updateTask = useUpdateTask()
  const updateSubtask = useUpdateSubtask()
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: task.id })

  return (
    <li
      ref={setNodeRef}
      className={`${styles.railTask} ${isDragging ? styles.dragging : ''}`}
      style={{ background: tint }}
      {...attributes}
      {...listeners}
    >
      <div className={styles.railTaskMain}>
        <StatusToggle
          size="sm"
          status={task.status}
          onChange={(status) => updateTask.mutate({ id: task.id, patch: { status } })}
        />
        <button
          type="button"
          className={styles.railTaskTitle}
          onClick={() => openTask({ taskId: task.id })}
        >
          <span className={task.status === 'hecha' ? styles.rowDone : undefined}>{task.title}</span>
        </button>
        {task.inToday ? (
          <span className={styles.inToday} style={{ background: dot }} title="Ya está en Hoy">
            <IconSun size={11} />
          </span>
        ) : null}
      </div>

      {task.subtasks.length > 0 ? (
        <ul className={styles.subtasks}>
          {task.subtasks.map((subtask) => (
            <li key={subtask.id} className={styles.subtask}>
              <label className={styles.subtaskLabel}>
                <input
                  type="checkbox"
                  className={styles.subtaskCheck}
                  checked={subtask.done}
                  onPointerDown={(event) => event.stopPropagation()}
                  onChange={(event) => {
                    if (shouldCelebrateChecked(event.target.checked)) celebrateFromPointer()
                    updateSubtask.mutate({ id: subtask.id, patch: { done: event.target.checked } })
                  }}
                />
                <span className={subtask.done ? styles.rowDone : undefined}>{subtask.title}</span>
              </label>
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  )
}
