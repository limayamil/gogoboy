import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import {
  SHOW_LIST_ON_TASK_KEY,
  SUGGEST_DUE_TODAY_KEY,
  readShowListOnTask,
  readSuggestDueToday,
} from '../lib/settings'

interface TaskSettings {
  showListOnTask: boolean
  suggestDueToday: boolean
  setShowListOnTask: (value: boolean) => void
  setSuggestDueToday: (value: boolean) => void
}

const Context = createContext<TaskSettings>({
  showListOnTask: false,
  suggestDueToday: true,
  setShowListOnTask: () => {},
  setSuggestDueToday: () => {},
})

function readKey(key: string): string | null {
  return localStorage.getItem(key)
}

export function useTaskSettings(): TaskSettings {
  return useContext(Context)
}

/** Preferencias de esta pantalla. No viajan al servidor ni tocan las tareas. */
export function TaskSettingsProvider({ children }: { children: ReactNode }) {
  const [showListOnTask, setShowList] = useState(() => readShowListOnTask(readKey))
  const [suggestDueToday, setSuggest] = useState(() => readSuggestDueToday(readKey))

  const api = useMemo<TaskSettings>(
    () => ({
      showListOnTask,
      suggestDueToday,
      setShowListOnTask(value) {
        localStorage.setItem(SHOW_LIST_ON_TASK_KEY, String(value))
        setShowList(value)
      },
      setSuggestDueToday(value) {
        localStorage.setItem(SUGGEST_DUE_TODAY_KEY, String(value))
        setSuggest(value)
      },
    }),
    [showListOnTask, suggestDueToday],
  )

  return <Context.Provider value={api}>{children}</Context.Provider>
}
