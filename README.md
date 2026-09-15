# GoGoBoy

App personal de productividad con tres vistas: **Hoy**, **Categorias** y **Semana**.

- **Hoy** — lista simple de lo que toca hoy (titulo, color de categoria y status, nada mas),
  con la columna de categorias a la derecha. Arrastra una tarea a Hoy para agendarla: la tarea
  se marca como "en Hoy" y **sigue viviendo en su categoria**.
- **Categorias** — mosaico tipo Pinterest; cada tarjeta es una categoria con su color pastel
  y sus tareas, con mas detalle (urgencia, deadline, progreso de subtareas).
- **Semana** — lunes a domingo, solo tareas con deadline. Arrastrar una tarjeta de un dia a
  otro cambia su deadline.

Dos FABs flotantes: **⚡** abre el checklist de tareas rapidas y **➕** el formulario completo.

Las tareas **no vencen solas**: lo que esta en Hoy se queda hasta que lo ocultes con el ojito.

## Stack

React + Vite + TypeScript, Neon Postgres, handlers HTTP en `server/` servidos por una
Vercel Function. Drag & drop con dnd-kit, datos con TanStack Query y mutaciones
optimistas.

## Puesta en marcha

```bash
npm install
cp .env.example .env        # pega la connection string de Neon en DATABASE_URL
npm run db:migrate          # crea las tablas
npm run dev                 # front en :5173, API en :3001
```

`npm run dev` levanta Vite y un servidor Express que monta los mismos handlers de `server/`
que la funcion de Vercel ejecuta en produccion, asi que no hace falta la CLI de Vercel.

## Comandos

| Comando | Que hace |
|---|---|
| `npm run dev` | Front + API en modo desarrollo |
| `npm run build` | Typecheck y build de produccion |
| `npm test` | Tests de Vitest (validacion de payloads, fechas) |
| `npm run db:migrate` | Aplica las migraciones pendientes de `db/migrations` |

## Deploy (Vercel)

El sitio es un build estatico de Vite mas dos Serverless Functions que exportan el
**mismo** handler (`server/lib/api-handler.ts`). Vercel fuera de Next no soporta
catch-all `[...path]`: un solo `api/[...path].ts` atiende `/api/categories` pero
responde `NOT_FOUND` en `/api/categories/:id`. Por eso:

- `api/[resource].ts` cubre un segmento (`/api/state`, `/api/tasks`, …)
- `api/[resource]/[id].ts` cubre dos (`/api/categories/:id`, `/api/uploads/sign`, …)

Para que el deploy funcione hay que cargar las variables de entorno en
**Project Settings -> Environment Variables**: `DATABASE_URL`, auth (`NEON_AUTH_URL`,
`AUTH_ALLOWED_EMAIL`) y, si queres adjuntos, las `S3_*`. Sin `DATABASE_URL` la
funcion responde 500 y la app muestra el error.

El `vercel.json` define el build (`npm run build` -> `dist`) y el fallback del SPA, para
que refrescar en `/semana` o `/categorias` no devuelva 404.

> Si agregas un endpoint en `server/`, sumalo a `server/lib/api-handler.ts`.
> El servidor de desarrollo reenvia todo `/api/*` a ese mismo handler.

## MCP (Grok y otros agentes)

`POST /api/mcp` es un servidor MCP JSON-RPC de **solo lectura** (hoy, semana, tareas,
notas). No usa el JWT del browser: va con `AUTH_AGENT_TOKEN` (Bearer). Ese token no
abre el resto de `/api`. Las notas tipo password no se exponen.

1. Generar un token (`openssl rand -hex 32`) y cargarlo en Vercel como `AUTH_AGENT_TOKEN`.
2. Cargar `GOGOBOY_TZ=America/Argentina/Buenos_Aires` (Vercel es UTC).
3. En [grok.com/connectors](https://grok.com/connectors) → Custom, URL
   `https://<tu-dominio>/api/mcp` y el mismo token como Authorization.

## Adjuntos

Los archivos van a un bucket S3-compatible via URL prefirmada (el navegador sube directo,
sin pasar por la funcion). Se configura con `S3_ENDPOINT`, `S3_BUCKET`, `S3_REGION`,
`S3_ACCESS_KEY_ID` y `S3_SECRET_ACCESS_KEY`. Sin esas variables la app funciona igual:
solo el boton de subir archivo responde que el almacenamiento no esta configurado.

Las variables se llaman `S3_*` y no `AWS_*` porque ese prefijo esta reservado en los
entornos serverless. Hoy apuntan a Neon Object Storage; cambiar a R2 o S3 es solo
cambiar esos valores.

## Estructura

```
server/           Handlers HTTP (los mismos en dev y en produccion)
  _lib/           Conexion a Neon, helpers HTTP, validacion, storage
  lib/            Adaptador Request/Response -> (req, res)
api/              Entradas de Vercel (un segmento y dos) hacia handleApi
db/migrations/    SQL versionado
scripts/          Servidor de desarrollo y runner de migraciones
src/
  app/            Shell, navegacion y host de modales
  components/     Modales, FABs, status toggle, iconos
  lib/            Cliente de API, cache de React Query, paleta, fechas
  views/          TodayView, CategoriesView, WeekView
  shared/types.ts Contrato compartido entre front y API
design/           Boceto original y referencias esteticas
```
