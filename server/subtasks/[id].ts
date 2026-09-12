import { mapSubtask, sql } from '../_lib/db.ts'
import { body, notFound, requireId, route } from '../_lib/http.ts'
import { bool, int, requiredText } from '../_lib/validate.ts'

type Row = Record<string, unknown>

export default route({
  async PATCH(req, res) {
    const id = requireId(req)
    const input = body(req)

    const [current] = (await sql`select * from subtasks where id = ${id}`) as Row[]
    if (!current) notFound('Subtarea no encontrada')

    const next = {
      title: 'title' in input ? requiredText(input.title, 'title', 200) : (current.title as string),
      done: 'done' in input ? bool(input.done, 'done') : Boolean(current.done),
      position: 'position' in input ? int(input.position, 'position') : Number(current.position),
    }

    const [row] = (await sql`
      update subtasks
      set title = ${next.title}, done = ${next.done}, position = ${next.position}
      where id = ${id}
      returning *
    `) as Row[]

    res.status(200).json(mapSubtask(row))
  },

  async DELETE(req, res) {
    const id = requireId(req)
    const rows = (await sql`delete from subtasks where id = ${id} returning id`) as Row[]
    if (rows.length === 0) notFound('Subtarea no encontrada')
    res.status(200).json({ ok: true })
  },
})
