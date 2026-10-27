import { body, notFound, requireId, route } from '../_lib/http.ts'
import {
  meetCalendarStore,
  parseMeetCalendarPatch,
  toPublicCalendar,
  type MeetCalendarStore,
} from '../_lib/meet-calendars.ts'

export function createMeetCalendarByIdHandler(store: MeetCalendarStore) {
  return route({
    async PATCH(req, res) {
      const id = requireId(req)
      const current = await store.get(id)
      if (!current) notFound('Calendario no encontrado')
      const updated = await store.update(id, parseMeetCalendarPatch(body(req), current))
      if (!updated) notFound('Calendario no encontrado')
      res.status(200).json(toPublicCalendar(updated))
    },

    async DELETE(req, res) {
      if (!(await store.remove(requireId(req)))) notFound('Calendario no encontrado')
      res.status(200).json({ ok: true })
    },
  })
}

export default createMeetCalendarByIdHandler(meetCalendarStore)
