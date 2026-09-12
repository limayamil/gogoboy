/**
 * Adaptador entre las serverless functions (Request/Response del estandar web) y los
 * handlers de server/, que usan la firma (req, res) de Node. Gracias a esto los mismos
 * handlers corren en el servidor de desarrollo y en produccion sin tocarlos.
 */
import type { ApiRequest, ApiResponse, Handler } from '../_lib/http.ts'

/** Ruta declarada como patron: los segmentos que empiezan con ':' son dinamicos. */
export type Route = [pattern: string, handler: Handler]

/**
 * Junta la respuesta que el handler va escribiendo para poder devolverla despues como
 * un Response. No hace falta esperar ninguna senal extra: `route()` espera al handler
 * antes de terminar, asi que cuando el await vuelve ya esta todo escrito.
 */
class ResponseCollector implements ApiResponse {
  private statusCode = 200
  private payload: string | undefined
  readonly headers = new Headers()

  status(code: number): ApiResponse {
    this.statusCode = code
    return this
  }

  json(payload: unknown): void {
    this.headers.set('content-type', 'application/json; charset=utf-8')
    this.payload = JSON.stringify(payload)
  }

  send(payload?: unknown): void {
    if (payload == null) return
    if (typeof payload === 'string') {
      if (!this.headers.has('content-type')) {
        this.headers.set('content-type', 'text/plain; charset=utf-8')
      }
      this.payload = payload
      return
    }
    this.json(payload)
  }

  setHeader(name: string, value: string): void {
    this.headers.set(name, value)
  }

  end(): void {}

  toResponse(): Response {
    // 204 y 304 no admiten cuerpo; el resto pasa null cuando el handler no escribio nada.
    const bodyless = this.statusCode === 204 || this.statusCode === 304
    return new Response(bodyless ? null : (this.payload ?? null), {
      status: this.statusCode,
      headers: this.headers,
    })
  }
}

/** Devuelve los parametros de la ruta si el patron coincide con el path, o null si no. */
function match(pattern: string, pathname: string): Record<string, string> | null {
  const expected = pattern.split('/')
  const actual = pathname.split('/')
  if (expected.length !== actual.length) return null

  const params: Record<string, string> = {}
  for (const [index, segment] of expected.entries()) {
    if (segment.startsWith(':')) {
      if (!actual[index]) return null
      params[segment.slice(1)] = decodeURIComponent(actual[index])
      continue
    }
    if (segment !== actual[index]) return null
  }
  return params
}

async function toApiRequest(
  request: Request,
  params: Record<string, string>,
  url: URL,
): Promise<ApiRequest> {
  // El body llega como texto: `body()` de server/_lib/http.ts ya sabe parsear JSON, y un
  // cuerpo vacio se manda como undefined para que lo lea como "sin cuerpo" y no como
  // JSON invalido.
  const raw = request.method === 'GET' || request.method === 'HEAD' ? '' : await request.text()

  return {
    method: request.method,
    url: url.pathname + url.search,
    query: { ...Object.fromEntries(url.searchParams), ...params },
    body: raw === '' ? undefined : raw,
    headers: Object.fromEntries(request.headers) as Record<string, string>,
  }
}

/** Arma el handler serverless que resuelve toda la familia /api/*. */
export function createApiHandler(routes: Route[]) {
  return async (request: Request): Promise<Response> => {
    const url = new URL(request.url)

    for (const [pattern, handler] of routes) {
      const params = match(pattern, url.pathname)
      if (!params) continue

      const res = new ResponseCollector()
      await handler(await toApiRequest(request, params, url), res)
      return res.toResponse()
    }

    return Response.json(
      { error: `Sin ruta para ${request.method} ${url.pathname}` },
      { status: 404 },
    )
  }
}
