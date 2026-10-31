import { notFound, requireId, route } from '../_lib/http.ts'
import { googleDeps, requireGoogle } from '../_lib/google-deps.ts'
import { refreshTokenOf, type GoogleDeps } from '../_lib/google-meets.ts'

/** Desconectar: revoca el token en Google y borra la cuenta con sus calendarios elegidos. */
export function createGoogleAccountByIdHandler(deps: GoogleDeps | null) {
  return route({
    async DELETE(req, res) {
      const google = requireGoogle(deps)
      const account = await google.store.getAccount(requireId(req))
      if (!account) notFound('Cuenta no encontrada')

      let refreshToken: string | null = null
      try {
        refreshToken = refreshTokenOf(account, google)
      } catch {
        // Si no se puede descifrar no hay nada que revocar; igual se borra.
      }
      if (refreshToken) await google.client.revoke(refreshToken)
      await google.store.removeAccount(account.id)
      res.status(200).json({ ok: true })
    },
  })
}

export default createGoogleAccountByIdHandler(googleDeps)
