import { weekKeys } from '../../src/lib/dates.ts'
import type { McpClock } from './mcp-tools.ts'

const DEFAULT_TZ = 'America/Argentina/Buenos_Aires'

/**
 * Calendario del MCP. Vercel corre en UTC; sin zona, "hoy" se corre despues
 * de las 21h en Argentina. Default AR; GOGOBOY_TZ lo pisa si hace falta.
 */
export function mcpClock(now: Date, timeZone = process.env.GOGOBOY_TZ): McpClock {
  const zone = timeZone?.trim() || DEFAULT_TZ
  const today = now.toLocaleDateString('en-CA', { timeZone: zone })
  const [y, m, d] = today.split('-').map(Number)
  return { today, week: weekKeys(new Date(y, m - 1, d)) }
}
