import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useModals } from '../app/modals'
import { ErrorState, LoadingState } from '../components/Feedback'
import { IconLock, IconNote, IconPaperclip, IconSearch } from '../components/Icons'
import { filterNotes, isPasswordNote, PASSWORDS_FILTER, uniqueNoteTags } from '../lib/notes'
import { richTextExcerpt } from '../lib/rich-text'
import { useAppState } from '../lib/store'
import type { Note } from '../shared/types'
import styles from './NotesView.module.css'

export function NotesView() {
  const { data, isPending, error } = useAppState()
  const { openNote } = useModals()
  const [params, setParams] = useSearchParams()
  const [query, setQuery] = useState('')
  const [tagId, setTagId] = useState<string | null>(null)

  const passwordsOn = params.get('vista') === 'contrasenas'
  const filter = passwordsOn ? PASSWORDS_FILTER : tagId

  const notes = data?.notes ?? []
  const tags = useMemo(() => uniqueNoteTags(notes), [notes])
  const visible = useMemo(() => filterNotes(notes, query, filter), [notes, query, filter])
  const hasPasswords = notes.some(isPasswordNote)

  if (isPending) return <LoadingState />
  if (error) return <ErrorState error={error} />

  const emptyPasswords = passwordsOn && !hasPasswords
  const emptyNotes = !passwordsOn && !tagId && notes.length === 0
  const emptyFilter = !emptyPasswords && !emptyNotes && visible.length === 0

  function showAll() {
    setTagId(null)
    setParams({})
  }

  function showPasswords() {
    setTagId(null)
    setParams({ vista: 'contrasenas' })
  }

  function showTag(id: string) {
    setParams({})
    setTagId((current) => (current === id ? null : id))
  }

  return (
    <div className={`${styles.page} pageEnter`}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>
            <IconNote size={22} />
            Notas
          </h1>
          <p className={styles.subtitle}>Apuntes sueltos y contraseñas, con etiquetas propias.</p>
        </div>
      </header>

      <div className={styles.toolbar}>
        <label className={styles.search}>
          <IconSearch size={16} />
          <input
            className={styles.searchInput}
            value={query}
            placeholder={
              passwordsOn ? 'Buscar sitio o usuario' : 'Buscar en títulos y contenido'
            }
            aria-label={passwordsOn ? 'Buscar contraseñas' : 'Buscar notas'}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <div className={styles.filters} role="tablist" aria-label="Filtrar notas">
          <button
            type="button"
            role="tab"
            aria-selected={!passwordsOn && tagId === null}
            className={`${styles.filter} ${!passwordsOn && tagId === null ? styles.filterOn : ''}`}
            onClick={showAll}
          >
            Todas
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={passwordsOn}
            className={`${styles.filter} ${passwordsOn ? styles.filterOn : ''}`}
            onClick={showPasswords}
          >
            <IconLock size={13} />
            Contraseñas
          </button>
          {tags.map((tag) => (
            <button
              key={tag.id}
              type="button"
              role="tab"
              aria-selected={!passwordsOn && tagId === tag.id}
              className={`${styles.filter} ${!passwordsOn && tagId === tag.id ? styles.filterOn : ''}`}
              onClick={() => showTag(tag.id)}
            >
              {tag.name}
            </button>
          ))}
        </div>
      </div>

      {emptyNotes ? (
        <div className={styles.empty}>
          <img
            className={styles.emptyIllustration}
            src="/images/empty-today.webp"
            alt=""
            width="480"
            height="480"
          />
          <p className={styles.emptyTitle}>Todavía no hay notas</p>
          <p className={styles.emptyText}>
            Tocá el + de abajo para anotar algo. Las etiquetas se crean al escribirlas.
          </p>
        </div>
      ) : emptyPasswords ? (
        <div className={styles.empty}>
          <p className={styles.emptyTitle}>Todavía no hay contraseñas</p>
          <p className={styles.emptyText}>
            Tocá el + de abajo para guardar un usuario y una clave. El ojito las muestra, el
            copiar las manda al portapapeles.
          </p>
        </div>
      ) : emptyFilter ? (
        <p className={styles.noResults}>Nada coincide con esa búsqueda.</p>
      ) : (
        <ul className={`${styles.list} staggerFade`} aria-label={passwordsOn ? 'Contraseñas' : 'Notas'}>
          {visible.map((note) => (
            <NoteRow key={note.id} note={note} onOpen={() => openNote(note.id, note.kind)} />
          ))}
        </ul>
      )}
    </div>
  )
}

function NoteRow({ note, onOpen }: { note: Note; onOpen: () => void }) {
  const password = isPasswordNote(note)
  const preview = password ? note.username : richTextExcerpt(note.description)
  return (
    <li>
      <button type="button" className={styles.row} onClick={onOpen}>
        <span className={styles.rowMain}>
          <span className={styles.rowTitle}>{note.title}</span>
          {preview ? <span className={styles.rowPreview}>{preview}</span> : null}
        </span>
        <span className={styles.rowMeta}>
          {password ? (
            <span className={styles.chips}>
              <span className={`${styles.chip} ${styles.chipLock}`}>
                <IconLock size={11} />
                Contraseñas
              </span>
            </span>
          ) : note.tags.length > 0 ? (
            <span className={styles.chips}>
              {note.tags.map((tag) => (
                <span key={tag.id} className={styles.chip}>
                  {tag.name}
                </span>
              ))}
            </span>
          ) : (
            <span className={styles.noTags}>Sin etiqueta</span>
          )}
          {!password && note.attachments.length > 0 ? (
            <span className={styles.attach}>
              <IconPaperclip size={13} />
              {note.attachments.length}
            </span>
          ) : null}
        </span>
      </button>
    </li>
  )
}
