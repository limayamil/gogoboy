import { IconAlert, IconSpinner } from './Icons'
import styles from './Feedback.module.css'

export function LoadingState() {
  return (
    <div className={styles.loading} role="status" aria-live="polite">
      <IconSpinner size={32} className={styles.spinner} />
      <p>Cargando</p>
    </div>
  )
}

export function ErrorState({ error }: { error: unknown }) {
  const message = error instanceof Error ? error.message : 'error desconocido'
  return (
    <div className={styles.error} role="alert">
      <IconAlert size={22} />
      <p>No se pudo cargar: {message}</p>
    </div>
  )
}
