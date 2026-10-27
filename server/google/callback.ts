import type { ApiResponse } from '../_lib/http.ts'
import { route } from '../_lib/http.ts'
import { STATE_COOKIE, clearStateCookie, encryptToken, readCookie, verifyOAuthState } from '../_lib/google-crypto.ts'
import { googleDeps } from '../_lib/google-deps.ts'
import type { GoogleDeps } from '../_lib/google-meets.ts'

function one(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

/** Siempre vuelve a la app con un resultado corto; nunca con el code ni con tokens. */
function back(res: ApiResponse, result: 'conectada' | 'cancelada' | 'error' | 'no-configurado') {
  res.setHeader('Set-Cookie', clearStateCookie())
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('Location', `/?google=${result}`)
  res.status(302).end()
}

/**
 * Adonde vuelve Google. Es la única ruta de /api sin JWT: es una navegación del
 * navegador y no lleva el header Authorization. La protege el state firmado más la
 * cookie HttpOnly que puso POST /api/google/connect, que sí exige JWT y allowlist.
 */
export function createGoogleCallbackHandler(deps: GoogleDeps | null) {
  return route({
    async GET(req, res) {
      if (!deps) return back(res, 'no-configurado')

      const verified = verifyOAuthState(
        one(req.query.state),
        readCookie(req.headers.cookie, STATE_COOKIE),
        deps.config.tokenKey,
      )
      if (!verified) return back(res, 'error')
      if (one(req.query.error)) return back(res, 'cancelada')

      const code = one(req.query.code)
      if (!code) return back(res, 'error')

      try {
        const { email, refreshToken } = await deps.client.exchangeCode(code, verified.redirectUri)
        await deps.store.upsertAccount(email, encryptToken(refreshToken, deps.config.tokenKey))
      } catch (error) {
        console.error('[google] falló el canje del code:', error instanceof Error ? error.message : error)
        return back(res, 'error')
      }
      back(res, 'conectada')
    },
  })
}

export default createGoogleCallbackHandler(googleDeps)
