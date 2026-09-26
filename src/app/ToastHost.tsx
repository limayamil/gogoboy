import { useEffect, useState } from 'react'
import { subscribeToasts, type Toast } from '../lib/toast'
import styles from './ToastHost.module.css'

const HIDE_AFTER_MS = 4500

export function ToastHost() {
  const [toast, setToast] = useState<Toast | null>(null)

  useEffect(() => subscribeToasts(setToast), [])

  useEffect(() => {
    if (!toast) return
    const id = window.setTimeout(() => setToast(null), HIDE_AFTER_MS)
    return () => window.clearTimeout(id)
  }, [toast])

  if (!toast) return <div className={styles.live} role="status" aria-live="polite" />

  return (
    <div
      className={`${styles.toast} ${toast.tone === 'error' ? styles.error : ''}`}
      role="status"
      aria-live="polite"
    >
      <span>{toast.message}</span>
      {toast.action ? (
        <button
          type="button"
          className={styles.action}
          onClick={() => {
            // Primero cerramos: si la accion falla, su propio toast de error no queda
            // tapado por este.
            setToast(null)
            toast.action?.onClick()
          }}
        >
          {toast.action.label}
        </button>
      ) : null}
    </div>
  )
}
