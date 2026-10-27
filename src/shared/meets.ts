/**
 * Solo https y solo el host de iCal de Google: el servidor hace fetch de esta URL,
 * así que aceptar cualquier otra lo convertiría en un proxy hacia donde sea.
 * El front la usa para avisar antes de mandar; la que decide es la del servidor.
 */
export function isGoogleIcalUrl(value: string): boolean {
  let url: URL
  try {
    url = new URL(value.trim())
  } catch {
    return false
  }
  return (
    url.protocol === 'https:' &&
    url.hostname === 'calendar.google.com' &&
    url.port === '' &&
    url.username === '' &&
    url.password === '' &&
    url.pathname.startsWith('/calendar/ical/')
  )
}
