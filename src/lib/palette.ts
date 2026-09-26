/**
 * Paleta pastel curada (inspirada en las dos referencias de Yamil: wellness
 * peach/lavanda/menta y productividad coral/mostaza).
 *
 * Las categorias guardan la CLAVE, nunca el hex: asi un ajuste de paleta o el cambio
 * de tema se aplican solos a todo lo ya creado.
 */
import { useThemeMode, type ThemeMode } from '../app/theme'

/** Las cuatro superficies que necesita una categoria para pintarse. */
export interface ColorVariant {
  /** Fondo de la tarjeta de categoria. */
  bg: string
  /** Relleno suave para filas y chips sobre `bg`. */
  soft: string
  /** Color fuerte: puntito, borde izquierdo, acentos. Igual en los dos temas. */
  dot: string
  /** Texto legible sobre `bg` y sobre `soft`. */
  ink: string
}

export interface PastelColor extends ColorVariant {
  key: string
  label: string
  dark: ColorVariant
}

export const PALETTE: PastelColor[] = [
  {
    key: 'coral', label: 'Coral',
    bg: '#F6D0CC', soft: '#FBECEA', dot: '#E8897A', ink: '#8A3D38',
    dark: { bg: '#3A2320', soft: '#2E1D1B', dot: '#E8897A', ink: '#FFC9BD' },
  },
  {
    key: 'rosa', label: 'Rosa',
    bg: '#F5D0DC', soft: '#FBEFF4', dot: '#E07AA0', ink: '#8A3558',
    dark: { bg: '#3A2029', soft: '#2E1A21', dot: '#E07AA0', ink: '#FFC6DC' },
  },
  {
    key: 'lila', label: 'Lila',
    bg: '#DDD6F6', soft: '#F0EDFB', dot: '#9A8FE3', ink: '#4A3E8A',
    dark: { bg: '#2C2440', soft: '#241E34', dot: '#9A8FE3', ink: '#D9C9FF' },
  },
  {
    key: 'lavanda', label: 'Lavanda',
    bg: '#D2D6F5', soft: '#EEEFFC', dot: '#7E8DE0', ink: '#36407A',
    dark: { bg: '#232842', soft: '#1D2136', dot: '#7E8DE0', ink: '#C6D0FF' },
  },
  {
    key: 'cielo', label: 'Cielo',
    bg: '#D4E8F6', soft: '#ECF5FB', dot: '#6AADD8', ink: '#245570',
    dark: { bg: '#1C2E3A', soft: '#17262F', dot: '#6AADD8', ink: '#BEE2F7' },
  },
  {
    key: 'menta', label: 'Menta',
    bg: '#CDEDE4', soft: '#E8F7F2', dot: '#5BB89A', ink: '#1E5F4C',
    dark: { bg: '#1B3029', soft: '#172722', dot: '#5BB89A', ink: '#B5EBD3' },
  },
  {
    key: 'salvia', label: 'Salvia',
    bg: '#DCE9D4', soft: '#F0F6EC', dot: '#7EAE6A', ink: '#3A5A2C',
    dark: { bg: '#24301E', soft: '#1E2819', dot: '#7EAE6A', ink: '#CFE5BC' },
  },
  {
    key: 'manteca', label: 'Manteca',
    bg: '#F6E2B0', soft: '#FBF3DC', dot: '#E0B04A', ink: '#7A5A12',
    dark: { bg: '#362D17', soft: '#2C2513', dot: '#E0B04A', ink: '#F7E1A8' },
  },
  {
    key: 'durazno', label: 'Durazno',
    bg: '#F6D8C4', soft: '#FBF0E8', dot: '#E8A06A', ink: '#8A4E20',
    dark: { bg: '#38271A', soft: '#2D2015', dot: '#E8A06A', ink: '#FBD6B4' },
  },
  {
    key: 'arena', label: 'Arena',
    bg: '#EDE4DA', soft: '#F7F2ED', dot: '#B89A82', ink: '#5C4A38',
    dark: { bg: '#2F2822', soft: '#27211C', dot: '#B89A82', ink: '#E3D2C1' },
  },
]

const BY_KEY = new Map(PALETTE.map((color) => [color.key, color]))

/** Nunca falla: una categoria con un color desconocido cae en el primero de la paleta. */
export function colorOf(key: string | null | undefined, mode: ThemeMode = 'light'): ColorVariant {
  const color = (key ? BY_KEY.get(key) : undefined) ?? PALETTE[0]
  return mode === 'dark' ? color.dark : color
}

/** Resuelve colores de categoria segun el tema activo. */
export function useColorOf(): (key: string | null | undefined) => ColorVariant {
  const { mode } = useThemeMode()
  return (key) => colorOf(key, mode)
}
