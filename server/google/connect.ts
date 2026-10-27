import { GOOGLE_CALLBACK_PATH } from '../_lib/auth.ts'
import type { ApiRequest } from '../_lib/http.ts'
import { badRequest, route } from '../_lib/http.ts'
import { createOAuthState, stateCookie } from '../_lib/google-crypto.ts'
import { buildAuthUrl } from '../_lib/google.ts'
import { googleDeps, requireGoogle } from '../_lib/google-deps.ts'
import type { GoogleDeps } from '../_lib/google-meets.ts'

function header(req: ApiRequest, name: string): string | undefined {
  const value = req.headers[name]
  return Array.isArray(value) ? value[0] : value
}

/**
 * El origen del navegador, no el del servidor: en dev Vite reenvía a :3001 y en
 * Vercel el host interno no es el público. Google igual rechaza cualquier
 * redirect_uri que no esté registrado en el cliente OAuth.
 */
export function publicOrigin(req: ApiRequest): string {
  const candidates = [
    header(req, 'origin'),
    header(req, 'x-forwarded-host') &&
      `${header(req, 'x-forwarded-proto') ?? 'https'}://${header(req, 'x-forwarded-host')}`,
    header(req, 'host') && `https://${header(req, 'host')}`,
  ]
  for (const candidate of candidates) {
    if (!candidate) continue
    try {
      const url = new URL(candidate)
      if (url.protocol === 'https:' || url.protocol === 'http:') return url.origin
    } catch {
      // Probamos el siguiente.
    }
  }
  badRequest('No se pudo saber el origen de la app')
}

/** Arranca el flujo: devuelve la URL de Google y deja en el navegador la cookie que ata el state. */
export function createGoogleConnectHandler(deps: GoogleDeps | null) {
  return route({
    POST(req, res) {
      const google = requireGoogle(deps)
      const origin = publicOrigin(req)
      const redirectUri = `${origin}${GOOGLE_CALLBACK_PATH}`
      const { state, nonce } = createOAuthState(google.config.tokenKey, redirectUri)
      res.setHeader('Set-Cookie', stateCookie(nonce, origin.startsWith('https:')))
      res.setHeader('Cache-Control', 'no-store')
      res.status(200).json({ url: buildAuthUrl(google.config, redirectUri, state) })
    },
  })
}

export default createGoogleConnectHandler(googleDeps)
