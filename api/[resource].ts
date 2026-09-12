/**
 * Entrada Vercel para rutas de un segmento (`/api/state`, `/api/categories`).
 * El ruteo interno vive en `server/lib/api-handler.ts`; este archivo solo existe
 * porque Vercel (fuera de Next) no soporta catch-all `[...path]`.
 *
 * `{ fetch }` es el contrato Web Standard: un `export default` de funcion lo toma
 * como handler Node `(req, res)` y `new URL(req.url)` tira.
 */
import { handleApi } from '../server/lib/api-handler.ts'

export default { fetch: handleApi }
