/**
 * Puente entre las cuentas de Google guardadas y las fuentes de la barra. Si Google
 * rechaza el token, la cuenta queda en 'reconectar' y las próximas vueltas ni lo
 * intentan, hasta que Yamil reconecte.
 */
import type { MeetEvent } from '../../src/shared/types.ts'
import { decryptToken } from './google-crypto.ts'
import { mapGoogleEvent } from './google-events.ts'
import { GoogleReconnectError, type GoogleApiEvent, type GoogleClient, type GoogleConfig } from './google.ts'
import type { GoogleStore, StoredGoogleAccount } from './google-store.ts'
import { createCache, type MeetSource } from './meets.ts'

export interface GoogleDeps {
  config: GoogleConfig
  client: GoogleClient
  store: GoogleStore
}

/** Un token que no se puede descifrar (clave cambiada) es, en la práctica, una cuenta a reconectar. */
export function refreshTokenOf(account: StoredGoogleAccount, deps: GoogleDeps): string {
  try {
    return decryptToken(account.refreshTokenEnc, deps.config.tokenKey)
  } catch {
    throw new GoogleReconnectError('No se pudo leer el token guardado')
  }
}

/** Corre `run` y, si Google pide reconectar, lo anota en la cuenta antes de propagar. */
export async function withReconnect<T>(account: StoredGoogleAccount, deps: GoogleDeps, run: () => Promise<T>): Promise<T> {
  try {
    return await run()
  } catch (error) {
    if (error instanceof GoogleReconnectError && account.status !== 'reconectar') {
      account.status = 'reconectar'
      await deps.store.setAccountStatus(account.id, 'reconectar')
    }
    throw error
  }
}

const eventsCache = createCache<GoogleApiEvent[]>()

export async function googleSources(deps: GoogleDeps, cache = eventsCache): Promise<MeetSource[]> {
  const [accounts, calendars] = await Promise.all([deps.store.listAccounts(), deps.store.listCalendars()])
  const byId = new Map(accounts.map((account) => [account.id, account]))

  return calendars.flatMap((calendar) => {
    const account = byId.get(calendar.accountId)
    if (!account) return []
    return [
      {
        calendar: { id: calendar.id, name: calendar.name, colorKey: calendar.colorKey },
        async load(day): Promise<MeetEvent[]> {
          if (account.status === 'reconectar') throw new GoogleReconnectError('Cuenta a reconectar')
          const timeMin = new Date(day.start).toISOString()
          const timeMax = new Date(day.end).toISOString()
          const items = await withReconnect(account, deps, () =>
            cache(`${account.id}|${calendar.calendarId}|${day.date}`, () =>
              deps.client.listEvents(refreshTokenOf(account, deps), calendar.calendarId, timeMin, timeMax),
            ),
          )
          return items.flatMap((item) => mapGoogleEvent(item, calendar.id, day) ?? [])
        },
      } satisfies MeetSource,
    ]
  })
}
