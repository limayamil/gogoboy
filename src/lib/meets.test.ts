import { describe, expect, it } from 'vitest'
import { formatMeetTime, formatMeetsDate, linkifyText, meetMoment } from './meets'

describe('formatMeetTime', () => {
  it('muestra la hora de Buenos Aires aunque el instante sea del día siguiente en UTC', () => {
    expect(
      formatMeetTime({ start: '2026-10-28T02:30:00.000Z', end: '2026-10-28T02:55:00.000Z', allDay: false }),
    ).toBe('23:30 – 23:55')
  })

  it('todo el día', () => {
    expect(formatMeetTime({ start: '2026-10-27T03:00:00.000Z', end: '2026-10-28T03:00:00.000Z', allDay: true })).toBe(
      'Todo el día',
    )
  })
})

describe('formatMeetsDate', () => {
  it('en castellano y sin coma', () => {
    expect(formatMeetsDate('2026-10-27')).toBe('martes 27 de octubre')
  })
})

describe('meetMoment', () => {
  const event = { start: '2026-10-27T14:30:00.000Z', end: '2026-10-27T14:45:00.000Z', allDay: false }

  it('antes, durante y después', () => {
    expect(meetMoment(event, new Date('2026-10-27T14:00:00.000Z'))).toBe('proxima')
    expect(meetMoment(event, new Date('2026-10-27T14:35:00.000Z'))).toBe('ahora')
    expect(meetMoment(event, new Date('2026-10-27T14:45:00.000Z'))).toBe('pasada')
  })
})

describe('linkifyText', () => {
  it('separa links de texto y deja afuera la puntuación final', () => {
    expect(linkifyText('Tablero: https://trello.com/b/abc. Y listo')).toEqual([
      { kind: 'text', value: 'Tablero: ' },
      { kind: 'link', value: 'https://trello.com/b/abc' },
      { kind: 'text', value: '. Y listo' },
    ])
  })

  it('el paréntesis que envuelve el link no es parte del link', () => {
    expect(linkifyText('Trello (https://trello.com/b/abc)')).toEqual([
      { kind: 'text', value: 'Trello (' },
      { kind: 'link', value: 'https://trello.com/b/abc' },
      { kind: 'text', value: ')' },
    ])
  })

  it('no convierte javascript: ni markup en links', () => {
    expect(linkifyText('<a href="javascript:alert(1)">x</a>')).toEqual([
      { kind: 'text', value: '<a href="javascript:alert(1)">x</a>' },
    ])
  })
})
