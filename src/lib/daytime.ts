/**
 * El cielo del header se pinta segun la hora local, no segun UTC: de madrugada
 * un toISOString() correra el dia y mostraria el cielo de otra franja.
 */

export type DayPeriod =
  | 'madrugada'
  | 'amanecer'
  | 'manana'
  | 'mediodia'
  | 'atardecer'
  | 'noche'

export interface SkyPalette {
  a: string
  b: string
  c: string
  glow: string
  glowX: string
  glowY: string
}

const PERIODS: { untilHour: number; period: DayPeriod }[] = [
  { untilHour: 5, period: 'madrugada' },
  { untilHour: 7, period: 'amanecer' },
  { untilHour: 11, period: 'manana' },
  { untilHour: 16, period: 'mediodia' },
  { untilHour: 19, period: 'atardecer' },
  { untilHour: 24, period: 'noche' },
]

export function dayPeriod(date: Date = new Date()): DayPeriod {
  const hour = date.getHours()
  return PERIODS.find(({ untilHour }) => hour < untilHour)?.period ?? 'noche'
}

const LIGHT: Record<DayPeriod, SkyPalette> = {
  madrugada: {
    a: '#d4d0f0',
    b: '#c5ccec',
    c: '#b8c5e8',
    glow: 'rgb(196 186 232 / 55%)',
    glowX: '82%',
    glowY: '10%',
  },
  amanecer: {
    a: '#ffd6c9',
    b: '#ffe8c8',
    c: '#f5d0e8',
    glow: 'rgb(255 210 160 / 70%)',
    glowX: '12%',
    glowY: '120%',
  },
  manana: {
    a: '#cde8fb',
    b: '#eaf4ff',
    c: '#fde8d4',
    glow: 'rgb(255 236 190 / 65%)',
    glowX: '78%',
    glowY: '-20%',
  },
  mediodia: {
    a: '#fff3c9',
    b: '#e8f5d4',
    c: '#d4eef8',
    glow: 'rgb(255 248 210 / 80%)',
    glowX: '50%',
    glowY: '-40%',
  },
  atardecer: {
    a: '#ffcbb8',
    b: '#f0c4e0',
    c: '#d8c0f0',
    glow: 'rgb(255 170 130 / 65%)',
    glowX: '88%',
    glowY: '80%',
  },
  noche: {
    a: '#c5c0e8',
    b: '#a8b4d8',
    c: '#9aa8d0',
    glow: 'rgb(230 228 255 / 45%)',
    glowX: '86%',
    glowY: '8%',
  },
}

const DARK: Record<DayPeriod, SkyPalette> = {
  madrugada: {
    a: '#3a3458',
    b: '#2e3450',
    c: '#3c3058',
    glow: 'rgb(160 150 220 / 42%)',
    glowX: '82%',
    glowY: '10%',
  },
  amanecer: {
    a: '#5a3840',
    b: '#5a4838',
    c: '#3c3050',
    glow: 'rgb(230 140 100 / 38%)',
    glowX: '12%',
    glowY: '120%',
  },
  manana: {
    a: '#2e4860',
    b: '#345060',
    c: '#385050',
    glow: 'rgb(180 210 240 / 30%)',
    glowX: '78%',
    glowY: '-20%',
  },
  mediodia: {
    a: '#4a5038',
    b: '#384850',
    c: '#485038',
    glow: 'rgb(230 220 140 / 28%)',
    glowX: '50%',
    glowY: '-40%',
  },
  atardecer: {
    a: '#5a3838',
    b: '#582848',
    c: '#3c3058',
    glow: 'rgb(230 120 90 / 38%)',
    glowX: '88%',
    glowY: '80%',
  },
  // Un poco más alto que --bg para que el cielo se lea, no se funda con la pagina.
  noche: {
    a: '#3a3860',
    b: '#2e3858',
    c: '#282848',
    glow: 'rgb(200 210 255 / 38%)',
    glowX: '86%',
    glowY: '8%',
  },
}

export function skyPalette(period: DayPeriod, theme: 'light' | 'dark'): SkyPalette {
  return (theme === 'dark' ? DARK : LIGHT)[period]
}
