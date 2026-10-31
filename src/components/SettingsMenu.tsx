import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTaskSettings } from '../app/task-settings'
import { IconSettings } from './Icons'
import { MeetCalendarsSettings } from './MeetCalendarsSettings'
import styles from './SettingsMenu.module.css'

/**
 * Única entrada a los ajustes: un engranaje del header abre este panel.
 * Va en un portal porque el header recorta el desborde (el cielo y la lluvia).
 */
export function SettingsMenu({ buttonClassName }: { buttonClassName: string }) {
  const panelId = useId()
  const buttonRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [box, setBox] = useState<{ top: number; right: number } | null>(null)
  const {
    showListOnTask,
    suggestDueToday,
    showMeets,
    completedLastOnHome,
    setShowListOnTask,
    setSuggestDueToday,
    setShowMeets,
    setCompletedLastOnHome,
  } = useTaskSettings()

  function place() {
    const rect = buttonRef.current?.getBoundingClientRect()
    if (!rect) return
    setBox({ top: rect.bottom + 8, right: window.innerWidth - rect.right })
  }

  function toggle() {
    if (open) {
      setOpen(false)
      return
    }
    place()
    setOpen(true)
  }

  useLayoutEffect(() => {
    if (!open) return
    place()
  }, [open])

  useEffect(() => {
    if (!open) return

    function onPointer(event: PointerEvent) {
      const target = event.target
      if (!(target instanceof Node)) return
      if (buttonRef.current?.contains(target) || panelRef.current?.contains(target)) return
      setOpen(false)
    }

    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }

    function onResize() {
      place()
    }

    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    window.addEventListener('resize', onResize)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', onResize)
    }
  }, [open])

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className={buttonClassName}
        aria-label="Ajustes"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={toggle}
      >
        <IconSettings size={20} />
      </button>

      {open && box
        ? createPortal(
            <div
              ref={panelRef}
              id={panelId}
              className={styles.panel}
              role="dialog"
              aria-label="Ajustes"
              style={{ top: box.top, right: box.right }}
            >
              <p className={styles.heading}>Ajustes</p>
              <Switch
                checked={showListOnTask}
                label="Mostrar la lista en cada tarea"
                onChange={setShowListOnTask}
              />
              <Switch
                checked={suggestDueToday}
                label="Sugerir las que vencen hoy"
                onChange={setSuggestDueToday}
              />
              <Switch
                checked={completedLastOnHome}
                label="Completadas al final"
                onChange={setCompletedLastOnHome}
              />
              <Switch checked={showMeets} label="Mostrar Meets del día" onChange={setShowMeets} />
              <MeetCalendarsSettings />
            </div>,
            document.body,
          )
        : null}
    </>
  )
}

function Switch({
  checked,
  label,
  onChange,
}: {
  checked: boolean
  label: string
  onChange: (value: boolean) => void
}) {
  return (
    <button
      type="button"
      role="switch"
      className={styles.option}
      aria-checked={checked}
      onClick={() => onChange(!checked)}
    >
      <span>{label}</span>
      <span className={`${styles.switch} ${checked ? styles.switchOn : ''}`}>
        <span className={styles.knob} />
      </span>
    </button>
  )
}
