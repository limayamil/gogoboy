import { describe, expect, it } from 'vitest'
import type { AppState, Note } from '../../src/shared/types.ts'
import { handleMcpMessage } from './mcp.ts'

const emptyState = (): AppState => ({
  categories: [],
  tasks: [],
  notes: [],
  quickTasks: [],
  storageConfigured: false,
})

const clock = { today: '2026-09-15', week: ['2026-09-14', '2026-09-15'] }

async function send(message: unknown, state: AppState = emptyState()) {
  return handleMcpMessage(message, { loadState: async () => state, clock })
}

describe('handleMcpMessage', () => {
  it('responde initialize con tools y sin sesion', async () => {
    const response = await send({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2025-03-26',
        capabilities: {},
        clientInfo: { name: 'grok', version: '1' },
      },
    })

    expect(response.status).toBe(200)
    expect(response.body).toMatchObject({
      jsonrpc: '2.0',
      id: 1,
      result: {
        protocolVersion: '2025-03-26',
        capabilities: { tools: {} },
        serverInfo: { name: 'gogoboy' },
      },
    })
  })

  it('acepta la notificacion initialized sin cuerpo', async () => {
    const response = await send({
      jsonrpc: '2.0',
      method: 'notifications/initialized',
    })

    expect(response.status).toBe(204)
    expect(response.body).toBeNull()
  })

  it('lista las tools de solo lectura', async () => {
    const response = await send({ jsonrpc: '2.0', id: 2, method: 'tools/list' })

    expect(response.status).toBe(200)
    const body = response.body as { result: { tools: { name: string }[] } }
    expect(body.result.tools.map((tool) => tool.name)).toEqual(['hoy', 'semana', 'tareas', 'notas'])
  })

  it('ejecuta notas sin filtrar passwords hacia el modelo', async () => {
    const notes: Note[] = [
      {
        id: 'n1',
        kind: 'note',
        title: 'Idea',
        description: 'hola',
        username: null,
        password: null,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        tags: [],
        attachments: [],
      },
      {
        id: 'n2',
        kind: 'password',
        title: 'Banco',
        description: null,
        username: 'yo',
        password: 'secreto',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        tags: [],
        attachments: [],
      },
    ]

    const response = await send(
      {
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: { name: 'notas', arguments: {} },
      },
      { ...emptyState(), notes },
    )

    expect(response.status).toBe(200)
    const body = response.body as {
      result: { content: { type: string; text: string }[]; isError?: boolean }
    }
    expect(body.result.isError).toBeFalsy()
    expect(body.result.content[0]?.type).toBe('text')
    expect(body.result.content[0]?.text).toContain('Idea')
    expect(body.result.content[0]?.text).not.toContain('secreto')
    expect(body.result.content[0]?.text).not.toContain('Banco')
  })

  it('responde error JSON-RPC si el metodo no existe', async () => {
    const response = await send({ jsonrpc: '2.0', id: 9, method: 'boom' })

    expect(response.status).toBe(200)
    expect(response.body).toMatchObject({
      jsonrpc: '2.0',
      id: 9,
      error: { code: -32601 },
    })
  })
})
