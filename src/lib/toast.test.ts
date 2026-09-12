import { describe, expect, it } from 'vitest'
import { errorMessage } from './toast'

describe('errorMessage', () => {
  it('usa el mensaje de Error', () => {
    expect(errorMessage(new Error('El bucket rechazó la subida'))).toBe('El bucket rechazó la subida')
  })

  it('cae a un fallback en español si no hay Error', () => {
    expect(errorMessage('boom')).toBe('No se pudo guardar. Probá de nuevo.')
  })
})
