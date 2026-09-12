import { sql } from '../_lib/db.ts'
import { notFound, requireId, route } from '../_lib/http.ts'
import { deleteObject, signDownload } from '../_lib/storage.ts'

type Row = Record<string, unknown>

export default route({
  /** Devuelve una URL de descarga prefirmada y de vida corta para ver el adjunto. */
  async GET(req, res) {
    const id = requireId(req)
    const [row] = (await sql`select object_key from attachments where id = ${id}`) as Row[]
    if (!row) notFound('Adjunto no encontrado')
    res.status(200).json({ url: await signDownload(row.object_key as string) })
  },

  async DELETE(req, res) {
    const id = requireId(req)
    const [row] = (await sql`
      delete from attachments where id = ${id} returning object_key
    `) as Row[]
    if (!row) notFound('Adjunto no encontrado')

    // El registro ya no esta; si el borrado en el bucket falla solo queda un archivo
    // huerfano, que es preferible a dejar un adjunto roto visible en la UI.
    try {
      await deleteObject(row.object_key as string)
    } catch (error) {
      console.error('[attachments] no se pudo borrar del bucket:', error)
    }

    res.status(200).json({ ok: true })
  },
})
