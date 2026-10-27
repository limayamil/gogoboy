import { describe, expect, it } from 'vitest'
import { handleApi } from './api-handler.ts'

const UUID = '11111111-2222-3333-4444-555555555555'

const call = (path: string, method = 'OPTIONS') =>
  handleApi(new Request(`https://gogoboy.vercel.app${path}`, { method }))

describe('handleApi', () => {
  it('enruta un segmento y dos segmentos (el caso que Vercel no catch-allea)', async () => {
    expect((await call('/api/state')).status).toBe(204)
    expect((await call(`/api/categories/${UUID}`)).status).toBe(204)
    expect((await call('/api/uploads/sign')).status).toBe(204)
    expect((await call('/api/notes')).status).toBe(204)
    expect((await call(`/api/notes/${UUID}`)).status).toBe(204)
    expect((await call('/api/mcp')).status).toBe(204)
    expect((await call('/api/version')).status).toBe(204)
    expect((await call(`/api/proposals/${UUID}`)).status).toBe(204)
  })

  it('tomar y tirar existen, y sin JWT no llegan a la base', async () => {
    const post = await call(`/api/proposals/${UUID}`, 'POST')
    const del = await call(`/api/proposals/${UUID}`, 'DELETE')
    expect(post.status).toBe(401)
    expect(del.status).toBe(401)
  })

  it('las rutas de Meets existen y piden el mismo JWT que el resto', async () => {
    const paths: Array<[string, string]> = [
      ['/api/meets', 'GET'],
      ['/api/meet-calendars', 'GET'],
      ['/api/meet-calendars', 'POST'],
      [`/api/meet-calendars/${UUID}`, 'PATCH'],
      [`/api/meet-calendars/${UUID}`, 'DELETE'],
    ]
    for (const [path, method] of paths) {
      expect((await call(path)).status).toBe(204)
      const anonymous = await call(path, method)
      expect(anonymous.status).toBe(401)
      const forged = await handleApi(
        new Request(`https://gogoboy.vercel.app${path}`, {
          method,
          headers: { authorization: 'Bearer token-inventado' },
        }),
      )
      expect(forged.status).toBe(401)
    }
  })

  it('responde 404 JSON cuando la ruta no existe', async () => {
    const response = await call('/api/nope', 'GET')
    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({ error: 'Sin ruta para GET /api/nope' })
  })

  it('responde 401 en una ruta real si no hay token', async () => {
    const response = await call('/api/state', 'GET')
    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: 'No autenticado' })
  })
})
