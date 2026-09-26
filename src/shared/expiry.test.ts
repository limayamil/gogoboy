import { describe, expect, it } from 'vitest'
import { mondayOf, shouldExpireCompleted } from './expiry'

describe('mondayOf', () => {
  it('devuelve el lunes de esa semana', () => {
    expect(mondayOf('2026-09-18')).toBe('2026-09-14')
  })

  it('trata el domingo como ultimo dia, no como primero', () => {
    expect(mondayOf('2026-09-13')).toBe('2026-09-07')
  })

  it('es idempotente sobre un lunes', () => {
    expect(mondayOf('2026-09-14')).toBe('2026-09-14')
  })
})

describe('shouldExpireCompleted', () => {
  const fridayThisWeek = new Date('2026-09-18T15:00:00-03:00')

  it('no vence una hecha completada esta semana', () => {
    expect(shouldExpireCompleted('hecha', '2026-09-15T18:00:00.000Z', fridayThisWeek)).toBe(false)
  })

  it('vence una hecha de la semana anterior', () => {
    expect(shouldExpireCompleted('hecha', '2026-09-11T18:00:00.000Z', fridayThisWeek)).toBe(true)
  })

  it('vence las hechas viejas sin completedAt', () => {
    expect(shouldExpireCompleted('hecha', null, fridayThisWeek)).toBe(true)
  })

  it('no aplica a pendientes', () => {
    expect(shouldExpireCompleted('pendiente', null, fridayThisWeek)).toBe(false)
  })

  it('el domingo todavia pertenece a esa semana', () => {
    const sunday = new Date('2026-09-20T22:00:00-03:00')
    expect(shouldExpireCompleted('hecha', '2026-09-14T12:00:00-03:00', sunday)).toBe(false)
  })

  it('el lunes siguiente ya vencio lo de la semana pasada', () => {
    const nextMonday = new Date('2026-09-21T00:30:00-03:00')
    expect(shouldExpireCompleted('hecha', '2026-09-20T23:00:00-03:00', nextMonday)).toBe(true)
  })
})
