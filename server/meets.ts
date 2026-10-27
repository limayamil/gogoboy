import { route } from './_lib/http.ts'
import { meetCalendarStore, type MeetCalendarStore } from './_lib/meet-calendars.ts'
import { cachedFetch, fetchFeedText, loadMeetsToday, type FetchText } from './_lib/meets.ts'

export function createMeetsHandler(deps: {
  store: MeetCalendarStore
  fetchText: FetchText
  now?: () => Date
}) {
  return route({
    async GET(_req, res) {
      const result = await loadMeetsToday({
        calendars: await deps.store.list(),
        fetchText: deps.fetchText,
        now: (deps.now ?? (() => new Date()))(),
      })
      // Reuniones privadas: que ningún proxy ni el navegador las guarde.
      res.setHeader('Cache-Control', 'no-store')
      res.status(200).json(result)
    },
  })
}

export default createMeetsHandler({ store: meetCalendarStore, fetchText: cachedFetch(fetchFeedText) })
