# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Proyecto

GoGoBoy: app personal de productividad (un solo usuario, sin `user_id` en las tablas). React + Vite + TypeScript, Neon Postgres, handlers HTTP en `server/`, deploy en Vercel. El acceso se cierra con Neon Auth: JWT en `/api` + allowlist `AUTH_ALLOWED_EMAIL`.

**El código, los comentarios y la UI están en español.** Los comentarios explican el *por qué* de una decisión, no el *qué* hace la línea. Mantené ese registro al escribir código nuevo.

## Comandos

```bash
npm run dev          # Vite en :5173 + API Express en :3001 (concurrently)
npm run build        # tsc -b && vite build — el typecheck es parte del build
npm test             # vitest run
npm run test:watch   # vitest en watch
npm run db:migrate   # aplica db/migrations pendientes
```

Un solo test: `npx vitest run src/lib/dates.test.ts` (o `npx vitest run -t "nombre del caso"`).

No hay linter configurado; `tsc -b` con `strict`, `noUnusedLocals` y `noUnusedParameters` es la única puerta.

Necesita `.env` con `DATABASE_URL`, `VITE_NEON_AUTH_URL` y `AUTH_ALLOWED_EMAIL` (copiar de `.env.example`). `server/_lib/db.ts` arma el cliente en el primer query; si falta, el handler responde 500 JSON (no tira al importar). Sin JWT válido o con un email fuera de la allowlist, `/api` responde 401/403.

## Arquitectura

### Los mismos handlers en dev y en producción

`server/` contiene handlers con firma `(req, res)` estilo Express. Corren en dos lugares sin modificarse:

- **Dev**: `scripts/dev-server.ts` reenvía todo `/api/*` a `handleApi`; Vite proxea `/api` a `:3001`.
- **Prod**: Vercel (fuera de Next) **no** implementa catch-all `[...path]`. Un único `api/[...path].ts` solo matchea un segmento (`/api/categories` sí, `/api/categories/:id` no) y Vercel responde `NOT_FOUND` antes de ejecutar código. Hay DOS entradas que exportan el mismo handler:
  - `api/[resource].ts` → `/api/state`, `/api/categories`, `/api/tasks`, …
  - `api/[resource]/[id].ts` → `/api/categories/:id`, `/api/uploads/sign`, …
  El ruteo interno vive en `server/lib/api-handler.ts`; `server/lib/router.ts` adapta el `Request`/`Response` del estándar web a `(req, res)`.

> **Al agregar un endpoint hay que sumarlo a `server/lib/api-handler.ts`.** Los imports ahí deben ser estáticos — el bundler de Vercel no sigue `import()` con variable y el handler quedaría fuera del paquete, fallando recién en producción.

Cada handler se arma con `route({ GET, POST, PATCH, DELETE })` de `server/_lib/http.ts`, que centraliza el 405, el OPTIONS y la conversión de `HttpError` a respuesta. Para cortar con un error: `badRequest(msg)` / `notFound(msg)` / `throw new HttpError(status, msg)`.

### Contrato compartido

`src/shared/types.ts` es el único tipo compartido entre front y API — está incluido en los dos proyectos de TS (`tsconfig.app.json` y `tsconfig.node.json`), así que romperlo rompe la compilación de ambos lados a la vez, que es la intención.

**Convención de imports por proyecto**: `api/`, `server/` y `scripts/` importan con extensión explícita (`'../_lib/http.ts'`); `src/` importa sin extensión. No mezclar.

### La base y el front hablan distinto

La base usa `snake_case`, el front `camelCase`. Los mappers de `server/_lib/db.ts` (`mapTask`, `mapCategory`, …) son la **única** frontera donde se traduce: ningún componente ve nombres de columnas. `loadTask(id)` trae una tarea completa con subtareas y adjuntos ya mapeada.

### Estado del front: un solo cache

`src/lib/store.ts` mantiene un único query key `['state']` con todo (`GET /api/state` devuelve categorías + tareas + quick tasks en una llamada). Todas las mutaciones pasan por el helper `useOptimistic`: snapshot → parche en cache → request → rollback en `onError` → `invalidateQueries` en `onSettled`. Por eso soltar una tarjeta se siente instantáneo.

Cuando el parche optimista tiene que replicar una regla del servidor, esa regla queda escrita en los dos lados (ej.: sacar de Hoy también des-oculta y limpia `todayPosition`, en `store.ts` y en `server/tasks/[id].ts`). Si cambiás una, cambiá la otra.

`PATCH /api/tasks/:id` lee la tarea, mezcla el patch en memoria y reescribe todas las columnas. Es una query extra pero evita concatenar nombres de columnas en SQL y distingue "no mandaron el campo" de "lo mandaron en null" — eso último lo garantiza `parseTaskPatch`, que solo copia las claves presentes con `'x' in input`.

### Reglas de dominio que no son obvias

- **Las tareas no vencen solas.** Nada limpia `in_today` al cambiar el día; lo que está en Hoy se queda hasta que se oculte con el ojito (`hidden_in_today`). Ocultar NO desmarca `in_today`.
- Una tarea "en Hoy" **sigue viviendo en su categoría**; `in_today` es una marca, no una mudanza.
- Borrar una categoría no borra sus tareas: la FK es `on delete set null`. Subtareas y adjuntos sí caen por `on delete cascade`.
- En Semana, arrastrar una tarjeta de un día a otro **es** cambiar el `deadline`. Solo se ven tareas con deadline.

### Drag & drop

dnd-kit, con un `DndContext` por vista (`TodayView`, `WeekView`) que resuelve todo en `handleDragEnd` disparando un `updateTask.mutate`. No hay estado de drag compartido entre vistas.

### Color y tema

Las categorías guardan la **clave** del color (`colorKey`), nunca el hex. `src/lib/palette.ts` resuelve clave + tema → `{ bg, soft, dot, ink }`; un color desconocido cae en el primero de la paleta en vez de romper. El tema vive en contexto (`src/app/theme.tsx`) además del atributo `data-theme` del `<html>`, porque los colores de categoría se aplican como estilos inline desde JS y los componentes necesitan saber qué variante pintar. El resto del color sale de tokens CSS (`src/styles/tokens.css`).

### Fechas

Los deadlines son **días calendario** (`'YYYY-MM-DD'`), no instantes. `src/lib/dates.ts` trabaja siempre con las partes locales de `Date` y nunca con `toISOString()`, que convierte a UTC y corre el día. Del lado del servidor, `toDateString` en `server/_lib/db.ts` usa las partes UTC del `Date` que devuelve Postgres. No mezclar los dos criterios.

### Migraciones

`db/migrations/*.sql` versionado, aplicado en orden alfabético por `scripts/migrate.ts`, que anota cada archivo en `_migrations` (re-ejecutar es seguro). El driver HTTP de Neon manda una sentencia por request, así que el runner separa el archivo por `;\n` — evitá sentencias que dependan de ejecutarse en el mismo batch.

### Adjuntos

Subida directa del navegador al bucket vía URL prefirmada (`POST /api/uploads/sign` → PUT al bucket → `POST /api/attachments`). Las variables se llaman `S3_*` y no `AWS_*` porque ese prefijo está reservado en entornos serverless. Sin esas variables la app funciona igual: `storageConfigured` es `false` y los endpoints de storage responden 503 con un mensaje explicativo.
