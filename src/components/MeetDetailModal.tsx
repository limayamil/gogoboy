import { formatMeetTime, linkifyText, RESPONSE_LABEL } from '../lib/meets'
import { useColorOf } from '../lib/palette'
import type { MeetCalendarStatus, MeetEvent, MeetPerson } from '../shared/types'
import { IconPaperclip, IconVideo } from './Icons'
import { Modal } from './Modal'
import styles from './MeetDetailModal.module.css'

function personLabel(person: MeetPerson): string {
  return person.name ?? person.email ?? 'Sin nombre'
}

/** Texto con links. Nada de innerHTML: cada link es un <a> armado por React. */
function LinkedText({ text }: { text: string }) {
  return (
    <>
      {linkifyText(text).map((part, index) =>
        part.kind === 'link' ? (
          <a key={index} href={part.value} target="_blank" rel="noopener noreferrer">
            {part.value}
          </a>
        ) : (
          <span key={index}>{part.value}</span>
        ),
      )}
    </>
  )
}

export function MeetDetailModal({
  event,
  calendar,
  onClose,
}: {
  event: MeetEvent
  calendar: MeetCalendarStatus | null
  onClose: () => void
}) {
  const colorOf = useColorOf()
  // Si el lugar es solo el link de la Meet, ya está en el botón.
  const location = event.location && event.location !== event.meetUrl ? event.location : null

  return (
    <Modal title={event.title} onClose={onClose}>
      <div className={styles.content}>
        <p className={styles.when}>
          {calendar ? (
            <span className={styles.calendar}>
              <span className={styles.dot} style={{ background: colorOf(calendar.colorKey).dot }} />
              {calendar.name}
            </span>
          ) : null}
          <span>{formatMeetTime(event)}</span>
        </p>

        {event.meetUrl ? (
          <a className={styles.join} href={event.meetUrl} target="_blank" rel="noopener noreferrer">
            <IconVideo size={17} />
            Unirme a la Meet
          </a>
        ) : null}

        {location ? (
          <section className={styles.block}>
            <h3 className={styles.label}>Lugar</h3>
            <p className={styles.text}>
              <LinkedText text={location} />
            </p>
          </section>
        ) : null}

        {event.organizer ? (
          <section className={styles.block}>
            <h3 className={styles.label}>Organiza</h3>
            <p className={styles.person}>
              <span className={styles.personName}>{personLabel(event.organizer)}</span>
              {event.organizer.name && event.organizer.email ? (
                <span className={styles.email}>{event.organizer.email}</span>
              ) : null}
            </p>
          </section>
        ) : null}

        {event.attendees.length > 0 ? (
          <section className={styles.block}>
            <h3 className={styles.label}>Invitados ({event.attendees.length})</h3>
            <ul className={styles.people}>
              {event.attendees.map((attendee, index) => (
                <li key={`${attendee.email ?? attendee.name}-${index}`} className={styles.person}>
                  <span className={styles.personText}>
                    <span className={styles.personName}>{personLabel(attendee)}</span>
                    {attendee.name && attendee.email ? <span className={styles.email}>{attendee.email}</span> : null}
                  </span>
                  <span className={`${styles.response} ${styles[attendee.response]}`}>
                    {RESPONSE_LABEL[attendee.response]}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {event.description ? (
          <section className={styles.block}>
            <h3 className={styles.label}>Notas</h3>
            <p className={`${styles.text} ${styles.notes}`}>
              <LinkedText text={event.description} />
            </p>
          </section>
        ) : null}

        {event.attachments.length > 0 ? (
          <section className={styles.block}>
            <h3 className={styles.label}>Adjuntos</h3>
            <ul className={styles.files}>
              {event.attachments.map((file) => (
                <li key={file.url}>
                  <a href={file.url} target="_blank" rel="noopener noreferrer" className={styles.file}>
                    <IconPaperclip size={15} />
                    {file.title}
                  </a>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </Modal>
  )
}
