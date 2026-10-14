import { describe, expect, it } from 'vitest'
import { tasksForHomeRail } from './home-rail'

const pendiente = { status: 'pendiente' as const, id: 'p' }
const progreso = { status: 'en_progreso' as const, id: 'e' }
const hecha = { status: 'hecha' as const, id: 'h' }

describe('tasksForHomeRail', () => {
  it('con el toggle apagado deja la lista como está', () => {
    const tasks = [pendiente, hecha, progreso]
    expect(tasksForHomeRail(tasks, false)).toBe(tasks)
  })

  it('en una lista mixta esconde solo las hechas y mantiene la lista', () => {
    expect(tasksForHomeRail([pendiente, hecha, progreso], true)).toEqual([pendiente, progreso])
  })

  it('esconde la lista entera solo cuando todas las tareas están hechas', () => {
    expect(tasksForHomeRail([hecha, { status: 'hecha' as const, id: 'h2' }], true)).toBeNull()
    expect(tasksForHomeRail([hecha], true)).toBeNull()
  })

  it('no esconde una lista vacía: no tiene tareas hechas que la completen', () => {
    expect(tasksForHomeRail([], true)).toEqual([])
  })

  it('deja visible una lista que solo tiene pendientes o en progreso', () => {
    expect(tasksForHomeRail([pendiente, progreso], true)).toEqual([pendiente, progreso])
  })

  it('no muta el array original', () => {
    const tasks = [pendiente, hecha]
    tasksForHomeRail(tasks, true)
    expect(tasks).toEqual([pendiente, hecha])
  })
})
