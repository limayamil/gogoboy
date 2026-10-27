import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { ApiRequest, ApiResponse, Handler } from './_lib/http.ts'
import {
  googleIcalUrl,
  maskIcalUrl,
  type MeetCalendarStore,
  type StoredMeetCalendar,
} from './_lib/meet-calendars.ts'
import { cachedFetch, FeedError, type FetchText } from './_lib/meets.ts'
import { createMeetCalendarsHandler } from './meet-calendars/index.ts'
import { createMeetCalendarByIdHandler } from './meet-calendars/[id].ts'
import { createMeetsHandler } from './meets.ts'

const FIXTURE = readFileSync(new URL('./_lib/fixtures/meets.ics', import.meta.url), 'utf8')
const NOON = new Date('2026-10-27T15:00:00.000Z')

const SECRET_TOKEN = 'private-0123456789abcdef0123456789abcdef'
const WORK_URL = `https://calendar.google.com/calendar/ical/yamil%40example.com/${SECRET_TOKEN}/basic.ics`
const BROKEN_URL = 'https://calendar.google.com/calendar/ical/otro%40example.com/private-ffffeeee11112222/basic.ics'

function memoryStore(seed: StoredMeetCalendar[] = []): MeetCalendarStore {
  const rows = [...seed]
  let next = 1
  return {
    async list() {
      return [...rows]
    },
    async get(id) {
      return rows.find((row) => row.id === id) ?? null
    },
    async create(input) {
      const row = {
        ...input,
        id: `00000000-0000-4000-8000-00000000000${next++}`,
        position: rows.length,
        createdAt: '2026-10-27T12:00:00.000Z',
      }
      rows.push(row)
      return row
    },
    async update(id, input) {
      const index = rows.findIndex((row) => row.id === id)
      if (index < 0) return null
      rows[index] = { ...rows[index], ...input }
      return rows[index]
    },
    async remove(id) {
      const index = rows.findIndex((row) => row.id === id)
      if (index < 0) return false
      rows.splice(index, 1)
      return true
    },
  }
}

const WORK: StoredMeetCalendar = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Trabajo',
  colorKey: 'lavanda',
  icalUrl: WORK_URL,
  position: 0,
  createdAt: '2026-10-27T12:00:00.000Z',
}

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
  return { status, payload, headers, raw: JSON.stringify(payload) }
}

describe('googleIcalUrl', () => {
  it('acepta la dirección secreta de Google', () => {
    expect(googleIcalUrl(` ${WORK_URL} `)).toBe(WORK_URL)
  })

  it.each([
    ['http', WORK_URL.replace('https:', 'http:')],
    ['otro host', 'https://evil.example.com/calendar/ical/x/private-1/basic.ics'],
    ['subdominio parecido', 'https://calendar.google.com.evil.io/calendar/ical/x/basic.ics'],
    ['otra ruta de google', 'https://calendar.google.com/calendar/u/0/r'],
    ['webcal', 'webcal://calendar.google.com/calendar/ical/x/basic.ics'],
    ['credenciales', 'https://a:b@calendar.google.com/calendar/ical/x/basic.ics'],
    ['puerto', 'https://calendar.google.com:8443/calendar/ical/x/basic.ics'],
    ['basura', 'no es una url'],
  ])('rechaza %s', (_, url) => {
    expect(() => googleIcalUrl(url)).toThrow()
  })
})

describe('maskIcalUrl', () => {
  it('deja reconocerla sin poder reconstruirla', () => {
    const masked = maskIcalUrl(WORK_URL)
    expect(masked).toBe('calendar.google.com/…/yami…/private-••••cdef/basic.ics')
    expect(masked).not.toContain('0123456789abcdef')
  })
})

describe('/api/meet-calendars', () => {
  it('POST guarda y responde sin la dirección secreta', async () => {
    const store = memoryStore()
    const response = await call(createMeetCalendarsHandler(store), {
      method: 'POST',
      body: { name: 'Trabajo', colorKey: 'lavanda', icalUrl: WORK_URL },
    })
    expect(response.status).toBe(201)
    expect(response.raw).not.toContain(SECRET_TOKEN)
    expect(response.payload).not.toHaveProperty('icalUrl')
    expect(response.payload).toMatchObject({ name: 'Trabajo', maskedUrl: expect.stringContaining('••••') })
    expect((await store.list())[0].icalUrl).toBe(WORK_URL)
  })

  it('GET lista enmascarado', async () => {
    const response = await call(createMeetCalendarsHandler(memoryStore([WORK])))
    expect(response.status).toBe(200)
    expect(response.raw).not.toContain(SECRET_TOKEN)
    expect(response.raw).not.toContain('icalUrl')
  })

  it('POST rechaza una URL que no es de Google', async () => {
    const response = await call(createMeetCalendarsHandler(memoryStore()), {
      method: 'POST',
      body: { name: 'X', colorKey: 'lila', icalUrl: 'https://example.com/a.ics' },
    })
    expect(response.status).toBe(400)
  })

  it('PATCH renombra y recolorea sin pisar la dirección guardada', async () => {
    const store = memoryStore([WORK])
    const response = await call(createMeetCalendarByIdHandler(store), {
      method: 'PATCH',
      query: { id: WORK.id },
      body: { name: 'Laburo', colorKey: 'menta' },
    })
    expect(response.status).toBe(200)
    expect(response.raw).not.toContain(SECRET_TOKEN)
    expect(await store.get(WORK.id)).toMatchObject({ name: 'Laburo', colorKey: 'menta', icalUrl: WORK_URL })
  })

  it('PATCH con una dirección nueva la reemplaza y tampoco la devuelve', async () => {
    const store = memoryStore([WORK])
    const response = await call(createMeetCalendarByIdHandler(store), {
      method: 'PATCH',
      query: { id: WORK.id },
      body: { icalUrl: BROKEN_URL },
    })
    expect(response.status).toBe(200)
    expect(response.raw).not.toContain('ffffeeee1111')
    expect((await store.get(WORK.id))?.icalUrl).toBe(BROKEN_URL)
  })

  it('DELETE borra y 404 si no existe', async () => {
    const store = memoryStore([WORK])
    const handler = createMeetCalendarByIdHandler(store)
    expect((await call(handler, { method: 'DELETE', query: { id: WORK.id } })).status).toBe(200)
    expect((await call(handler, { method: 'DELETE', query: { id: WORK.id } })).status).toBe(404)
  })
})

describe('/api/meets', () => {
  const broken: StoredMeetCalendar = { ...WORK, id: '22222222-2222-4222-8222-222222222222', name: 'Personal', icalUrl: BROKEN_URL }
  const fetchText: FetchText = async (url) => {
    if (url === BROKEN_URL) throw new FeedError('Google respondió 500')
    return FIXTURE
  }

  it('un feed roto no tumba a los demás y queda marcado', async () => {
    const response = await call(
      createMeetsHandler({ store: memoryStore([WORK, broken]), fetchText, now: () => NOON }),
    )
    expect(response.status).toBe(200)
    const payload = response.payload as { date: string; events: { title: string }[]; calendars: unknown[] }
    expect(payload.date).toBe('2026-10-27')
    expect(payload.events.map((event) => event.title)).toEqual([
      'Día de foco',
      'Standup (movido)',
      'Planning semanal (adelantado)',
      'Llamada tarde',
    ])
    expect(payload.calendars).toEqual([
      { id: WORK.id, name: 'Trabajo', colorKey: 'lavanda', error: null },
      { id: broken.id, name: 'Personal', colorKey: 'lavanda', error: 'Google respondió 500' },
    ])
  })

  it('un feed que no es iCal también queda marcado aparte', async () => {
    const response = await call(
      createMeetsHandler({
        store: memoryStore([WORK, broken]),
        fetchText: async (url) => (url === BROKEN_URL ? '<html>login</html>' : FIXTURE),
        now: () => NOON,
      }),
    )
    const payload = response.payload as { events: unknown[]; calendars: { error: string | null }[] }
    expect(payload.events).toHaveLength(4)
    expect(payload.calendars[1].error).toBe('El feed no es un calendario iCal válido')
  })

  it('nunca devuelve la dirección secreta ni pide no cachear', async () => {
    const response = await call(createMeetsHandler({ store: memoryStore([WORK, broken]), fetchText, now: () => NOON }))
    expect(response.raw).not.toContain(SECRET_TOKEN)
    expect(response.raw).not.toContain('ffffeeee1111')
    expect(response.headers['Cache-Control']).toBe('no-store')
  })

  it('sin calendarios responde vacío sin hacer fetch', async () => {
    const response = await call(
      createMeetsHandler({
        store: memoryStore(),
        fetchText: async () => {
          throw new Error('no debería bajar nada')
        },
        now: () => NOON,
      }),
    )
    expect(response.payload).toEqual({ date: '2026-10-27', events: [], calendars: [] })
  })
})

describe('cachedFetch', () => {
  it('reusa el feed durante 5 minutos y no guarda errores', async () => {
    let now = 0
    let calls = 0
    let fail = true
    const fetchText = cachedFetch(
      async () => {
        calls += 1
        if (fail) throw new FeedError('caído')
        return 'ok'
      },
      5 * 60_000,
      () => now,
    )

    await expect(fetchText(WORK_URL)).rejects.toThrow('caído')
    fail = false
    expect(await fetchText(WORK_URL)).toBe('ok')
    now = 4 * 60_000
    expect(await fetchText(WORK_URL)).toBe('ok')
    expect(calls).toBe(2)
    now = 6 * 60_000
    await fetchText(WORK_URL)
    expect(calls).toBe(3)
  })
})
