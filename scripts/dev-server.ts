/**
 * Servidor de desarrollo. Monta los mismos handlers de server/ que la funcion de Vercel
 * sirve en produccion, asi no hace falta la CLI de Vercel para trabajar en local.
 * Vite proxea /api aca (ver vite.config.ts).
 */
import 'dotenv/config'
import express from 'express'
import type { ErrorRequestHandler } from 'express'
import type { Handler } from '../server/_lib/http.ts'

const PORT = Number(process.env.API_PORT ?? 3001)

const app = express()
app.use(express.json({ limit: '1mb' }))

/**
 * Cada entrada refleja un archivo de server/; el `:id` de Express se copia a req.query.id.
 * Si agregas una ruta aca, agregala tambien en api/[...path].ts.
 */
const routes: Array<[path: string, module: string]> = [
  ['/api/state', '../server/state.ts'],
  ['/api/categories', '../server/categories/index.ts'],
  ['/api/categories/:id', '../server/categories/[id].ts'],
  ['/api/tasks', '../server/tasks/index.ts'],
  ['/api/tasks/:id', '../server/tasks/[id].ts'],
  ['/api/subtasks', '../server/subtasks/index.ts'],
  ['/api/subtasks/:id', '../server/subtasks/[id].ts'],
  ['/api/quick-tasks', '../server/quick-tasks/index.ts'],
  ['/api/quick-tasks/:id', '../server/quick-tasks/[id].ts'],
  ['/api/attachments', '../server/attachments/index.ts'],
  ['/api/attachments/:id', '../server/attachments/[id].ts'],
  ['/api/links', '../server/links/index.ts'],
  ['/api/links/:id', '../server/links/[id].ts'],
  ['/api/uploads/sign', '../server/uploads/sign.ts'],
]

for (const [path, modulePath] of routes) {
  app.all(path, async (req, res, next) => {
    try {
      const mod = (await import(modulePath)) as { default: Handler }
      await mod.default(
        {
          method: req.method,
          url: req.originalUrl,
          query: { ...req.query, ...req.params } as Record<string, string>,
          body: req.body,
          headers: req.headers as Record<string, string>,
        },
        res as never,
      )
    } catch (error) {
      next(error)
    }
  })
}

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
