import { useState } from 'react'
import { useColorOf, PALETTE } from '../lib/palette'
import {
  useCreateMeetCalendar,
  useDeleteMeetCalendar,
  useMeetCalendars,
  useUpdateMeetCalendar,
} from '../lib/meet-store'
import { errorMessage } from '../lib/toast'
import { isGoogleIcalUrl } from '../shared/meets'
import type { MeetCalendar } from '../shared/types'
import styles from './MeetCalendarsSettings.module.css'

/**
 * Alta, edición y baja de los calendarios de Google. La dirección secreta se
 * escribe acá y no vuelve nunca: al editar, el campo arranca vacío y vacío
 * significa "dejá la que estaba".
 */
export function MeetCalendarsSettings() {
  const calendars = useMeetCalendars()
  const remove = useDeleteMeetCalendar()
  const [editing, setEditing] = useState<string | 'nuevo' | null>(null)
  const colorOf = useColorOf()

  function confirmRemove(calendar: MeetCalendar) {
    if (!window.confirm(`¿Quitar el calendario “${calendar.name}”? Sus reuniones dejan de aparecer.`)) return
    remove.mutate(calendar.id)
  }

  return (
    <section className={styles.section} aria-label="Calendarios">
      <p className={styles.heading}>Calendarios</p>

      {calendars.isPending ? <p className={styles.hint}>Cargando…</p> : null}
      {calendars.isError ? <p className={styles.error}>{errorMessage(calendars.error)}</p> : null}
      {calendars.data?.length === 0 && editing !== 'nuevo' ? (
        <p className={styles.hint}>Todavía no agregaste ninguno.</p>
      ) : null}

      <ul className={styles.list}>
        {calendars.data?.map((calendar) =>
          editing === calendar.id ? (
            <li key={calendar.id}>
              <CalendarForm calendar={calendar} onDone={() => setEditing(null)} />
            </li>
          ) : (
            <li key={calendar.id} className={styles.row}>
              <span className={styles.dot} style={{ background: colorOf(calendar.colorKey).dot }} />
              <span className={styles.rowText}>
                <span className={styles.name}>{calendar.name}</span>
                <span className={styles.masked} title="La dirección secreta no se vuelve a mostrar">
                  {calendar.maskedUrl}
                </span>
              </span>
              <button type="button" className={styles.link} onClick={() => setEditing(calendar.id)}>
                Editar
              </button>
              <button type="button" className={styles.link} onClick={() => confirmRemove(calendar)}>
                Quitar
              </button>
            </li>
          ),
        )}
      </ul>

      {editing === 'nuevo' ? (
        <CalendarForm onDone={() => setEditing(null)} />
      ) : (
        <button type="button" className={styles.add} onClick={() => setEditing('nuevo')}>
          + Agregar calendario
        </button>
      )}
    </section>
  )
}

function CalendarForm({ calendar, onDone }: { calendar?: MeetCalendar; onDone: () => void }) {
  const create = useCreateMeetCalendar()
  const update = useUpdateMeetCalendar()
  const colorOf = useColorOf()
  const [name, setName] = useState(calendar?.name ?? '')
  const [colorKey, setColorKey] = useState(calendar?.colorKey ?? PALETTE[3].key)
  const [icalUrl, setIcalUrl] = useState('')
  const [error, setError] = useState<string | null>(null)
  const busy = create.isPending || update.isPending

  async function save() {
    const trimmedName = name.trim()
    const trimmedUrl = icalUrl.trim()
    if (!trimmedName) return setError('Ponele un nombre.')
    if (!calendar && !trimmedUrl) return setError('Pegá la dirección secreta en formato iCal.')
    if (trimmedUrl && !isGoogleIcalUrl(trimmedUrl)) {
      return setError('Tiene que ser una dirección https://calendar.google.com/calendar/ical/…')
    }
    setError(null)
    try {
      if (calendar) {
        await update.mutateAsync({
          id: calendar.id,
          patch: { name: trimmedName, colorKey, ...(trimmedUrl ? { icalUrl: trimmedUrl } : {}) },
        })
      } else {
        await create.mutateAsync({ name: trimmedName, colorKey, icalUrl: trimmedUrl })
      }
      onDone()
    } catch (cause) {
      setError(errorMessage(cause))
    }
  }

  return (
    <form
      className={styles.form}
      onSubmit={(event) => {
        event.preventDefault()
        void save()
      }}
    >
      <label className={styles.field}>
        <span className={styles.label}>Nombre</span>
        <input
          className={styles.input}
          value={name}
          maxLength={60}
          placeholder="Trabajo"
          onChange={(event) => setName(event.target.value)}
          autoFocus
        />
      </label>

      <div className={styles.field}>
        <span className={styles.label}>Color</span>
        <div className={styles.swatches}>
          {PALETTE.map((swatch) => (
            <button
              key={swatch.key}
              type="button"
              className={`${styles.swatch} ${colorKey === swatch.key ? styles.swatchOn : ''}`}
              style={{ background: colorOf(swatch.key).dot }}
              onClick={() => setColorKey(swatch.key)}
              aria-label={swatch.label}
              aria-pressed={colorKey === swatch.key}
              title={swatch.label}
            />
          ))}
        </div>
      </div>

      <label className={styles.field}>
        <span className={styles.label}>Dirección secreta en formato iCal</span>
        <input
          className={styles.input}
          type="url"
          value={icalUrl}
          autoComplete="off"
          spellCheck={false}
          placeholder={calendar ? 'Dejala vacía para no cambiarla' : 'https://calendar.google.com/calendar/ical/…'}
          onChange={(event) => setIcalUrl(event.target.value)}
        />
        {calendar ? <span className={styles.hint}>Guardada: {calendar.maskedUrl}</span> : null}
      </label>

      {error ? <p className={styles.error}>{error}</p> : null}

      <div className={styles.actions}>
        <button type="button" className={styles.ghost} onClick={onDone} disabled={busy}>
          Cancelar
        </button>
        <button type="submit" className={styles.primary} disabled={busy}>
          {busy ? 'Guardando…' : 'Guardar'}
        </button>
      </div>
    </form>
  )
}
