import { describe, expect, it } from 'vitest'
import { computeTaskStats, computeWeekDetail, formatWeekSpan, UNCATEGORIZED_NAME } from './stats'
import type { Category, Task } from '../shared/types'

function task(partial: Partial<Task> & Pick<Task, 'id'>): Task {
  return {
    categoryId: null,
    title: partial.title ?? partial.id,
    description: null,
    notes: null,
    urgency: 'media',
    deadline: null,
    status: 'hecha',
    inToday: false,
    hiddenInToday: false,
    expired: false,
    todayPosition: null,
    position: 0,
    createdAt: '2026-01-01T12:00:00.000Z',
    updatedAt: '2026-01-01T12:00:00.000Z',
    completedAt: null,
    subtasks: [],
    attachments: [],
    links: [],
    ...partial,
  }
}

const casa: Category = {
  id: 'casa',
  name: 'Casa',
  colorKey: 'coral',
  position: 0,
  createdAt: '2026-01-01T12:00:00.000Z',
}
const laburo: Category = {
  id: 'laburo',
  name: 'Laburo',
  colorKey: 'lila',
  position: 1,
  createdAt: '2026-01-01T12:00:00.000Z',
}

/** Viernes 18 sep 2026, 15:00 en Argentina: semana lun 14 – dom 20. */
const friday = new Date('2026-09-18T15:00:00-03:00')

describe('computeTaskStats', () => {
  it('queda vacio si no hay hechas', () => {
    const stats = computeTaskStats(
      [task({ id: 'p', status: 'pendiente' })],
      [casa],
      friday,
    )
    expect(stats.total).toBe(0)
    expect(stats.byCategory).toEqual([])
    expect(stats.weeks).toEqual([])
    expect(stats.thisWeekCount).toBe(0)
    expect(stats.lastWeekCount).toBe(0)
    expect(stats.mostProductiveWeekdays).toEqual([])
  })

  it('incluye hechas expiradas que Hoy y Listas ocultan', () => {
    const stats = computeTaskStats(
      [
        task({
          id: 'vieja',
          expired: true,
          categoryId: 'casa',
          completedAt: '2026-09-10T18:00:00.000Z',
        }),
        task({
          id: 'esta-semana',
          categoryId: 'laburo',
          completedAt: '2026-09-16T18:00:00.000Z',
        }),
      ],
      [casa, laburo],
      friday,
    )
    expect(stats.total).toBe(2)
    expect(stats.byCategory.map((row) => [row.name, row.count])).toEqual([
      ['Casa', 1],
      ['Laburo', 1],
    ])
    expect(stats.weeks.map((week) => [week.monday, week.count, week.listCount, week.isCurrent])).toEqual([
      ['2026-09-14', 1, 1, true],
      ['2026-09-07', 1, 1, false],
    ])
  })

  it('agrupa categoryId null como Sin categoría', () => {
    const stats = computeTaskStats(
      [task({ id: 'suelta', completedAt: '2026-09-15T12:00:00.000Z' })],
      [casa],
      friday,
    )
    expect(stats.byCategory).toEqual([
      { categoryId: null, name: UNCATEGORIZED_NAME, colorKey: null, count: 1 },
    ])
    expect(stats.weeks[0]?.listCount).toBe(1)
  })

  it('cuenta listas distintas por semana, no tareas', () => {
    const stats = computeTaskStats(
      [
        task({ id: 'a', categoryId: 'casa', completedAt: '2026-09-14T12:00:00-03:00' }),
        task({ id: 'b', categoryId: 'casa', completedAt: '2026-09-15T12:00:00-03:00' }),
        task({ id: 'c', categoryId: 'laburo', completedAt: '2026-09-16T12:00:00-03:00' }),
        task({ id: 'd', completedAt: '2026-09-17T12:00:00-03:00' }),
      ],
      [casa, laburo],
      friday,
    )
    expect(stats.thisWeekCount).toBe(4)
    expect(stats.weeks[0]).toMatchObject({ monday: '2026-09-14', count: 4, listCount: 3 })
  })

  it('usa la zona de Argentina, no UTC, para asignar la semana', () => {
    // Lunes 21 sep 02:00 UTC = domingo 20 sep 23:00 en Buenos Aires.
    const stats = computeTaskStats(
      [task({ id: 'domingo-noche', completedAt: '2026-09-21T02:00:00.000Z' })],
      [],
      friday,
    )
    expect(stats.weeks[0]?.monday).toBe('2026-09-14')
    expect(stats.thisWeekCount).toBe(1)
  })

  it('el domingo sigue en la semana que arranco el lunes', () => {
    const sunday = new Date('2026-09-20T22:00:00-03:00')
    const stats = computeTaskStats(
      [task({ id: 'dom', completedAt: '2026-09-20T21:00:00-03:00' })],
      [],
      sunday,
    )
    expect(stats.thisWeekCount).toBe(1)
    expect(stats.weeks[0]?.sunday).toBe('2026-09-20')
  })

  it('compara esta semana contra la anterior', () => {
    const stats = computeTaskStats(
      [
        task({ id: 'ahora', completedAt: '2026-09-15T12:00:00-03:00' }),
        task({ id: 'antes-1', expired: true, completedAt: '2026-09-08T12:00:00-03:00' }),
        task({ id: 'antes-2', expired: true, completedAt: '2026-09-10T12:00:00-03:00' }),
      ],
      [],
      friday,
    )
    expect(stats.thisWeekCount).toBe(1)
    expect(stats.lastWeekCount).toBe(2)
  })

  it('elige el dia mas productivo y empata si hay varios', () => {
    const stats = computeTaskStats(
      [
        task({ id: 'jue-1', completedAt: '2026-09-17T12:00:00-03:00' }),
        task({ id: 'jue-2', completedAt: '2026-09-17T18:00:00-03:00' }),
        task({ id: 'vie', completedAt: '2026-09-18T12:00:00-03:00' }),
      ],
      [],
      friday,
    )
    expect(stats.mostProductiveWeekdays).toEqual([{ index: 3, label: 'jueves', count: 2 }])
  })

  it('suma hechas sin completedAt al total, no a una semana', () => {
    const stats = computeTaskStats(
      [task({ id: 'antigua', expired: true, completedAt: null, categoryId: 'casa' })],
      [casa],
      friday,
    )
    expect(stats.total).toBe(1)
    expect(stats.weeks).toEqual([])
    expect(stats.byCategory[0]?.count).toBe(1)
  })

  it('trata un categoryId huerfano como Sin categoría', () => {
    const stats = computeTaskStats(
      [task({ id: 'huerfana', categoryId: 'desaparecida', completedAt: '2026-09-15T12:00:00-03:00' })],
      [casa],
      friday,
    )
    expect(stats.byCategory[0]?.name).toBe(UNCATEGORIZED_NAME)
    expect(stats.byCategory[0]?.colorKey).toBeNull()
  })
})

describe('computeWeekDetail', () => {
  it('incluye expiradas y corta en el lunes–domingo de Argentina', () => {
    const detail = computeWeekDetail(
      [
        task({
          id: 'esta',
          expired: true,
          categoryId: 'casa',
          completedAt: '2026-09-14T12:00:00-03:00',
        }),
        task({
          id: 'otra-lista',
          categoryId: 'laburo',
          completedAt: '2026-09-20T23:00:00-03:00',
        }),
        task({
          id: 'lunes-siguiente',
          categoryId: 'casa',
          completedAt: '2026-09-21T00:30:00-03:00',
        }),
        task({ id: 'pendiente', status: 'pendiente', completedAt: '2026-09-15T12:00:00-03:00' }),
      ],
      [casa, laburo],
      '2026-09-14',
    )
    expect(detail.total).toBe(2)
    expect(detail.sunday).toBe('2026-09-20')
    expect(detail.byCategory.map((row) => [row.name, row.count])).toEqual([
      ['Casa', 1],
      ['Laburo', 1],
    ])
    expect(detail.weekdays.map((day) => day.count)).toEqual([1, 0, 0, 0, 0, 0, 1])
  })

  it('agrupa Sin categoría y queda vacio si esa semana no tuvo hechas', () => {
    const empty = computeWeekDetail(
      [task({ id: 'otra', completedAt: '2026-09-08T12:00:00-03:00' })],
      [casa],
      '2026-09-14',
    )
    expect(empty.total).toBe(0)
    expect(empty.byCategory).toEqual([])

    const loose = computeWeekDetail(
      [task({ id: 'suelta', completedAt: '2026-09-16T12:00:00-03:00' })],
      [casa],
      '2026-09-14',
    )
    expect(loose.byCategory).toEqual([
      { categoryId: null, name: UNCATEGORIZED_NAME, colorKey: null, count: 1 },
    ])
  })
})

describe('formatWeekSpan', () => {
  it('usa el formato corto de la app', () => {
    expect(formatWeekSpan('2026-09-14', '2026-09-20')).toBe('14 sept – 20 sept')
  })
})
