import { timingSafeEqual } from 'node:crypto'
import { createRemoteJWKSet, jwtVerify } from 'jose'

export interface TokenPayload {
  email?: unknown
}

export type VerifyToken = (token: string) => Promise<TokenPayload | null>

/**
 * El candado de la API: JWT de Neon Auth + un solo email. Las tablas no tienen
 * user_id, asi que sin allowlist cualquier cuenta valida veria todos los datos.
 *
 * /api/mcp es la excepcion: va con AUTH_AGENT_TOKEN, no con sesion humana. El
 * token de agente no abre el resto de /api (no hay user_id; un write seria de
 * la cuenta entera).
 */
export function createAuthenticator(options: {
  allowedEmail: string
  agentToken?: string
  verifyToken: VerifyToken
}): (request: Request) => Promise<Response | null> {
  const allowed = options.allowedEmail.trim().toLowerCase()
  const agentToken = options.agentToken?.trim() ?? ''

  return async (request) => {
    if (request.method.toUpperCase() === 'OPTIONS') return null

    if (requestPath(request) === '/api/mcp') {
      if (!agentToken) return deny(503, 'MCP no configurado')
      const token = bearerToken(request)
      if (!token || !tokenMatches(agentToken, token)) return deny(401, 'No autenticado')
      return null
    }

    const token = bearerToken(request)
    if (!token) return deny(401, 'No autenticado')

    const payload = await options.verifyToken(token)
    const email = typeof payload?.email === 'string' ? payload.email.trim().toLowerCase() : ''
    if (!email) return deny(401, 'No autenticado')

    if (!allowed || email !== allowed) return deny(403, 'No autorizado')

    return null
  }
}

function bearerToken(request: Request): string | null {
  const header = request.headers.get('authorization')
  if (!header) return null
  const match = /^Bearer\s+(.+)$/i.exec(header.trim())
  const token = match?.[1]?.trim()
  return token || null
}

function requestPath(request: Request): string {
  const raw = request.url || '/'
  try {
    return new URL(raw).pathname
  } catch {
    const host = request.headers.get('host') ?? 'localhost'
    return new URL(raw, `http://${host}`).pathname
  }
}

function tokenMatches(expected: string, actual: string): boolean {
  const left = Buffer.from(expected)
  const right = Buffer.from(actual)
  if (left.length !== right.length) return false
  return timingSafeEqual(left, right)
}

function deny(status: 401 | 403 | 503, error: string): Response {
  return Response.json({ error }, { status })
}

function authBaseUrl(): string | null {
  const raw = process.env.NEON_AUTH_URL ?? process.env.VITE_NEON_AUTH_URL
  const url = raw?.trim()
  return url ? url.replace(/\/$/, '') : null
}

let jwks: ReturnType<typeof createRemoteJWKSet> | undefined

async function verifyNeonJwt(token: string): Promise<TokenPayload | null> {
  const base = authBaseUrl()
  if (!base) return null

  try {
    jwks ??= createRemoteJWKSet(new URL(`${base}/.well-known/jwks.json`))
    const { payload } = await jwtVerify(token, jwks, {
      issuer: new URL(base).origin,
    })
    return { email: payload.email }
  } catch {
    return null
  }
}

export const authenticateRequest = createAuthenticator({
  allowedEmail: process.env.AUTH_ALLOWED_EMAIL ?? '',
  agentToken: process.env.AUTH_AGENT_TOKEN ?? '',
  verifyToken: verifyNeonJwt,
})
