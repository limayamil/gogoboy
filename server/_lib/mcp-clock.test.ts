import { describe, expect, it } from 'vitest'
import { mcpClock } from './mcp-clock.ts'

describe('mcpClock', () => {
  it('en America/Argentina usa el dia local, no UTC', () => {
    // 02:00 UTC del 16 es 23:00 del 15 en Buenos Aires.
    const clock = mcpClock(new Date('2026-09-16T02:00:00.000Z'), 'America/Argentina/Buenos_Aires')

    expect(clock.today).toBe('2026-09-15')
    expect(clock.week[0]).toBe('2026-09-14')
    expect(clock.week[6]).toBe('2026-09-20')
  })
})
