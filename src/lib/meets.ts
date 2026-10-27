import { MEETS_TIME_ZONE, type MeetEvent, type MeetResponse } from '../shared/types'

/** Siempre en Buenos Aires: la hora del navegador no cuenta para las Meets. */
const timeFormat = new Intl.DateTimeFormat('es-AR', {
  timeZone: MEETS_TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

export function formatMeetTime(event: Pick<MeetEvent, 'start' | 'end' | 'allDay'>): string {
  if (event.allDay) return 'Todo el día'
  const start = timeFormat.format(new Date(event.start))
  if (event.end === event.start) return start
  return `${start} – ${timeFormat.format(new Date(event.end))}`
}

/** 'YYYY-MM-DD' → "martes 27 de octubre". La fecha ya viene calculada en GMT-3. */
export function formatMeetsDate(date: string): string {
  const [y, m, d] = date.split('-').map(Number)
  return new Intl.DateTimeFormat('es-AR', {
    timeZone: 'UTC',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
    .format(new Date(Date.UTC(y, m - 1, d, 12)))
    .replace(',', '')
}

export type MeetMoment = 'pasada' | 'ahora' | 'proxima'

export function meetMoment(event: Pick<MeetEvent, 'start' | 'end' | 'allDay'>, now: Date): MeetMoment {
  if (event.allDay) return 'proxima'
  const at = now.getTime()
  if (at >= Date.parse(event.end) && event.end !== event.start) return 'pasada'
  if (at >= Date.parse(event.start)) return 'ahora'
  return 'proxima'
}

export const RESPONSE_LABEL: Record<MeetResponse, string> = {
  si: 'Sí',
  no: 'No',
  tal_vez: 'Tal vez',
  sin_responder: 'Sin responder',
}

export type TextPart = { kind: 'text'; value: string } | { kind: 'link'; value: string }

const URL_RE = /https?:\/\/[^\s<>"']+/g

/**
 * Parte el texto de las notas en trozos y links. Se pinta con nodos de React, sin
 * HTML: aunque el feed traiga markup, acá ya llega como texto y no puede ejecutar nada.
 */
export function linkifyText(text: string): TextPart[] {
  const parts: TextPart[] = []
  let last = 0
  for (const match of text.matchAll(URL_RE)) {
    let url = match[0]
    // El punto o el paréntesis que cierra la oración no son parte del link.
    while (/[.,;:!?)\]]$/.test(url) && !(url.endsWith(')') && url.includes('('))) {
      url = url.slice(0, -1)
    }
    const index = match.index ?? 0
    if (index > last) parts.push({ kind: 'text', value: text.slice(last, index) })
    parts.push({ kind: 'link', value: url })
    last = index + url.length
  }
  if (last < text.length) parts.push({ kind: 'text', value: text.slice(last) })
  return parts
}
