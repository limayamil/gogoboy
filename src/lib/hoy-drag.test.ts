import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  HOY_HANDLE_ACTIVATION_PX,
  HOY_PANEL_ID,
  LIST_PANEL_ID,
  hitsWhileReorderingHoy,
  restrictHoyReorderToVerticalAxis,
} from './hoy-drag'

const transform = { x: 48, y: 12, scaleX: 1, scaleY: 1 }

describe('eje vertical de la manija', () => {
  it('anula el eje X solo cuando el arrastre es un reorder de Hoy', () => {
    const vertical = restrictHoyReorderToVerticalAxis({
      active: { data: { current: { sortable: { index: 0 } } } },
      transform,
    } as unknown as Parameters<typeof restrictHoyReorderToVerticalAxis>[0])
    expect(vertical).toEqual({ x: 0, y: 12, scaleX: 1, scaleY: 1 })

    const fromLists = restrictHoyReorderToVerticalAxis({
      active: { data: { current: {} } },
      transform,
    } as unknown as Parameters<typeof restrictHoyReorderToVerticalAxis>[0])
    expect(fromLists.x).toBe(48)
  })
})

describe('colisión al reordenar Hoy', () => {
  it('no suelta la tarea en Listas', () => {
    const task = { id: 'tarea' }
    const list = { id: LIST_PANEL_ID }
    const panel = { id: HOY_PANEL_ID }

    expect(hitsWhileReorderingHoy([list, task], [list], true)).toEqual([task])
    expect(hitsWhileReorderingHoy([list], [task, list], true)).toEqual([task])
    expect(hitsWhileReorderingHoy([panel, list], [list], true).map((hit) => hit.id)).toEqual([
      HOY_PANEL_ID,
    ])
  })

  it('desde las listas, Listas y el panel siguen siendo destinos', () => {
    const list = { id: LIST_PANEL_ID }
    const panel = { id: HOY_PANEL_ID }
    expect(hitsWhileReorderingHoy([list, panel], [], false)).toEqual([list])
    expect(hitsWhileReorderingHoy([panel], [], false)).toEqual([panel])
  })
})

describe('la manija no usa la fila entera', () => {
  const here = dirname(fileURLToPath(import.meta.url))
  const view = readFileSync(join(here, '../views/TodayView.tsx'), 'utf8')
  const css = readFileSync(join(here, '../views/TodayView.module.css'), 'utf8')
  const toggle = readFileSync(join(here, '../components/StatusToggle.tsx'), 'utf8')
  const rowStart = view.indexOf('function TodayRow')
  const rowEnd = view.indexOf('\nfunction Rail')
  const row = view.slice(rowStart, rowEnd)

  it('los listeners viven en la manija, con umbral corto y eje vertical', () => {
    expect(HOY_HANDLE_ACTIVATION_PX).toBe(8)
    expect(view).toContain('HOY_HANDLE_ACTIVATION_PX')
    expect(view).toContain('modifiers={[restrictHoyReorderToVerticalAxis]}')
    expect(view).not.toContain('distance: 6')

    const main = row.match(/<div className=\{styles\.todayRowMain\}[^>]*>/)?.[0] ?? ''
    expect(main).not.toContain('listeners')
    expect(main).not.toContain('attributes')

    const handleAt = row.indexOf('styles.dragHandle')
    const handle = row.slice(row.lastIndexOf('<button', handleAt), row.indexOf('</button>', handleAt))
    expect(handle).toContain('setActivatorNodeRef')
    expect(handle).toContain('{...listeners}')
    expect(handle).toContain('{...attributes}')
    expect(handle).toContain('aria-label="Arrastrá para reordenar"')

    const outside = row.replace(handle, '')
    expect(outside).not.toContain('{...listeners}')
    expect(outside).not.toContain('{...attributes}')
  })

  it('el titulo, el circulo de estado y el ojito frenan el pointerdown', () => {
    expect(toggle).toContain('onPointerDown={(event) => event.stopPropagation()}')
    expect(row).toMatch(
      /styles\.rowTitle[\s\S]*?onPointerDown=\{\(event\) => event\.stopPropagation\(\)\}/,
    )
    expect(row).toMatch(
      /styles\.rowEye[\s\S]*?onPointerDown=\{\(event\) => event\.stopPropagation\(\)\}/,
    )
  })

  it('una tarea que ya está en Hoy no registra otro draggable en Listas', () => {
    expect(view).toContain('if (props.task.inToday) return <RailTaskRow')
    expect(view).not.toContain('disabled: task.inToday')
  })

  it('la manija mide 44px, no scrollea con el dedo, y la inserción es una linea de 2px', () => {
    const handleCss = css.match(/\.dragHandle \{[^}]+\}/)?.[0] ?? ''
    expect(handleCss).toMatch(/width:\s*44px/)
    expect(handleCss).toMatch(/touch-action:\s*none/)
    expect(row).toContain('isOver && !isDragging')
    expect(row).toContain('styles.insertLine')
    const line = css.match(/\.insertLine \{[^}]+\}/)?.[0] ?? ''
    expect(line).toMatch(/height:\s*2px/)
  })
})
