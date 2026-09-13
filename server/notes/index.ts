import { loadNote, replaceNoteTags, sql } from '../_lib/db.ts'
import { body, route } from '../_lib/http.ts'
import { parseNoteCreate } from '../_lib/validate.ts'

type Row = Record<string, unknown>

export default route({
  async POST(req, res) {
    const input = parseNoteCreate(body(req))

    const [created] = (await sql`
      insert into notes (title, description, kind, username, password)
      values (
        ${input.title},
        ${input.description ?? null},
        ${input.kind ?? 'note'},
        ${input.username ?? null},
        ${input.password ?? null}
      )
      returning id
    `) as Row[]

    const noteId = created.id as string
    if ((input.kind ?? 'note') !== 'password') {
      await replaceNoteTags(noteId, input.tags ?? [])
    }

    res.status(201).json(await loadNote(noteId))
  },
})
