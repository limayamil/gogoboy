import { describe, expect, it } from 'vitest'
import { PALETTE } from './palette'
import {
  CONFETTI_COUNT,
  createBurst,
  shouldCelebrateChecked,
  shouldCelebrateStatus,
} from './confetti'

describe('shouldCelebrateStatus', () => {
  it('solo dispara al pasar a hecha', () => {
    expect(shouldCelebrateStatus('en_progreso', 'hecha')).toBe(true)
    expect(shouldCelebrateStatus('pendiente', 'hecha')).toBe(true)
    expect(shouldCelebrateStatus('hecha', 'hecha')).toBe(false)
    expect(shouldCelebrateStatus('hecha', 'pendiente')).toBe(false)
    expect(shouldCelebrateStatus('pendiente', 'en_progreso')).toBe(false)
  })
})

describe('shouldCelebrateChecked', () => {
  it('solo dispara al tildar, no al destildar', () => {
    expect(shouldCelebrateChecked(true)).toBe(true)
    expect(shouldCelebrateChecked(false)).toBe(false)
  })
})

describe('createBurst', () => {
  it('nace en el origen del pointer y es un burst chico', () => {
    const particles = createBurst(120, 80, () => 0.5)
    expect(particles).toHaveLength(CONFETTI_COUNT)
    expect(CONFETTI_COUNT).toBeLessThanOrEqual(40)
    for (const particle of particles) {
      expect(particle.x).toBe(120)
      expect(particle.y).toBe(80)
    }
  })

  it('pinta con los puntitos de la paleta', () => {
    const dots = new Set(PALETTE.map((color) => color.dot))
    const particles = createBurst(0, 0, () => 0)
    for (const particle of particles) {
      expect(dots.has(particle.color)).toBe(true)
    }
  })
})
