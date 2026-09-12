import { useEffect, useState } from 'react'
import { subscribeToasts } from '../lib/toast'
import styles from './ToastHost.module.css'

const HIDE_AFTER_MS = 4500

export function ToastHost() {
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => subscribeToasts(setMessage), [])

  useEffect(() => {
    if (!message) return
    const id = window.setTimeout(() => setMessage(null), HIDE_AFTER_MS)
    return () => window.clearTimeout(id)
  }, [message])

  if (!message) return <div className={styles.live} role="status" aria-live="polite" />

  return (
    <div className={styles.toast} role="status" aria-live="polite">
      {message}
    </div>
  )
}
