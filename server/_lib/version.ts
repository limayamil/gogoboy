import { sql } from './db.ts'

type Row = Record<string, unknown>

/** Convierte el row de agregados en la firma que comparan /api/state y /api/version. */
export function encodeStateVersion(values: unknown[]): string {
  return values
    .map((value) => (value instanceof Date ? value.getTime() : String(value ?? '')))
    .join('.')
}

/**
 * Firma barata del estado completo: una sola sentencia, un solo round-trip.
 *
 * Los `count(*)` detectan los borrados — que no dejan rastro en ningun `max` — y
 * los `max` detectan las ediciones. `proposals` entra igual: si no, el banner no
 * se entera de una propuesta nueva. Vive en un solo lugar a proposito: la consumen
 * GET /api/state y GET /api/version. Si se calcularan por separado, cualquier
 * diferencia haria aparecer el aviso de novedades para siempre.
 */
export async function stateVersion(): Promise<string> {
  const [row] = (await sql`
    select
      (select count(*) from tasks)                      as tasks_n,
      (select max(updated_at) from tasks)               as tasks_at,
      (select count(*) from categories)                 as cat_n,
      (select max(created_at) from categories)          as cat_at,
      (select count(*) from subtasks)                   as sub_n,
      (select count(*) from quick_tasks)                as quick_n,
      (select max(created_at) from quick_tasks)         as quick_at,
      (select count(*) from task_links)                 as link_n,
      (select count(*) from attachments)                as att_n,
      (select count(*) from notes)                      as notes_n,
      (select max(updated_at) from notes)               as notes_at,
      (select count(*) from note_tags)                  as tag_n,
      (select count(*) from note_tag_assignments)       as tag_assign_n,
      (select count(*) from proposals)                  as prop_n,
      (select max(updated_at) from proposals)           as prop_at
  `) as Row[]

  return encodeStateVersion([
    row.tasks_n,
    row.tasks_at,
    row.cat_n,
    row.cat_at,
    row.sub_n,
    row.quick_n,
    row.quick_at,
    row.link_n,
    row.att_n,
    row.notes_n,
    row.notes_at,
    row.tag_n,
    row.tag_assign_n,
    row.prop_n,
    row.prop_at,
  ])
}
