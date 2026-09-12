import { mapQuickTask, sql } from '../_lib/db.ts'
import { body, route } from '../_lib/http.ts'
import { requiredText } from '../_lib/validate.ts'

type Row = Record<string, unknown>

/** Tareas rapidas: viven solo en el popover del FAB, sin categoria ni campos extra. */
export default route({
  async GET(_req, res) {
    const rows = (await sql`select * from quick_tasks order by position, created_at`) as Row[]
    res.status(200).json(rows.map(mapQuickTask))
  },

  async POST(req, res) {
    const title = requiredText(body(req).title, 'title', 200)

    const [{ next }] = (await sql`
      select coalesce(max(position), -1) + 1 as next from quick_tasks
    `) as Row[]

    const [row] = (await sql`
      insert into quick_tasks (title, position) values (${title}, ${Number(next)}) returning *
    `) as Row[]

    res.status(201).json(mapQuickTask(row))
  },
})
