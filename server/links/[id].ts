import { mapTaskLink, sql } from '../_lib/db.ts'
import { body, notFound, requireId, route } from '../_lib/http.ts'
import { httpUrl, optionalText } from '../_lib/validate.ts'

type Row = Record<string, unknown>

export default route({
  async PATCH(req, res) {
    const id = requireId(req)
    const input = body(req)

    const [current] = (await sql`select * from task_links where id = ${id}`) as Row[]
    if (!current) notFound('Link no encontrado')

    const next = {
      url: 'url' in input ? httpUrl(input.url, 'url') : (current.url as string),
      title:
        'title' in input
          ? optionalText(input.title, 'title', 200)
          : ((current.title as string | null) ?? null),
    }

    const [row] = (await sql`
      update task_links set url = ${next.url}, title = ${next.title}
      where id = ${id}
      returning *
    `) as Row[]

    res.status(200).json(mapTaskLink(row))
  },

  async DELETE(req, res) {
    const id = requireId(req)
    const rows = (await sql`delete from task_links where id = ${id} returning id`) as Row[]
    if (rows.length === 0) notFound('Link no encontrado')
    res.status(200).json({ ok: true })
  },
})
