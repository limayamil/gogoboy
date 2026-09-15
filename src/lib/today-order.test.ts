import { describe, expect, it } from 'vitest'
import { nextTodayPositions } from './today-order'

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
