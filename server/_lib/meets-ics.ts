/**
 * De un feed iCal de Google Calendar a las reuniones de un día. Funciones puras:
 * reciben el texto del .ics y el instante "ahora", sin red ni base.
 *
 * La expansión de RRULE/EXDATE la hace ical.js. Las excepciones (RECURRENCE-ID)
 * se resuelven acá comparando instantes y no con el mapa interno de ical.js, que
 * las indexa por el string de la hora y falla si la excepción viene en UTC y la
 * serie con TZID.
 */
import ICAL from 'ical.js'
import {
  MEETS_TIME_ZONE,
  type MeetAttachment,
  type MeetAttendee,
  type MeetEvent,
  type MeetPerson,
  type MeetResponse,
} from '../../src/shared/types.ts'

type Component = InstanceType<typeof ICAL.Component>
type Time = InstanceType<typeof ICAL.Time>
type Property = InstanceType<typeof ICAL.Property>

const HOUR = 3_600_000
const DAY = 24 * HOUR
/** Corta series patológicas (cada minuto desde 1990) en vez de colgar la función. */
const MAX_OCCURRENCES = 20_000

export interface DayWindow {
  /** 'YYYY-MM-DD' en MEETS_TIME_ZONE. */
  date: string
  start: number
  end: number
}

const dateParts = new Intl.DateTimeFormat('en-CA', {
  timeZone: MEETS_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

/** El día calendario de Buenos Aires que contiene `now`, como [inicio, fin) en ms. */
export function meetsDay(now: Date): DayWindow {
  const date = dateParts.format(now)
  const [y, m, d] = date.split('-').map(Number)
  const start = wallToInstant([y, m, d, 0, 0, 0], MEETS_TIME_ZONE)
  return { date, start, end: wallToInstant([y, m, d + 1, 0, 0, 0], MEETS_TIME_ZONE) }
}

/** Medianoche GMT-3 de un día calendario 'YYYY-MM-DD', en ms. */
export function meetsMidnight(date: string): number {
  const [y, m, d] = date.split('-').map(Number)
  return wallToInstant([y, m, d, 0, 0, 0], MEETS_TIME_ZONE)
}

type Wall = [year: number, month: number, day: number, hour: number, minute: number, second: number]

function offsetAt(instant: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
  }).formatToParts(instant)
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value)
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'))
  return asUtc - Math.floor(instant / 1000) * 1000
}

/** Hora de pared en una zona IANA → instante. Dos pasadas alcanzan para los cambios de horario. */
function wallToInstant([y, m, d, h, mi, s]: Wall, timeZone: string): number {
  const guess = Date.UTC(y, m - 1, d, h, mi, s)
  const first = guess - offsetAt(guess, timeZone)
  return guess - offsetAt(first, timeZone)
}

function isIanaZone(tzid: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tzid })
    return true
  } catch {
    return false
  }
}

/**
 * Instante de una hora del feed. Con TZID IANA (lo que manda Google) usamos Intl y
 * no las reglas del VTIMEZONE del archivo. Una hora flotante, o con un TZID que el
 * feed no define, se lee como GMT-3: es lo más probable para este usuario.
 */
function toInstant(time: Time): number {
  const wall: Wall = [time.year, time.month, time.day, time.hour, time.minute, time.second]
  const zone = time.zone
  if (zone === ICAL.Timezone.utcTimezone) {
    return Date.UTC(time.year, time.month - 1, time.day, time.hour, time.minute, time.second)
  }
  if (!zone || zone === ICAL.Timezone.localTimezone) return wallToInstant(wall, MEETS_TIME_ZONE)
  if (isIanaZone(zone.tzid)) return wallToInstant(wall, zone.tzid)
  // VTIMEZONE con un nombre que Intl no conoce (ej. de Windows): mandan sus reglas.
  return time.toUnixTime() * 1000
}

function dateKey(time: Time): string {
  return `${time.year}-${String(time.month).padStart(2, '0')}-${String(time.day).padStart(2, '0')}`
}

/** Clave para cruzar una ocurrencia con su RECURRENCE-ID o su EXDATE. */
function occurrenceKey(time: Time): string {
  return time.isDate ? `D${dateKey(time)}` : `T${toInstant(time)}`
}

interface Span {
  start: number
  end: number
  allDay: boolean
}

function spanOf(start: Time, end: Time | null): Span {
  if (start.isDate) {
    const startMs = wallToInstant([start.year, start.month, start.day, 0, 0, 0], MEETS_TIME_ZONE)
    // DTEND de un día completo es exclusivo; sin DTEND dura un día.
    const endMs = end ? wallToInstant([end.year, end.month, end.day, 0, 0, 0], MEETS_TIME_ZONE) : startMs + DAY
    return { start: startMs, end: Math.max(endMs, startMs + DAY), allDay: true }
  }
  const startMs = toInstant(start)
  const endMs = end ? toInstant(end) : startMs
  return { start: startMs, end: Math.max(endMs, startMs), allDay: false }
}

/** Una reunión de duración cero cuenta si arranca dentro del día. */
function overlaps(span: Span, day: DayWindow): boolean {
  if (span.end === span.start) return span.start >= day.start && span.start < day.end
  return span.start < day.end && span.end > day.start
}

function isCancelled(component: Component): boolean {
  const status = component.getFirstPropertyValue('status')
  return typeof status === 'string' && status.toUpperCase() === 'CANCELLED'
}

function text(component: Component, name: string): string | null {
  const value = component.getFirstPropertyValue(name)
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed || null
}

// --- Personas -----------------------------------------------------------------

const PARTSTAT: Record<string, MeetResponse> = {
  ACCEPTED: 'si',
  DECLINED: 'no',
  TENTATIVE: 'tal_vez',
}

function param(prop: Property, name: string): string | null {
  const value = prop.getParameter(name)
  const first = Array.isArray(value) ? value[0] : value
  return typeof first === 'string' && first.trim() ? first.trim() : null
}

function personOf(prop: Property): MeetPerson {
  const raw = prop.getFirstValue()
  const value = typeof raw === 'string' ? raw.trim() : ''
  const email = /^mailto:/i.test(value) ? value.slice(7).trim() || null : null
  const name = param(prop, 'cn')
  // Google repite el email en CN cuando no conoce el nombre: no lo mostramos dos veces.
  return { name: name && name !== email ? name : null, email }
}

export function parseAttendees(component: Component): MeetAttendee[] {
  return component.getAllProperties('attendee').map((prop) => ({
    ...personOf(prop),
    response: PARTSTAT[param(prop, 'partstat')?.toUpperCase() ?? ''] ?? 'sin_responder',
  }))
}

function parseOrganizer(component: Component): MeetPerson | null {
  const prop = component.getFirstProperty('organizer')
  if (!prop) return null
  const person = personOf(prop)
  return person.name || person.email ? person : null
}

function parseAttachments(component: Component): MeetAttachment[] {
  const result: MeetAttachment[] = []
  for (const prop of component.getAllProperties('attach')) {
    const value = prop.getFirstValue()
    // Un adjunto binario (ENCODING=BASE64) no tiene a dónde linkear.
    if (typeof value !== 'string' || !isHttpUrl(value)) continue
    result.push({ title: param(prop, 'filename') ?? value, url: value })
  }
  return result
}

// --- Meet y descripción -------------------------------------------------------

const MEET_URL_RE = /https:\/\/meet\.google\.com\/[a-z0-9][a-z0-9-]*[a-z0-9](?:\?[^\s"'<>]*)?/i

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:'
  } catch {
    return false
  }
}

/** X-GOOGLE-CONFERENCE manda; si no está, el primer meet.google.com de lugar o descripción. */
export function extractMeetUrl(fields: {
  conference?: string | null
  location?: string | null
  description?: string | null
}): string | null {
  for (const candidate of [fields.conference, fields.location, fields.description]) {
    const match = candidate ? MEET_URL_RE.exec(candidate) : null
    if (match) return match[0]
  }
  return null
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }

function decodeEntities(value: string): string {
  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, code: string) => {
    if (code[0] === '#') {
      const n = code[1] === 'x' || code[1] === 'X' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10)
      return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : whole
    }
    return ENTITIES[code.toLowerCase()] ?? whole
  })
}

/** El bloque "Unirse con Google Meet" que Google agrega entre separadores `-::~:~::~…::-`. */
const GOOGLE_INVITE_BLOCK_RE = /-::~[:~]*::-[\s\S]*?(?:-::~[:~]*::-|$)/g

/**
 * Descripción de Google (a veces HTML) → texto plano. Nunca devolvemos HTML: el
 * front arma los links a partir del texto, así no hay nada que sanitizar allá.
 * Un `<a href>` con texto distinto al link queda como "texto (url)" para no perder el destino.
 */
export function descriptionToText(raw: string | null): string | null {
  if (!raw) return null
  const plain = raw
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<a\b[^>]*?href\s*=\s*(["'])(.*?)\1[^>]*>([\s\S]*?)<\/a>/gi, (_, _q, href: string, inner: string) => {
      const label = decodeEntities(inner.replace(/<[^>]+>/g, '')).trim()
      const url = decodeEntities(href).trim()
      if (!isHttpUrl(url)) return label
      return !label || label === url ? url : `${label} (${url})`
    })
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6]|tr|blockquote)>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '• ')
    .replace(/<[^>]+>/g, '')
  const cleaned = decodeEntities(plain)
    .replace(GOOGLE_INVITE_BLOCK_RE, '')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  return cleaned || null
}

// --- Expansión ----------------------------------------------------------------

function toMeetEvent(component: Component, span: Span, calendarId: string, uid: string): MeetEvent {
  const location = text(component, 'location')
  const rawDescription = text(component, 'description')
  return {
    id: `${calendarId}:${uid}:${span.start}`,
    calendarId,
    title: text(component, 'summary') ?? '(Sin título)',
    start: new Date(span.start).toISOString(),
    end: new Date(span.end).toISOString(),
    allDay: span.allDay,
    location,
    description: descriptionToText(rawDescription),
    meetUrl: extractMeetUrl({
      conference: text(component, 'x-google-conference'),
      location,
      description: rawDescription,
    }),
    organizer: parseOrganizer(component),
    attendees: parseAttendees(component),
    attachments: parseAttachments(component),
  }
}

function exdateKeys(master: Component): Set<string> {
  const keys = new Set<string>()
  for (const prop of master.getAllProperties('exdate')) {
    for (const value of prop.getValues()) {
      if (value instanceof ICAL.Time) keys.add(occurrenceKey(value))
    }
  }
  return keys
}

function expandSeries(
  master: Component,
  exceptions: Component[],
  day: DayWindow,
  calendarId: string,
  uid: string,
): MeetEvent[] {
  const result: MeetEvent[] = []
  const overridden = new Set<string>()

  // Una excepción puede mover la ocurrencia de otro día a hoy (o sacarla de hoy):
  // se evalúa con su propio horario, no con el de la serie.
  for (const exception of exceptions) {
    const recurrenceId = exception.getFirstPropertyValue('recurrence-id')
    if (recurrenceId instanceof ICAL.Time) overridden.add(occurrenceKey(recurrenceId))
    if (isCancelled(exception)) continue
    const event = new ICAL.Event(exception)
    const span = spanOf(event.startDate, event.endDate)
    if (overlaps(span, day)) result.push(toMeetEvent(exception, span, calendarId, uid))
  }

  if (isCancelled(master)) return result

  const event = new ICAL.Event(master)
  // ical.js ya saltea los EXDATE; los volvemos a cruzar por instante por si vienen
  // en otra zona que el DTSTART y su comparación por string no los reconoce.
  const excluded = exdateKeys(master)
  const duration = event.duration
  const iterator = event.iterator()

  for (let count = 0; count < MAX_OCCURRENCES; count += 1) {
    const occurrence = iterator.next()
    if (!occurrence) break
    const key = occurrenceKey(occurrence)
    const end = occurrence.clone()
    end.addDuration(duration)
    const span = spanOf(occurrence, end)
    if (span.start >= day.end) break
    if (overridden.has(key) || excluded.has(key)) continue
    if (overlaps(span, day)) result.push(toMeetEvent(master, span, calendarId, uid))
  }
  return result
}

/** Las reuniones del feed que tocan `day`, sin ordenar. Tira si el texto no es iCal. */
export function eventsForDay(ics: string, day: DayWindow, calendarId: string): MeetEvent[] {
  const root = new ICAL.Component(ICAL.parse(ics))
  if (root.name !== 'vcalendar') throw new Error('El feed no es un calendario iCal')

  const masters = new Map<string, Component>()
  const exceptions = new Map<string, Component[]>()
  const loose: Component[] = []

  for (const vevent of root.getAllSubcomponents('vevent')) {
    const uid = text(vevent, 'uid')
    if (!uid) {
      loose.push(vevent)
      continue
    }
    if (vevent.hasProperty('recurrence-id')) {
      exceptions.set(uid, [...(exceptions.get(uid) ?? []), vevent])
    } else {
      masters.set(uid, vevent)
    }
  }

  const result: MeetEvent[] = []

  for (const [uid, master] of masters) {
    const own = exceptions.get(uid) ?? []
    exceptions.delete(uid)
    if (master.hasProperty('rrule') || master.hasProperty('rdate')) {
      result.push(...expandSeries(master, own, day, calendarId, uid))
      continue
    }
    // Sin regla las "excepciones" no tienen a quién pisar: valen solas.
    loose.push(master, ...own)
  }
  // Excepciones cuya serie no vino en el feed (pasa con invitaciones sueltas).
  for (const orphans of exceptions.values()) loose.push(...orphans)

  for (const component of loose) {
    if (isCancelled(component)) continue
    const event = new ICAL.Event(component)
    if (!event.startDate) continue
    const span = spanOf(event.startDate, event.endDate ?? null)
    if (overlaps(span, day)) {
      result.push(toMeetEvent(component, span, calendarId, text(component, 'uid') ?? `sin-uid-${span.start}`))
    }
  }

  return result
}

/** Todo el día primero; después por hora de inicio y, a igual hora, por título. */
export function sortMeetEvents(events: MeetEvent[]): MeetEvent[] {
  return [...events].sort((a, b) => {
    if (a.allDay !== b.allDay) return a.allDay ? -1 : 1
    return a.start.localeCompare(b.start) || a.title.localeCompare(b.title, 'es')
  })
}
