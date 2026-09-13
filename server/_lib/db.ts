import { neon } from '@neondatabase/serverless'
import type {
  Attachment,
  Category,
  Note,
  NoteKind,
  NoteTag,
  QuickTask,
  Subtask,
  Task,
  TaskLink,
} from '../../src/shared/types.ts'

type Sql = ReturnType<typeof neon>

function databaseUrl(): string {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error(
      'Falta DATABASE_URL. Copia .env.example a .env y pega la connection string de Neon.',
    )
  }
  return connectionString
}

let sqlClient: Sql | undefined

// Recien en el primer query: si tiramos al importar, Vercel responde
// FUNCTION_INVOCATION_FAILED (texto plano) y la UI no puede mostrar el mensaje.
export const sql: Sql = ((strings: TemplateStringsArray, ...values: unknown[]) => {
  sqlClient ??= neon(databaseUrl())
  return sqlClient(strings, ...values)
}) as Sql

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
    taskId: (row.task_id as string | null) ?? null,
    noteId: (row.note_id as string | null) ?? null,
    objectKey: row.object_key as string,
    fileName: row.file_name as string,
    contentType: row.content_type as string,
    sizeBytes: Number(row.size_bytes),
    createdAt: toIso(row.created_at),
  }
}

export function mapNoteTag(row: Row): NoteTag {
  return {
    id: row.id as string,
    name: row.name as string,
  }
}

export function mapNote(row: Row, tags: NoteTag[] = [], attachments: Attachment[] = []): Note {
  const kind: NoteKind = row.kind === 'password' ? 'password' : 'note'
  return {
    id: row.id as string,
    kind,
    title: row.title as string,
    description: (row.description as string | null) ?? null,
    username: (row.username as string | null) ?? null,
    password: (row.password as string | null) ?? null,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
    tags,
    attachments,
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

/** Trae una nota completa (etiquetas y adjuntos) ya mapeada, o null si no existe. */
export async function loadNote(id: string): Promise<Note | null> {
  const [note] = (await sql`select * from notes where id = ${id}`) as Row[]
  if (!note) return null
  const tags = (await sql`
    select t.*
    from note_tags t
    join note_tag_assignments a on a.tag_id = t.id
    where a.note_id = ${id}
    order by t.name
  `) as Row[]
  const attachments = (await sql`
    select * from attachments where note_id = ${id} order by created_at
  `) as Row[]
  return mapNote(note, tags.map(mapNoteTag), attachments.map(mapAttachment))
}

/**
 * Reemplaza las etiquetas de una nota. Crea las que no existen (por nombre,
 * sin importar mayusculas) y borra las que quedaron huerfanas.
 */
export async function replaceNoteTags(noteId: string, names: string[]): Promise<void> {
  await sql`delete from note_tag_assignments where note_id = ${noteId}`

  for (const name of names) {
    const [existing] = (await sql`
      select id from note_tags where lower(name) = lower(${name}) limit 1
    `) as Row[]
    const tagId = existing
      ? (existing.id as string)
      : (((await sql`insert into note_tags (name) values (${name}) returning id`) as Row[])[0]
          .id as string)
    await sql`
      insert into note_tag_assignments (note_id, tag_id)
      values (${noteId}, ${tagId})
    `
  }

  await sql`
    delete from note_tags
    where not exists (
      select 1 from note_tag_assignments a where a.tag_id = note_tags.id
    )
  `
}
