import { loadTask, loadTaskChildren, loadTaskRow, mapTask, sql } from '../_lib/db.ts'
import { body, notFound, requireId, route } from '../_lib/http.ts'
import { parseTaskPatch } from '../_lib/validate.ts'

type Row = Record<string, unknown>

export default route({
  async GET(req, res) {
    const task = await loadTask(requireId(req))
    if (!task) notFound('Tarea no encontrada')
    res.status(200).json(task)
  },

  /**
   * Lee la tarea, mezcla el patch en memoria y reescribe todas las columnas.
   * Es una query extra frente a armar el UPDATE dinamicamente, pero evita
   * concatenar nombres de columnas en SQL y hace trivial distinguir
   * "no mandaron el campo" de "lo mandaron en null".
   *
   * Esa query extra es UNA sola: alcanza con la fila de `tasks`, porque el UPDATE no
   * toca subtareas, adjuntos ni links. Los hijos se traen solo para armar la respuesta,
   * en paralelo con el propio UPDATE.
   */
  async PATCH(req, res) {
    const id = requireId(req)
    const patch = parseTaskPatch(body(req))

    const row = await loadTaskRow(id)
    if (!row) notFound('Tarea no encontrada')

    const current = mapTask(row)

    const merged = { ...current, ...patch }

    // El ojito solo aplica dentro de Hoy: sacar una tarea de Hoy la des-oculta,
    // para que al volver a arrastrarla aparezca en vez de quedar invisible.
    if (merged.inToday === false) {
      merged.hiddenInToday = false
      merged.todayPosition = null
    }

    if (merged.inToday && merged.todayPosition == null) {
      const [{ next }] = (await sql`
        select coalesce(max(today_position), -1) + 1 as next from tasks where in_today = true
      `) as Row[]
      merged.todayPosition = Number(next)
    }

    const completedAt =
      merged.status === 'hecha'
        ? (current.completedAt ?? new Date().toISOString())
        : null
    // Completar esta semana la deja visible; reabrirla limpia el vencimiento.
    // Si ya estaba hecha, no tocamos `expired`: el lazy del GET se encarga.
    const expired =
      merged.status === 'hecha'
        ? current.status === 'hecha'
          ? current.expired
          : false
        : false

    // Los hijos no cambian con este UPDATE, asi que la lectura arranca ya mismo y
    // corre solapada con la escritura en vez de esperarla.
    const children = loadTaskChildren(id)

    const [updated] = (await sql`
      update tasks set
        category_id     = ${merged.categoryId},
        title           = ${merged.title},
        description     = ${merged.description},
        notes           = ${merged.notes},
        urgency         = ${merged.urgency},
        deadline        = ${merged.deadline},
        status          = ${merged.status},
        in_today        = ${merged.inToday},
        hidden_in_today = ${merged.hiddenInToday},
        today_position  = ${merged.todayPosition},
        position        = ${merged.position},
        completed_at    = ${completedAt},
        expired         = ${expired},
        updated_at      = now()
      where id = ${id}
      returning *
    `) as Row[]

    const [subtasks, attachments, links] = await children
    res.status(200).json(mapTask(updated, subtasks, attachments, links))
  },

  async DELETE(req, res) {
    const id = requireId(req)
    // Subtareas y adjuntos caen por `on delete cascade`.
    const rows = (await sql`delete from tasks where id = ${id} returning id`) as Row[]
    if (rows.length === 0) notFound('Tarea no encontrada')
    res.status(200).json({ ok: true })
  },
})
