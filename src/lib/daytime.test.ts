import { describe, expect, it } from 'vitest'
import { dayPeriod, skyPalette } from './daytime'

function atHour(hour: number, minute = 0) {
  return new Date(2026, 8, 12, hour, minute)
}

describe('dayPeriod', () => {
  it('clasifica cada franja por la hora local', () => {
    expect(dayPeriod(atHour(0))).toBe('madrugada')
    expect(dayPeriod(atHour(4, 59))).toBe('madrugada')
    expect(dayPeriod(atHour(5))).toBe('amanecer')
    expect(dayPeriod(atHour(6, 59))).toBe('amanecer')
    expect(dayPeriod(atHour(7))).toBe('manana')
    expect(dayPeriod(atHour(10, 59))).toBe('manana')
    expect(dayPeriod(atHour(11))).toBe('mediodia')
    expect(dayPeriod(atHour(15, 59))).toBe('mediodia')
    expect(dayPeriod(atHour(16))).toBe('atardecer')
    expect(dayPeriod(atHour(18, 59))).toBe('atardecer')
    expect(dayPeriod(atHour(19))).toBe('noche')
    expect(dayPeriod(atHour(23, 59))).toBe('noche')
  })
})

describe('skyPalette', () => {
  it('devuelve tres colores distintos por franja', () => {
    const palette = skyPalette('amanecer', 'light')
    expect(new Set([palette.a, palette.b, palette.c]).size).toBe(3)
  })

  it('en oscuro usa una paleta distinta a la clara', () => {
    const light = skyPalette('mediodia', 'light')
    const dark = skyPalette('mediodia', 'dark')
    expect(light).not.toEqual(dark)
  })
})
