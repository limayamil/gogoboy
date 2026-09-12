import { sql } from '../_lib/db.ts'
import { body, notFound, route } from '../_lib/http.ts'
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
    const taskId = uuid(input.taskId, 'taskId')
    const fileName = requiredText(input.fileName, 'fileName', 255)
    const contentType = requiredText(input.contentType, 'contentType', 150)

    const [task] = (await sql`select id from tasks where id = ${taskId}`) as Row[]
    if (!task) notFound('Tarea no encontrada')

    const objectKey = buildObjectKey(taskId, fileName)
    res.status(200).json({ objectKey, uploadUrl: await signUpload(objectKey, contentType) })
  },
})
