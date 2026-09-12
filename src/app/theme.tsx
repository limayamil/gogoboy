import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

export type ThemeMode = 'light' | 'dark'

interface ThemeApi {
  mode: ThemeMode
  toggle: () => void
}

const Context = createContext<ThemeApi>({ mode: 'light', toggle: () => {} })

/**
 * El tema vive en contexto y no solo en el atributo del <html> porque los colores de
 * categoria se aplican como estilos inline desde JS: los componentes necesitan saber
 * que variante de la paleta pintar.
 */
export function useThemeMode(): ThemeApi {
  return useContext(Context)
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>(
    () => (localStorage.getItem('gogoboy-theme') as ThemeMode | null) ?? 'light',
  )

  useEffect(() => {
    document.documentElement.dataset.theme = mode
    localStorage.setItem('gogoboy-theme', mode)
    const meta = document.querySelector('meta[name="theme-color"]')
    if (meta) meta.setAttribute('content', mode === 'dark' ? '#17141c' : '#fbf6f3')
  }, [mode])

  const api = useMemo<ThemeApi>(
    () => ({ mode, toggle: () => setMode((m) => (m === 'light' ? 'dark' : 'light')) }),
    [mode],
  )

  return <Context.Provider value={api}>{children}</Context.Provider>
}
