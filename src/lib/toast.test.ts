import { describe, expect, it, vi } from 'vitest'
import { errorMessage, subscribeToasts, toastError, toastSuccess, toastUndo } from './toast'

describe('errorMessage', () => {
  it('usa el mensaje de Error', () => {
    expect(errorMessage(new Error('El bucket rechazó la subida'))).toBe('El bucket rechazó la subida')
  })

  it('cae a un fallback en español si no hay Error', () => {
    expect(errorMessage('boom')).toBe('No se pudo guardar. Probá de nuevo.')
  })
})

describe('toasts', () => {
  it('entrega el error a los suscriptos con tono de error', () => {
    const listener = vi.fn()
    const stop = subscribeToasts(listener)
    toastError(new Error('sin red'))
    expect(listener).toHaveBeenCalledWith({ message: 'sin red', tone: 'error', action: undefined })
    stop()
  })

  it('deja de entregar despues de desuscribirse', () => {
    const listener = vi.fn()
    subscribeToasts(listener)()
    toastSuccess('listo')
    expect(listener).not.toHaveBeenCalled()
  })

  it('toastUndo arma la accion de deshacer', () => {
    const listener = vi.fn()
    const stop = subscribeToasts(listener)
    const undo = vi.fn()
    toastUndo('Subtarea eliminada', undo)

    const toast = listener.mock.calls[0][0]
    expect(toast.message).toBe('Subtarea eliminada')
    expect(toast.action?.label).toBe('Deshacer')

    toast.action?.onClick()
    expect(undo).toHaveBeenCalledOnce()
    stop()
  })
})
