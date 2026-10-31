import { badRequest, body, notFound, requireId, route } from '../_lib/http.ts'
import { googleDeps, requireGoogle } from '../_lib/google-deps.ts'
import type { GoogleDeps } from '../_lib/google-meets.ts'
import { requiredText } from '../_lib/validate.ts'

export function createGoogleCalendarByIdHandler(deps: GoogleDeps | null) {
  return route({
    async PATCH(req, res) {
      const google = requireGoogle(deps)
      const id = requireId(req)
      const input = body(req)
      const current = await google.store.getCalendar(id)
      if (!current) notFound('Calendario no encontrado')
      if (!('name' in input) && !('colorKey' in input)) badRequest('No hay nada para actualizar')
      const updated = await google.store.updateCalendar(id, {
        name: 'name' in input ? requiredText(input.name, 'name', 60) : current.name,
        colorKey: 'colorKey' in input ? requiredText(input.colorKey, 'colorKey', 40) : current.colorKey,
      })
      if (!updated) notFound('Calendario no encontrado')
      res.status(200).json({ id: updated.id, name: updated.name, colorKey: updated.colorKey })
    },

    /** Dejar de mostrarlo. La cuenta sigue conectada. */
    async DELETE(req, res) {
      const google = requireGoogle(deps)
      if (!(await google.store.removeCalendar(requireId(req)))) notFound('Calendario no encontrado')
      res.status(200).json({ ok: true })
    },
  })
}

export default createGoogleCalendarByIdHandler(googleDeps)
