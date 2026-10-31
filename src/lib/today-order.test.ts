import { describe, expect, it } from 'vitest'
import type { Status } from '../shared/types'
import { tasksForHomeRail } from './home-rail'
import { nextHoyPositions, nextTodayPositions, orderHoyTasks } from './today-order'

describe('nextTodayPositions', () => {
  it('mueve una tarea hacia arriba y reindexa 0..n-1', () => {
    expect(nextTodayPositions(['a', 'b', 'c'], 'c', 'a')).toEqual([
      { id: 'c', todayPosition: 0 },
      { id: 'a', todayPosition: 1 },
      { id: 'b', todayPosition: 2 },
    ])
  })

  it('mueve una tarea hacia abajo', () => {
    expect(nextTodayPositions(['a', 'b', 'c'], 'a', 'c')).toEqual([
      { id: 'b', todayPosition: 0 },
      { id: 'c', todayPosition: 1 },
      { id: 'a', todayPosition: 2 },
    ])
  })

  it('deja las ocultas en su hueco si no son el origen ni el destino', () => {
    expect(nextTodayPositions(['a', 'hidden', 'b'], 'b', 'a')).toEqual([
      { id: 'b', todayPosition: 0 },
      { id: 'a', todayPosition: 1 },
      { id: 'hidden', todayPosition: 2 },
    ])
  })

  it('no hace nada si origen y destino son la misma tarea', () => {
    expect(nextTodayPositions(['a', 'b'], 'a', 'a')).toBeNull()
  })

  it('no hace nada si alguna de las tareas no está en Hoy', () => {
    expect(nextTodayPositions(['a', 'b'], 'a', 'zona-hoy')).toBeNull()
    expect(nextTodayPositions(['a', 'b'], 'faltante', 'b')).toBeNull()
  })

  it('no muta el array original', () => {
    const ids = ['a', 'b', 'c']
    nextTodayPositions(ids, 'c', 'a')
    expect(ids).toEqual(['a', 'b', 'c'])
  })
})

const row = (id: string, status: Status, todayPosition: number) => ({ id, status, todayPosition })

describe('orderHoyTasks', () => {
  it('con el ajuste apagado respeta todayPosition', () => {
    const tasks = [row('b', 'hecha', 1), row('a', 'pendiente', 0), row('c', 'en_progreso', 2)]
    expect(orderHoyTasks(tasks, false).map((task) => task.id)).toEqual(['a', 'b', 'c'])
  })

  it('manda las hechas al final y cada grupo conserva su orden', () => {
    const tasks = [
      row('h1', 'hecha', 0),
      row('p1', 'pendiente', 1),
      row('e1', 'en_progreso', 2),
      row('h2', 'hecha', 3),
      row('p2', 'pendiente', 4),
    ]
    expect(orderHoyTasks(tasks, true).map((task) => task.id)).toEqual(['p1', 'e1', 'p2', 'h1', 'h2'])
  })

  it('no esconde las hechas: Ocultar hechas sigue siendo el filtro de las listas', () => {
    const tasks = [row('p', 'pendiente', 0), row('h', 'hecha', 1)]
    expect(orderHoyTasks(tasks, true).map((task) => task.id)).toEqual(['p', 'h'])
    expect(tasksForHomeRail(tasks, true)?.map((task) => task.id)).toEqual(['p'])
  })

  it('no muta el array original', () => {
    const tasks = [row('h', 'hecha', 0), row('p', 'pendiente', 1)]
    orderHoyTasks(tasks, true)
    expect(tasks.map((task) => task.id)).toEqual(['h', 'p'])
  })
})

describe('nextHoyPositions', () => {
  it('sin el ajuste reordena como antes, ocultas incluidas', () => {
    const tasks = [row('a', 'pendiente', 0), row('hidden', 'pendiente', 1), row('b', 'hecha', 2)]
    expect(nextHoyPositions(tasks, false, 'b', 'a')).toEqual(
      nextTodayPositions(['a', 'hidden', 'b'], 'b', 'a'),
    )
  })

  it('reordena dentro del orden visible, no del todayPosition crudo', () => {
    const tasks = [row('h', 'hecha', 0), row('a', 'pendiente', 1), row('b', 'pendiente', 2)]
    expect(orderHoyTasks(tasks, true).map((task) => task.id)).toEqual(['a', 'b', 'h'])
    expect(nextHoyPositions(tasks, true, 'a', 'h')).toEqual([
      { id: 'b', todayPosition: 0 },
      { id: 'a', todayPosition: 1 },
      { id: 'h', todayPosition: 2 },
    ])
  })

  it('reordena las hechas entre sí y deja las pendientes quietas', () => {
    const tasks = [row('a', 'pendiente', 0), row('h1', 'hecha', 1), row('h2', 'hecha', 2)]
    expect(nextHoyPositions(tasks, true, 'h2', 'h1')).toEqual([
      { id: 'a', todayPosition: 0 },
      { id: 'h2', todayPosition: 1 },
      { id: 'h1', todayPosition: 2 },
    ])
  })

  it('no guarda un drop que volvería a mezclar una hecha con las pendientes', () => {
    const tasks = [row('a', 'pendiente', 1), row('b', 'pendiente', 2), row('h', 'hecha', 0)]
    expect(nextHoyPositions(tasks, true, 'h', 'a')).toBeNull()
  })
})
