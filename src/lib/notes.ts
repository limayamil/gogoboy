import type { Note, NoteKind, NoteTag } from '../shared/types'
import { richTextPlain } from './rich-text'

/** Filtro reservado: no es una etiqueta, vive al lado de "Todas". */
export const PASSWORDS_FILTER = 'passwords'

export type NotesFilter = string | null

function haystack(note: Note): string {
  if (note.kind === 'password') return `${note.title} ${note.username ?? ''}`
  return `${note.title} ${richTextPlain(note.description)}`
}

/** Filtro de la vista Notas: query, etiqueta o el chip reservado de contraseñas. */
export function filterNotes(notes: Note[], query: string, filter: NotesFilter): Note[] {
  const needle = query.trim().toLowerCase()
  return notes.filter((note) => {
    if (filter === PASSWORDS_FILTER) {
      if (note.kind !== 'password') return false
    } else if (filter && !note.tags.some((tag) => tag.id === filter)) {
      return false
    }
    if (!needle) return true
    return haystack(note).toLowerCase().includes(needle)
  })
}

/** Etiquetas unicas para el control de filtro, ordenadas por nombre. */
export function uniqueNoteTags(notes: Note[]): NoteTag[] {
  const seen = new Map<string, NoteTag>()
  for (const note of notes) {
    for (const tag of note.tags) {
      if (!seen.has(tag.id)) seen.set(tag.id, tag)
    }
  }
  return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name, 'es'))
}

export function isPasswordNote(note: Pick<Note, 'kind'>): boolean {
  return note.kind === 'password'
}

export function composeKindFromFilter(filter: NotesFilter): NoteKind {
  return filter === PASSWORDS_FILTER ? 'password' : 'note'
}
