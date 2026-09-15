import { describe, expect, it } from 'vitest'
import type { AppState } from '../src/shared/types.ts'
import { createMcpHandler } from './mcp.ts'

const state = (): AppState => ({
  categories: [],
  tasks: [],
  notes: [],
  quickTasks: [],
  storageConfigured: false,
})

const handler = createMcpHandler({
  loadState: async () => state(),
  now: () => new Date('2026-09-15T15:00:00.000Z'),
  timeZone: 'America/Argentina/Buenos_Aires',
})

describe('POST /api/mcp', () => {
  it('responde initialize en JSON-RPC', async () => {
    const req = {
      method: 'POST',
      query: {},
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'test' } },
      }),
    }
    const headers: Record<string, string> = {}
    let status = 200
    let payload: unknown
    await handler(req, {
      status(code) {
        status = code
        return this
      },
      json(value) {
        payload = value
      },
      send() {},
      setHeader(name, value) {
        headers[name] = value
      },
      end() {},
    })

    expect(status).toBe(200)
    expect(payload).toMatchObject({
      jsonrpc: '2.0',
      id: 1,
      result: { serverInfo: { name: 'gogoboy' }, protocolVersion: '2025-03-26' },
    })
  })
})
