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
