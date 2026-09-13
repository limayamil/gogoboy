/**
 * El clima del header vive en el cliente: Open-Meteo no pide clave y las
 * coords son las de este unico usuario, no hace falta un endpoint propio.
 */

export const GEO_STORAGE_KEY = 'gogoboy-geo'
export const WEATHER_STORAGE_KEY = 'gogoboy-weather'
export const WEATHER_TTL_MS = 20 * 60 * 1000

export interface GeoCoords {
  lat: number
  lon: number
}

export interface KeyValueStore {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

const RAIN_CODES = new Set([
  51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99,
])

export function isRainyWeatherCode(code: number): boolean {
  return RAIN_CODES.has(code)
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' ? (value as Record<string, unknown>) : null
}

export function parseIsRaining(payload: unknown): boolean {
  const current = asRecord(asRecord(payload)?.current)
  if (!current) return false
  const code = current.weather_code
  if (typeof code === 'number' && isRainyWeatherCode(code)) return true
  const precipitation = current.precipitation
  return typeof precipitation === 'number' && precipitation > 0
}

export function readStoredCoords(storage: KeyValueStore): GeoCoords | null {
  const raw = storage.getItem(GEO_STORAGE_KEY)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as unknown
    const record = asRecord(parsed)
    if (!record || typeof record.lat !== 'number' || typeof record.lon !== 'number') return null
    if (!Number.isFinite(record.lat) || !Number.isFinite(record.lon)) return null
    return { lat: record.lat, lon: record.lon }
  } catch {
    return null
  }
}

export function writeStoredCoords(storage: KeyValueStore, coords: GeoCoords): void {
  storage.setItem(GEO_STORAGE_KEY, JSON.stringify(coords))
}

export function readWeatherCache(storage: KeyValueStore, now: number): boolean | null {
  const raw = storage.getItem(WEATHER_STORAGE_KEY)
  if (!raw) return null
  try {
    const parsed = asRecord(JSON.parse(raw) as unknown)
    if (!parsed || typeof parsed.raining !== 'boolean' || typeof parsed.fetchedAt !== 'number') {
      return null
    }
    if (now - parsed.fetchedAt > WEATHER_TTL_MS) return null
    return parsed.raining
  } catch {
    return null
  }
}

export function writeWeatherCache(storage: KeyValueStore, raining: boolean, now: number): void {
  storage.setItem(WEATHER_STORAGE_KEY, JSON.stringify({ raining, fetchedAt: now }))
}

export function openMeteoUrl({ lat, lon }: GeoCoords): string {
  // URLSearchParams encodea la coma y Open-Meteo acepta las dos formas;
  // dejamos el query legible porque lat/lon ya son numeros.
  return `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=weather_code,precipitation&timezone=auto`
}

export async function fetchIsRaining(
  coords: GeoCoords,
  fetchFn: typeof fetch = fetch,
): Promise<boolean> {
  try {
    const response = await fetchFn(openMeteoUrl(coords))
    if (!response.ok) return false
    return parseIsRaining(await response.json())
  } catch {
    return false
  }
}

export async function resolveCoords(options: {
  storage: KeyValueStore
  geolocate: () => Promise<GeoCoords>
}): Promise<GeoCoords | null> {
  const stored = readStoredCoords(options.storage)
  if (stored) return stored
  try {
    const coords = await options.geolocate()
    writeStoredCoords(options.storage, coords)
    return coords
  } catch {
    return null
  }
}

export function geolocateFromBrowser(
  geolocation: Pick<Geolocation, 'getCurrentPosition'> | undefined = navigator.geolocation,
): Promise<GeoCoords> {
  return new Promise((resolve, reject) => {
    if (!geolocation) {
      reject(new Error('sin geolocalizacion'))
      return
    }
    geolocation.getCurrentPosition(
      (position) => {
        resolve({ lat: position.coords.latitude, lon: position.coords.longitude })
      },
      (error) => reject(error),
      { maximumAge: 24 * 60 * 60 * 1000, timeout: 8_000, enableHighAccuracy: false },
    )
  })
}
