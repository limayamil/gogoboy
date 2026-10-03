import { isExpiredCompleted } from '../../src/shared/expiry.ts'
import type { AppState, Proposal, Task } from '../../src/shared/types.ts'
import type { ProposalInput, ProposalPatch } from './validate.ts'
import { parseProposalCreate, parseProposalPatch, uuid } from './validate.ts'

export interface McpClock {
  today: string
  week: string[]
}

/** Escritura chica: el token de agente no toca tareas ni categorias. */
export interface ProposalStore {
  upsert(input: ProposalInput): Promise<{ proposal: Proposal; creada: boolean }>
  update(id: string, patch: ProposalPatch): Promise<Proposal | null>
  discard(id: string): Promise<boolean>
}

export interface McpToolDef {
  name: string
  description: string
  inputSchema: {
    type: 'object'
    properties: Record<string, unknown>
    required?: string[]
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
  {
    name: 'categorias',
    description: 'Id y nombre de las categorias que ya existen. Consultala antes de sugerir una.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'propuestas',
    description: 'Propuestas pendientes de la bandeja, mas nuevas primero. No son tareas.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'proponer',
    description:
      'Crea una propuesta, o actualiza la pendiente si origenClave ya existe. No crea tareas ni categorias. categoryId solo si la viste en categorias.',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        description: { type: 'string' },
        urgency: { type: 'string', enum: ['baja', 'media', 'alta'] },
        deadline: { type: 'string', description: 'YYYY-MM-DD, o null' },
        categoryName: { type: 'string', description: 'Nombre sugerido, exista o no la categoria' },
        categoryId: { type: 'string', description: 'Solo si la categoria ya existe' },
        origen: { type: 'string', description: 'De donde sale: gmail, x, chat' },
        origenUrl: { type: 'string' },
        origenClave: { type: 'string', description: 'Si se repite, pisa la propuesta pendiente' },
      },
      required: ['title'],
      additionalProperties: false,
    },
  },
  {
    name: 'actualizar_propuesta',
    description: 'Patch de una propuesta pendiente por id. Solo las claves presentes. 404 si no esta.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        title: { type: 'string' },
        description: { type: 'string' },
        urgency: { type: 'string', enum: ['baja', 'media', 'alta'] },
        deadline: { type: 'string' },
        categoryName: { type: 'string' },
        categoryId: { type: 'string' },
        origen: { type: 'string' },
        origenUrl: { type: 'string' },
        origenClave: { type: 'string' },
      },
      required: ['id'],
      additionalProperties: false,
    },
  },
  {
    name: 'descartar_propuesta',
    description: 'Borra una propuesta pendiente por id. No crea tarea ni categoria. 404 si no esta.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
      },
      required: ['id'],
      additionalProperties: false,
    },
  },
]

export function listTools(): McpToolDef[] {
  return TOOLS
}

const WRITE_TOOLS = new Set(['proponer', 'actualizar_propuesta', 'descartar_propuesta'])

export function isProposalWriteTool(name: string): boolean {
  return WRITE_TOOLS.has(name)
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
    case 'categorias':
      return projectCategorias(app)
    case 'propuestas':
      return projectPropuestas(app)
    default:
      throw new Error(`Herramienta desconocida: ${name}`)
  }
}

/** Las de escritura no leen el AppState: pisan o borran en la base. */
export async function callProposalTool(
  name: string,
  args: Record<string, unknown>,
  store: ProposalStore,
): Promise<unknown> {
  switch (name) {
    case 'proponer':
      return store.upsert(parseProposalCreate(args))
    case 'actualizar_propuesta': {
      const id = uuid(args.id, 'id')
      const proposal = await store.update(id, parseProposalPatch(args))
      if (!proposal) throw new Error('Propuesta no encontrada')
      return { proposal }
    }
    case 'descartar_propuesta': {
      const id = uuid(args.id, 'id')
      const removed = await store.discard(id)
      if (!removed) throw new Error('Propuesta no encontrada')
      return { ok: true }
    }
    default:
      throw new Error(`Herramienta desconocida: ${name}`)
  }
}

function projectCategorias(app: AppState) {
  return {
    categories: [...app.categories]
      .sort((a, b) => a.position - b.position || a.name.localeCompare(b.name, 'es'))
      .map((item) => ({ id: item.id, name: item.name })),
  }
}

function projectPropuestas(app: AppState) {
  const proposals = [...app.proposals].sort(
    (a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id),
  )
  return {
    proposals: proposals.map((item) => ({
      id: item.id,
      title: item.title,
      description: item.description,
      urgency: item.urgency,
      deadline: item.deadline,
      categoryName: item.categoryName,
      categoryId: item.categoryId,
      origen: item.origen,
      origenUrl: item.origenUrl,
      origenClave: item.origenClave,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    })),
  }
}

function projectHoy(app: AppState, today: string) {
  // Mediodia UTC cae en el mismo dia calendario de Argentina: el vencimiento
  // usa el "hoy" del reloj del MCP, no el UTC del host.
  const now = new Date(`${today}T12:00:00Z`)
  const tasks = app.tasks
    .filter((item) => item.inToday && !item.hiddenInToday && !isExpiredCompleted(item, now))
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
