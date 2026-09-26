import { route } from './_lib/http.ts'
import { stateVersion } from './_lib/version.ts'

/**
 * GET /api/version
 *
 * La firma del estado, sola. Es lo que consulta el front cada tanto para saber si hay
 * novedades sin tener que re-descargar /api/state entero.
 */
export default route({
  async GET(_req, res) {
    res.status(200).json({ version: await stateVersion() })
  },
})
