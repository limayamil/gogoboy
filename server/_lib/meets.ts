/**
 * Arma las Meets del día: baja cada feed desde el servidor (Google no manda CORS y
 * la dirección es secreta, así que el navegador no la ve), filtra hoy en GMT-3 y
 * junta todo. Un feed que falla queda marcado con su error y no tumba a los demás.
 */
import type { MeetCalendarStatus, MeetEvent, MeetsToday } from '../../src/shared/types.ts'
import type { StoredMeetCalendar } from './meet-calendars.ts'
import { eventsForDay, meetsDay, sortMeetEvents } from './meets-ics.ts'

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

interface CacheEntry {
  at: number
  text: string
}

/**
 * Cache por instancia de la función, clave = URL secreta (que no sale de acá).
 * Solo guarda éxitos: si Google falla, el próximo refresco vuelve a intentar.
 */
export function cachedFetch(fetchText: FetchText, ttlMs = FEED_CACHE_MS, clock = () => Date.now()): FetchText {
  const cache = new Map<string, CacheEntry>()
  return async (url) => {
    const hit = cache.get(url)
    if (hit && clock() - hit.at < ttlMs) return hit.text
    const text = await fetchText(url)
    cache.set(url, { at: clock(), text })
    return text
  }
}

function errorMessage(error: unknown): string {
  if (error instanceof FeedError) return error.message
  return 'El feed no es un calendario iCal válido'
}

export async function loadMeetsToday(options: {
  calendars: StoredMeetCalendar[]
  fetchText: FetchText
  now: Date
}): Promise<MeetsToday> {
  const day = meetsDay(options.now)

  const results = await Promise.all(
    options.calendars.map(async (calendar) => {
      const status: MeetCalendarStatus = {
        id: calendar.id,
        name: calendar.name,
        colorKey: calendar.colorKey,
        error: null,
      }
      try {
        const ics = await options.fetchText(calendar.icalUrl)
        return { status, events: eventsForDay(ics, day, calendar.id) }
      } catch (error) {
        // Sin la URL en el log: es secreta.
        console.error(`[meets] falló el calendario ${calendar.id}:`, error instanceof Error ? error.message : error)
        return { status: { ...status, error: errorMessage(error) }, events: [] as MeetEvent[] }
      }
    }),
  )

  return {
    date: day.date,
    events: sortMeetEvents(results.flatMap((result) => result.events)),
    calendars: results.map((result) => result.status),
  }
}
