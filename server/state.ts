import { route } from './_lib/http.ts'
import { loadAppState } from './_lib/load-state.ts'

/**
 * GET /api/state
 *
 * Devuelve todo el estado en una sola llamada. La app es de un usuario y el volumen
 * es chico: una carga unica hace que React Query tenga un solo cache que actualizar,
 * lo que simplifica muchisimo las mutaciones optimistas del drag & drop.
 */
export default route({
  async GET(_req, res) {
    res.status(200).json(await loadAppState())
  },
})
