import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import { Fabs } from '../components/Fabs'
import { IconCalendar, IconGrid, IconMoon, IconSun } from '../components/Icons'
import { ModalProvider } from './modals'
import { ToastHost } from './ToastHost'
import { useThemeMode } from './theme'
import styles from './AppShell.module.css'

const TABS = [
  { to: '/', label: 'Hoy', Icon: IconSun },
  { to: '/categorias', label: 'Categorías', Icon: IconGrid },
  { to: '/semana', label: 'Semana', Icon: IconCalendar },
]

const TITLES: Record<string, string> = {
  '/': 'Hoy · GoGoBoy',
  '/categorias': 'Categorías · GoGoBoy',
  '/semana': 'Semana · GoGoBoy',
}

function DocumentTitle() {
  const { pathname } = useLocation()
  useEffect(() => {
    document.title = TITLES[pathname] ?? 'GoGoBoy'
  }, [pathname])
  return null
}

export function AppShell() {
  const { mode, toggle } = useThemeMode()

  return (
    <div className={styles.shell}>
      <DocumentTitle />
      <header className={styles.header}>
        <div className={styles.brand}>
          <span className={styles.logo} aria-hidden="true">
            <img src="/brand/logo-mark.webp" alt="" width="34" height="34" />
          </span>
          <span className={styles.brandName}>GoGoBoy</span>
        </div>

        <nav className={styles.tabs} aria-label="Vistas">
          {TABS.map(({ to, label, Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) => `${styles.tab} ${isActive ? styles.tabActive : ''}`}
            >
              <Icon size={18} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <button
          type="button"
          className={styles.themeButton}
          onClick={toggle}
          aria-label={mode === 'light' ? 'Activar modo oscuro' : 'Activar modo claro'}
        >
          {mode === 'light' ? <IconMoon size={18} /> : <IconSun size={18} />}
        </button>
      </header>

      <ModalProvider>
        <main className={styles.main} id="main">
          <Outlet />
        </main>

        <Fabs />
        <ToastHost />
      </ModalProvider>
    </div>
  )
}
