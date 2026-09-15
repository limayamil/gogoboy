import { describe, expect, it } from 'vitest'
import { createAuthenticator } from './auth.ts'

const allowed = 'yo@example.com'

function request(init: { method?: string; authorization?: string; path?: string }) {
  const headers = new Headers()
  if (init.authorization) headers.set('authorization', init.authorization)
  return new Request(`https://gogoboy.vercel.app${init.path ?? '/api/state'}`, {
    method: init.method ?? 'GET',
    headers,
  })
}

describe('createAuthenticator', () => {
  it('deja pasar OPTIONS sin token (preflight)', async () => {
    const authenticate = createAuthenticator({
      allowedEmail: allowed,
      verifyToken: async () => {
        throw new Error('no deberia verificar en OPTIONS')
      },
    })

    expect(await authenticate(request({ method: 'OPTIONS' }))).toBeNull()
  })

  it('responde 401 si no hay Authorization', async () => {
    const authenticate = createAuthenticator({
      allowedEmail: allowed,
      verifyToken: async () => ({ email: allowed }),
    })

    const response = await authenticate(request({}))
    expect(response?.status).toBe(401)
    expect(await response?.json()).toEqual({ error: 'No autenticado' })
  })

  it('responde 401 si el Bearer no verifica', async () => {
    const authenticate = createAuthenticator({
      allowedEmail: allowed,
      verifyToken: async () => null,
    })

    const response = await authenticate(request({ authorization: 'Bearer mentira' }))
    expect(response?.status).toBe(401)
    expect(await response?.json()).toEqual({ error: 'No autenticado' })
  })

  it('responde 403 si el email no esta en la allowlist', async () => {
    const authenticate = createAuthenticator({
      allowedEmail: allowed,
      verifyToken: async () => ({ email: 'otro@example.com' }),
    })

    const response = await authenticate(request({ authorization: 'Bearer ok' }))
    expect(response?.status).toBe(403)
    expect(await response?.json()).toEqual({ error: 'No autorizado' })
  })

  it('deja pasar si el email coincide, sin importar mayusculas', async () => {
    const authenticate = createAuthenticator({
      allowedEmail: 'Yo@Example.com',
      verifyToken: async () => ({ email: 'yo@example.com' }),
    })

    expect(await authenticate(request({ authorization: 'Bearer ok' }))).toBeNull()
  })

  it('responde 403 si no hay allowlist, aunque el token sea valido', async () => {
    const authenticate = createAuthenticator({
      allowedEmail: '',
      verifyToken: async () => ({ email: allowed }),
    })

    const response = await authenticate(request({ authorization: 'Bearer ok' }))
    expect(response?.status).toBe(403)
  })

  it('en /api/mcp deja pasar el token de agente, sin verificar JWT', async () => {
    const authenticate = createAuthenticator({
      allowedEmail: allowed,
      agentToken: 'agente-secreto',
      verifyToken: async () => {
        throw new Error('no deberia verificar JWT en MCP')
      },
    })

    expect(
      await authenticate(request({ path: '/api/mcp', authorization: 'Bearer agente-secreto' })),
    ).toBeNull()
  })

  it('en /api/mcp responde 401 si el token de agente no coincide', async () => {
    const authenticate = createAuthenticator({
      allowedEmail: allowed,
      agentToken: 'agente-secreto',
      verifyToken: async () => ({ email: allowed }),
    })

    const response = await authenticate(
      request({ path: '/api/mcp', authorization: 'Bearer otro' }),
    )
    expect(response?.status).toBe(401)
    expect(await response?.json()).toEqual({ error: 'No autenticado' })
  })

  it('no acepta el token de agente en el resto de /api', async () => {
    const authenticate = createAuthenticator({
      allowedEmail: allowed,
      agentToken: 'agente-secreto',
      verifyToken: async () => null,
    })

    const response = await authenticate(request({ authorization: 'Bearer agente-secreto' }))
    expect(response?.status).toBe(401)
  })

  it('en /api/mcp responde 503 si el token de agente no esta configurado', async () => {
    const authenticate = createAuthenticator({
      allowedEmail: allowed,
      agentToken: '',
      verifyToken: async () => ({ email: allowed }),
    })

    const response = await authenticate(
      request({ path: '/api/mcp', authorization: 'Bearer lo-que-sea' }),
    )
    expect(response?.status).toBe(503)
    expect(await response?.json()).toEqual({ error: 'MCP no configurado' })
  })
})
