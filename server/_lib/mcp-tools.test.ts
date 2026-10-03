import { describe, expect, it } from 'vitest'
import type { AppState, Category, Note, Proposal, QuickTask, Task } from '../../src/shared/types.ts'
import { callProposalTool, callTool, listTools } from './mcp-tools.ts'

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
  expired: false,
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
  proposals: [],
  storageConfigured: false,
  version: '',
  ...over,
})

describe('listTools', () => {
  it('expone las de lectura y las de la bandeja', () => {
    expect(listTools().map((tool) => tool.name)).toEqual([
      'hoy',
      'semana',
      'tareas',
      'notas',
      'categorias',
      'propuestas',
      'proponer',
      'actualizar_propuesta',
      'descartar_propuesta',
    ])
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

  it('omite las hechas de semanas ya cerradas', () => {
    const result = callTool(
      'hoy',
      {},
      state({
        tasks: [
          task({ id: 'viva', title: 'Pendiente', inToday: true }),
          task({
            id: 'vieja',
            title: 'Hecha la semana pasada',
            status: 'hecha',
            inToday: true,
            completedAt: '2026-09-08T15:00:00-03:00',
          }),
        ],
      }),
      {
        today: '2026-09-15',
        week: ['2026-09-14', '2026-09-15', '2026-09-16', '2026-09-17', '2026-09-18', '2026-09-19', '2026-09-20'],
      },
    )

    expect(result).toMatchObject({ tasks: [{ id: 'viva' }] })
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

  it('no trata proponer como lectura', () => {
    expect(() => callTool('proponer', {}, state(), { today: '2026-09-15', week: [] })).toThrow(
      /desconocida/i,
    )
  })
})

const proposal = (over: Partial<Proposal> = {}): Proposal => ({
  id: 'p1',
  title: 'Llamar al banco',
  description: 'por la tarjeta',
  urgency: 'alta',
  deadline: '2026-10-04',
  categoryName: 'Tramites',
  categoryId: null,
  origen: 'gmail',
  origenUrl: 'https://mail.example/1',
  origenClave: 'msg-1',
  createdAt: '2026-10-03T12:00:00.000Z',
  updatedAt: '2026-10-03T12:00:00.000Z',
  ...over,
})

describe('callTool categorias y propuestas', () => {
  const clock = { today: '2026-09-15', week: [] as string[] }

  it('una propuesta pendiente no entra en hoy, semana ni tareas, ni crea su categoria', () => {
    const app = state({
      proposals: [proposal()],
      tasks: [task({ id: 'real', title: 'Comprar cafe', inToday: true, deadline: '2026-09-15' })],
    })

    expect(JSON.stringify(callTool('hoy', {}, app, { ...clock, today: '2026-09-15' }))).not.toContain(
      'Llamar al banco',
    )
    expect(JSON.stringify(callTool('semana', {}, app, { today: '2026-09-15', week: ['2026-09-14', '2026-09-15'] }))).not.toContain(
      'Llamar al banco',
    )
    expect(JSON.stringify(callTool('tareas', {}, app, clock))).not.toContain('Llamar al banco')
    expect(callTool('categorias', {}, app, clock)).toEqual({
      categories: [{ id: 'cat-casa', name: 'Casa' }],
    })
  })

  it('lista propuestas mas nuevas primero, con categoria sugerida', () => {
    const result = callTool(
      'propuestas',
      {},
      state({
        proposals: [
          proposal({ id: 'vieja', title: 'Vieja', createdAt: '2026-10-01T00:00:00.000Z' }),
          proposal({ id: 'nueva', title: 'Nueva', createdAt: '2026-10-03T00:00:00.000Z' }),
        ],
      }),
      clock,
    )

    expect(result).toMatchObject({
      proposals: [
        { id: 'nueva', categoryName: 'Tramites', categoryId: null },
        { id: 'vieja' },
      ],
    })
  })
})

describe('callProposalTool', () => {
  it('proponer con solo el nombre no manda categoryId', async () => {
    let seen: unknown
    const result = await callProposalTool(
      'proponer',
      { title: '  Comprar  ', categoryName: 'Viaje' },
      {
        upsert: async (input) => {
          seen = input
          return {
            creada: true,
            proposal: proposal({ title: input.title, categoryName: input.categoryName, categoryId: input.categoryId }),
          }
        },
        update: async () => null,
        discard: async () => false,
      },
    )

    expect(seen).toMatchObject({
      title: 'Comprar',
      categoryName: 'Viaje',
      categoryId: null,
      urgency: 'media',
    })
    expect(result).toMatchObject({ creada: true })
  })

  it('rechaza inToday y un categoryId que no es uuid', async () => {
    const store = {
      upsert: async () => {
        throw new Error('no deberia escribir')
      },
      update: async () => null,
      discard: async () => false,
    }
    await expect(callProposalTool('proponer', { title: 'x', inToday: false }, store)).rejects.toThrow(
      /inToday/,
    )
    await expect(
      callProposalTool('proponer', { title: 'x', categoryId: 'no-existe' }, store),
    ).rejects.toThrow(/uuid/)
  })

  it('actualizar y descartar avisan si la propuesta no esta', async () => {
    const store = {
      upsert: async () => {
        throw new Error('no')
      },
      update: async () => null,
      discard: async () => false,
    }
    const id = '11111111-2222-3333-4444-555555555555'
    await expect(callProposalTool('actualizar_propuesta', { id, title: 'Otro' }, store)).rejects.toThrow(
      /no encontrada/,
    )
    await expect(callProposalTool('descartar_propuesta', { id }, store)).rejects.toThrow(/no encontrada/)
  })
})
