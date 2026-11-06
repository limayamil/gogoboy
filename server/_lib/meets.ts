/**
 * Arma las Meets del día juntando fuentes: feeds iCal (bajados desde el servidor:
 * Google no manda CORS y la dirección es secreta) y calendarios de cuentas de Google
 * conectadas por OAuth. Cada fuente falla sola: queda marcada y no tumba a las demás.
 */
import type { MeetCalendarStatus, MeetEvent, MeetsToday } from '../../src/shared/types.ts'
import { GoogleApiError, GoogleReconnectError } from './google.ts'
import type { StoredMeetCalendar } from './meet-calendars.ts'
import { eventsForDay, meetsDay, sortMeetEvents, type DayWindow } from './meets-ics.ts'

export type FetchText = (url: string) => Promise<string>

export const FEED_CACHE_MS = 5 * 60_000
const FEED_TIMEOUT_MS = 10_000
/** Un calendario de años pesa unos pocos MB; más que esto no es un feed normal. */
const FEED_MAX_BYTES = 15 * 1024 * 1024

export class FeedError extends Error {}

export const fetchFeedText: FetchText = async (url) => {
  let response: Response
  try {
    response = await fetch(url, {
      headers: { accept: 'text/calendar' },
      signal: AbortSignal.timeout(FEED_TIMEOUT_MS),
    })
  } catch (error) {
    const timedOut = error instanceof Error && error.name === 'TimeoutError'
    throw new FeedError(timedOut ? 'Google no respondió a tiempo' : 'No se pudo conectar con Google')
  }
  // Una dirección secreta reseteada en Google responde 404.
  if (response.status === 404) throw new FeedError('Google no encuentra el calendario (¿se reseteó la dirección?)')
  if (!response.ok) throw new FeedError(`Google respondió ${response.status}`)
  const length = Number(response.headers.get('content-length') ?? 0)
  if (length > FEED_MAX_BYTES) throw new FeedError('El feed es demasiado grande')
  const text = await response.text()
  if (text.length > FEED_MAX_BYTES) throw new FeedError('El feed es demasiado grande')
  return text
}

/**
 * Cache por instancia de la función. Solo guarda éxitos: si Google falla, el
 * próximo refresco vuelve a intentar.
 */
export function createCache<T>(ttlMs = FEED_CACHE_MS, clock = () => Date.now()) {
  const entries = new Map<string, { at: number; value: T }>()
  return async (key: string, load: () => Promise<T>): Promise<T> => {
    const hit = entries.get(key)
    if (hit && clock() - hit.at < ttlMs) return hit.value
    const value = await load()
    entries.set(key, { at: clock(), value })
    return value
  }
}

/** La clave es la URL secreta, que no sale de acá. */
export function cachedFetch(fetchText: FetchText, ttlMs = FEED_CACHE_MS, clock = () => Date.now()): FetchText {
  const cache = createCache<string>(ttlMs, clock)
  return (url) => cache(url, () => fetchText(url))
}

/** Una fuente de reuniones: un calendario iCal o uno elegido de una cuenta de Google. */
export interface MeetSource {
  calendar: Pick<MeetCalendarStatus, 'id' | 'name' | 'colorKey'>
  load(day: DayWindow): Promise<MeetEvent[]>
}

export function icalSources(calendars: StoredMeetCalendar[], fetchText: FetchText): MeetSource[] {
  return calendars.map((calendar) => ({
    calendar: { id: calendar.id, name: calendar.name, colorKey: calendar.colorKey },
    load: async (day) => eventsForDay(await fetchText(calendar.icalUrl), day, calendar.id),
  }))
}

function describeError(error: unknown): Pick<MeetCalendarStatus, 'error' | 'reconnect'> {
  if (error instanceof GoogleReconnectError) {
    return { error: 'Google pide volver a conectar la cuenta', reconnect: true }
  }
  if (error instanceof FeedError || error instanceof GoogleApiError) return { error: error.message, reconnect: false }
  return { error: 'El feed no es un calendario iCal válido', reconnect: false }
}

export async function loadMeetsToday(options: { sources: MeetSource[]; now: Date }): Promise<MeetsToday> {
  const day = meetsDay(options.now)

  const results = await Promise.all(
    options.sources.map(async (source) => {
      const status: MeetCalendarStatus = { ...source.calendar, error: null, reconnect: false }
      try {
        return { status, events: await source.load(day) }
      } catch (error) {
        // Sin URLs ni tokens en el log: son secretos.
        console.error(`[meets] falló el calendario ${source.calendar.id}:`, error instanceof Error ? error.message : error)
        return { status: { ...status, ...describeError(error) }, events: [] as MeetEvent[] }
      }
    }),
  )

  return {
    date: day.date,
    events: sortMeetEvents(results.flatMap((result) => result.events)),
    calendars: results.map((result) => result.status),
  }
}
