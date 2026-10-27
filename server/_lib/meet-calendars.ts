/**
 * Calendarios de Google para las Meets del día. La dirección secreta iCal se guarda
 * en la base y solo la lee el servidor para bajar el feed: ningún handler la
 * devuelve. Al front le llega `maskedUrl`.
 */
import { isGoogleIcalUrl } from '../../src/shared/meets.ts'
import type { MeetCalendar, MeetCalendarInput } from '../../src/shared/types.ts'
import { sql } from './db.ts'
import { HttpError } from './http.ts'
import { requiredText } from './validate.ts'

/** Lo que vive en la base. No sale de server/. */
export interface StoredMeetCalendar extends Omit<MeetCalendar, 'maskedUrl'> {
  icalUrl: string
}

export interface MeetCalendarStore {
  list(): Promise<StoredMeetCalendar[]>
  get(id: string): Promise<StoredMeetCalendar | null>
  create(input: MeetCalendarInput): Promise<StoredMeetCalendar>
  update(id: string, next: MeetCalendarInput): Promise<StoredMeetCalendar | null>
  remove(id: string): Promise<boolean>
}

function fail(message: string): never {
  throw new HttpError(400, message)
}

export function googleIcalUrl(value: unknown, field = 'icalUrl'): string {
  if (typeof value !== 'string') fail(`"${field}" debe ser texto`)
  const trimmed = value.trim()
  if (!trimmed) fail(`"${field}" no puede estar vacío`)
  if (trimmed.length > 2000) fail(`"${field}" supera los 2000 caracteres`)
  if (!isGoogleIcalUrl(trimmed)) {
    fail('Solo se aceptan direcciones https://calendar.google.com/calendar/ical/…')
  }
  return new URL(trimmed).toString()
}

/**
 * Lo justo para reconocer cuál es: el inicio del calendario y los últimos 4 del
 * token. Con eso no se puede reconstruir la dirección.
 */
export function maskIcalUrl(icalUrl: string): string {
  let url: URL
  try {
    url = new URL(icalUrl)
  } catch {
    return '••••'
  }
  const [, , , calendarId = '', token = '', file = ''] = url.pathname.split('/')
  const id = decodeURIComponent(calendarId)
  const shortId = id.length > 6 ? `${id.slice(0, 4)}…` : id ? '…' : ''
  const tail = token.slice(-4)
  const maskedToken = token.startsWith('private-') ? `private-••••${tail}` : token ? `••••${tail}` : '••••'
  return `${url.hostname}/…/${shortId}/${maskedToken}${file ? `/${file}` : ''}`
}

export function toPublicCalendar(calendar: StoredMeetCalendar): MeetCalendar {
  const { icalUrl, ...rest } = calendar
  return { ...rest, maskedUrl: maskIcalUrl(icalUrl) }
}

export function parseMeetCalendarCreate(input: Record<string, unknown>): MeetCalendarInput {
  return {
    name: requiredText(input.name, 'name', 60),
    colorKey: requiredText(input.colorKey, 'colorKey', 40),
    icalUrl: googleIcalUrl(input.icalUrl),
  }
}

/** Sin `icalUrl` en el patch la dirección guardada queda como está: el front no la tiene. */
export function parseMeetCalendarPatch(
  input: Record<string, unknown>,
  current: StoredMeetCalendar,
): MeetCalendarInput {
  const keys = ['name', 'colorKey', 'icalUrl'].filter((key) => key in input)
  if (keys.length === 0) fail('No hay nada para actualizar')
  return {
    name: 'name' in input ? requiredText(input.name, 'name', 60) : current.name,
    colorKey: 'colorKey' in input ? requiredText(input.colorKey, 'colorKey', 40) : current.colorKey,
    icalUrl: 'icalUrl' in input ? googleIcalUrl(input.icalUrl) : current.icalUrl,
  }
}

type Row = Record<string, unknown>

function mapRow(row: Row): StoredMeetCalendar {
  return {
    id: row.id as string,
    name: row.name as string,
    colorKey: row.color_key as string,
    icalUrl: row.ical_url as string,
    position: Number(row.position),
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
  }
}

export const meetCalendarStore: MeetCalendarStore = {
  async list() {
    const rows = (await sql`select * from meet_calendars order by position, created_at`) as Row[]
    return rows.map(mapRow)
  },

  async get(id) {
    const [row] = (await sql`select * from meet_calendars where id = ${id}`) as Row[]
    return row ? mapRow(row) : null
  },

  async create(input) {
    const [row] = (await sql`
      insert into meet_calendars (name, color_key, ical_url, position)
      values (
        ${input.name}, ${input.colorKey}, ${input.icalUrl},
        (select coalesce(max(position), -1) + 1 from meet_calendars)
      )
      returning *
    `) as Row[]
    return mapRow(row)
  },

  async update(id, next) {
    const [row] = (await sql`
      update meet_calendars
      set name = ${next.name}, color_key = ${next.colorKey}, ical_url = ${next.icalUrl}
      where id = ${id}
      returning *
    `) as Row[]
    return row ? mapRow(row) : null
  },

  async remove(id) {
    const rows = (await sql`delete from meet_calendars where id = ${id} returning id`) as Row[]
    return rows.length > 0
  },
}
