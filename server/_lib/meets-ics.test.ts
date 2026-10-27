import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  descriptionToText,
  eventsForDay,
  extractMeetUrl,
  meetsDay,
  sortMeetEvents,
} from './meets-ics.ts'

const FIXTURE = readFileSync(new URL('./fixtures/meets.ics', import.meta.url), 'utf8')

// Martes 27/10/2026, 12:00 en Buenos Aires.
const NOON = new Date('2026-10-27T15:00:00.000Z')

function titlesFor(now: Date, ics = FIXTURE) {
  return sortMeetEvents(eventsForDay(ics, meetsDay(now), 'cal')).map((event) => event.title)
}

function calendar(...events: string[]) {
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', ...events, 'END:VCALENDAR'].join('\r\n')
}

function vevent(lines: string[]) {
  return ['BEGIN:VEVENT', 'DTSTAMP:20261020T120000Z', ...lines, 'END:VEVENT'].join('\r\n')
}

describe('meetsDay', () => {
  it('corta el día en la medianoche GMT-3, no en la del servidor ni en UTC', () => {
    expect(meetsDay(NOON)).toEqual({
      date: '2026-10-27',
      start: Date.parse('2026-10-27T03:00:00.000Z'),
      end: Date.parse('2026-10-28T03:00:00.000Z'),
    })
  })

  it('a las 23:59 de Buenos Aires (02:59 UTC del día siguiente) sigue siendo hoy', () => {
    expect(meetsDay(new Date('2026-10-28T02:59:00.000Z')).date).toBe('2026-10-27')
    expect(meetsDay(new Date('2026-10-28T03:00:00.000Z')).date).toBe('2026-10-28')
  })
})

describe('eventsForDay', () => {
  it('arma el día con la serie, sus excepciones, exclusiones y bordes', () => {
    expect(titlesFor(NOON)).toEqual([
      'Día de foco',
      'Standup (movido)',
      'Planning semanal (adelantado)',
      'Llamada tarde',
    ])
  })

  it('una excepción reemplaza la ocurrencia: no aparece el Standup de las 10', () => {
    const standups = eventsForDay(FIXTURE, meetsDay(NOON), 'cal').filter((event) =>
      event.title.startsWith('Standup'),
    )
    expect(standups).toHaveLength(1)
    expect(standups[0].start).toBe('2026-10-27T14:30:00.000Z')
    expect(standups[0].end).toBe('2026-10-27T14:45:00.000Z')
  })

  it('la serie sigue normal los otros martes', () => {
    const previous = eventsForDay(FIXTURE, meetsDay(new Date('2026-10-20T15:00:00.000Z')), 'cal')
    const standup = previous.find((event) => event.title === 'Standup')
    expect(standup?.start).toBe('2026-10-20T13:00:00.000Z')
  })

  it('EXDATE saca solo ese día de la serie diaria', () => {
    expect(titlesFor(NOON)).not.toContain('Sync diario')
    expect(titlesFor(new Date('2026-10-26T15:00:00.000Z'))).toContain('Sync diario')
    expect(titlesFor(new Date('2026-10-28T15:00:00.000Z'))).toContain('Sync diario')
  })

  it('una ocurrencia cancelada (RECURRENCE-ID + CANCELLED) no aparece', () => {
    expect(titlesFor(NOON)).not.toContain('Revisión de diseño')
    expect(titlesFor(new Date('2026-10-26T15:00:00.000Z'))).toContain('Revisión de diseño')
  })

  it('una ocurrencia de mañana adelantada a hoy aparece hoy y no mañana', () => {
    expect(titlesFor(NOON)).toContain('Planning semanal (adelantado)')
    expect(titlesFor(new Date('2026-10-28T15:00:00.000Z'))).not.toContain('Planning semanal')
  })

  it('23:30 GMT-3 es hoy; 00:30 del día siguiente no', () => {
    const today = titlesFor(NOON)
    expect(today).toContain('Llamada tarde')
    expect(today).not.toContain('Llamada de madrugada')
    expect(titlesFor(new Date('2026-10-28T15:00:00.000Z'))).toContain('Llamada de madrugada')
  })

  it('un evento suelto cancelado no aparece', () => {
    expect(titlesFor(NOON)).not.toContain('Reunión cancelada')
  })

  it('el día completo cuenta solo en su día y va primero', () => {
    const [first] = sortMeetEvents(eventsForDay(FIXTURE, meetsDay(NOON), 'cal'))
    expect(first).toMatchObject({ title: 'Día de foco', allDay: true, start: '2026-10-27T03:00:00.000Z' })
    expect(titlesFor(new Date('2026-10-28T15:00:00.000Z'))).not.toContain('Día de foco')
  })

  it('un día completo de varios días aparece en cada uno', () => {
    const ics = calendar(
      vevent(['UID:viaje', 'SUMMARY:Viaje', 'DTSTART;VALUE=DATE:20261026', 'DTEND;VALUE=DATE:20261029']),
    )
    expect(titlesFor(NOON, ics)).toEqual(['Viaje'])
    expect(titlesFor(new Date('2026-10-29T15:00:00.000Z'), ics)).toEqual([])
  })

  it('una serie de días completos con EXDATE de fecha', () => {
    const ics = calendar(
      vevent([
        'UID:gym',
        'SUMMARY:Gimnasio',
        'DTSTART;VALUE=DATE:20261020',
        'RRULE:FREQ=DAILY',
        'EXDATE;VALUE=DATE:20261027',
      ]),
    )
    expect(titlesFor(NOON, ics)).toEqual([])
    expect(titlesFor(new Date('2026-10-26T15:00:00.000Z'), ics)).toEqual(['Gimnasio'])
  })

  it('EXDATE en UTC tapa la ocurrencia de una serie con TZID', () => {
    const ics = calendar(
      vevent([
        'UID:utc-ex',
        'SUMMARY:Diaria',
        'DTSTART;TZID=America/Argentina/Buenos_Aires:20261020T100000',
        'DTEND;TZID=America/Argentina/Buenos_Aires:20261020T103000',
        'RRULE:FREQ=DAILY',
        'EXDATE:20261027T130000Z',
      ]),
    )
    expect(titlesFor(NOON, ics)).toEqual([])
  })

  it('una hora flotante (sin zona) se lee en GMT-3', () => {
    const ics = calendar(
      vevent(['UID:flot', 'SUMMARY:Flotante', 'DTSTART:20261027T233000', 'DTEND:20261027T235000']),
    )
    const [event] = eventsForDay(ics, meetsDay(NOON), 'cal')
    expect(event.start).toBe('2026-10-28T02:30:00.000Z')
  })

  it('respeta un TZID de otra zona', () => {
    const ics = calendar(
      vevent([
        'UID:madrid',
        'SUMMARY:Con Madrid',
        'DTSTART;TZID=Europe/Madrid:20261028T040000',
        'DTEND;TZID=Europe/Madrid:20261028T050000',
      ]),
    )
    // 04:00 en Madrid (CET, UTC+1 desde el 25/10) son las 00:00 del 28 en Buenos Aires.
    expect(titlesFor(NOON, ics)).toEqual([])
    expect(titlesFor(new Date('2026-10-28T15:00:00.000Z'), ics)).toEqual(['Con Madrid'])
  })

  it('tira si el texto no es iCal (por ejemplo, una página de login)', () => {
    expect(() => eventsForDay('<html>Iniciá sesión</html>', meetsDay(NOON), 'cal')).toThrow()
  })
})

describe('detalle del evento', () => {
  const standup = eventsForDay(FIXTURE, meetsDay(NOON), 'cal').find(
    (event) => event.title === 'Standup (movido)',
  )!

  it('lee invitados con su respuesta y sin repetir el email como nombre', () => {
    expect(standup.attendees).toEqual([
      { name: 'Yamil Lima', email: 'yamil@example.com', response: 'si' },
      { name: 'Ana Pérez', email: 'ana@example.com', response: 'no' },
      { name: null, email: 'beto@example.com', response: 'tal_vez' },
      { name: null, email: 'caro@example.com', response: 'sin_responder' },
    ])
  })

  it('lee el organizador', () => {
    expect(standup.organizer).toEqual({ name: 'Yamil Lima', email: 'yamil@example.com' })
  })

  it('lee los adjuntos con su nombre', () => {
    expect(standup.attachments).toEqual([
      { title: 'Minuta standup', url: 'https://drive.google.com/open?id=minuta123' },
    ])
  })

  it('la descripción llega como texto, sin HTML ni el bloque de Meet de Google', () => {
    expect(standup.description).toBe(
      'Hoy lo corremos a las 11:30 por la demo.\nTablero: Trello (https://trello.com/b/abc)\nNotas en https://docs.google.com/document/d/123',
    )
  })

  it('cada ocurrencia de una serie tiene id propio', () => {
    const week = [20, 27].flatMap((day) =>
      eventsForDay(FIXTURE, meetsDay(new Date(`2026-10-${day}T15:00:00.000Z`)), 'cal'),
    )
    const ids = week.map((event) => event.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('extractMeetUrl', () => {
  it('prefiere X-GOOGLE-CONFERENCE', () => {
    expect(
      extractMeetUrl({
        conference: 'https://meet.google.com/abc-defg-hij',
        description: 'https://meet.google.com/otr-oooo-xxx',
      }),
    ).toBe('https://meet.google.com/abc-defg-hij')
  })

  it('cae al lugar y después a la descripción', () => {
    expect(extractMeetUrl({ location: 'Sala 3 · https://meet.google.com/rev-isio-nes' })).toBe(
      'https://meet.google.com/rev-isio-nes',
    )
    expect(extractMeetUrl({ description: '<a href="https://meet.google.com/tar-dell-ama">Unirse</a>' })).toBe(
      'https://meet.google.com/tar-dell-ama',
    )
  })

  it('ignora lo que no es meet.google.com por https', () => {
    expect(extractMeetUrl({ description: 'http://meet.google.com/abc-defg-hij' })).toBeNull()
    expect(extractMeetUrl({ description: 'https://meet.google.com.evil.io/abc' })).toBeNull()
    expect(extractMeetUrl({ location: 'https://zoom.us/j/123' })).toBeNull()
    expect(extractMeetUrl({})).toBeNull()
  })

  it('las reuniones del fixture traen su link', () => {
    const events = eventsForDay(FIXTURE, meetsDay(NOON), 'cal')
    const byTitle = Object.fromEntries(events.map((event) => [event.title, event.meetUrl]))
    expect(byTitle['Standup (movido)']).toBe('https://meet.google.com/abc-defg-hij')
    expect(byTitle['Llamada tarde']).toBe('https://meet.google.com/tar-dell-ama')
    expect(byTitle['Día de foco']).toBeNull()
  })
})

describe('descriptionToText', () => {
  it('descarta scripts y links que no son http', () => {
    expect(descriptionToText('Hola<script>alert(1)</script> <a href="javascript:alert(1)">acá</a>')).toBe(
      'Hola acá',
    )
  })

  it('decodifica entidades sin volver a crear tags', () => {
    expect(descriptionToText('&lt;b&gt;no es negrita&lt;/b&gt; &amp; listo')).toBe('<b>no es negrita</b> & listo')
  })

  it('vacío es null', () => {
    expect(descriptionToText('<p> </p>')).toBeNull()
    expect(descriptionToText(null)).toBeNull()
  })
})
