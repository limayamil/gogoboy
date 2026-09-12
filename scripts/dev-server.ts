/**
 * Servidor de desarrollo. Reenvia todo `/api/*` al mismo handler que las entradas
 * de Vercel (`server/lib/api-handler.ts`), asi agregar un endpoint es tocarlo ahi
 * y no en dos tablas de rutas.
 */
import 'dotenv/config'
import express from 'express'
import type { ErrorRequestHandler, Request as ExpressRequest } from 'express'
import { handleApi } from '../server/lib/api-handler.ts'

const PORT = Number(process.env.API_PORT ?? 3001)

const app = express()
app.use(express.json({ limit: '1mb' }))

function toWebRequest(req: ExpressRequest): Request {
  const url = new URL(req.originalUrl, `http://127.0.0.1:${PORT}`)
  const headers = new Headers()
  for (const [key, value] of Object.entries(req.headers)) {
    if (value == null) continue
    if (Array.isArray(value)) {
      for (const item of value) headers.append(key, item)
    } else {
      headers.set(key, value)
    }
  }
  // El body lo rearmamos nosotros; el content-length original no coincide.
  headers.delete('content-length')

  const method = req.method
  const hasBody = method !== 'GET' && method !== 'HEAD'
  return new Request(url, {
    method,
    headers,
    body: hasBody ? JSON.stringify(req.body ?? {}) : undefined,
  })
}

app.use(async (req, res, next) => {
  if (!req.path.startsWith('/api')) {
    next()
    return
  }

  try {
    const response = await handleApi(toWebRequest(req))
    res.status(response.status)
    response.headers.forEach((value, name) => {
      res.setHeader(name, value)
    })
    const buf = Buffer.from(await response.arrayBuffer())
    res.end(buf.length ? buf : undefined)
  } catch (error) {
    next(error)
  }
})

app.use((req, res) => {
  res.status(404).json({ error: `Sin ruta para ${req.method} ${req.path}` })
})

// Sin esto Express responde su pagina HTML de error, que el cliente no puede leer
// y termina mostrando un "Error 500" generico en vez del motivo real.
const onError: ErrorRequestHandler = (error, _req, res, _next) => {
  console.error('[api]', error)
  res.status(500).json({ error: error instanceof Error ? error.message : 'Error desconocido' })
}
app.use(onError)

app.listen(PORT, () => {
  console.log(`[api] escuchando en http://localhost:${PORT}`)
})
