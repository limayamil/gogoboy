import { route } from './_lib/http.ts'
import { googleDeps } from './_lib/google-deps.ts'
import { googleSources, type GoogleDeps } from './_lib/google-meets.ts'
import { meetCalendarStore, type MeetCalendarStore } from './_lib/meet-calendars.ts'
import { cachedFetch, fetchFeedText, icalSources, loadMeetsToday, type FetchText } from './_lib/meets.ts'

export function createMeetsHandler(deps: {
  store: MeetCalendarStore
  fetchText: FetchText
  google?: GoogleDeps | null
  now?: () => Date
}) {
  return route({
    async GET(_req, res) {
      const [ical, google] = await Promise.all([
        deps.store.list(),
        deps.google ? googleSources(deps.google) : Promise.resolve([]),
      ])
      const result = await loadMeetsToday({
        sources: [...icalSources(ical, deps.fetchText), ...google],
        now: (deps.now ?? (() => new Date()))(),
      })
      // Reuniones privadas: que ningún proxy ni el navegador las guarde.
      res.setHeader('Cache-Control', 'no-store')
      res.status(200).json(result)
    },
  })
}

export default createMeetsHandler({
  store: meetCalendarStore,
  fetchText: cachedFetch(fetchFeedText),
  google: googleDeps,
})
