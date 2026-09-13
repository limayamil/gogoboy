import { mapAttachment, sql } from '../_lib/db.ts'
import { badRequest, body, notFound, route } from '../_lib/http.ts'
import { int, requiredText, uuid } from '../_lib/validate.ts'

type Row = Record<string, unknown>

/** Registra en la base un archivo ya subido al bucket via URL prefirmada. */
export default route({
  async POST(req, res) {
    const input = body(req)
    const taskId = input.taskId == null ? null : uuid(input.taskId, 'taskId')
    const noteId = input.noteId == null ? null : uuid(input.noteId, 'noteId')
    if (Boolean(taskId) === Boolean(noteId)) {
      badRequest('Mandá taskId o noteId, uno solo')
    }
    const objectKey = requiredText(input.objectKey, 'objectKey', 500)
    const fileName = requiredText(input.fileName, 'fileName', 255)
    const contentType = requiredText(input.contentType, 'contentType', 150)
    const sizeBytes = input.sizeBytes == null ? 0 : int(input.sizeBytes, 'sizeBytes')

    if (taskId) {
      const [task] = (await sql`select id from tasks where id = ${taskId}`) as Row[]
      if (!task) notFound('Tarea no encontrada')
    } else {
      const [note] = (await sql`select id from notes where id = ${noteId}`) as Row[]
      if (!note) notFound('Nota no encontrada')
    }

    const [row] = (await sql`
      insert into attachments (task_id, note_id, object_key, file_name, content_type, size_bytes)
      values (${taskId}, ${noteId}, ${objectKey}, ${fileName}, ${contentType}, ${sizeBytes})
      returning *
    `) as Row[]

    res.status(201).json(mapAttachment(row))
  },
})
