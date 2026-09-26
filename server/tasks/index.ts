import { loadTask, sql } from '../_lib/db.ts'
import { body, route } from '../_lib/http.ts'
import { httpUrl, optionalText, parseTaskCreate, requiredText } from '../_lib/validate.ts'

type Row = Record<string, unknown>

export default route({
  async POST(req, res) {
    const raw = body(req)
    const input = parseTaskCreate(raw)

    // Las subtareas pueden venir en el mismo payload cuando se crea la tarea desde el modal.
    const rawSubtasks = Array.isArray(raw.subtasks) ? raw.subtasks : []
    const subtaskTitles = rawSubtasks.map((item, index) =>
      requiredText(
        typeof item === 'string' ? item : (item as Record<string, unknown>)?.title,
        `subtasks[${index}].title`,
        200,
      ),
    )

    // Los links tambien: el modal los junta antes de que la tarea exista.
    const rawLinks = Array.isArray(raw.links) ? raw.links : []
    const links = rawLinks.map((item, index) => {
      const entry = typeof item === 'string' ? { url: item } : ((item ?? {}) as Record<string, unknown>)
      return {
        url: httpUrl(entry.url, `links[${index}].url`),
        title: optionalText(entry.title, `links[${index}].title`, 200),
      }
    })

    // Las dos posiciones son independientes entre si: una sola espera, no dos.
    const [[{ next: position }], [{ next: todayPosition }]] = (await Promise.all([
      sql`
        select coalesce(max(position), -1) + 1 as next
        from tasks
        where category_id is not distinct from ${input.categoryId ?? null}
      `,
      sql`select coalesce(max(today_position), -1) + 1 as next from tasks where in_today = true`,
    ])) as Row[][]

    const [created] = (await sql`
      insert into tasks (
        category_id, title, description, notes, urgency, deadline, status,
        in_today, today_position, position
      )
      values (
        ${input.categoryId ?? null}, ${input.title}, ${input.description ?? null},
        ${input.notes ?? null}, ${input.urgency ?? 'media'}, ${input.deadline ?? null},
        ${input.status ?? 'pendiente'}, ${input.inToday ?? false},
        ${input.inToday ? Number(todayPosition) : null}, ${Number(position)}
      )
      returning id
    `) as Row[]

    const taskId = created.id as string

    /**
     * Subtareas y links entran con una sentencia por tabla, no una por fila: `unnest`
     * expande los arrays en filas del lado de Postgres. Antes esto era un `await` dentro
     * de un `for`, o sea un round-trip HTTP por subtarea, y si fallaba el cuarto insert
     * quedaban tres subtareas huerfanas colgando de la tarea recien creada.
     */
    const inserts: Promise<unknown>[] = []

    if (subtaskTitles.length > 0) {
      inserts.push(sql`
        insert into subtasks (task_id, title, position)
        select ${taskId}, title, position
        from unnest(
          ${subtaskTitles}::text[],
          ${subtaskTitles.map((_, index) => index)}::int[]
        ) as t(title, position)
      `)
    }

    if (links.length > 0) {
      inserts.push(sql`
        insert into task_links (task_id, url, title, position)
        select ${taskId}, url, title, position
        from unnest(
          ${links.map((link) => link.url)}::text[],
          ${links.map((link) => link.title)}::text[],
          ${links.map((_, index) => index)}::int[]
        ) as t(url, title, position)
      `)
    }

    await Promise.all(inserts)

    res.status(201).json(await loadTask(taskId))
  },
})
