import { celebrateFromPointer, shouldCelebrateStatus } from '../lib/confetti'
import type { Status } from '../shared/types'
import styles from './StatusToggle.module.css'

const NEXT: Record<Status, Status> = {
  pendiente: 'en_progreso',
  en_progreso: 'hecha',
  hecha: 'pendiente',
}

const LABEL: Record<Status, string> = {
  pendiente: 'Pendiente',
  en_progreso: 'En progreso',
  hecha: 'Hecha',
}

interface Props {
  status: Status
  onChange: (status: Status) => void
  size?: 'sm' | 'md'
}

/** Circulo de 3 estados: vacio -> medio -> tildado. Un click avanza al siguiente. */
export function StatusToggle({ status, onChange, size = 'md' }: Props) {
  return (
    <button
      type="button"
      className={`${styles.toggle} ${styles[size]} ${styles[status]}`}
      onClick={(event) => {
        event.stopPropagation()
        const next = NEXT[status]
        if (shouldCelebrateStatus(status, next)) celebrateFromPointer(event)
        onChange(next)
      }}
      aria-label={`Estado: ${LABEL[status]}. Tocá para cambiar.`}
      title={LABEL[status]}
    >
      {status === 'hecha' ? (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" aria-hidden="true">
          <path d="m5 13 4.5 4.5L19 7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : null}
      {status === 'en_progreso' ? <span className={styles.half} /> : null}
    </button>
  )
}

export { LABEL as STATUS_LABEL }
