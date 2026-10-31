import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import {
  COMPLETED_LAST_ON_HOME_KEY,
  SHOW_LIST_ON_TASK_KEY,
  SHOW_MEETS_KEY,
  SUGGEST_DUE_TODAY_KEY,
  readCompletedLastOnHome,
  readShowListOnTask,
  readShowMeets,
  readSuggestDueToday,
} from '../lib/settings'

interface TaskSettings {
  showListOnTask: boolean
  suggestDueToday: boolean
  showMeets: boolean
  completedLastOnHome: boolean
  setShowListOnTask: (value: boolean) => void
  setSuggestDueToday: (value: boolean) => void
  setShowMeets: (value: boolean) => void
  setCompletedLastOnHome: (value: boolean) => void
}

const Context = createContext<TaskSettings>({
  showListOnTask: false,
  suggestDueToday: true,
  showMeets: false,
  completedLastOnHome: false,
  setShowListOnTask: () => {},
  setSuggestDueToday: () => {},
  setShowMeets: () => {},
  setCompletedLastOnHome: () => {},
})

function readKey(key: string): string | null {
  return localStorage.getItem(key)
}

export function useTaskSettings(): TaskSettings {
  return useContext(Context)
}

/**
 * Preferencias de esta pantalla. No viajan al servidor ni tocan las tareas.
 * `showMeets` es solo el interruptor: los calendarios viven en la base.
 */
export function TaskSettingsProvider({ children }: { children: ReactNode }) {
  const [showListOnTask, setShowList] = useState(() => readShowListOnTask(readKey))
  const [suggestDueToday, setSuggest] = useState(() => readSuggestDueToday(readKey))
  const [showMeets, setMeets] = useState(() => readShowMeets(readKey))
  const [completedLastOnHome, setCompletedLast] = useState(() => readCompletedLastOnHome(readKey))

  const api = useMemo<TaskSettings>(
    () => ({
      showListOnTask,
      suggestDueToday,
      showMeets,
      completedLastOnHome,
      setShowListOnTask(value) {
        localStorage.setItem(SHOW_LIST_ON_TASK_KEY, String(value))
        setShowList(value)
      },
      setSuggestDueToday(value) {
        localStorage.setItem(SUGGEST_DUE_TODAY_KEY, String(value))
        setSuggest(value)
      },
      setShowMeets(value) {
        localStorage.setItem(SHOW_MEETS_KEY, String(value))
        setMeets(value)
      },
      setCompletedLastOnHome(value) {
        localStorage.setItem(COMPLETED_LAST_ON_HOME_KEY, String(value))
        setCompletedLast(value)
      },
    }),
    [showListOnTask, suggestDueToday, showMeets, completedLastOnHome],
  )

  return <Context.Provider value={api}>{children}</Context.Provider>
}
