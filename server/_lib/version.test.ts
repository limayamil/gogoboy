import { describe, expect, it } from 'vitest'
import { encodeStateVersion } from './version.ts'

describe('encodeStateVersion', () => {
  it('une counts y timestamps en una firma estable', () => {
    const at = new Date('2026-09-15T12:00:00.000Z')
    expect(encodeStateVersion([2, at, 1, null])).toBe(`2.${at.getTime()}.1.`)
  })

  it('cambia si se borra una nota (el count baja aunque no haya max)', () => {
    const withNotes = encodeStateVersion([1, 1, 2])
    const withoutNotes = encodeStateVersion([1, 1, 1])
    expect(withNotes).not.toBe(withoutNotes)
  })
})
