import { mapTaskLink, sql } from '../_lib/db.ts'
import { body, notFound, route } from '../_lib/http.ts'
import { httpUrl, int, optionalText, uuid } from '../_lib/validate.ts'

type Row = Record<string, unknown>

export default route({
  async POST(req, res) {
    const input = body(req)
    const taskId = uuid(input.taskId, 'taskId')
    const url = httpUrl(input.url, 'url')
    const title = optionalText(input.title, 'title', 200)

    const [task] = (await sql`select id from tasks where id = ${taskId}`) as Row[]
    if (!task) notFound('La tarea de ese link no existe')

    const position =
      input.position == null
        ? Number(
            ((await sql`
              select coalesce(max(position), -1) + 1 as next from task_links where task_id = ${taskId}
            `) as Row[])[0].next,
          )
        : int(input.position, 'position')

    const [row] = (await sql`
      insert into task_links (task_id, url, title, position)
      values (${taskId}, ${url}, ${title}, ${position})
      returning *
    `) as Row[]

    res.status(201).json(mapTaskLink(row))
  },
})
