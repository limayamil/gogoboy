import { mapQuickTask, sql } from '../_lib/db.ts'
import { body, notFound, requireId, route } from '../_lib/http.ts'
import { bool, int, requiredText } from '../_lib/validate.ts'

type Row = Record<string, unknown>

export default route({
  async PATCH(req, res) {
    const id = requireId(req)
    const input = body(req)

    const [current] = (await sql`select * from quick_tasks where id = ${id}`) as Row[]
    if (!current) notFound('Tarea rapida no encontrada')

    const next = {
      title: 'title' in input ? requiredText(input.title, 'title', 200) : (current.title as string),
      done: 'done' in input ? bool(input.done, 'done') : Boolean(current.done),
      position: 'position' in input ? int(input.position, 'position') : Number(current.position),
    }

    const [row] = (await sql`
      update quick_tasks
      set title = ${next.title}, done = ${next.done}, position = ${next.position}
      where id = ${id}
      returning *
    `) as Row[]

    res.status(200).json(mapQuickTask(row))
  },

  async DELETE(req, res) {
    const id = requireId(req)
    const rows = (await sql`delete from quick_tasks where id = ${id} returning id`) as Row[]
    if (rows.length === 0) notFound('Tarea rapida no encontrada')
    res.status(200).json({ ok: true })
  },
})
