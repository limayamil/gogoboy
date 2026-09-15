import type { Status } from '../shared/types'
import { PALETTE } from './palette'

/** Burst chico: alcanza para celebrar un tilde sin tapar la UI. */
export const CONFETTI_COUNT = 28
const DURATION_MS = 720
const COLORS = PALETTE.map((color) => color.dot)

export interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  rotation: number
  vr: number
  w: number
  h: number
  color: string
}

export function shouldCelebrateStatus(from: Status, to: Status): boolean {
  return to === 'hecha' && from !== 'hecha'
}

export function shouldCelebrateChecked(checked: boolean): boolean {
  return checked
}

export function createBurst(originX: number, originY: number, random = Math.random): Particle[] {
  return Array.from({ length: CONFETTI_COUNT }, () => {
    const angle = random() * Math.PI * 2
    const speed = 3 + random() * 7
    return {
      x: originX,
      y: originY,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 4,
      rotation: random() * Math.PI,
      vr: (random() - 0.5) * 0.4,
      w: 4 + random() * 4,
      h: 6 + random() * 6,
      color: COLORS[Math.floor(random() * COLORS.length)] ?? COLORS[0]!,
    }
  })
}

let lastX = 0
let lastY = 0

if (typeof window !== 'undefined') {
  // pointerdown llega antes que click/change: las checkboxes no traen clientX.
  window.addEventListener(
    'pointerdown',
    (event) => {
      lastX = event.clientX
      lastY = event.clientY
    },
    { capture: true, passive: true },
  )
}

/** Lanza el burst desde el pointer. No-op con reduced-motion o sin window. */
export function burstConfetti(clientX: number, clientY: number) {
  if (typeof window === 'undefined') return
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

  const canvas = document.createElement('canvas')
  canvas.setAttribute('aria-hidden', 'true')
  canvas.style.cssText =
    'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:70'
  const dpr = window.devicePixelRatio || 1
  const width = window.innerWidth
  const height = window.innerHeight
  canvas.width = Math.round(width * dpr)
  canvas.height = Math.round(height * dpr)

  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.scale(dpr, dpr)
  document.body.appendChild(canvas)

  const particles = createBurst(clientX, clientY)
  const started = performance.now()
  let last = started

  const frame = (now: number) => {
    const dt = Math.min(32, now - last) / 16
    last = now
    const elapsed = now - started
    ctx.clearRect(0, 0, width, height)
    const fade = Math.max(0, 1 - elapsed / DURATION_MS)

    for (const particle of particles) {
      particle.vy += 0.22 * dt
      particle.vx *= 0.99
      particle.x += particle.vx * dt
      particle.y += particle.vy * dt
      particle.rotation += particle.vr * dt

      ctx.save()
      ctx.translate(particle.x, particle.y)
      ctx.rotate(particle.rotation)
      ctx.globalAlpha = fade
      ctx.fillStyle = particle.color
      ctx.fillRect(-particle.w / 2, -particle.h / 2, particle.w, particle.h)
      ctx.restore()
    }

    if (elapsed < DURATION_MS) {
      requestAnimationFrame(frame)
      return
    }
    canvas.remove()
  }

  requestAnimationFrame(frame)
}

export function celebrateFromPointer(event?: { clientX: number; clientY: number }) {
  burstConfetti(event?.clientX ?? lastX, event?.clientY ?? lastY)
}
