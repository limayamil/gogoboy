// Utilidades compartidas por todos los handlers. La firma (req, res) es la de Express,
// asi que el mismo handler corre en el servidor de desarrollo y, via el adaptador de
// server/lib/router.ts, tambien en produccion.

export interface ApiRequest {
  method?: string
  url?: string
  query: Record<string, string | string[] | undefined>
  body?: unknown
  headers: Record<string, string | string[] | undefined>
}

export interface ApiResponse {
  status(code: number): ApiResponse
  json(payload: unknown): void
  send(payload?: unknown): void
  setHeader(name: string, value: string): void
  end(): void
}

export type Handler = (req: ApiRequest, res: ApiResponse) => Promise<void> | void

/** Error con codigo HTTP: lo lanza cualquier capa y `route` lo convierte en respuesta. */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message)
    this.name = 'HttpError'
  }
}

export function badRequest(message: string): never {
  throw new HttpError(400, message)
}

export function notFound(message = 'No encontrado'): never {
  throw new HttpError(404, message)
}

type Methods = Partial<Record<'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE', Handler>>

/**
 * Arma un handler a partir de un mapa de metodos, centralizando el 405 y el manejo
 * de errores para que ningun endpoint tenga que repetir ese boilerplate.
 */
export function route(methods: Methods): Handler {
  return async (req, res) => {
    const method = (req.method ?? 'GET').toUpperCase()

    if (method === 'OPTIONS') {
      res.status(204).end()
      return
    }

    const handler = methods[method as keyof Methods]
    if (!handler) {
      res.setHeader('Allow', Object.keys(methods).join(', '))
      res.status(405).json({ error: `Metodo ${method} no permitido` })
      return
    }

    try {
      await handler(req, res)
    } catch (error) {
      if (error instanceof HttpError) {
        res.status(error.status).json({ error: error.message })
        return
      }
      console.error('[api] error no manejado:', error)
      const message = error instanceof Error ? error.message : 'Error desconocido'
      res.status(500).json({ error: message })
    }
  }
}

/** Lee el parametro dinamico `id` de la ruta, validando que sea un uuid. */
export function requireId(req: ApiRequest): string {
  const raw = req.query.id
  const id = Array.isArray(raw) ? raw[0] : raw
  if (!id) badRequest('Falta el id en la ruta')
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    badRequest(`Id invalido: ${id}`)
  }
  return id
}

export function body(req: ApiRequest): Record<string, unknown> {
  const raw = req.body
  if (raw == null) return {}
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as Record<string, unknown>
    } catch {
      badRequest('El cuerpo no es JSON valido')
    }
  }
  if (typeof raw !== 'object' || Array.isArray(raw)) badRequest('El cuerpo debe ser un objeto')
  return raw as Record<string, unknown>
}
