import { HttpError } from './http.ts'
import { createGoogleClient, googleConfigFromEnv } from './google.ts'
import type { GoogleDeps } from './google-meets.ts'
import { googleStore } from './google-store.ts'

const config = googleConfigFromEnv()

/** null sin las tres variables: las rutas de Google responden 503 y la barra usa solo iCal. */
export const googleDeps: GoogleDeps | null = config
  ? { config, client: createGoogleClient(config), store: googleStore }
  : null

export function requireGoogle(deps: GoogleDeps | null): GoogleDeps {
  if (!deps) throw new HttpError(503, 'Google no está configurado (faltan GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET o GOOGLE_TOKEN_KEY)')
  return deps
}
