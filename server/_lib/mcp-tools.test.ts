import { describe, expect, it } from 'vitest'
import type { AppState, Category, Note, QuickTask, Task } from '../../src/shared/types.ts'
import { callTool, listTools } from './mcp-tools.ts'

const category = (over: Partial<Category> = {}): Category => ({
  id: 'cat-casa',
  name: 'Casa',
  colorKey: 'peach',
  position: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
  ...over,
})

const task = (over: Partial<Task> = {}): Task => ({
  id: 't1',
  categoryId: 'cat-casa',
  title: 'Comprar cafe',
  description: null,
  notes: null,
  urgency: 'media',
  deadline: null,
  status: 'pendiente',
  inToday: false,
  hiddenInToday: false,
  todayPosition: null,
  position: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  completedAt: null,
  subtasks: [],
  attachments: [],
  links: [],
  ...over,
})

const note = (over: Partial<Note> = {}): Note => ({
  id: 'n1',
  kind: 'note',
  title: 'Lista del super',
  description: 'leche',
  username: null,
  password: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  tags: [],
  attachments: [],
  ...over,
})

const quick = (over: Partial<QuickTask> = {}): QuickTask => ({
  id: 'q1',
  title: 'Sacar la basura',
  done: false,
  position: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
  ...over,
})

const state = (over: Partial<AppState> = {}): AppState => ({
  categories: [category()],
  tasks: [],
  notes: [],
  quickTasks: [],
  storageConfigured: false,
  ...over,
})

describe('listTools', () => {
  it('expone hoy, semana, tareas y notas', () => {
    expect(listTools().map((tool) => tool.name)).toEqual(['hoy', 'semana', 'tareas', 'notas'])
  })
})

describe('callTool hoy', () => {
  it('devuelve las tareas visibles de Hoy y las quick pendientes', () => {
    const result = callTool(
      'hoy',
      {},
      state({
        tasks: [
          task({ id: 'visible', title: ' vis', inToday: true, hiddenInToday: false, todayPosition: 1 }),
          task({ id: 'oculta', title: 'ojo', inToday: true, hiddenInToday: true }),
          task({ id: 'otra', title: 'no', inToday: false }),
        ],
        quickTasks: [quick({ id: 'pendiente' }), quick({ id: 'hecha', title: 'ya', done: true })],
      }),
      { today: '2026-09-15', week: ['2026-09-14', '2026-09-15', '2026-09-16', '2026-09-17', '2026-09-18', '2026-09-19', '2026-09-20'] },
    )

    expect(result).toMatchObject({
      date: '2026-09-15',
      tasks: [{ id: 'visible', title: ' vis', category: 'Casa' }],
      quickTasks: [{ id: 'pendiente', title: 'Sacar la basura' }],
    })
    expect((result as { tasks: unknown[] }).tasks).toHaveLength(1)
    expect((result as { quickTasks: unknown[] }).quickTasks).toHaveLength(1)
  })
})

describe('callTool semana', () => {
  it('agrupa por deadline solo las de esa semana', () => {
    const result = callTool(
      'semana',
      {},
      state({
        tasks: [
          task({ id: 'lun', title: 'Lunes', deadline: '2026-09-14' }),
          task({ id: 'fuera', title: 'Otra semana', deadline: '2026-09-21' }),
          task({ id: 'sin', title: 'Sin fecha', deadline: null }),
        ],
      }),
      { today: '2026-09-15', week: ['2026-09-14', '2026-09-15', '2026-09-16', '2026-09-17', '2026-09-18', '2026-09-19', '2026-09-20'] },
    )

    expect(result).toMatchObject({
      week: ['2026-09-14', '2026-09-15', '2026-09-16', '2026-09-17', '2026-09-18', '2026-09-19', '2026-09-20'],
      days: [{ date: '2026-09-14', tasks: [{ id: 'lun', title: 'Lunes' }] }],
    })
    expect((result as { days: { date: string; tasks: unknown[] }[] }).days).toHaveLength(1)
  })
})

describe('callTool tareas', () => {
  it('filtra por texto y status, y nombra la categoria', () => {
    const result = callTool(
      'tareas',
      { q: 'cafe', status: 'pendiente' },
      state({
        tasks: [
          task({ id: 'ok', title: 'Comprar cafe', status: 'pendiente' }),
          task({ id: 'hecha', title: 'Comprar cafe', status: 'hecha' }),
          task({ id: 'otra', title: 'Pasear', status: 'pendiente' }),
        ],
      }),
      { today: '2026-09-15', week: [] },
    )

    expect(result).toEqual({
      tasks: [
        expect.objectContaining({ id: 'ok', title: 'Comprar cafe', category: 'Casa', status: 'pendiente' }),
      ],
    })
  })
})

describe('callTool notas', () => {
  it('omite las notas tipo password y nunca incluye usuario ni clave', () => {
    const result = callTool(
      'notas',
      {},
      state({
        notes: [
          note({ id: 'n1', title: 'Lista del super', description: 'leche' }),
          note({
            id: 'n2',
            kind: 'password',
            title: 'Banco',
            username: 'yo',
            password: 'secreto',
            description: null,
          }),
        ],
      }),
      { today: '2026-09-15', week: [] },
    )

    expect(result).toEqual({
      notes: [{ id: 'n1', title: 'Lista del super', description: 'leche', tags: [], updatedAt: '2026-01-01T00:00:00.000Z' }],
    })
    expect(JSON.stringify(result)).not.toMatch(/secreto|password|"yo"/)
  })
})

describe('callTool desconocida', () => {
  it('tira si el nombre no existe', () => {
    expect(() => callTool('borrar', {}, state(), { today: '2026-09-15', week: [] })).toThrow(
      /desconocida/i,
    )
  })
})
