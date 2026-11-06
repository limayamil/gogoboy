/**
 * Evento de Calendar API → la misma forma que sale del iCal, para que la barra no
 * sepa de dónde vino. Las notas pasan por el mismo `descriptionToText`.
 */
import type { MeetAttendee, MeetEvent, MeetResponse } from '../../src/shared/types.ts'
import type { GoogleApiEvent } from './google.ts'
import { descriptionToText, extractMeetUrl, meetsMidnight, type DayWindow } from './meets-ics.ts'

const DAY = 24 * 3_600_000

const RESPONSE: Record<string, MeetResponse> = {
  accepted: 'si',
  declined: 'no',
  tentative: 'tal_vez',
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:'
  } catch {
    return false
  }
}

function clean(value: string | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

export function mapGoogleAttendees(event: GoogleApiEvent): MeetAttendee[] {
  return (event.attendees ?? [])
    // Las salas también vienen como invitados; no son personas que respondan.
    .filter((attendee) => !attendee.resource)
    .map((attendee) => {
      const email = clean(attendee.email)
      const name = clean(attendee.displayName)
      return {
        name: name && name !== email ? name : null,
        email,
        response: RESPONSE[attendee.responseStatus ?? ''] ?? 'sin_responder',
      }
    })
}

/** null si está cancelado, no tiene horario o no toca el día. */
export function mapGoogleEvent(event: GoogleApiEvent, calendarId: string, day: DayWindow): MeetEvent | null {
  if (event.status === 'cancelled') return null

  let start: number
  let end: number
  let allDay = false
  if (event.start?.date) {
    allDay = true
    start = meetsMidnight(event.start.date)
    end = event.end?.date ? meetsMidnight(event.end.date) : start + DAY
    end = Math.max(end, start + DAY)
  } else if (event.start?.dateTime) {
    start = Date.parse(event.start.dateTime)
    end = event.end?.dateTime ? Date.parse(event.end.dateTime) : start
    if (!Number.isFinite(start)) return null
    if (!Number.isFinite(end) || end < start) end = start
  } else {
    return null
  }

  const touches = end === start ? start >= day.start && start < day.end : start < day.end && end > day.start
  if (!touches) return null

  const location = clean(event.location)
  const video = event.conferenceData?.entryPoints?.find((entry) => entry.entryPointType === 'video')?.uri

  return {
    id: `${calendarId}:${event.id}`,
    calendarId,
    title: clean(event.summary) ?? '(Sin título)',
    start: new Date(start).toISOString(),
    end: new Date(end).toISOString(),
    allDay,
    location,
    description: descriptionToText(clean(event.description)),
    meetUrl: extractMeetUrl({
      conference: event.hangoutLink ?? video ?? null,
      location,
      description: event.description ?? null,
    }),
    organizer:
      event.organizer && (event.organizer.email || event.organizer.displayName)
        ? {
            name: clean(event.organizer.displayName),
            email: clean(event.organizer.email),
          }
        : null,
    attendees: mapGoogleAttendees(event),
    attachments: (event.attachments ?? [])
      .filter((file) => file.fileUrl && isHttpUrl(file.fileUrl))
      .map((file) => ({ title: clean(file.title) ?? file.fileUrl!, url: file.fileUrl! })),
  }
}
