import { describe, expect, it } from 'vitest'
import { composeKindFromFilter, filterNotes, PASSWORDS_FILTER, uniqueNoteTags } from './notes'
import type { Note, NoteTag } from '../shared/types'

const tag = (id: string, name: string): NoteTag => ({ id, name })

function note(partial: Partial<Note> & Pick<Note, 'id' | 'title'>): Note {
  return {
    kind: 'note',
    description: null,
    username: null,
    password: null,
    createdAt: '2026-09-13T00:00:00.000Z',
    updatedAt: '2026-09-13T00:00:00.000Z',
    tags: [],
    attachments: [],
    ...partial,
  }
}

const casa = tag('t1', 'Casa')
const laburo = tag('t2', 'Laburo')

const notes: Note[] = [
  note({ id: 'n1', title: 'Comprar pintura', description: 'Para el living', tags: [casa] }),
  note({ id: 'n2', title: 'Idea de app', description: 'Notas con etiquetas', tags: [laburo] }),
  note({ id: 'n3', title: 'Sin etiqueta', description: 'texto suelto' }),
  note({
    id: 'p1',
    kind: 'password',
    title: 'Gmail',
    username: 'yo@correo.com',
    password: 'secreto-gmail',
  }),
]

describe('filterNotes', () => {
  it('sin query ni etiqueta devuelve notas y contraseñas', () => {
    expect(filterNotes(notes, '', null).map((n) => n.id)).toEqual(['n1', 'n2', 'n3', 'p1'])
  })

  it('busca en titulo y descripcion, sin importar mayusculas', () => {
    expect(filterNotes(notes, 'LIVING', null).map((n) => n.id)).toEqual(['n1'])
    expect(filterNotes(notes, 'idea', null).map((n) => n.id)).toEqual(['n2'])
  })

  it('busca el texto visible, no los tags del HTML', () => {
    const htmlNotes = [
      note({ id: 'n4', title: 'Receta', description: '<p>tarta de <strong>manzana</strong></p>' }),
    ]
    expect(filterNotes(htmlNotes, 'manzana', null).map((n) => n.id)).toEqual(['n4'])
    expect(filterNotes(htmlNotes, 'strong', null)).toEqual([])
  })

  it('en contraseñas busca titulo y usuario, nunca la clave', () => {
    expect(filterNotes(notes, 'correo', null).map((n) => n.id)).toEqual(['p1'])
    expect(filterNotes(notes, 'secreto-gmail', null)).toEqual([])
    expect(filterNotes(notes, 'GMAIL', PASSWORDS_FILTER).map((n) => n.id)).toEqual(['p1'])
  })

  it('el filtro reservado solo deja contraseñas', () => {
    expect(filterNotes(notes, '', PASSWORDS_FILTER).map((n) => n.id)).toEqual(['p1'])
  })

  it('filtra por etiqueta y combina con la busqueda', () => {
    expect(filterNotes(notes, '', 't1').map((n) => n.id)).toEqual(['n1'])
    expect(filterNotes(notes, 'app', 't1')).toEqual([])
    expect(filterNotes(notes, 'app', 't2').map((n) => n.id)).toEqual(['n2'])
    expect(filterNotes(notes, '', 't1').some((n) => n.kind === 'password')).toBe(false)
  })
})

describe('uniqueNoteTags', () => {
  it('deduplica y ordena por nombre', () => {
    expect(uniqueNoteTags(notes)).toEqual([casa, laburo])
  })
})

describe('composeKindFromFilter', () => {
  it('el chip reservado crea una contraseña; el resto, una nota', () => {
    expect(composeKindFromFilter(PASSWORDS_FILTER)).toBe('password')
    expect(composeKindFromFilter(null)).toBe('note')
    expect(composeKindFromFilter('t1')).toBe('note')
  })
})
