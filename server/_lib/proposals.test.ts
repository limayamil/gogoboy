import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Task } from '../../src/shared/types.ts'

const db = vi.hoisted(() => {
  const calls: { text: string; values: unknown[] }[] = []
  let categories: Record<string, unknown>[] = []
  let acceptRow: Record<string, unknown> | null = null
  let proposalRow: Record<string, unknown> | null = null
  const loadTask = vi.fn()

  const sql = (strings: TemplateStringsArray, ...values: unknown[]) => {
    const text = strings.join('?')
    calls.push({ text, values })
    if (text.includes('insert into tasks')) return Promise.resolve(acceptRow ? [acceptRow] : [])
    if (text.includes('insert into proposals') || text.includes('update proposals')) {
      return Promise.resolve(proposalRow ? [proposalRow] : [])
    }
    if (text.includes('from categories')) return Promise.resolve(categories)
    if (text.includes('delete from proposals')) return Promise.resolve([])
    return Promise.resolve([])
  }

  return {
    calls,
    sql,
    loadTask,
    reset() {
      calls.length = 0
      categories = []
      acceptRow = null
      proposalRow = null
      loadTask.mockReset()
    },
    setCategories(rows: Record<string, unknown>[]) {
      categories = rows
    },
    setAccept(row: Record<string, unknown> | null) {
      acceptRow = row
    },
    setProposal(row: Record<string, unknown> | null) {
      proposalRow = row
    },
  }
})

vi.mock('./db.ts', async () => {
  const actual = await vi.importActual<typeof import('./db.ts')>('./db.ts')
  return { ...actual, sql: db.sql, loadTask: db.loadTask }
})

import { HttpError } from './http.ts'
import { acceptProposal, applyCategoryPointer, categoryWrite, upsertProposal } from './proposals.ts'
import { parseProposalCreate } from './validate.ts'

const ID = '11111111-2222-3333-4444-555555555555'
const CASA = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'

const task = { id: 'task-1', title: 'Llamar' } as Task

function proposalRow(over: Record<string, unknown> = {}) {
  return {
    id: ID,
    title: 'Llamar',
    description: null,
    urgency: 'media',
    deadline: null,
    category_name: null,
    category_id: null,
    origen: null,
    origen_url: null,
    origen_clave: 'msg-1',
    created_at: '2026-10-03T12:00:00.000Z',
    updated_at: '2026-10-03T12:00:00.000Z',
    creada: true,
    ...over,
  }
}

function writeCall() {
  const call = db.calls.find((item) => item.text.includes('insert into tasks'))
  if (!call) throw new Error('no hubo sentencia de tomar')
  return call
}

beforeEach(() => {
  db.reset()
  db.loadTask.mockResolvedValue(task)
})

describe('applyCategoryPointer', () => {
  it('rechaza un categoryId que no existe', () => {
    expect(() => applyCategoryPointer({ categoryId: CASA, categoryName: null }, null)).toThrow(HttpError)
  })

  it('si mandan solo el id, copia el nombre vivo', () => {
    expect(applyCategoryPointer({ categoryId: CASA, categoryName: null }, { id: CASA, name: 'Casa' })).toEqual({
      categoryId: CASA,
      categoryName: 'Casa',
    })
  })

  it('si mandan solo el nombre, el id queda null aunque la lista exista', () => {
    expect(applyCategoryPointer({ categoryId: null, categoryName: 'Casa' }, null)).toEqual({
      categoryId: null,
      categoryName: 'Casa',
    })
  })
})

describe('categoryWrite', () => {
  it('solo el caso crear inserta categoria', () => {
    expect(categoryWrite({ kind: 'create', name: 'Nueva' })).toEqual({
      creating: true,
      categoryId: null,
      categoryName: 'Nueva',
    })
    expect(categoryWrite({ kind: 'none' })).toEqual({
      creating: false,
      categoryId: null,
      categoryName: null,
    })
    expect(categoryWrite({ kind: 'existing', categoryId: CASA })).toMatchObject({
      creating: false,
      categoryId: CASA,
    })
  })
})

describe('upsertProposal', () => {
  it('una propuesta pendiente no inserta en categories', async () => {
    db.setProposal(proposalRow({ category_name: 'Viaje' }))
    const result = await upsertProposal(parseProposalCreate({ title: 'Llamar', categoryName: 'Viaje' }))

    const insert = db.calls.find((item) => item.text.includes('insert into proposals'))
    expect(insert?.text).not.toMatch(/insert into categories/i)
    expect(insert?.values[4]).toBe('Viaje')
    expect(insert?.values[5]).toBeNull()
    expect(result.creada).toBe(true)
    expect(db.calls.some((item) => item.text.includes('insert into tasks'))).toBe(false)
  })

  it('un categoryId inexistente se rechaza y no escribe', async () => {
    db.setCategories([])
    await expect(
      upsertProposal(
        parseProposalCreate({ title: 'Llamar', categoryId: CASA }),
      ),
    ).rejects.toThrow(/no existe/)

    expect(db.calls.some((item) => item.text.includes('insert into proposals'))).toBe(false)
    expect(db.calls.some((item) => item.text.includes('insert into categories'))).toBe(false)
  })
})

describe('acceptProposal', () => {
  it('tomar con nombre desconocido crea categoria y tarea y borra la propuesta, en una sentencia', async () => {
    db.setAccept({
      task_id: 'task-1',
      new_category_id: 'cat-nueva',
      new_category_name: 'Viaje',
      new_color_key: 'coral',
      new_category_position: 0,
      new_category_created_at: '2026-10-03T12:00:00.000Z',
    })

    const result = await acceptProposal(ID, { categoryName: 'Viaje' })
    const write = writeCall()

    expect(db.calls.filter((item) => item.text.includes('insert into tasks'))).toHaveLength(1)
    expect(write.text).toMatch(/delete from proposals/i)
    expect(write.text).toMatch(/insert into categories/i)
    expect(write.text).toContain("'coral'")
    // id, creating, categoryId, categoryName, deadlineProvided, deadline, inToday
    expect(write.values).toEqual([ID, true, null, 'Viaje', false, null, false])
    expect(result.category?.name).toBe('Viaje')
    expect(result.category?.colorKey).toBe('coral')
    expect(result.task).toBe(task)
    expect(db.loadTask).toHaveBeenCalledWith('task-1')
  })

  it('tomar con el nombre limpio no crea categoria y deja category_id null', async () => {
    db.setAccept({ task_id: 'task-1', new_category_id: null })

    const result = await acceptProposal(ID, { categoryName: null, categoryId: null })
    const write = writeCall()

    expect(write.values[1]).toBe(false)
    expect(write.values[2]).toBeNull()
    expect(write.values[6]).toBe(false)
    expect(result.category).toBeNull()
  })

  it('enganchar un nombre que ya existe no marca creating', async () => {
    db.setCategories([{ id: CASA, name: 'Casa', position: 0 }])
    db.setAccept({ task_id: 'task-1', new_category_id: null })

    const result = await acceptProposal(ID, { categoryName: 'casa' })

    expect(writeCall().values[1]).toBe(false)
    expect(writeCall().values[2]).toBe(CASA)
    expect(result.category).toBeNull()
  })

  it('in_today no se marca salvo que el body lo pida', async () => {
    db.setAccept({ task_id: 'task-1', new_category_id: null })

    await acceptProposal(ID, {})
    expect(writeCall().values[6]).toBe(false)

    db.calls.length = 0
    await acceptProposal(ID, { inToday: true })
    expect(writeCall().values[6]).toBe(true)
  })

  it('si no mandan fecha, el flag deja copiar la sugerida; si mandan null, no', async () => {
    db.setAccept({ task_id: 'task-1', new_category_id: null })

    await acceptProposal(ID, {})
    expect(writeCall().values[4]).toBe(false)

    db.calls.length = 0
    await acceptProposal(ID, { deadline: null })
    expect(writeCall().values[4]).toBe(true)
    expect(writeCall().values[5]).toBeNull()
  })

  it('id inexistente no carga una tarea', async () => {
    db.setAccept(null)
    await expect(acceptProposal(ID, { categoryName: 'Viaje' })).rejects.toBeInstanceOf(HttpError)
    expect(db.loadTask).not.toHaveBeenCalled()
  })
})
