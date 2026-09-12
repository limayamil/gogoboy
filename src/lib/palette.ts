/**
 * Paleta pastel curada (inspirada en design/refe3.jpeg y design/refe4.jpeg).
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
    bg: '#FFE3DC', soft: '#FFF1ED', dot: '#F4836C', ink: '#8C3A2A',
    dark: { bg: '#3A2320', soft: '#2E1D1B', dot: '#F4836C', ink: '#FFC9BD' },
  },
  {
    key: 'rosa', label: 'Rosa',
    bg: '#FFE0EC', soft: '#FFF0F5', dot: '#F07AA6', ink: '#8E2F56',
    dark: { bg: '#3A2029', soft: '#2E1A21', dot: '#F07AA6', ink: '#FFC6DC' },
  },
  {
    key: 'lila', label: 'Lila',
    bg: '#EBE2FB', soft: '#F5F0FE', dot: '#A78BE6', ink: '#513A87',
    dark: { bg: '#2C2440', soft: '#241E34', dot: '#A78BE6', ink: '#D9C9FF' },
  },
  {
    key: 'lavanda', label: 'Lavanda',
    bg: '#E1E5FA', soft: '#F0F2FD', dot: '#8496E3', ink: '#37457F',
    dark: { bg: '#232842', soft: '#1D2136', dot: '#8496E3', ink: '#C6D0FF' },
  },
  {
    key: 'cielo', label: 'Cielo',
    bg: '#DCEEF9', soft: '#EFF7FC', dot: '#6FB4DC', ink: '#245675',
    dark: { bg: '#1C2E3A', soft: '#17262F', dot: '#6FB4DC', ink: '#BEE2F7' },
  },
  {
    key: 'menta', label: 'Menta',
    bg: '#D9F0E5', soft: '#EEF8F3', dot: '#63BF98', ink: '#1F6148',
    dark: { bg: '#1B3029', soft: '#172722', dot: '#63BF98', ink: '#B5EBD3' },
  },
  {
    key: 'salvia', label: 'Salvia',
    bg: '#E4EEDC', soft: '#F2F7EE', dot: '#8DB473', ink: '#41602C',
    dark: { bg: '#24301E', soft: '#1E2819', dot: '#8DB473', ink: '#CFE5BC' },
  },
  {
    key: 'manteca', label: 'Manteca',
    bg: '#FCF0CE', soft: '#FEF8E7', dot: '#E4B84C', ink: '#7C5C10',
    dark: { bg: '#362D17', soft: '#2C2513', dot: '#E4B84C', ink: '#F7E1A8' },
  },
  {
    key: 'durazno', label: 'Durazno',
    bg: '#FDE6D2', soft: '#FEF3E9', dot: '#EE9E5C', ink: '#8A4E17',
    dark: { bg: '#38271A', soft: '#2D2015', dot: '#EE9E5C', ink: '#FBD6B4' },
  },
  {
    key: 'arena', label: 'Arena',
    bg: '#EFE7DF', soft: '#F8F3EF', dot: '#B69B83', ink: '#5F4B38',
    dark: { bg: '#2F2822', soft: '#27211C', dot: '#B69B83', ink: '#E3D2C1' },
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
