import { sql } from './db.ts'
import { APP_TIME_ZONE, shouldExpireCompleted } from '../../src/shared/expiry.ts'

type Row = Record<string, unknown>

function completedAtIso(value: unknown): string | null {
  if (value == null) return null
  return value instanceof Date ? value.toISOString() : String(value)
}

/** Misma zona que el reloj del MCP: default Argentina, GOGOBOY_TZ la pisa. */
function appZone(): string {
  return process.env.GOGOBOY_TZ?.trim() || APP_TIME_ZONE
}

/**
 * Marca hechas cuya semana ya cerro. Se llama al cargar el estado: no hay cron.
 * Devuelve cuantas filas paso a expired, por si un test quiere asertarlo.
 */
export async function expireCompletedTasks(now = new Date()): Promise<number> {
  const rows = (await sql`
    select id, status, completed_at
    from tasks
    where status = 'hecha' and expired = false
  `) as Row[]

  const zone = appZone()
  const ids = rows
    .filter((row) =>
      shouldExpireCompleted(String(row.status), completedAtIso(row.completed_at), now, zone),
    )
    .map((row) => row.id as string)

  if (ids.length === 0) return 0

  await sql`
    update tasks
    set expired = true, updated_at = now()
    where id = any(${ids}::uuid[])
  `
  return ids.length
}
