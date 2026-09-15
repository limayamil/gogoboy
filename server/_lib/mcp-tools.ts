import type { AppState, Task } from '../../src/shared/types.ts'

export interface McpClock {
  today: string
  week: string[]
}

export interface McpToolDef {
  name: string
  description: string
  inputSchema: {
    type: 'object'
    properties: Record<string, unknown>
    additionalProperties: false
  }
}

type AgentTask = {
  id: string
  title: string
  status: Task['status']
  urgency: Task['urgency']
  deadline: string | null
  inToday: boolean
  category: string | null
  description: string | null
  notes: string | null
  subtasksDone: number
  subtasksTotal: number
  links: { title: string | null; url: string }[]
}

const TOOLS: McpToolDef[] = [
  {
    name: 'hoy',
    description:
      'Tareas visibles de Hoy (sin las ocultas con el ojito) y quick tasks pendientes.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'semana',
    description:
      'Tareas con deadline en la semana actual (lunes a domingo), agrupadas por dia.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'tareas',
    description: 'Lista tareas. Filtros opcionales: texto (q), status y nombre o id de categoria.',
    inputSchema: {
      type: 'object',
      properties: {
        q: { type: 'string', description: 'Texto a buscar en el titulo' },
        status: { type: 'string', enum: ['pendiente', 'en_progreso', 'hecha'] },
        category: { type: 'string', description: 'Nombre o id de categoria' },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'notas',
    description:
      'Notas de texto. Nunca incluye notas tipo password ni campos de usuario/clave.',
    inputSchema: {
      type: 'object',
      properties: {
        q: { type: 'string', description: 'Texto a buscar en titulo o descripcion' },
      },
      additionalProperties: false,
    },
  },
]

export function listTools(): McpToolDef[] {
  return TOOLS
}

export function callTool(
  name: string,
  args: Record<string, unknown>,
  app: AppState,
  clock: McpClock,
): unknown {
  switch (name) {
    case 'hoy':
      return projectHoy(app, clock.today)
    case 'semana':
      return projectSemana(app, clock.week)
    case 'tareas':
      return { tasks: filterTasks(app, args).map((item) => summarizeTask(item, app)) }
    case 'notas':
      return { notes: filterNotes(app, args) }
    default:
      throw new Error(`Herramienta desconocida: ${name}`)
  }
}

function projectHoy(app: AppState, today: string) {
  const tasks = app.tasks
    .filter((item) => item.inToday && !item.hiddenInToday)
    .sort(byTodayOrder)
    .map((item) => summarizeTask(item, app))
  const quickTasks = app.quickTasks
    .filter((item) => !item.done)
    .map((item) => ({ id: item.id, title: item.title }))
  return { date: today, tasks, quickTasks }
}

function projectSemana(app: AppState, week: string[]) {
  const days = week
    .map((date) => ({
      date,
      tasks: app.tasks
        .filter((item) => item.deadline === date)
        .map((item) => summarizeTask(item, app)),
    }))
    .filter((day) => day.tasks.length > 0)

  return { week, days }
}

function filterTasks(app: AppState, args: Record<string, unknown>): Task[] {
  const q = stringArg(args.q)?.toLowerCase()
  const status = stringArg(args.status)
  const category = stringArg(args.category)?.toLowerCase()

  return app.tasks.filter((item) => {
    if (q && !item.title.toLowerCase().includes(q)) return false
    if (status && item.status !== status) return false
    if (category) {
      const name = categoryName(app, item.categoryId)?.toLowerCase()
      const id = item.categoryId?.toLowerCase()
      if (name !== category && id !== category) return false
    }
    return true
  })
}

function filterNotes(app: AppState, args: Record<string, unknown>) {
  const q = stringArg(args.q)?.toLowerCase()
  return app.notes
    .filter((item) => item.kind !== 'password')
    .filter((item) => {
      if (!q) return true
      return (
        item.title.toLowerCase().includes(q) || (item.description ?? '').toLowerCase().includes(q)
      )
    })
    .map((item) => ({
      id: item.id,
      title: item.title,
      description: item.description,
      tags: item.tags.map((tag) => tag.name),
      updatedAt: item.updatedAt,
    }))
}

function summarizeTask(item: Task, app: AppState): AgentTask {
  const done = item.subtasks.filter((sub) => sub.done).length
  return {
    id: item.id,
    title: item.title,
    status: item.status,
    urgency: item.urgency,
    deadline: item.deadline,
    inToday: item.inToday,
    category: categoryName(app, item.categoryId),
    description: item.description,
    notes: item.notes,
    subtasksDone: done,
    subtasksTotal: item.subtasks.length,
    links: item.links.map((link) => ({ title: link.title, url: link.url })),
  }
}

function categoryName(app: AppState, categoryId: string | null): string | null {
  if (!categoryId) return null
  return app.categories.find((item) => item.id === categoryId)?.name ?? null
}

function byTodayOrder(a: Task, b: Task): number {
  const left = a.todayPosition ?? a.position
  const right = b.todayPosition ?? b.position
  return left - right
}

function stringArg(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed || undefined
}
