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

    const [{ next: position }] = (await sql`
      select coalesce(max(position), -1) + 1 as next
      from tasks
      where category_id is not distinct from ${input.categoryId ?? null}
    `) as Row[]

    const [{ next: todayPosition }] = (await sql`
      select coalesce(max(today_position), -1) + 1 as next from tasks where in_today = true
    `) as Row[]

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

    for (const [index, title] of subtaskTitles.entries()) {
      await sql`
        insert into subtasks (task_id, title, position) values (${taskId}, ${title}, ${index})
      `
    }

    for (const [index, link] of links.entries()) {
      await sql`
        insert into task_links (task_id, url, title, position)
        values (${taskId}, ${link.url}, ${link.title}, ${index})
      `
    }

    res.status(201).json(await loadTask(taskId))
  },
})
