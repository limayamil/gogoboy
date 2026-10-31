import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { HIDE_COMPLETED_ON_HOME_KEY, readHideCompletedOnHome, tasksForHomeRail } from './home-rail'

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

describe('preferencia compartida de ocultar hechas', () => {
  it('usa la clave de Hoy y arranca apagada', () => {
    expect(HIDE_COMPLETED_ON_HOME_KEY).toBe('gogoboy.hideCompletedOnHome')
    expect(readHideCompletedOnHome(null)).toBe(false)
    expect(readHideCompletedOnHome('false')).toBe(false)
    expect(readHideCompletedOnHome('')).toBe(false)
    expect(readHideCompletedOnHome('TRUE')).toBe(false)
    expect(readHideCompletedOnHome('true')).toBe(true)
  })

  it('Hoy y Categorías leen y escriben la misma preferencia y el mismo filtro', () => {
    const views = dirname(fileURLToPath(import.meta.url))
    const today = readFileSync(join(views, '../views/TodayView.tsx'), 'utf8')
    const categories = readFileSync(join(views, '../views/CategoriesView.tsx'), 'utf8')

    for (const source of [today, categories]) {
      expect(source).toContain('HIDE_COMPLETED_ON_HOME_KEY')
      expect(source).toContain('readHideCompletedOnHome')
      expect(source).toContain('tasksForHomeRail')
      expect(source).toContain('localStorage.getItem(HIDE_COMPLETED_ON_HOME_KEY)')
      expect(source).toContain('localStorage.setItem(HIDE_COMPLETED_ON_HOME_KEY, String(next))')
      expect(source).not.toContain("'gogoboy.hideCompletedOnHome'")
      expect(source).not.toContain('"gogoboy.hideCompletedOnHome"')
    }
  })
})
