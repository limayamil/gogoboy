/**
 * Entrada Vercel para rutas de dos segmentos (`/api/categories/:id`,
 * `/api/uploads/sign`). Sin este archivo esas URLs ni siquiera invocan la funcion:
 * Vercel responde NOT_FOUND en texto plano.
 *
 * Mismo handler que `api/[resource].ts`: el path original llega intacto y el
 * matcher de `server/lib/api-handler.ts` decide a que endpoint va.
 */
import { handleApi } from '../../server/lib/api-handler.ts'

export default { fetch: handleApi }
