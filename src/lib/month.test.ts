import { describe, expect, it } from 'vitest'
import { dateKeyInAppZone } from '../shared/expiry'
import {
  calendarDayLabel,
  calendarDotCount,
  calendarMonthInZone,
  formatMonthTitle,
  groupTasksByDeadline,
  monthGrid,
  shiftMonth,
  withoutWeekend,
} from './month'

describe('calendarMonthInZone', () => {
  it('usa el día de Buenos Aires aunque UTC ya cambió de fecha', () => {
    // 02:30 UTC del 7 es todavía las 23:30 del 6 en Argentina (UTC−3, sin horario de verano).
    const now = new Date('2026-11-07T02:30:00.000Z')
    expect(dateKeyInAppZone(now, 'UTC')).toBe('2026-11-07')
    expect(calendarMonthInZone(now)).toEqual({ year: 2026, month: 11, today: '2026-11-06' })
  })
})

describe('monthGrid', () => {
  it('arma noviembre 2026 de lunes a domingo, con los días vecinos', () => {
    const cells = monthGrid(2026, 11)
    expect(cells[0]).toEqual({ key: '2026-10-26', inMonth: false })
    expect(cells.at(-1)).toEqual({ key: '2026-12-06', inMonth: false })
    expect(cells).toHaveLength(42)
    expect(cells.find((cell) => cell.key === '2026-11-01')).toEqual({
      key: '2026-11-01',
      inMonth: true,
    })
    expect(cells.find((cell) => cell.key === '2026-11-30')).toEqual({
      key: '2026-11-30',
      inMonth: true,
    })
  })

  it('esconde sábado y domingo y deja las semanas alineadas de lunes a viernes', () => {
    const weekdays = withoutWeekend(monthGrid(2026, 11))
    expect(weekdays).toHaveLength(30)
    expect(weekdays[0]).toEqual({ key: '2026-10-26', inMonth: false })
    expect(weekdays.map((cell) => cell.key)).not.toContain('2026-11-01')
    expect(weekdays.map((cell) => cell.key)).not.toContain('2026-11-07')
    expect(weekdays.map((cell) => cell.key)).toContain('2026-11-06')
  })
})

describe('shiftMonth', () => {
  it('cruza el cambio de año', () => {
    expect(shiftMonth(2026, 12, 1)).toEqual({ year: 2027, month: 1 })
    expect(shiftMonth(2026, 1, -1)).toEqual({ year: 2025, month: 12 })
  })
})

describe('formatMonthTitle', () => {
  it('capitaliza el mes y deja "de" en minúscula', () => {
    expect(formatMonthTitle(2026, 11)).toBe('Noviembre de 2026')
  })
})

describe('groupTasksByDeadline', () => {
  it('agrupa cada deadline en el día argentino y no cuenta las que no tienen fecha', () => {
    const now = new Date('2026-11-07T02:30:00.000Z')
    const month = calendarMonthInZone(now)
    const grid = monthGrid(month.year, month.month)
    const tasks = [
      { id: 'en-argentina', deadline: '2026-11-06' },
      { id: 'otra', deadline: '2026-11-06' },
      { id: 'el-dia-utc', deadline: '2026-11-07' },
      { id: 'sin-fecha', deadline: null },
      { id: 'vacia', deadline: '' },
    ]

    const grouped = groupTasksByDeadline(tasks)
    const todayCell = grid.find((cell) => cell.key === month.today)

    expect(month.today).toBe('2026-11-06')
    expect(todayCell).toEqual({ key: '2026-11-06', inMonth: true })
    expect(grouped.get('2026-11-06')?.map((task) => task.id)).toEqual(['en-argentina', 'otra'])
    expect(grouped.get('2026-11-07')?.map((task) => task.id)).toEqual(['el-dia-utc'])
    expect([...grouped.values()].flat().map((task) => task.id)).toEqual([
      'en-argentina',
      'otra',
      'el-dia-utc',
    ])
    expect(calendarDotCount(grouped.get('2026-11-06')?.length ?? 0)).toBe(2)
  })

  it('muestra como máximo tres puntos', () => {
    expect(calendarDotCount(0)).toBe(0)
    expect(calendarDotCount(1)).toBe(1)
    expect(calendarDotCount(3)).toBe(3)
    expect(calendarDotCount(4)).toBe(3)
  })
})

describe('calendarDayLabel', () => {
  it('nombra el día y cuántas tareas tiene', () => {
    expect(calendarDayLabel('2026-11-06', 0)).toBe('Viernes, 6 de noviembre, sin tareas')
    expect(calendarDayLabel('2026-11-06', 1)).toBe('Viernes, 6 de noviembre, 1 tarea')
    expect(calendarDayLabel('2026-11-06', 4)).toBe('Viernes, 6 de noviembre, 4 tareas')
  })
})
