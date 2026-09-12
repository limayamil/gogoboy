import { describe, expect, it } from 'vitest'
import { DAY_NAMES, formatTodayHeading, startOfWeek, toDateKey, weekKeys } from './dates'

describe('DAY_NAMES', () => {
  it('lleva tildes en miércoles y sábado', () => {
    expect(DAY_NAMES).toEqual(['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'])
  })
})

describe('formatTodayHeading', () => {
  it('capitaliza solo el primer carácter y deja "de" en minúscula', () => {
    expect(formatTodayHeading(new Date(2026, 8, 11))).toBe('Viernes, 11 de septiembre')
  })
})

describe('startOfWeek', () => {
  it('devuelve el lunes de esa semana', () => {
    // 2026-09-11 es viernes.
    expect(toDateKey(startOfWeek(new Date(2026, 8, 11)))).toBe('2026-09-07')
  })

  it('trata el domingo como ultimo dia, no como primero', () => {
    // 2026-09-13 es domingo: su lunes es el 7, no el 14.
    expect(toDateKey(startOfWeek(new Date(2026, 8, 13)))).toBe('2026-09-07')
  })

  it('es idempotente sobre un lunes', () => {
    expect(toDateKey(startOfWeek(new Date(2026, 8, 7)))).toBe('2026-09-07')
  })
})

describe('weekKeys', () => {
  it('da 7 dias consecutivos de lunes a domingo', () => {
    expect(weekKeys(new Date(2026, 8, 11))).toEqual([
      '2026-09-07',
      '2026-09-08',
      '2026-09-09',
      '2026-09-10',
      '2026-09-11',
      '2026-09-12',
      '2026-09-13',
    ])
  })

  it('cruza el cambio de mes sin romperse', () => {
    expect(weekKeys(new Date(2026, 8, 30))).toEqual([
      '2026-09-28',
      '2026-09-29',
      '2026-09-30',
      '2026-10-01',
      '2026-10-02',
      '2026-10-03',
      '2026-10-04',
    ])
  })
})

describe('toDateKey', () => {
  it('usa la fecha local, no UTC (no corre el dia de madrugada)', () => {
    expect(toDateKey(new Date(2026, 0, 1, 0, 30))).toBe('2026-01-01')
    expect(toDateKey(new Date(2026, 11, 31, 23, 30))).toBe('2026-12-31')
  })
})
