import { neon } from '@neondatabase/serverless'
import type { Attachment, Category, QuickTask, Subtask, Task, TaskLink } from '../../src/shared/types.ts'

const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  throw new Error(
    'Falta DATABASE_URL. Copia .env.example a .env y pega la connection string de Neon.',
  )
}

export const sql = neon(connectionString)

// La base usa snake_case y el front camelCase; estos mappers son la unica frontera
// donde se traduce, para que ningun componente vea nombres de columnas.

type Row = Record<string, unknown>

/** Postgres devuelve `date` como Date; lo pasamos a 'YYYY-MM-DD' sin corrimiento de zona. */
function toDateString(value: unknown): string | null {
  if (value == null) return null
  if (value instanceof Date) {
    const y = value.getUTCFullYear()
    const m = String(value.getUTCMonth() + 1).padStart(2, '0')
    const d = String(value.getUTCDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }
  return String(value).slice(0, 10)
}

function toIso(value: unknown): string {
  return value instanceof Date ? value.toISOString() : String(value)
}

export function mapCategory(row: Row): Category {
  return {
    id: row.id as string,
    name: row.name as string,
    colorKey: row.color_key as string,
    position: Number(row.position),
    createdAt: toIso(row.created_at),
  }
}

export function mapSubtask(row: Row): Subtask {
  return {
    id: row.id as string,
    taskId: row.task_id as string,
    title: row.title as string,
    done: Boolean(row.done),
    position: Number(row.position),
  }
}

export function mapAttachment(row: Row): Attachment {
  return {
    id: row.id as string,
    taskId: row.task_id as string,
    objectKey: row.object_key as string,
    fileName: row.file_name as string,
    contentType: row.content_type as string,
    sizeBytes: Number(row.size_bytes),
    createdAt: toIso(row.created_at),
  }
}

export function mapTaskLink(row: Row): TaskLink {
  return {
    id: row.id as string,
    taskId: row.task_id as string,
    url: row.url as string,
    title: (row.title as string | null) ?? null,
    position: Number(row.position),
  }
}

export function mapQuickTask(row: Row): QuickTask {
  return {
    id: row.id as string,
    title: row.title as string,
    done: Boolean(row.done),
    position: Number(row.position),
    createdAt: toIso(row.created_at),
  }
}

export function mapTask(
  row: Row,
  subtasks: Subtask[] = [],
  attachments: Attachment[] = [],
  links: TaskLink[] = [],
): Task {
  return {
    id: row.id as string,
    categoryId: (row.category_id as string | null) ?? null,
    title: row.title as string,
    description: (row.description as string | null) ?? null,
    notes: (row.notes as string | null) ?? null,
    urgency: row.urgency as Task['urgency'],
    deadline: toDateString(row.deadline),
    status: row.status as Task['status'],
    inToday: Boolean(row.in_today),
    hiddenInToday: Boolean(row.hidden_in_today),
    todayPosition: row.today_position == null ? null : Number(row.today_position),
    position: Number(row.position),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
    completedAt: row.completed_at == null ? null : toIso(row.completed_at),
    subtasks,
    attachments,
    links,
  }
}

/** Trae una tarea completa (subtareas, adjuntos y links) ya mapeada, o null si no existe. */
export async function loadTask(id: string): Promise<Task | null> {
  const [task] = (await sql`select * from tasks where id = ${id}`) as Row[]
  if (!task) return null
  const subtasks = (await sql`
    select * from subtasks where task_id = ${id} order by position, title
  `) as Row[]
  const attachments = (await sql`
    select * from attachments where task_id = ${id} order by created_at
  `) as Row[]
  const links = (await sql`
    select * from task_links where task_id = ${id} order by position, created_at
  `) as Row[]
  return mapTask(
    task,
    subtasks.map(mapSubtask),
    attachments.map(mapAttachment),
    links.map(mapTaskLink),
  )
}
