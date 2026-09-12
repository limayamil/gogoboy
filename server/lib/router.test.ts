import { describe, expect, it } from 'vitest'
import { createApiHandler } from './router.ts'
import { body, route } from '../_lib/http.ts'
import type { ApiRequest } from '../_lib/http.ts'

const UUID = '11111111-2222-3333-4444-555555555555'

/** Handler espia: responde con lo que recibio, para poder afirmar sobre la conversion. */
const echo = route({
  GET(req, res) {
    res.status(200).json(seen(req))
  },
  POST(req, res) {
    res.setHeader('x-custom', 'si')
    res.status(201).json(seen(req))
  },
  DELETE(_req, res) {
    res.status(204).end()
  },
})

const seen = (req: ApiRequest) => ({
  method: req.method,
  query: req.query,
  body: body(req),
  contentType: req.headers['content-type'],
})

const handler = createApiHandler([
  ['/api/state', echo],
  ['/api/tasks', echo],
  ['/api/tasks/:id', echo],
])

const call = (url: string, init?: RequestInit) => handler(new Request(url, init))

/** `Response.json()` devuelve unknown; el espia siempre responde con la forma de `seen`. */
const readJson = async (response: Response) =>
  (await response.json()) as ReturnType<typeof seen>

describe('createApiHandler', () => {
  it('enruta una ruta estatica al handler correspondiente', async () => {
    const response = await call('https://gogoboy.vercel.app/api/state')

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ method: 'GET', query: {} })
  })

  it('copia el parametro dinamico a req.query.id', async () => {
    const response = await call(`https://gogoboy.vercel.app/api/tasks/${UUID}`)

    expect((await readJson(response)).query).toEqual({ id: UUID })
  })

  it('no confunde una ruta estatica con el segmento dinamico', async () => {
    const response = await call('https://gogoboy.vercel.app/api/tasks')

    expect((await readJson(response)).query).toEqual({})
  })

  it('incluye la query string en req.query', async () => {
    const response = await call('https://gogoboy.vercel.app/api/state?hidden=1')

    expect((await readJson(response)).query).toEqual({ hidden: '1' })
  })

  it('pasa el cuerpo JSON y devuelve status y headers del handler', async () => {
    const response = await call('https://gogoboy.vercel.app/api/tasks', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'Comprar cafe' }),
    })

    expect(response.status).toBe(201)
    expect(response.headers.get('x-custom')).toBe('si')
    expect(response.headers.get('content-type')).toContain('application/json')
    expect((await readJson(response)).body).toEqual({ title: 'Comprar cafe' })
  })

  it('responde 204 sin cuerpo', async () => {
    const response = await call(`https://gogoboy.vercel.app/api/tasks/${UUID}`, {
      method: 'DELETE',
    })

    expect(response.status).toBe(204)
    expect(await response.text()).toBe('')
  })

  it('devuelve un 404 en JSON cuando ninguna ruta coincide', async () => {
    const response = await call('https://gogoboy.vercel.app/api/nope')

    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({ error: 'Sin ruta para GET /api/nope' })
  })

  it('propaga el 405 de route() para un metodo no soportado', async () => {
    const response = await call('https://gogoboy.vercel.app/api/state', { method: 'PUT' })

    expect(response.status).toBe(405)
    expect(response.headers.get('allow')).toBe('GET, POST, DELETE')
  })

  it('acepta URL relativa como la que manda el runtime Node de Vercel', async () => {
    const response = await handler({
      url: '/api/state',
      method: 'GET',
      headers: new Headers({ host: 'gogoboy.vercel.app' }),
      text: async () => '',
    } as unknown as Request)

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ method: 'GET' })
  })

  it('responde 500 en JSON si el handler tira, para no devolver FUNCTION_INVOCATION_FAILED', async () => {
    const boom = createApiHandler([
      [
        '/api/boom',
        () => {
          throw new Error('fallo de prueba')
        },
      ],
    ])

    const response = await boom(new Request('https://gogoboy.vercel.app/api/boom'))

    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ error: 'fallo de prueba' })
  })
})
