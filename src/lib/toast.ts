type Listener = (message: string) => void

const listeners = new Set<Listener>()

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'No se pudo guardar. Probá de nuevo.'
}

export function toastError(error: unknown) {
  const message = typeof error === 'string' ? error : errorMessage(error)
  for (const listener of listeners) listener(message)
}

export function subscribeToasts(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
