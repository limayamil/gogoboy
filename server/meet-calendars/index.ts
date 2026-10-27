import { body, route } from '../_lib/http.ts'
import {
  meetCalendarStore,
  parseMeetCalendarCreate,
  toPublicCalendar,
  type MeetCalendarStore,
} from '../_lib/meet-calendars.ts'

export function createMeetCalendarsHandler(store: MeetCalendarStore) {
  return route({
    async GET(_req, res) {
      res.status(200).json((await store.list()).map(toPublicCalendar))
    },

    async POST(req, res) {
      const created = await store.create(parseMeetCalendarCreate(body(req)))
      res.status(201).json(toPublicCalendar(created))
    },
  })
}

export default createMeetCalendarsHandler(meetCalendarStore)
