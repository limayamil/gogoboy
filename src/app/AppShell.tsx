import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { Fabs } from '../components/Fabs'
import { IconCalendar, IconGrid, IconInbox, IconLogout, IconMoon, IconNote, IconSun } from '../components/Icons'
import { authClient } from '../lib/auth'
import { useAppState } from '../lib/store'
import { ModalProvider } from './modals'
import { ToastHost } from './ToastHost'
import { UpdateBanner } from './UpdateBanner'
import { useThemeMode } from './theme'
import { useSky } from './useSky'
import styles from './AppShell.module.css'

const TABS = [
  { to: '/', label: 'Hoy', Icon: IconSun, badge: false },
  { to: '/categorias', label: 'Categorías', Icon: IconGrid, badge: false },
  { to: '/semana', label: 'Semana', Icon: IconCalendar, badge: false },
  { to: '/notas', label: 'Notas', Icon: IconNote, badge: false },
  { to: '/bandeja', label: 'Bandeja', Icon: IconInbox, badge: true },
]

const TITLES: Record<string, string> = {
  '/': 'Hoy · GoGoBoy',
  '/categorias': 'Categorías · GoGoBoy',
  '/semana': 'Semana · GoGoBoy',
  '/notas': 'Notas · GoGoBoy',
  '/bandeja': 'Bandeja · GoGoBoy',
}

function DocumentTitle() {
  const { pathname } = useLocation()
  useEffect(() => {
    document.title = TITLES[pathname] ?? 'GoGoBoy'
  }, [pathname])
  return null
}

const RAIN_DROPS = Array.from({ length: 42 }, (_, index) => ({
  left: `${(index * 23 + 7) % 100}%`,
  delay: `${((index * 17) % 160) / 100}s`,
  duration: `${0.7 + (index % 6) * 0.12}s`,
  height: 12 + (index % 5) * 5,
  opacity: 0.4 + (index % 4) * 0.15,
}))

export function AppShell() {
  const { mode, toggle } = useThemeMode()
  const { period, raining, palette } = useSky()
  const pending = useAppState().data?.proposals.length ?? 0
  const [skyReady, setSkyReady] = useState(false)

  useEffect(() => {
    // El primer frame pinta la franja actual; recien despues animamos
    // para no arrancar siempre desde el amanecer del @property inicial.
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => setSkyReady(true))
    })
    return () => cancelAnimationFrame(id)
  }, [])

  const skyStyle = useMemo(
    () =>
      ({
        '--sky-a': palette.a,
        '--sky-b': palette.b,
        '--sky-c': palette.c,
        '--sky-glow': palette.glow,
        '--sky-glow-x': palette.glowX,
        '--sky-glow-y': palette.glowY,
      }) as CSSProperties,
    [palette],
  )

  return (
    <div className={styles.shell}>
      <DocumentTitle />
      <header
        className={`${styles.header} ${skyReady ? styles.skyReady : ''}`}
        data-period={period}
        data-raining={raining ? 'true' : 'false'}
        style={skyStyle}
      >
        <div className={styles.sky} aria-hidden="true">
          <span className={styles.skyGlow} />
          <span className={styles.skyPattern} />
          {raining ? (
            <span className={styles.skyRain}>
              {RAIN_DROPS.map((drop, index) => (
                <span
                  key={index}
                  className={styles.drop}
                  style={{
                    left: drop.left,
                    height: drop.height,
                    opacity: drop.opacity,
                    animationDelay: drop.delay,
                    animationDuration: drop.duration,
                  }}
                />
              ))}
            </span>
          ) : null}
        </div>

        <NavLink to="/" end className={styles.brand} aria-label="Ir a Hoy">
          <span className={styles.logo} aria-hidden="true">
            <img src="/brand/logo-mark.webp" alt="" width="34" height="34" />
          </span>
          <span className={styles.brandName}>GoGoBoy</span>
        </NavLink>

        <nav className={styles.tabs} aria-label="Vistas">
          {TABS.map(({ to, label, Icon, badge }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) => `${styles.tab} ${isActive ? styles.tabActive : ''}`}
              aria-label={badge && pending > 0 ? `${label}, ${pending} pendientes` : undefined}
            >
              <Icon size={20} />
              <span className={styles.tabLabel}>{label}</span>
              {badge && pending > 0 ? <span className={styles.badge}>{pending}</span> : null}
            </NavLink>
          ))}
        </nav>

        <div className={styles.headerActions}>
          <button
            type="button"
            className={styles.themeButton}
            onClick={() => authClient.signOut()}
            aria-label="Cerrar sesión"
          >
            <IconLogout size={20} />
          </button>
          <button
            type="button"
            className={styles.themeButton}
            onClick={toggle}
            aria-label={mode === 'light' ? 'Activar modo oscuro' : 'Activar modo claro'}
          >
            {mode === 'light' ? <IconMoon size={20} /> : <IconSun size={20} />}
          </button>
        </div>
      </header>

      <ModalProvider>
        <main className={styles.main} id="main">
          <Outlet />
        </main>

        <Fabs />
        <ToastHost />
        <UpdateBanner />
      </ModalProvider>
    </div>
  )
}
