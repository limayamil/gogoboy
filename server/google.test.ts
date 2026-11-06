import { readFileSync } from 'node:fs'
import { randomBytes } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import type { GoogleAccountsResponse, MeetsToday } from '../src/shared/types.ts'
import { createAuthenticator } from './_lib/auth.ts'
import type { ApiRequest, ApiResponse, Handler } from './_lib/http.ts'
import {
  createOAuthState,
  decryptToken,
  encryptToken,
  parseTokenKey,
  readCookie,
  verifyOAuthState,
} from './_lib/google-crypto.ts'
import { mapGoogleEvent } from './_lib/google-events.ts'
import type { GoogleDeps } from './_lib/google-meets.ts'
import type { GoogleStore, StoredGoogleAccount, StoredGoogleCalendar } from './_lib/google-store.ts'
import { buildAuthUrl, createGoogleClient, googleConfigFromEnv, type GoogleApiEvent, type GoogleConfig } from './_lib/google.ts'
import type { MeetCalendarStore, StoredMeetCalendar } from './_lib/meet-calendars.ts'
import { meetsDay } from './_lib/meets-ics.ts'
import { handleApi } from './lib/api-handler.ts'
import { createGoogleAccountByIdHandler } from './google-accounts/[id].ts'
import { createGoogleCalendarsHandler } from './google-calendars/index.ts'
import { createGoogleAccountsHandler } from './google/accounts.ts'
import { createGoogleCallbackHandler } from './google/callback.ts'
import { createGoogleConnectHandler } from './google/connect.ts'
import { createMeetsHandler } from './meets.ts'

const KEY = randomBytes(32)
const CONFIG: GoogleConfig = { clientId: 'cliente.apps.googleusercontent.com', clientSecret: 'shh-secreto', tokenKey: KEY }
const NOON = new Date('2026-10-27T15:00:00.000Z')
const DAY = meetsDay(NOON)
const ICS = readFileSync(new URL('./_lib/fixtures/meets.ics', import.meta.url), 'utf8')

// --- helpers --------------------------------------------------------------------

async function call(handler: Handler, init: Partial<ApiRequest> = {}) {
  let status = 200
  let payload: unknown
  const headers: Record<string, string> = {}
  const res: ApiResponse = {
    status(code) {
      status = code
      return res
    },
    json(value) {
      payload = value
    },
    send() {},
    setHeader(name, value) {
      headers[name] = value
    },
    end() {},
  }
  await handler({ method: 'GET', query: {}, headers: {}, ...init }, res)
  return { status, payload, headers, raw: JSON.stringify(payload ?? null) + JSON.stringify(headers) }
}

function idToken(email: string) {
  const part = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url')
  return `${part({ alg: 'RS256' })}.${part({ email })}.firma`
}

const WORK_EVENTS: GoogleApiEvent[] = [
  {
    id: 'directorio',
    summary: 'Directorio',
    start: { dateTime: '2026-10-27T10:00:00-03:00' },
    end: { dateTime: '2026-10-27T11:00:00-03:00' },
    hangoutLink: 'https://meet.google.com/dir-ecto-rio',
    organizer: { email: 'ceo@empresa.com', displayName: 'Ceo' },
    attendees: [{ email: 'yamil@empresa.com', responseStatus: 'accepted', displayName: 'Yamil' }],
  },
]

/** Google de mentira: token, calendarList, events y revoke. Anota lo que le piden. */
function fakeGoogle() {
  const log = { revoked: [] as string[], eventCalls: 0, tokenCalls: 0 }
  const refreshFor: Record<string, string> = { 'code-empresa': 'rt-empresa', 'code-otra': 'rt-otra' }
  const emailFor: Record<string, string> = { 'code-empresa': 'yamil@empresa.com', 'code-otra': 'yamil@otra.com' }
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

  const fetchImpl = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input))
    const form = new URLSearchParams(typeof init?.body === 'string' ? init.body : init?.body?.toString() ?? '')
    if (url.href === 'https://oauth2.googleapis.com/token') {
      log.tokenCalls += 1
      if (form.get('grant_type') === 'authorization_code') {
        const code = form.get('code') ?? ''
        if (!refreshFor[code]) return json({ error: 'invalid_grant' }, 400)
        return json({ access_token: `at-${code}`, refresh_token: refreshFor[code], id_token: idToken(emailFor[code]), expires_in: 3600 })
      }
      const rt = form.get('refresh_token')
      if (rt === 'rt-revocado') return json({ error: 'invalid_grant', error_description: 'Token has been expired or revoked.' }, 400)
      return json({ access_token: `at-${rt}`, expires_in: 3600 })
    }
    if (url.href.startsWith('https://oauth2.googleapis.com/revoke')) {
      log.revoked.push(form.get('token') ?? '')
      return new Response('', { status: 200 })
    }
    const auth = new Headers(init?.headers).get('authorization') ?? ''
    if (url.pathname === '/calendar/v3/users/me/calendarList') {
      return json({
        items: [
          { id: 'yamil@empresa.com', summary: 'yamil@empresa.com', primary: true, accessRole: 'owner' },
          { id: 'equipo@group.calendar.google.com', summary: 'Equipo', summaryOverride: 'Equipo producto', accessRole: 'reader' },
        ],
      })
    }
    if (url.pathname.startsWith('/calendar/v3/calendars/')) {
      log.eventCalls += 1
      expect(url.searchParams.get('singleEvents')).toBe('true')
      expect(url.searchParams.get('orderBy')).toBe('startTime')
      expect(url.searchParams.get('timeMin')).toBe('2026-10-27T03:00:00.000Z')
      expect(url.searchParams.get('timeMax')).toBe('2026-10-28T03:00:00.000Z')
      if (auth !== 'Bearer at-rt-empresa' && auth !== 'Bearer at-rt-otra') return json({ error: 'unauthorized' }, 401)
      return json({ items: WORK_EVENTS })
    }
    return json({ error: 'not found' }, 404)
  }) as typeof fetch

  return { fetchImpl, log }
}

function memoryGoogleStore(accounts: StoredGoogleAccount[] = [], calendars: StoredGoogleCalendar[] = []): GoogleStore & {
  accounts: StoredGoogleAccount[]
  calendars: StoredGoogleCalendar[]
} {
  let next = 100
  const id = () => `00000000-0000-4000-8000-000000000${next++}`
  return {
    accounts,
    calendars,
    async listAccounts() {
      return accounts.map((account) => ({ ...account }))
    },
    async getAccount(accountId) {
      const found = accounts.find((account) => account.id === accountId)
      return found ? { ...found } : null
    },
    async upsertAccount(email, refreshTokenEnc) {
      const existing = accounts.find((account) => account.email === email)
      if (existing) {
        Object.assign(existing, { refreshTokenEnc, status: 'ok' })
        return { ...existing }
      }
      const row: StoredGoogleAccount = { id: id(), email, refreshTokenEnc, status: 'ok' }
      accounts.push(row)
      return { ...row }
    },
    async setAccountStatus(accountId, status) {
      const found = accounts.find((account) => account.id === accountId)
      if (found) found.status = status
    },
    async removeAccount(accountId) {
      const index = accounts.findIndex((account) => account.id === accountId)
      if (index < 0) return false
      accounts.splice(index, 1)
      for (let i = calendars.length - 1; i >= 0; i--) if (calendars[i].accountId === accountId) calendars.splice(i, 1)
      return true
    },
    async listCalendars() {
      return calendars.map((calendar) => ({ ...calendar }))
    },
    async getCalendar(calendarId) {
      return calendars.find((calendar) => calendar.id === calendarId) ?? null
    },
    async addCalendar(input) {
      const row = { ...input, id: id(), position: calendars.length }
      calendars.push(row)
      return row
    },
    async updateCalendar(calendarId, input) {
      const found = calendars.find((calendar) => calendar.id === calendarId)
      if (!found) return null
      Object.assign(found, input)
      return found
    },
    async removeCalendar(calendarId) {
      const index = calendars.findIndex((calendar) => calendar.id === calendarId)
      if (index < 0) return false
      calendars.splice(index, 1)
      return true
    },
  }
}

const EMPRESA: StoredGoogleAccount = {
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  email: 'yamil@empresa.com',
  refreshTokenEnc: encryptToken('rt-empresa', KEY),
  status: 'ok',
}
const REVOCADA: StoredGoogleAccount = {
  id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  email: 'yamil@vieja.com',
  refreshTokenEnc: encryptToken('rt-revocado', KEY),
  status: 'ok',
}
const DIRECTORIO_CAL: StoredGoogleCalendar = {
  id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  accountId: EMPRESA.id,
  calendarId: 'yamil@empresa.com',
  name: 'Empresa',
  colorKey: 'cielo',
  position: 0,
}
const VIEJA_CAL: StoredGoogleCalendar = {
  id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  accountId: REVOCADA.id,
  calendarId: 'yamil@vieja.com',
  name: 'Vieja',
  colorKey: 'rosa',
  position: 1,
}

function setup(accounts = [EMPRESA, REVOCADA], calendars = [DIRECTORIO_CAL, VIEJA_CAL]) {
  const google = fakeGoogle()
  const store = memoryGoogleStore(
    accounts.map((account) => ({ ...account })),
    calendars.map((calendar) => ({ ...calendar })),
  )
  const deps: GoogleDeps = { config: CONFIG, client: createGoogleClient(CONFIG, google.fetchImpl), store }
  return { google, store, deps }
}

const SECRETS = /rt-empresa|rt-revocado|rt-otra|at-rt-|shh-secreto|refresh_?token/i

// --- cifrado --------------------------------------------------------------------

describe('cifrado del refresh token', () => {
  it('ida y vuelta con AES-256-GCM, distinto cada vez', () => {
    const a = encryptToken('1//refresh-token', KEY)
    const b = encryptToken('1//refresh-token', KEY)
    expect(a).not.toBe(b)
    expect(a).not.toContain('refresh-token')
    expect(decryptToken(a, KEY)).toBe('1//refresh-token')
  })

  it('tira con otra clave o si alguien tocó el texto', () => {
    const blob = encryptToken('1//refresh-token', KEY)
    expect(() => decryptToken(blob, randomBytes(32))).toThrow()
    const [v, iv, tag, data] = blob.split(':')
    const flipped = Buffer.from(data, 'base64')
    flipped[0] ^= 1
    expect(() => decryptToken([v, iv, tag, flipped.toString('base64')].join(':'), KEY)).toThrow()
  })

  it('GOOGLE_TOKEN_KEY tiene que ser 32 bytes en base64', () => {
    expect(parseTokenKey(randomBytes(32).toString('base64'))).toHaveLength(32)
    expect(parseTokenKey(randomBytes(16).toString('base64'))).toBeNull()
    expect(parseTokenKey('')).toBeNull()
    expect(parseTokenKey(undefined)).toBeNull()
  })

  it('sin alguna de las tres variables no hay Google', () => {
    const env = { GOOGLE_CLIENT_ID: 'id', GOOGLE_CLIENT_SECRET: 's', GOOGLE_TOKEN_KEY: KEY.toString('base64') }
    expect(googleConfigFromEnv(env)).not.toBeNull()
    expect(googleConfigFromEnv({ ...env, GOOGLE_CLIENT_ID: '' })).toBeNull()
    expect(googleConfigFromEnv({ ...env, GOOGLE_CLIENT_SECRET: undefined })).toBeNull()
    expect(googleConfigFromEnv({ ...env, GOOGLE_TOKEN_KEY: 'corta' })).toBeNull()
  })
})

// --- state ----------------------------------------------------------------------

describe('state de OAuth', () => {
  const redirect = 'https://gogoboy.vercel.app/api/google/callback'

  it('vale con su cookie y devuelve el redirect_uri firmado', () => {
    const { state, nonce } = createOAuthState(KEY, redirect, 1_000)
    expect(verifyOAuthState(state, nonce, KEY, 2_000)).toEqual({ redirectUri: redirect })
  })

  it('no vale sin cookie, con la cookie de otro flujo, vencido, alterado o con otra clave', () => {
    const { state, nonce } = createOAuthState(KEY, redirect, 1_000)
    const other = createOAuthState(KEY, redirect, 1_000)
    expect(verifyOAuthState(state, undefined, KEY, 2_000)).toBeNull()
    expect(verifyOAuthState(state, other.nonce, KEY, 2_000)).toBeNull()
    expect(verifyOAuthState(state, nonce, KEY, 1_000 + 11 * 60_000)).toBeNull()
    expect(verifyOAuthState(undefined, nonce, KEY, 2_000)).toBeNull()
    expect(verifyOAuthState(`${state}x`, nonce, KEY, 2_000)).toBeNull()
    const [, signature] = state.split('.')
    const forged = Buffer.from(JSON.stringify({ n: nonce, r: 'https://evil.io/cb', e: 9e15 })).toString('base64url')
    expect(verifyOAuthState(`${forged}.${signature}`, nonce, KEY, 2_000)).toBeNull()
    expect(verifyOAuthState(state, nonce, randomBytes(32), 2_000)).toBeNull()
  })

  it('lee la cookie entre otras', () => {
    expect(readCookie('a=1; gogoboy_google_oauth=abc%2Bd; b=2', 'gogoboy_google_oauth')).toBe('abc+d')
    expect(readCookie(undefined, 'gogoboy_google_oauth')).toBeUndefined()
  })

  it('la URL de Google pide offline, consent y solo los tres scopes', () => {
    const url = new URL(buildAuthUrl(CONFIG, redirect, 'st'))
    expect(url.origin + url.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth')
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      client_id: CONFIG.clientId,
      redirect_uri: redirect,
      response_type: 'code',
      access_type: 'offline',
      prompt: 'consent',
      state: 'st',
      scope: 'openid email https://www.googleapis.com/auth/calendar.readonly',
    })
    expect(url.toString()).not.toContain('shh-secreto')
  })
})

// --- mapeo ----------------------------------------------------------------------

describe('mapGoogleEvent', () => {
  const base: GoogleApiEvent = {
    id: 'e1',
    summary: 'Revisión',
    start: { dateTime: '2026-10-27T15:00:00-03:00' },
    end: { dateTime: '2026-10-27T15:30:00-03:00' },
  }

  it('toma el Meet de hangoutLink o, si no, de conferenceData', () => {
    expect(mapGoogleEvent({ ...base, hangoutLink: 'https://meet.google.com/abc-defg-hij' }, 'cal', DAY)?.meetUrl).toBe(
      'https://meet.google.com/abc-defg-hij',
    )
    expect(
      mapGoogleEvent(
        {
          ...base,
          conferenceData: {
            entryPoints: [
              { entryPointType: 'phone', uri: 'tel:+54-11-1234' },
              { entryPointType: 'video', uri: 'https://meet.google.com/xyz-abcd-efg' },
            ],
          },
        },
        'cal',
        DAY,
      )?.meetUrl,
    ).toBe('https://meet.google.com/xyz-abcd-efg')
    expect(mapGoogleEvent(base, 'cal', DAY)?.meetUrl).toBeNull()
  })

  it('invitados con su respuesta, sin salas; organizador', () => {
    const event = mapGoogleEvent(
      {
        ...base,
        organizer: { email: 'ana@empresa.com', displayName: 'Ana' },
        attendees: [
          { email: 'ana@empresa.com', displayName: 'Ana', responseStatus: 'accepted' },
          { email: 'beto@empresa.com', responseStatus: 'declined' },
          { email: 'caro@empresa.com', displayName: 'caro@empresa.com', responseStatus: 'tentative' },
          { email: 'dani@empresa.com', responseStatus: 'needsAction' },
          { email: 'sala-3@resource.calendar.google.com', displayName: 'Sala 3', resource: true, responseStatus: 'accepted' },
        ],
      },
      'cal',
      DAY,
    )
    expect(event?.organizer).toEqual({ name: 'Ana', email: 'ana@empresa.com' })
    expect(event?.attendees).toEqual([
      { name: 'Ana', email: 'ana@empresa.com', response: 'si' },
      { name: null, email: 'beto@empresa.com', response: 'no' },
      { name: null, email: 'caro@empresa.com', response: 'tal_vez' },
      { name: null, email: 'dani@empresa.com', response: 'sin_responder' },
    ])
  })

  it('todo el día en GMT-3, y solo en su día', () => {
    const allDay: GoogleApiEvent = { id: 'f', summary: 'Feriado', start: { date: '2026-10-27' }, end: { date: '2026-10-28' } }
    expect(mapGoogleEvent(allDay, 'cal', DAY)).toMatchObject({
      allDay: true,
      start: '2026-10-27T03:00:00.000Z',
      end: '2026-10-28T03:00:00.000Z',
    })
    expect(mapGoogleEvent(allDay, 'cal', meetsDay(new Date('2026-10-28T15:00:00Z')))).toBeNull()
  })

  it('cancelado no aparece', () => {
    expect(mapGoogleEvent({ ...base, status: 'cancelled' }, 'cal', DAY)).toBeNull()
  })

  it('23:30 GMT-3 es hoy; 00:30 del día siguiente no', () => {
    const at = (dateTime: string) => ({ ...base, start: { dateTime }, end: { dateTime } })
    expect(mapGoogleEvent(at('2026-10-27T23:30:00-03:00'), 'cal', DAY)).not.toBeNull()
    expect(mapGoogleEvent(at('2026-10-28T00:30:00-03:00'), 'cal', DAY)).toBeNull()
  })

  it('descripción sanitizada como en iCal y adjuntos de Drive', () => {
    const event = mapGoogleEvent(
      {
        ...base,
        description: 'Agenda <b>corta</b><br><script>alert(1)</script><a href="https://docs.google.com/d/1">Doc</a>',
        attachments: [
          { fileUrl: 'https://drive.google.com/file/d/1', title: 'Minuta' },
          { fileUrl: 'javascript:alert(1)', title: 'Malo' },
        ],
      },
      'cal',
      DAY,
    )
    expect(event?.description).toBe('Agenda corta\nDoc (https://docs.google.com/d/1)')
    expect(event?.attachments).toEqual([{ title: 'Minuta', url: 'https://drive.google.com/file/d/1' }])
  })
})

// --- rutas ----------------------------------------------------------------------

describe('POST /api/google/connect', () => {
  it('devuelve la URL de Google y deja la cookie que ata el state', async () => {
    const { deps } = setup()
    const response = await call(createGoogleConnectHandler(deps), {
      method: 'POST',
      headers: { origin: 'https://gogoboy.vercel.app' },
    })
    expect(response.status).toBe(200)
    const url = new URL((response.payload as { url: string }).url)
    expect(url.searchParams.get('redirect_uri')).toBe('https://gogoboy.vercel.app/api/google/callback')
    const cookie = response.headers['Set-Cookie']
    expect(cookie).toMatch(/^gogoboy_google_oauth=[^;]+; Path=\/api\/google; Max-Age=600; HttpOnly; SameSite=Lax; Secure$/)
    const nonce = decodeURIComponent(cookie.split(';')[0].split('=')[1])
    expect(verifyOAuthState(url.searchParams.get('state') ?? undefined, nonce, KEY)).not.toBeNull()
  })

  it('503 si Google no está configurado', async () => {
    expect((await call(createGoogleConnectHandler(null), { method: 'POST' })).status).toBe(503)
  })
})

describe('GET /api/google/callback', () => {
  async function startFlow(deps: GoogleDeps) {
    const response = await call(createGoogleConnectHandler(deps), {
      method: 'POST',
      headers: { origin: 'http://localhost:5173' },
    })
    const state = new URL((response.payload as { url: string }).url).searchParams.get('state')!
    const cookie = response.headers['Set-Cookie'].split(';')[0]
    return { state, cookie }
  }

  it('canjea el code, guarda el token cifrado y vuelve a la app sin tokens', async () => {
    const { deps, store } = setup([], [])
    const { state, cookie } = await startFlow(deps)
    const response = await call(createGoogleCallbackHandler(deps), {
      query: { state, code: 'code-empresa' },
      headers: { cookie },
    })
    expect(response.status).toBe(302)
    expect(response.headers.Location).toBe('/?google=conectada')
    expect(response.raw).not.toMatch(SECRETS)
    expect(store.accounts).toHaveLength(1)
    expect(store.accounts[0].email).toBe('yamil@empresa.com')
    expect(store.accounts[0].refreshTokenEnc).not.toContain('rt-empresa')
    expect(decryptToken(store.accounts[0].refreshTokenEnc, KEY)).toBe('rt-empresa')
  })

  it('sin la cookie del navegador que arrancó el flujo no conecta nada', async () => {
    const { deps, store } = setup([], [])
    const { state } = await startFlow(deps)
    const response = await call(createGoogleCallbackHandler(deps), { query: { state, code: 'code-empresa' } })
    expect(response.headers.Location).toBe('/?google=error')
    expect(store.accounts).toHaveLength(0)
  })

  it('con un state inventado no conecta nada', async () => {
    const { deps, store } = setup([], [])
    const { cookie } = await startFlow(deps)
    const response = await call(createGoogleCallbackHandler(deps), {
      query: { state: 'inventado.firma', code: 'code-empresa' },
      headers: { cookie },
    })
    expect(response.headers.Location).toBe('/?google=error')
    expect(store.accounts).toHaveLength(0)
  })

  it('si Yamil cancela en Google vuelve con "cancelada"', async () => {
    const { deps } = setup([], [])
    const { state, cookie } = await startFlow(deps)
    const response = await call(createGoogleCallbackHandler(deps), { query: { state, error: 'access_denied' }, headers: { cookie } })
    expect(response.headers.Location).toBe('/?google=cancelada')
  })

  it('reconectar la misma cuenta pisa el token y la vuelve a "ok"', async () => {
    const { deps, store } = setup([{ ...EMPRESA, status: 'reconectar' }], [DIRECTORIO_CAL])
    const { state, cookie } = await startFlow(deps)
    await call(createGoogleCallbackHandler(deps), { query: { state, code: 'code-empresa' }, headers: { cookie } })
    expect(store.accounts).toHaveLength(1)
    expect(store.accounts[0].status).toBe('ok')
    expect(store.calendars).toHaveLength(1)
  })
})

describe('GET /api/google/accounts', () => {
  it('lista las cuentas con sus calendarios y cuáles se muestran, sin tokens', async () => {
    const { deps } = setup()
    const response = await call(createGoogleAccountsHandler(deps))
    expect(response.raw).not.toMatch(SECRETS)
    const payload = response.payload as GoogleAccountsResponse
    expect(payload.configured).toBe(true)
    expect(payload.accounts[0]).toEqual({
      id: EMPRESA.id,
      email: 'yamil@empresa.com',
      status: 'ok',
      error: null,
      calendars: [
        {
          calendarId: 'yamil@empresa.com',
          summary: 'yamil@empresa.com',
          primary: true,
          selection: { id: DIRECTORIO_CAL.id, name: 'Empresa', colorKey: 'cielo' },
        },
        { calendarId: 'equipo@group.calendar.google.com', summary: 'Equipo producto', primary: false, selection: null },
      ],
    })
    expect(payload.accounts[1]).toMatchObject({ email: 'yamil@vieja.com', status: 'reconectar' })
  })

  it('sin configuración responde configured: false', async () => {
    expect((await call(createGoogleAccountsHandler(null))).payload).toEqual({ configured: false, accounts: [] })
  })
})

describe('elegir y desconectar', () => {
  it('POST /api/google-calendars elige un calendario de la cuenta', async () => {
    const { deps, store } = setup([EMPRESA], [])
    const response = await call(createGoogleCalendarsHandler(deps), {
      method: 'POST',
      body: { accountId: EMPRESA.id, calendarId: 'equipo@group.calendar.google.com', name: 'Equipo', colorKey: 'menta' },
    })
    expect(response.status).toBe(201)
    expect(store.calendars).toMatchObject([{ accountId: EMPRESA.id, calendarId: 'equipo@group.calendar.google.com', name: 'Equipo' }])
  })

  it('desconectar revoca el token y borra solo esa cuenta', async () => {
    const { deps, store, google } = setup()
    const response = await call(createGoogleAccountByIdHandler(deps), { method: 'DELETE', query: { id: EMPRESA.id } })
    expect(response.status).toBe(200)
    expect(google.log.revoked).toEqual(['rt-empresa'])
    expect(store.accounts.map((account) => account.id)).toEqual([REVOCADA.id])
    expect(store.calendars.map((calendar) => calendar.id)).toEqual([VIEJA_CAL.id])
  })
})

describe('/api/meets con Google', () => {
  const WORK: StoredMeetCalendar = {
    id: '11111111-1111-4111-8111-111111111111',
    name: 'Trabajo iCal',
    colorKey: 'lavanda',
    icalUrl: 'https://calendar.google.com/calendar/ical/x/private-abc/basic.ics',
    position: 0,
    createdAt: '2026-10-27T12:00:00.000Z',
  }
  const icalStore: MeetCalendarStore = {
    list: async () => [WORK],
    get: async () => WORK,
    create: async () => WORK,
    update: async () => WORK,
    remove: async () => true,
  }

  it('junta iCal y Google; una cuenta revocada queda en "Reconectar" sin romper el resto', async () => {
    const { deps, store } = setup()
    const response = await call(
      createMeetsHandler({ store: icalStore, fetchText: async () => ICS, google: deps, now: () => NOON }),
    )
    const payload = response.payload as MeetsToday
    expect(payload.events.map((event) => event.title)).toEqual([
      'Día de foco',
      'Directorio',
      'Standup (movido)',
      'Planning semanal (adelantado)',
      'Llamada tarde',
    ])
    const directorio = payload.events.find((event) => event.title === 'Directorio')!
    expect(directorio).toMatchObject({
      calendarId: DIRECTORIO_CAL.id,
      meetUrl: 'https://meet.google.com/dir-ecto-rio',
      attendees: [{ name: 'Yamil', email: 'yamil@empresa.com', response: 'si' }],
    })
    expect(payload.calendars).toEqual([
      { id: WORK.id, name: 'Trabajo iCal', colorKey: 'lavanda', error: null, reconnect: false },
      { id: DIRECTORIO_CAL.id, name: 'Empresa', colorKey: 'cielo', error: null, reconnect: false },
      { id: VIEJA_CAL.id, name: 'Vieja', colorKey: 'rosa', error: 'Google pide volver a conectar la cuenta', reconnect: true },
    ])
    expect(store.accounts.find((account) => account.id === REVOCADA.id)?.status).toBe('reconectar')
    expect(response.raw).not.toMatch(SECRETS)
  })

  it('una cuenta ya marcada no vuelve a pedirle a Google', async () => {
    const { deps, google } = setup([{ ...REVOCADA, status: 'reconectar' }], [VIEJA_CAL])
    const response = await call(createMeetsHandler({ store: { ...icalStore, list: async () => [] }, fetchText: async () => ICS, google: deps, now: () => NOON }))
    expect((response.payload as MeetsToday).calendars[0].reconnect).toBe(true)
    expect(google.log.tokenCalls).toBe(0)
  })

  it('cachea los eventos de Google 5 minutos', async () => {
    const { deps, google } = setup([EMPRESA], [DIRECTORIO_CAL])
    const handler = createMeetsHandler({ store: { ...icalStore, list: async () => [] }, fetchText: async () => ICS, google: deps, now: () => NOON })
    // El cache es por instancia y se comparte entre tests: el primer llamado puede venir cacheado del test anterior.
    await call(handler)
    const after = google.log.eventCalls
    await call(handler)
    expect(google.log.eventCalls).toBe(after)
  })
})

// --- auth -----------------------------------------------------------------------

describe('auth de las rutas de Google', () => {
  const UUID = '11111111-2222-3333-4444-555555555555'
  const protectedRoutes: Array<[string, string]> = [
    ['/api/google/connect', 'POST'],
    ['/api/google/accounts', 'GET'],
    [`/api/google-accounts/${UUID}`, 'DELETE'],
    ['/api/google-calendars', 'POST'],
    [`/api/google-calendars/${UUID}`, 'PATCH'],
    [`/api/google-calendars/${UUID}`, 'DELETE'],
  ]

  it('sin JWT responden 401, con JWT inventado también', async () => {
    for (const [path, method] of protectedRoutes) {
      const anonymous = await handleApi(new Request(`https://gogoboy.vercel.app${path}`, { method }))
      expect([path, anonymous.status]).toEqual([path, 401])
      const forged = await handleApi(
        new Request(`https://gogoboy.vercel.app${path}`, { method, headers: { authorization: 'Bearer inventado' } }),
      )
      expect([path, forged.status]).toEqual([path, 401])
    }
  })

  it('piden el email de la allowlist y no aceptan el token de agente', async () => {
    const authenticate = createAuthenticator({
      allowedEmail: 'yo@example.com',
      agentToken: 'agente',
      verifyToken: async (token) => (token === 'yo' ? { email: 'yo@example.com' } : token === 'otro' ? { email: 'otro@example.com' } : null),
    })
    for (const [path, method] of protectedRoutes) {
      const request = (token: string) =>
        new Request(`https://gogoboy.vercel.app${path}`, { method, headers: { authorization: `Bearer ${token}` } })
      expect((await authenticate(request('agente')))?.status).toBe(401)
      expect((await authenticate(request('otro')))?.status).toBe(403)
      expect(await authenticate(request('yo'))).toBeNull()
    }
  })

  it('el callback es la única excepción: pasa sin JWT, pero sin state válido no conecta', async () => {
    const authenticate = createAuthenticator({ allowedEmail: 'yo@example.com', verifyToken: async () => null })
    expect(await authenticate(new Request('https://gogoboy.vercel.app/api/google/callback?code=x&state=y'))).toBeNull()
    // Sin las variables de Google (como en este test) vuelve a la app sin tocar nada.
    const response = await handleApi(new Request('https://gogoboy.vercel.app/api/google/callback?code=x&state=y'))
    expect(response.status).toBe(302)
    expect(response.headers.get('location')).toMatch(/^\/\?google=/)
  })
})
