import type { AcceptCategoryPlan } from '../../src/shared/proposals.ts'
import { resolveAcceptCategory } from '../../src/shared/proposals.ts'
import type { Category, Proposal, Task } from '../../src/shared/types.ts'
import { loadTask, mapCategory, mapProposal, sql } from './db.ts'
import { HttpError, notFound } from './http.ts'
import type { ProposalInput, ProposalPatch } from './validate.ts'
import { parseTakeProposal } from './validate.ts'

type Row = Record<string, unknown>

/**
 * El id solo se guarda si la categoria existe. Si mandan solo el id, copiamos
 * el nombre vivo: es lo que se muestra si despues la borran y la FK deja el id
 * en null. Si mandan solo el nombre, el id queda null aunque la lista ya
 * exista: crearla (o engancharla) es decision de tomar, no de proponer.
 */
export function applyCategoryPointer(
  input: { categoryId: string | null; categoryName: string | null },
  found: { id: string; name: string } | null,
): { categoryId: string | null; categoryName: string | null } {
  if (!input.categoryId) {
    return { categoryId: null, categoryName: input.categoryName }
  }
  if (!found) throw new HttpError(400, 'La categoria no existe')
  return {
    categoryId: found.id,
    categoryName: input.categoryName ?? found.name,
  }
}

/** Lo que la sentencia de tomar tiene que ejecutar. `creating` es el unico caso que inserta en categories. */
export function categoryWrite(plan: AcceptCategoryPlan): {
  creating: boolean
  categoryId: string | null
  categoryName: string | null
} {
  if (plan.kind === 'create') {
    return { creating: true, categoryId: null, categoryName: plan.name }
  }
  if (plan.kind === 'existing') {
    return { creating: false, categoryId: plan.categoryId, categoryName: null }
  }
  return { creating: false, categoryId: null, categoryName: null }
}

async function categoryRow(id: string): Promise<{ id: string; name: string } | null> {
  const [row] = (await sql`select id, name from categories where id = ${id}`) as Row[]
  if (!row) return null
  return { id: row.id as string, name: row.name as string }
}

export async function upsertProposal(
  input: ProposalInput,
): Promise<{ proposal: Proposal; creada: boolean }> {
  const found = input.categoryId ? await categoryRow(input.categoryId) : null
  const bound = applyCategoryPointer(input, found)

  const [row] = (await sql`
    insert into proposals (
      title, description, urgency, deadline, category_name, category_id,
      origen, origen_url, origen_clave, created_at, updated_at
    )
    values (
      ${input.title}, ${input.description}, ${input.urgency}, ${input.deadline},
      ${bound.categoryName}, ${bound.categoryId}, ${input.origen}, ${input.origenUrl},
      ${input.origenClave}, now(), now()
    )
    on conflict (origen_clave) where origen_clave is not null
    do update set
      title = excluded.title,
      description = excluded.description,
      urgency = excluded.urgency,
      deadline = excluded.deadline,
      category_name = excluded.category_name,
      category_id = excluded.category_id,
      origen = excluded.origen,
      origen_url = excluded.origen_url,
      updated_at = now()
    returning *, (created_at = updated_at) as creada
  `) as Row[]

  if (!row) throw new Error('No se pudo guardar la propuesta')
  return { proposal: mapProposal(row), creada: row.creada === true }
}

export async function updateProposal(id: string, patch: ProposalPatch): Promise<Proposal | null> {
  const [current] = (await sql`select * from proposals where id = ${id}`) as Row[]
  if (!current) return null
  const base = mapProposal(current)

  let categoryId = 'categoryId' in patch ? (patch.categoryId ?? null) : base.categoryId
  let categoryName = 'categoryName' in patch ? (patch.categoryName ?? null) : base.categoryName

  // Misma regla que el alta: un id que no existe se rechaza, y si no mandaron
  // nombre copiamos el vivo. Las demas claves ausentes no se tocan.
  if ('categoryId' in patch && patch.categoryId) {
    const bound = applyCategoryPointer(
      {
        categoryId: patch.categoryId,
        categoryName: 'categoryName' in patch ? (patch.categoryName ?? null) : null,
      },
      await categoryRow(patch.categoryId),
    )
    categoryId = bound.categoryId
    categoryName = 'categoryName' in patch ? (patch.categoryName ?? null) : bound.categoryName
  }

  const next = {
    title: patch.title ?? base.title,
    description: 'description' in patch ? (patch.description ?? null) : base.description,
    urgency: patch.urgency ?? base.urgency,
    deadline: 'deadline' in patch ? (patch.deadline ?? null) : base.deadline,
    categoryName,
    categoryId,
    origen: 'origen' in patch ? (patch.origen ?? null) : base.origen,
    origenUrl: 'origenUrl' in patch ? (patch.origenUrl ?? null) : base.origenUrl,
    origenClave: 'origenClave' in patch ? (patch.origenClave ?? null) : base.origenClave,
  }

  const [row] = (await sql`
    update proposals set
      title = ${next.title},
      description = ${next.description},
      urgency = ${next.urgency},
      deadline = ${next.deadline},
      category_name = ${next.categoryName},
      category_id = ${next.categoryId},
      origen = ${next.origen},
      origen_url = ${next.origenUrl},
      origen_clave = ${next.origenClave},
      updated_at = now()
    where id = ${id}
    returning *
  `) as Row[]

  return row ? mapProposal(row) : null
}

export async function discardProposal(id: string): Promise<boolean> {
  const rows = (await sql`delete from proposals where id = ${id} returning id`) as Row[]
  return rows.length > 0
}

/**
 * Tomar: borra la propuesta, crea la categoria solo si el nombre no coincide
 * con ninguna, e inserta la tarea. Tiene que ser una sola sentencia. El driver
 * HTTP de Neon manda un request por sentencia, y un insert separado de un
 * delete puede dejar la propuesta y la tarea, o una categoria vacia.
 *
 * `inToday` queda en false salvo que el body lo pida. Si no viene fecha, se
 * copia la sugerida; si viene null, la tarea queda sin deadline.
 *
 * Orden de los parametros del CTE `params` (lo afirma proposals.test.ts):
 * id, creating, categoryId, categoryName, deadlineProvided, deadline, inToday.
 */
export async function acceptProposal(
  id: string,
  raw: Record<string, unknown>,
): Promise<{ task: Task; category: Category | null }> {
  const input = parseTakeProposal(raw)
  const listed = (await sql`select id, name, position from categories`) as Row[]
  const plan = resolveAcceptCategory(
    { categoryId: input.categoryId, categoryName: input.categoryName },
    listed.map((row) => ({
      id: row.id as string,
      name: row.name as string,
      position: Number(row.position),
    })),
  )
  const write = categoryWrite(plan)
  // Ausente no es true: el checkbox del paso nace destildado.
  const inToday = input.inToday === true
  const deadlineProvided = 'deadline' in input
  const deadline = input.deadline ?? null

  const [row] = (await sql`
    with params as (
      select
        ${id}::uuid as id,
        ${write.creating}::boolean as creating,
        ${write.categoryId}::uuid as category_id,
        ${write.categoryName}::text as category_name,
        ${deadlineProvided}::boolean as deadline_provided,
        ${deadline}::date as deadline,
        ${inToday}::boolean as in_today
    ),
    deleted as (
      delete from proposals p
      using params
      where p.id = params.id
      returning p.id, p.title, p.description, p.urgency, p.deadline
    ),
    created as (
      insert into categories (name, color_key, position)
      select
        left(trim(params.category_name), 60),
        -- Mismo default que el modal: la columna es obligatoria y tomar no pregunta el color.
        'coral',
        (select coalesce(max(position), -1) + 1 from categories)
      from params
      where params.creating
        and params.category_name is not null
        and length(trim(params.category_name)) > 0
        and exists (select 1 from deleted)
      returning id, name, color_key, position, created_at
    ),
    inserted as (
      insert into tasks (
        category_id, title, description, notes, urgency, deadline, status,
        in_today, today_position, position
      )
      select
        case
          when params.creating then (select id from created)
          else params.category_id
        end,
        deleted.title,
        deleted.description,
        null,
        deleted.urgency,
        case
          when params.deadline_provided then params.deadline
          else deleted.deadline
        end,
        'pendiente',
        params.in_today,
        case
          when params.in_today then (
            select coalesce(max(today_position), -1) + 1
            from tasks
            where in_today = true
          )
          else null
        end,
        (
          select coalesce(max(t.position), -1) + 1
          from tasks t
          where t.category_id is not distinct from (
            case
              when params.creating then (select id from created)
              else params.category_id
            end
          )
        )
      from deleted
      cross join params
      returning id
    )
    select
      (select id from inserted) as task_id,
      (select id from created) as new_category_id,
      (select name from created) as new_category_name,
      (select color_key from created) as new_color_key,
      (select position from created) as new_category_position,
      (select created_at from created) as new_category_created_at
  `) as Row[]

  if (!row?.task_id) notFound('Propuesta no encontrada')

  const task = await loadTask(String(row.task_id))
  if (!task) notFound('Propuesta no encontrada')

  // Solo la recien creada. Reutilizar una, o quedar sin categoria, devuelve null
  // para que el cache no invente una lista.
  const category = row.new_category_id
    ? mapCategory({
        id: row.new_category_id,
        name: row.new_category_name,
        color_key: row.new_color_key,
        position: row.new_category_position,
        created_at: row.new_category_created_at,
      })
    : null

  return { task, category }
}

export const proposalStore = {
  upsert: upsertProposal,
  update: updateProposal,
  discard: discardProposal,
}
