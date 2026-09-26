/**
 * Avisos efimeros. El toast es tambien el lugar donde vive el "Deshacer": varios
 * borrados son de un solo click y sin confirmacion, asi que en vez de frenar al
 * usuario con un dialogo se hace la accion y se le ofrece volver atras.
 */

export type ToastTone = 'error' | 'success'

export interface ToastAction {
  label: string
  onClick: () => void
}

export interface Toast {
  message: string
  tone: ToastTone
  action?: ToastAction
}

type Listener = (toast: Toast) => void

const listeners = new Set<Listener>()

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'No se pudo guardar. Probá de nuevo.'
}

function emit(toast: Toast) {
  for (const listener of listeners) listener(toast)
}

export function toastError(error: unknown, action?: ToastAction) {
  emit({ message: typeof error === 'string' ? error : errorMessage(error), tone: 'error', action })
}

export function toastSuccess(message: string, action?: ToastAction) {
  emit({ message, tone: 'success', action })
}

/** Borro algo de un click: el aviso trae el boton para revertirlo. */
export function toastUndo(message: string, undo: () => void) {
  emit({ message, tone: 'success', action: { label: 'Deshacer', onClick: undo } })
}

export function subscribeToasts(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
