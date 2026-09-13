import { describe, expect, it } from 'vitest'
import {
  GEO_STORAGE_KEY,
  WEATHER_TTL_MS,
  fetchIsRaining,
  isRainyWeatherCode,
  openMeteoUrl,
  parseIsRaining,
  readStoredCoords,
  readWeatherCache,
  resolveCoords,
  writeStoredCoords,
  writeWeatherCache,
} from './weather'

describe('isRainyWeatherCode', () => {
  it('marca llovizna, lluvia, chaparrones y tormenta', () => {
    for (const code of [51, 61, 63, 65, 80, 81, 82, 95, 96, 99]) {
      expect(isRainyWeatherCode(code)).toBe(true)
    }
  })

  it('deja afuera cielo despejado, nubes y nieve', () => {
    for (const code of [0, 1, 2, 3, 45, 71, 73, 75, 85]) {
      expect(isRainyWeatherCode(code)).toBe(false)
    }
  })
})

describe('parseIsRaining', () => {
  it('usa el weather_code actual de Open-Meteo', () => {
    expect(parseIsRaining({ current: { weather_code: 61, precipitation: 0 } })).toBe(true)
    expect(parseIsRaining({ current: { weather_code: 1, precipitation: 0 } })).toBe(false)
  })

  it('tambien cuenta precipitacion > 0 aunque el codigo no sea de lluvia', () => {
    expect(parseIsRaining({ current: { weather_code: 3, precipitation: 0.4 } })).toBe(true)
  })

  it('si el payload no sirve, asume que no llueve', () => {
    expect(parseIsRaining(null)).toBe(false)
    expect(parseIsRaining({})).toBe(false)
  })
})

describe('coords y cache', () => {
  it('persiste y relee lat/lon', () => {
    const storage = new Map<string, string>()
    const fake = {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storage.set(key, value)
      },
    }

    expect(readStoredCoords(fake)).toBeNull()
    writeStoredCoords(fake, { lat: -34.6, lon: -58.38 })
    expect(readStoredCoords(fake)).toEqual({ lat: -34.6, lon: -58.38 })
    expect(storage.has(GEO_STORAGE_KEY)).toBe(true)
  })

  it('la cache de clima vence', () => {
    const storage = new Map<string, string>()
    const fake = {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storage.set(key, value)
      },
    }
    const now = 1_000_000

    expect(readWeatherCache(fake, now)).toBeNull()
    writeWeatherCache(fake, true, now)
    expect(readWeatherCache(fake, now + 60_000)).toBe(true)
    expect(readWeatherCache(fake, now + WEATHER_TTL_MS + 1)).toBeNull()
  })
})

describe('resolveCoords', () => {
  it('reusa las coords guardadas y no pide geolocalizacion', async () => {
    const storage = {
      getItem: () => JSON.stringify({ lat: 1, lon: 2 }),
      setItem: () => {
        throw new Error('no deberia guardar de nuevo')
      },
    }
    let asked = false
    const coords = await resolveCoords({
      storage,
      geolocate: async () => {
        asked = true
        return { lat: 9, lon: 9 }
      },
    })
    expect(coords).toEqual({ lat: 1, lon: 2 })
    expect(asked).toBe(false)
  })

  it('pide ubicacion, la guarda y la devuelve', async () => {
    const storage = new Map<string, string>()
    const fake = {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storage.set(key, value)
      },
    }
    const coords = await resolveCoords({
      storage: fake,
      geolocate: async () => ({ lat: -34.6, lon: -58.38 }),
    })
    expect(coords).toEqual({ lat: -34.6, lon: -58.38 })
    expect(readStoredCoords(fake)).toEqual(coords)
  })

  it('si el permiso falla, no rompe: coords null', async () => {
    const coords = await resolveCoords({
      storage: { getItem: () => null, setItem: () => {} },
      geolocate: async () => {
        throw new Error('denied')
      },
    })
    expect(coords).toBeNull()
  })
})

describe('fetchIsRaining', () => {
  it('arma la URL de Open-Meteo y parsea la respuesta', async () => {
    const url = openMeteoUrl({ lat: -34.6, lon: -58.38 })
    expect(url).toContain('latitude=-34.6')
    expect(url).toContain('longitude=-58.38')
    expect(url).toContain('current=weather_code,precipitation')

    const raining = await fetchIsRaining(
      { lat: -34.6, lon: -58.38 },
      async () =>
        new Response(JSON.stringify({ current: { weather_code: 81, precipitation: 1.2 } })),
    )
    expect(raining).toBe(true)
  })

  it('si la red falla, asume que no llueve', async () => {
    const raining = await fetchIsRaining({ lat: 0, lon: 0 }, async () => {
      throw new Error('offline')
    })
    expect(raining).toBe(false)
  })
})
