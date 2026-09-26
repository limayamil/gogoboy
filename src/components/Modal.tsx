import { useCallback, useEffect, useId, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { IconClose } from './Icons'
import styles from './Modal.module.css'

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

interface Props {
  title: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  /**
   * Se consulta antes de cada cierre (Escape, click en el velo, la X). Si devuelve
   * false el modal se queda abierto: es como TaskModal pregunta por los cambios sin
   * guardar sin tener que interceptar las tres salidas por separado.
   */
  canClose?: () => boolean
  /** false cuando el contenido ya enfoca algo propio y no queremos pisarselo. */
  autoFocus?: boolean
}

export function Modal({ title, onClose, children, footer, canClose, autoFocus = true }: Props) {
  const overlayRef = useRef<HTMLDivElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const titleId = useId()

  // Por ref para que el efecto del focus trap no se reenganche en cada render.
  const guard = useRef(canClose)
  guard.current = canClose
  const requestClose = useCallback(() => {
    if (guard.current && !guard.current()) return
    onClose()
  }, [onClose])

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null

    if (autoFocus) {
      const titleEl = dialog.querySelector<HTMLElement>('h2')
      titleEl?.setAttribute('tabindex', '-1')
      titleEl?.focus()
    }

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        requestClose()
        return
      }
      if (event.key !== 'Tab') return

      const items = [...dialog.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
        (el) => !el.hasAttribute('disabled') && el.tabIndex !== -1 && el.offsetParent !== null,
      )
      if (items.length === 0) {
        event.preventDefault()
        return
      }
      const first = items[0]
      const last = items[items.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previousOverflow
      previouslyFocused?.focus()
    }
  }, [autoFocus, requestClose])

  return createPortal(
    <div
      ref={overlayRef}
      className={styles.overlay}
      onMouseDown={(event) => {
        if (event.target === overlayRef.current) requestClose()
      }}
    >
      <div
        ref={dialogRef}
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className={styles.header}>
          <h2 id={titleId} className={styles.title}>
            {title}
          </h2>
          <button type="button" className={styles.close} onClick={requestClose} aria-label="Cerrar">
            <IconClose size={18} />
          </button>
        </header>

        <div className={styles.body}>{children}</div>

        {footer ? <footer className={styles.footer}>{footer}</footer> : null}
      </div>
    </div>,
    document.body,
  )
}
