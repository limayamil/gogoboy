import { sql } from '../_lib/db.ts'
import { badRequest, body, notFound, route } from '../_lib/http.ts'
import { buildObjectKey, signUpload } from '../_lib/storage.ts'
import { requiredText, uuid } from '../_lib/validate.ts'

type Row = Record<string, unknown>

/**
 * POST /api/uploads/sign
 * Devuelve una URL PUT prefirmada. El navegador sube el archivo directo al bucket
 * (sin pasar por la funcion serverless) y despues registra el adjunto en /api/attachments.
 */
export default route({
  async POST(req, res) {
    const input = body(req)
    const taskId = input.taskId == null ? null : uuid(input.taskId, 'taskId')
    const noteId = input.noteId == null ? null : uuid(input.noteId, 'noteId')
    if (Boolean(taskId) === Boolean(noteId)) {
      badRequest('Mandá taskId o noteId, uno solo')
    }
    const fileName = requiredText(input.fileName, 'fileName', 255)
    const contentType = requiredText(input.contentType, 'contentType', 150)

    if (taskId) {
      const [task] = (await sql`select id from tasks where id = ${taskId}`) as Row[]
      if (!task) notFound('Tarea no encontrada')
    } else {
      const [note] = (await sql`select id from notes where id = ${noteId}`) as Row[]
      if (!note) notFound('Nota no encontrada')
    }

    const objectKey = buildObjectKey(taskId ?? noteId!, fileName, taskId ? 'tasks' : 'notes')
    res.status(200).json({ objectKey, uploadUrl: await signUpload(objectKey, contentType) })
  },
})
