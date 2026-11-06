import type { GoogleAccount, GoogleAccountsResponse, GoogleCalendarOption } from '../../src/shared/types.ts'
import { route } from '../_lib/http.ts'
import { googleDeps } from '../_lib/google-deps.ts'
import { refreshTokenOf, withReconnect, type GoogleDeps } from '../_lib/google-meets.ts'
import type { StoredGoogleAccount, StoredGoogleCalendar } from '../_lib/google-store.ts'
import { GoogleApiError, GoogleReconnectError } from '../_lib/google.ts'

async function describeAccount(
  account: StoredGoogleAccount,
  selected: StoredGoogleCalendar[],
  deps: GoogleDeps,
): Promise<GoogleAccount> {
  const selectionOf = (calendarId: string) => {
    const row = selected.find((calendar) => calendar.calendarId === calendarId)
    return row ? { id: row.id, name: row.name, colorKey: row.colorKey } : null
  }
  const onlySelected = (): GoogleCalendarOption[] =>
    selected.map((row) => ({ calendarId: row.calendarId, summary: row.name, primary: false, selection: selectionOf(row.calendarId) }))

  const base = { id: account.id, email: account.email }
  if (account.status === 'reconectar') {
    return { ...base, status: 'reconectar', error: null, calendars: onlySelected() }
  }

  try {
    const list = await withReconnect(account, deps, () => deps.client.listCalendars(refreshTokenOf(account, deps)))
    const options: GoogleCalendarOption[] = list.map((item) => ({
      calendarId: item.id,
      summary: item.summary,
      primary: item.primary,
      selection: selectionOf(item.id),
    }))
    // Un calendario elegido que ya no está en la lista (lo dejaron de compartir) sigue visible para poder quitarlo.
    for (const row of selected) {
      if (!list.some((item) => item.id === row.calendarId)) {
        options.push({ calendarId: row.calendarId, summary: row.name, primary: false, selection: selectionOf(row.calendarId) })
      }
    }
    return { ...base, status: 'ok', error: null, calendars: options }
  } catch (error) {
    if (error instanceof GoogleReconnectError) return { ...base, status: 'reconectar', error: null, calendars: onlySelected() }
    const message = error instanceof GoogleApiError ? error.message : 'No se pudo leer la lista de calendarios'
    return { ...base, status: 'ok', error: message, calendars: onlySelected() }
  }
}

export function createGoogleAccountsHandler(deps: GoogleDeps | null) {
  return route({
    async GET(_req, res) {
      res.setHeader('Cache-Control', 'no-store')
      if (!deps) {
        res.status(200).json({ configured: false, accounts: [] } satisfies GoogleAccountsResponse)
        return
      }
      const [accounts, calendars] = await Promise.all([deps.store.listAccounts(), deps.store.listCalendars()])
      const described = await Promise.all(
        accounts.map((account) =>
          describeAccount(
            account,
            calendars.filter((calendar) => calendar.accountId === account.id),
            deps,
          ),
        ),
      )
      res.status(200).json({ configured: true, accounts: described } satisfies GoogleAccountsResponse)
    },
  })
}

export default createGoogleAccountsHandler(googleDeps)
