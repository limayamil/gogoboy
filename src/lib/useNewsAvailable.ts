import { useCallback, useEffect, useRef, useState } from 'react'
import { useIsMutating, useQueryClient } from '@tanstack/react-query'
import { api } from './api'
import { useAppState } from './store'

/** Con la pestaña al frente, cada minuto y medio. Oculta, nunca. */
const POLL_MS = 90_000

export interface NewsState {
  available: boolean
  /** Trae los cambios y esconde el aviso. */
  refresh: () => void
  /** Esconde el aviso hasta que haya un cambio distinto. */
  dismiss: () => void
}

/**
 * Avisa cuando el servidor tiene algo que este cache no.
 *
 * La app no re-descarga el estado en cada mutacion (ver store.ts), asi que una pestaña
 * abierta no se entera sola de lo que se cargo desde otro dispositivo o desde el MCP.
 * Esto lo resuelve comparando la firma de GET /api/version contra la de los datos que
 * tenemos.
 *
 * La sutileza esta en no avisar por los cambios de uno mismo: despues de cada mutacion
 * propia la firma del servidor cambia de forma legitima, asi que se la adopta en
 * silencio como nueva linea de base en vez de mostrar el aviso.
 */
export function useNewsAvailable(): NewsState {
  const client = useQueryClient()
  const { data } = useAppState()
  const stateVersion = data?.version
  const mutating = useIsMutating()

  const baseline = useRef<string | null>(null)
  const [available, setAvailable] = useState(false)

  if (stateVersion && baseline.current === null) baseline.current = stateVersion

  useEffect(() => {
    if (!stateVersion) return
    baseline.current = stateVersion
    setAvailable(false)
  }, [stateVersion])

  const check = useCallback(async (adoptSilently: boolean) => {
    try {
      const { version } = await api.getVersion()
      if (adoptSilently || baseline.current === null) {
        baseline.current = version
        setAvailable(false)
        return
      }
      if (version !== baseline.current) setAvailable(true)
    } catch {
      // Sin red no hay novedades que mostrar; el proximo intento reintenta solo.
    }
  }, [])

  const wasMutating = useRef(0)
  useEffect(() => {
    const settled = wasMutating.current > 0 && mutating === 0
    wasMutating.current = mutating
    if (settled) void check(true)
  }, [mutating, check])

  useEffect(() => {
    const poll = () => {
      if (document.visibilityState !== 'visible' || wasMutating.current > 0) return
      void check(false)
    }
    const id = window.setInterval(poll, POLL_MS)
    const onVisible = () => {
      if (document.visibilityState === 'visible') poll()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [check])

  const refresh = useCallback(() => {
    setAvailable(false)
    void client.invalidateQueries({ queryKey: ['state'] })
  }, [client])

  const dismiss = useCallback(() => {
    setAvailable(false)
    void check(true)
  }, [check])

  return { available, refresh, dismiss }
}
