import { body, notFound, route } from '../_lib/http.ts'
import { googleDeps, requireGoogle } from '../_lib/google-deps.ts'
import type { GoogleDeps } from '../_lib/google-meets.ts'
import { requiredText, uuid } from '../_lib/validate.ts'

/** Elegir un calendario de una cuenta para mostrarlo en la barra. */
export function createGoogleCalendarsHandler(deps: GoogleDeps | null) {
  return route({
    async POST(req, res) {
      const google = requireGoogle(deps)
      const input = body(req)
      const accountId = uuid(input.accountId, 'accountId')
      if (!(await google.store.getAccount(accountId))) notFound('Cuenta no encontrada')
      const created = await google.store.addCalendar({
        accountId,
        calendarId: requiredText(input.calendarId, 'calendarId', 500),
        name: requiredText(input.name, 'name', 60),
        colorKey: requiredText(input.colorKey, 'colorKey', 40),
      })
      res.status(201).json({ id: created.id, name: created.name, colorKey: created.colorKey })
    },
  })
}

export default createGoogleCalendarsHandler(googleDeps)
