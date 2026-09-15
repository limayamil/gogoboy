import type { AppState, Attachment, NoteTag, Subtask, TaskLink } from '../../src/shared/types.ts'
import {
  mapAttachment,
  mapCategory,
  mapNote,
  mapNoteTag,
  mapQuickTask,
  mapSubtask,
  mapTask,
  mapTaskLink,
  sql,
} from './db.ts'
import { storageConfigured } from './storage.ts'

type Row = Record<string, unknown>

/**
 * Misma carga que GET /api/state. El MCP la reusa para no duplicar el armado
 * de tareas/notas (y para que un cambio de mapeo se vea en los dos lados).
 */
export async function loadAppState(): Promise<AppState> {
  const [
    categories,
    tasks,
    subtasks,
    attachments,
    links,
    quickTasks,
    notes,
    noteTags,
    noteTagAssignments,
  ] = (await Promise.all([
    sql`select * from categories order by position, created_at`,
    sql`select * from tasks order by position, created_at`,
    sql`select * from subtasks order by position, title`,
    sql`select * from attachments order by created_at`,
    sql`select * from task_links order by position, created_at`,
    sql`select * from quick_tasks order by position, created_at`,
    sql`select * from notes order by updated_at desc, created_at desc`,
    sql`select * from note_tags order by name`,
    sql`select * from note_tag_assignments`,
  ])) as Row[][]

  const subtasksByTask = new Map<string, Subtask[]>()
  for (const row of subtasks) {
    const subtask = mapSubtask(row)
    const list = subtasksByTask.get(subtask.taskId)
    if (list) list.push(subtask)
    else subtasksByTask.set(subtask.taskId, [subtask])
  }

  const attachmentsByTask = new Map<string, Attachment[]>()
  const attachmentsByNote = new Map<string, Attachment[]>()
  for (const row of attachments) {
    const attachment = mapAttachment(row)
    if (attachment.taskId) {
      const list = attachmentsByTask.get(attachment.taskId)
      if (list) list.push(attachment)
      else attachmentsByTask.set(attachment.taskId, [attachment])
    } else if (attachment.noteId) {
      const list = attachmentsByNote.get(attachment.noteId)
      if (list) list.push(attachment)
      else attachmentsByNote.set(attachment.noteId, [attachment])
    }
  }

  const linksByTask = new Map<string, TaskLink[]>()
  for (const row of links) {
    const link = mapTaskLink(row)
    const list = linksByTask.get(link.taskId)
    if (list) list.push(link)
    else linksByTask.set(link.taskId, [link])
  }

  const tagsById = new Map<string, NoteTag>()
  for (const row of noteTags) {
    const tag = mapNoteTag(row)
    tagsById.set(tag.id, tag)
  }

  const tagsByNote = new Map<string, NoteTag[]>()
  for (const row of noteTagAssignments) {
    const tag = tagsById.get(row.tag_id as string)
    if (!tag) continue
    const noteId = row.note_id as string
    const list = tagsByNote.get(noteId)
    if (list) list.push(tag)
    else tagsByNote.set(noteId, [tag])
  }

  return {
    categories: categories.map(mapCategory),
    tasks: tasks.map((row) =>
      mapTask(
        row,
        subtasksByTask.get(row.id as string) ?? [],
        attachmentsByTask.get(row.id as string) ?? [],
        linksByTask.get(row.id as string) ?? [],
      ),
    ),
    notes: notes.map((row) =>
      mapNote(
        row,
        (tagsByNote.get(row.id as string) ?? []).sort((a, b) => a.name.localeCompare(b.name, 'es')),
        attachmentsByNote.get(row.id as string) ?? [],
      ),
    ),
    quickTasks: quickTasks.map(mapQuickTask),
    storageConfigured,
  }
}
