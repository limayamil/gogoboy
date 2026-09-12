import { mapCategory, sql } from '../_lib/db.ts'
import { body, notFound, requireId, route } from '../_lib/http.ts'
import { parseCategoryPatch } from '../_lib/validate.ts'

type Row = Record<string, unknown>

export default route({
  async PATCH(req, res) {
    const id = requireId(req)
    const patch = parseCategoryPatch(body(req))

    const [current] = (await sql`select * from categories where id = ${id}`) as Row[]
    if (!current) notFound('Categoria no encontrada')

    const next = {
      name: patch.name ?? (current.name as string),
      colorKey: patch.colorKey ?? (current.color_key as string),
      position: patch.position ?? Number(current.position),
    }

    const [row] = (await sql`
      update categories
      set name = ${next.name}, color_key = ${next.colorKey}, position = ${next.position}
      where id = ${id}
      returning *
    `) as Row[]

    res.status(200).json(mapCategory(row))
  },

  async DELETE(req, res) {
    const id = requireId(req)
    // La FK es `on delete set null`: las tareas sobreviven, quedan sin categoria.
    const rows = (await sql`delete from categories where id = ${id} returning id`) as Row[]
    if (rows.length === 0) notFound('Categoria no encontrada')
    res.status(200).json({ ok: true })
  },
})
