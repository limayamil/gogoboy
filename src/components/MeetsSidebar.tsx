import { useEffect, useState } from 'react'
import { formatMeetTime, formatMeetsDate, meetMoment } from '../lib/meets'
import { useMeetsToday } from '../lib/meet-store'
import { useColorOf } from '../lib/palette'
import { errorMessage } from '../lib/toast'
import type { MeetCalendarStatus, MeetEvent } from '../shared/types'
import { IconAlert, IconCalendar, IconChevronRight, IconRefresh, IconVideo } from './Icons'
import { MeetDetailModal } from './MeetDetailModal'
import styles from './MeetsSidebar.module.css'

function useMinuteClock(): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60_000)
    return () => window.clearInterval(id)
  }, [])
  return now
}

/**
 * Barra derecha con las reuniones de hoy. Solo se monta con el ajuste prendido:
 * así, apagado, no hay ni request ni hueco en la pantalla.
 */
export function MeetsSidebar({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const meets = useMeetsToday(true)
  const colorOf = useColorOf()
  const now = useMinuteClock()
  const [selected, setSelected] = useState<MeetEvent | null>(null)
  const { refetch } = meets

  useEffect(() => {
    if (open) void refetch()
  }, [open, refetch])

  const calendars = new Map<string, MeetCalendarStatus>(
    (meets.data?.calendars ?? []).map((calendar) => [calendar.id, calendar]),
  )
  const events = meets.data?.events ?? []
  const upcoming = events.filter((event) => meetMoment(event, now) !== 'pasada').length

  if (!open) {
    return (
      <button
        type="button"
        className={styles.tab}
        onClick={() => onOpenChange(true)}
        aria-label={`Abrir Meets del día${meets.data ? `, ${upcoming} por delante` : ''}`}
      >
        <IconCalendar size={18} />
        <span className={styles.tabLabel}>Meets</span>
        {meets.data && upcoming > 0 ? <span className={styles.count}>{upcoming}</span> : null}
      </button>
    )
  }

  const failed = meets.data?.calendars.filter((calendar) => calendar.error) ?? []

  return (
    <aside className={styles.sidebar} aria-label="Meets del día">
      <header className={styles.header}>
        <div className={styles.titles}>
          <h2 className={styles.title}>Meets del día</h2>
          {meets.data ? <p className={styles.date}>{formatMeetsDate(meets.data.date)}</p> : null}
        </div>
        <button
          type="button"
          className={`${styles.iconButton} ${meets.isFetching ? styles.spinning : ''}`}
          onClick={() => void refetch()}
          aria-label="Actualizar"
          title="Actualizar"
        >
          <IconRefresh size={16} />
        </button>
        <button
          type="button"
          className={styles.iconButton}
          onClick={() => onOpenChange(false)}
          aria-label="Plegar Meets del día"
          title="Plegar"
        >
          <IconChevronRight size={18} />
        </button>
      </header>

      <div className={styles.body}>
        {meets.isPending ? <p className={styles.note}>Cargando reuniones…</p> : null}
        {meets.isError ? (
          <p className={styles.problem}>
            <IconAlert size={16} />
            <span>{errorMessage(meets.error)}</span>
          </p>
        ) : null}

        {failed.map((calendar) => (
          <p key={calendar.id} className={styles.problem}>
            <IconAlert size={16} />
            <span>
              No se pudo cargar <strong>{calendar.name}</strong>: {calendar.error}
            </span>
          </p>
        ))}

        {meets.data && meets.data.calendars.length === 0 ? (
          <p className={styles.note}>Agregá un calendario en Ajustes → Calendarios.</p>
        ) : null}
        {meets.data && meets.data.calendars.length > 0 && events.length === 0 ? (
          <p className={styles.note}>No tenés reuniones hoy.</p>
        ) : null}

        <ol className={styles.list}>
          {events.map((event) => {
            const calendar = calendars.get(event.calendarId)
            const moment = meetMoment(event, now)
            return (
              <li
                key={event.id}
                className={`${styles.item} ${moment === 'pasada' ? styles.past : ''} ${moment === 'ahora' ? styles.now : ''}`}
                style={{ borderLeftColor: colorOf(calendar?.colorKey).dot }}
              >
                <button type="button" className={styles.itemMain} onClick={() => setSelected(event)}>
                  <span className={styles.time}>
                    {formatMeetTime(event)}
                    {moment === 'ahora' ? <span className={styles.nowChip}>Ahora</span> : null}
                  </span>
                  <span className={styles.itemTitle}>{event.title}</span>
                  {calendar ? (
                    <span className={styles.calendar}>
                      <span className={styles.dot} style={{ background: colorOf(calendar.colorKey).dot }} />
                      {calendar.name}
                    </span>
                  ) : null}
                </button>
                {event.meetUrl ? (
                  <a className={styles.join} href={event.meetUrl} target="_blank" rel="noopener noreferrer">
                    <IconVideo size={15} />
                    Unirme
                  </a>
                ) : null}
              </li>
            )
          })}
        </ol>
      </div>

      {selected ? (
        <MeetDetailModal
          event={selected}
          calendar={calendars.get(selected.calendarId) ?? null}
          onClose={() => setSelected(null)}
        />
      ) : null}
    </aside>
  )
}
