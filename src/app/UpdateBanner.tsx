import { IconClose, IconRefresh } from '../components/Icons'
import { useNewsAvailable } from '../lib/useNewsAvailable'
import styles from './UpdateBanner.module.css'

/**
 * Aviso de novedades. No se autocierra como el toast: es informacion que sigue siendo
 * cierta hasta que el usuario decide traerla. Tampoco refresca solo — recargar podria
 * pisar algo a medio escribir en un modal abierto.
 */
export function UpdateBanner() {
  const { available, refresh, dismiss } = useNewsAvailable()

  if (!available) return null

  return (
    <div className={styles.banner} role="status" aria-live="polite">
      <span className={styles.text}>Hay novedades</span>
      <button type="button" className={styles.action} onClick={refresh}>
        <IconRefresh size={14} />
        Actualizar
      </button>
      <button
        type="button"
        className={styles.dismiss}
        onClick={dismiss}
        aria-label="Descartar el aviso"
      >
        <IconClose size={14} />
      </button>
    </div>
  )
}
