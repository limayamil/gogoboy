import { useEffect, useSyncExternalStore } from 'react'
import { createInternalNeonAuth } from '@neondatabase/neon-js/auth'
import { BetterAuthVanillaAdapter } from '@neondatabase/neon-js/auth/vanilla/adapters'

const authUrl = import.meta.env.VITE_NEON_AUTH_URL ?? ''

// credentials: include para mandar la cookie de sesion a Neon Auth, que vive
// en otro origen (*.neon.tech) que el de Vite/Vercel.
const neonAuth = createInternalNeonAuth(authUrl, {
  adapter: BetterAuthVanillaAdapter({
    fetchOptions: { credentials: 'include' },
  }),
})

export const authClient = neonAuth.adapter

export function getAccessToken(): Promise<string | null> {
  return neonAuth.getJWTToken()
}

export function useAuthSession() {
  useEffect(() => {
    void authClient.getSession()
  }, [])

  return useSyncExternalStore(
    (notify) => authClient.useSession.subscribe(notify),
    () => authClient.useSession.get(),
    () => authClient.useSession.get(),
  )
}
