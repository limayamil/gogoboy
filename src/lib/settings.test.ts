import { describe, expect, it } from 'vitest'
import {
  COMPLETED_LAST_ON_HOME_KEY,
  SHOW_LIST_ON_TASK_KEY,
  SHOW_MEETS_KEY,
  SUGGEST_DUE_TODAY_KEY,
  addToTodayPatch,
  categoryListName,
  isShownInTodayPanel,
  readCompletedLastOnHome,
  readShowListOnTask,
  readShowMeets,
  readSuggestDueToday,
  suggestionStripTasks,
  visibleListLabel,
  type SuggestableTask,
} from './settings'

const TODAY = '2026-10-24'

type Row = SuggestableTask & { id: string }

function task(partial: Partial<Row> & { id: string }): Row {
  return {
    inToday: false,
    hiddenInToday: false,
    expired: false,
    status: 'pendiente',
    completedAt: null,
    deadline: TODAY,
    ...partial,
  }
}

describe('completadas al final en Hoy', () => {
  it('usa la clave gogoboy.completedLastOnHome y viene apagado', () => {
    expect(COMPLETED_LAST_ON_HOME_KEY).toBe('gogoboy.completedLastOnHome')
    expect(readCompletedLastOnHome(() => null)).toBe(false)
    expect(readCompletedLastOnHome(() => 'false')).toBe(false)
    expect(readCompletedLastOnHome(() => '')).toBe(false)
    expect(readCompletedLastOnHome(() => 'TRUE')).toBe(false)
    expect(readCompletedLastOnHome(() => 'true')).toBe(true)
  })
})

describe('Meets del día', () => {
  it('usa la clave gogoboy.showMeets y viene apagado', () => {
    expect(SHOW_MEETS_KEY).toBe('gogoboy.showMeets')
    expect(readShowMeets(() => null)).toBe(false)
    expect(readShowMeets(() => 'false')).toBe(false)
    expect(readShowMeets(() => 'true')).toBe(true)
  })
})

describe('etiqueta de lista', () => {
  it('usa la clave gogoboy.showListOnTask y viene apagada', () => {
    expect(SHOW_LIST_ON_TASK_KEY).toBe('gogoboy.showListOnTask')
    expect(readShowListOnTask(() => null)).toBe(false)
    expect(readShowListOnTask(() => 'false')).toBe(false)
    expect(readShowListOnTask(() => 'true')).toBe(true)
  })

  it('esconde el nombre por defecto y lo muestra con el ajuste prendido', () => {
    expect(visibleListLabel(false, 'Galeón')).toBeNull()
    expect(visibleListLabel(true, 'Galeón')).toBe('Galeón')
  })

  it('no muestra línea si la tarea no tiene lista', () => {
    expect(visibleListLabel(true, null)).toBeNull()
    expect(visibleListLabel(true, undefined)).toBeNull()
    expect(visibleListLabel(true, '   ')).toBeNull()
    expect(categoryListName(null, [{ id: 'g', name: 'Galeón' }])).toBeNull()
    expect(categoryListName('otra', [{ id: 'g', name: 'Galeón' }])).toBeNull()
    expect(categoryListName('g', [{ id: 'g', name: 'Galeón' }])).toBe('Galeón')
  })
})

describe('sugerencias de hoy', () => {
  it('usa la clave gogoboy.suggestDueToday y viene prendida', () => {
    expect(SUGGEST_DUE_TODAY_KEY).toBe('gogoboy.suggestDueToday')
    expect(readSuggestDueToday(() => null)).toBe(true)
    expect(readSuggestDueToday(() => 'true')).toBe(true)
    expect(readSuggestDueToday(() => 'false')).toBe(false)
  })

  it('solo sugiere las que vencen hoy, no están en el panel y no están hechas', () => {
    const yes = task({ id: 'si', status: 'en_progreso' })
    const onHoy = task({ id: 'hoy', inToday: true })
    const done = task({ id: 'hecha', status: 'hecha' })
    const tomorrow = task({ id: 'manana', deadline: '2026-10-25' })
    const noDate = task({ id: 'sindia', deadline: null })

    expect(isShownInTodayPanel(onHoy, false)).toBe(true)
    expect(suggestionStripTasks([onHoy, yes, done, tomorrow, noDate], TODAY, false, true)).toEqual([
      yes,
    ])
  })

  it('no sugiere una tarea que el panel de Hoy ya muestra', () => {
    const visible = task({ id: 'visible', inToday: true, hiddenInToday: false })
    const hiddenButShown = task({ id: 'oculta-vista', inToday: true, hiddenInToday: true })

    expect(suggestionStripTasks([visible], TODAY, false, true)).toEqual([])
    expect(suggestionStripTasks([hiddenButShown], TODAY, true, true)).toEqual([])
  })

  it('sí sugiere una de Hoy que el panel tiene escondida con el ojito', () => {
    const hidden = task({ id: 'oculta', inToday: true, hiddenInToday: true })
    expect(isShownInTodayPanel(hidden, false)).toBe(false)
    expect(suggestionStripTasks([hidden], TODAY, false, true)).toEqual([hidden])
  })

  it('Tomar para hoy usa el parche de agregar a hoy y deja de sugerirla', () => {
    const row = task({ id: 'galeon', hiddenInToday: true })
    const patch = addToTodayPatch()
    expect(patch).toEqual({ inToday: true, hiddenInToday: false })

    const taken = { ...row, ...patch }
    expect(isShownInTodayPanel(taken, false)).toBe(true)
    expect(suggestionStripTasks([taken], TODAY, false, true)).toEqual([])
  })

  it('con el ajuste apagado no hay franja aunque haya candidatas', () => {
    expect(suggestionStripTasks([task({ id: 'a' })], TODAY, false, false)).toEqual([])
  })

  it('si nadie califica la franja queda vacía', () => {
    const rows = [
      task({ id: 'hoy', inToday: true }),
      task({ id: 'hecha', status: 'hecha' }),
      task({ id: 'manana', deadline: '2026-10-25' }),
    ]
    expect(suggestionStripTasks(rows, TODAY, false, true)).toEqual([])
  })
})
