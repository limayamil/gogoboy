/**
 * Cliente mínimo de Google OAuth + Calendar API. Sin SDK: son cinco endpoints REST y
 * `fetch` alcanza. `fetch` se inyecta para poder probar sin red.
 */
import { parseTokenKey } from './google-crypto.ts'

export const GOOGLE_SCOPES = ['openid', 'email', 'https://www.googleapis.com/auth/calendar.readonly']

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const REVOKE_URL = 'https://oauth2.googleapis.com/revoke'
const CALENDAR_API = 'https://www.googleapis.com/calendar/v3'
const TIMEOUT_MS = 10_000

export interface GoogleConfig {
  clientId: string
  clientSecret: string
  tokenKey: Buffer
}

/** null si falta cualquiera de las tres: el front esconde "Conectar" y el iCal sigue igual. */
export function googleConfigFromEnv(env: Record<string, string | undefined> = process.env): GoogleConfig | null {
  const clientId = env.GOOGLE_CLIENT_ID?.trim()
  const clientSecret = env.GOOGLE_CLIENT_SECRET?.trim()
  const tokenKey = parseTokenKey(env.GOOGLE_TOKEN_KEY)
  if (!clientId || !clientSecret || !tokenKey) return null
  return { clientId, clientSecret, tokenKey }
}

/** Google ya no acepta el token (revocado, vencido, contraseña cambiada): hay que reconectar. */
export class GoogleReconnectError extends Error {}

export class GoogleApiError extends Error {}

export function buildAuthUrl(config: GoogleConfig, redirectUri: string, state: string): string {
  const url = new URL(AUTH_URL)
  url.search = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: GOOGLE_SCOPES.join(' '),
    // offline + consent: sin esto Google no vuelve a mandar refresh_token al reconectar.
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    state,
  }).toString()
  return url.toString()
}

export interface GoogleCalendarListItem {
  id: string
  summary: string
  primary: boolean
  accessRole: string
}

/** La forma de un evento de events.list que usamos. El resto se ignora. */
export interface GoogleApiEvent {
  id: string
  status?: string
  summary?: string
  description?: string
  location?: string
  hangoutLink?: string
  start?: { date?: string; dateTime?: string; timeZone?: string }
  end?: { date?: string; dateTime?: string; timeZone?: string }
  organizer?: { email?: string; displayName?: string }
  attendees?: Array<{ email?: string; displayName?: string; responseStatus?: string; resource?: boolean }>
  conferenceData?: { entryPoints?: Array<{ entryPointType?: string; uri?: string }> }
  attachments?: Array<{ fileUrl?: string; title?: string }>
}

type Fetch = typeof fetch

async function call(fetchImpl: Fetch, url: string, init: RequestInit = {}): Promise<Response> {
  try {
    return await fetchImpl(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) })
  } catch {
    throw new GoogleApiError('No se pudo conectar con Google')
  }
}

function decodeIdTokenEmail(idToken: unknown): string | null {
  if (typeof idToken !== 'string') return null
  // Viene directo de Google por TLS en el canje del code: no hace falta verificar la firma.
  try {
    const payload = JSON.parse(Buffer.from(idToken.split('.')[1] ?? '', 'base64url').toString('utf8'))
    return typeof payload.email === 'string' ? payload.email.toLowerCase() : null
  } catch {
    return null
  }
}

export function createGoogleClient(config: GoogleConfig, fetchImpl: Fetch = fetch, clock = () => Date.now()) {
  // Access tokens por refresh token, por instancia de la función. Duran ~1 h.
  const accessTokens = new Map<string, { token: string; expiresAt: number }>()

  async function tokenRequest(params: Record<string, string>) {
    const response = await call(fetchImpl, TOKEN_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: config.clientId, client_secret: config.clientSecret, ...params }),
    })
    const data = (await response.json().catch(() => ({}))) as Record<string, unknown>
    return { response, data }
  }

  async function accessToken(refreshToken: string): Promise<string> {
    const hit = accessTokens.get(refreshToken)
    if (hit && hit.expiresAt - 60_000 > clock()) return hit.token
    const { response, data } = await tokenRequest({ grant_type: 'refresh_token', refresh_token: refreshToken })
    if (data.error === 'invalid_grant' || response.status === 401) {
      accessTokens.delete(refreshToken)
      throw new GoogleReconnectError('Google rechazó el acceso')
    }
    if (!response.ok || typeof data.access_token !== 'string') throw new GoogleApiError(`Google respondió ${response.status}`)
    const expiresIn = typeof data.expires_in === 'number' ? data.expires_in : 3600
    accessTokens.set(refreshToken, { token: data.access_token, expiresAt: clock() + expiresIn * 1000 })
    return data.access_token
  }

  async function getJson(refreshToken: string, url: string): Promise<Record<string, unknown>> {
    const token = await accessToken(refreshToken)
    const response = await call(fetchImpl, url, { headers: { authorization: `Bearer ${token}` } })
    if (response.status === 401) {
      // Un access token cacheado que Google ya invalidó: probamos una vez con uno nuevo.
      accessTokens.delete(refreshToken)
      const retry = await call(fetchImpl, url, {
        headers: { authorization: `Bearer ${await accessToken(refreshToken)}` },
      })
      if (retry.status === 401) throw new GoogleReconnectError('Google rechazó el acceso')
      if (!retry.ok) throw new GoogleApiError(`Google respondió ${retry.status}`)
      return (await retry.json()) as Record<string, unknown>
    }
    if (response.status === 403) throw new GoogleApiError('Sin permiso para leer este calendario')
    if (response.status === 404) throw new GoogleApiError('Google no encuentra el calendario')
    if (!response.ok) throw new GoogleApiError(`Google respondió ${response.status}`)
    return (await response.json()) as Record<string, unknown>
  }

  return {
    async exchangeCode(code: string, redirectUri: string): Promise<{ email: string; refreshToken: string }> {
      const { response, data } = await tokenRequest({ grant_type: 'authorization_code', code, redirect_uri: redirectUri })
      if (!response.ok) throw new GoogleApiError(`Google respondió ${response.status} al canjear el código`)
      const email = decodeIdTokenEmail(data.id_token)
      if (typeof data.refresh_token !== 'string') throw new GoogleApiError('Google no mandó refresh token')
      if (!email) throw new GoogleApiError('Google no mandó el email de la cuenta')
      return { email, refreshToken: data.refresh_token }
    },

    async listCalendars(refreshToken: string): Promise<GoogleCalendarListItem[]> {
      const items: GoogleCalendarListItem[] = []
      let pageToken: string | undefined
      do {
        const url = new URL(`${CALENDAR_API}/users/me/calendarList`)
        url.searchParams.set('maxResults', '250')
        if (pageToken) url.searchParams.set('pageToken', pageToken)
        const data = await getJson(refreshToken, url.toString())
        for (const raw of (data.items as Array<Record<string, unknown>> | undefined) ?? []) {
          if (typeof raw.id !== 'string') continue
          items.push({
            id: raw.id,
            summary: String(raw.summaryOverride ?? raw.summary ?? raw.id),
            primary: raw.primary === true,
            accessRole: String(raw.accessRole ?? ''),
          })
        }
        pageToken = typeof data.nextPageToken === 'string' ? data.nextPageToken : undefined
      } while (pageToken)
      return items
    },

    async listEvents(refreshToken: string, calendarId: string, timeMin: string, timeMax: string): Promise<GoogleApiEvent[]> {
      const events: GoogleApiEvent[] = []
      let pageToken: string | undefined
      do {
        const url = new URL(`${CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events`)
        url.search = new URLSearchParams({
          singleEvents: 'true',
          orderBy: 'startTime',
          timeMin,
          timeMax,
          timeZone: 'America/Argentina/Buenos_Aires',
          maxResults: '250',
          ...(pageToken ? { pageToken } : {}),
        }).toString()
        const data = await getJson(refreshToken, url.toString())
        events.push(...((data.items as GoogleApiEvent[] | undefined) ?? []))
        pageToken = typeof data.nextPageToken === 'string' ? data.nextPageToken : undefined
      } while (pageToken)
      return events
    },

    /** Mejor esfuerzo: si Google ya lo había revocado, igual borramos la cuenta. */
    async revoke(refreshToken: string): Promise<void> {
      accessTokens.delete(refreshToken)
      await call(fetchImpl, REVOKE_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ token: refreshToken }),
      }).catch(() => undefined)
    },
  }
}

export type GoogleClient = ReturnType<typeof createGoogleClient>
