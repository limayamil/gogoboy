import {
  mapAttachment,
  mapCategory,
  mapQuickTask,
  mapSubtask,
  mapTask,
  mapTaskLink,
  sql,
} from './_lib/db.ts'
import { route } from './_lib/http.ts'
import { storageConfigured } from './_lib/storage.ts'
import type { AppState, Attachment, Subtask, TaskLink } from '../src/shared/types.ts'

type Row = Record<string, unknown>

/**
 * GET /api/state
 *
 * Devuelve todo el estado en una sola llamada. La app es de un usuario y el volumen
 * es chico: una carga unica hace que React Query tenga un solo cache que actualizar,
 * lo que simplifica muchisimo las mutaciones optimistas del drag & drop.
 */
export default route({
  async GET(_req, res) {
    const [categories, tasks, subtasks, attachments, links, quickTasks] = (await Promise.all([
      sql`select * from categories order by position, created_at`,
      sql`select * from tasks order by position, created_at`,
      sql`select * from subtasks order by position, title`,
      sql`select * from attachments order by created_at`,
      sql`select * from task_links order by position, created_at`,
      sql`select * from quick_tasks order by position, created_at`,
    ])) as Row[][]

    const subtasksByTask = new Map<string, Subtask[]>()
    for (const row of subtasks) {
      const subtask = mapSubtask(row)
      const list = subtasksByTask.get(subtask.taskId)
      if (list) list.push(subtask)
      else subtasksByTask.set(subtask.taskId, [subtask])
    }

    const attachmentsByTask = new Map<string, Attachment[]>()
    for (const row of attachments) {
      const attachment = mapAttachment(row)
      const list = attachmentsByTask.get(attachment.taskId)
      if (list) list.push(attachment)
      else attachmentsByTask.set(attachment.taskId, [attachment])
    }

    const linksByTask = new Map<string, TaskLink[]>()
    for (const row of links) {
      const link = mapTaskLink(row)
      const list = linksByTask.get(link.taskId)
      if (list) list.push(link)
      else linksByTask.set(link.taskId, [link])
    }

    const state: AppState = {
      categories: categories.map(mapCategory),
      tasks: tasks.map((row) =>
        mapTask(
          row,
          subtasksByTask.get(row.id as string) ?? [],
          attachmentsByTask.get(row.id as string) ?? [],
          linksByTask.get(row.id as string) ?? [],
        ),
      ),
      quickTasks: quickTasks.map(mapQuickTask),
      storageConfigured,
    }

    res.status(200).json(state)
  },
})
