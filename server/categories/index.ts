import { mapCategory, sql } from '../_lib/db.ts'
import { body, route } from '../_lib/http.ts'
import { parseCategoryInput } from '../_lib/validate.ts'

type Row = Record<string, unknown>

export default route({
  async GET(_req, res) {
    const rows = (await sql`select * from categories order by position, created_at`) as Row[]
    res.status(200).json(rows.map(mapCategory))
  },

  async POST(req, res) {
    const input = parseCategoryInput(body(req))

    // Si no viene posicion, la categoria nueva va al final de la lista.
    const position =
      input.position ??
      Number(
        ((await sql`select coalesce(max(position), -1) + 1 as next from categories`) as Row[])[0]
          .next,
      )

    const [row] = (await sql`
      insert into categories (name, color_key, position)
      values (${input.name}, ${input.colorKey}, ${position})
      returning *
    `) as Row[]

    res.status(201).json(mapCategory(row))
  },
})
