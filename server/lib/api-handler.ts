/**
 * Tabla unica de rutas de la API. La usan el servidor de desarrollo y las dos
 * entradas de Vercel (`api/[resource].ts` y `api/[resource]/[id].ts`).
 *
 * Vercel fuera de Next no implementa catch-all `[...path]`: un archivo
 * `api/[...path].ts` solo matchea UN segmento (`/api/categories` si, `/api/categories/:id`
 * no) y responde 404 de plataforma antes de llegar aca. Por eso hay dos archivos
 * de entrada que reexportan este mismo handler.
 *
 * Los imports son estaticos a proposito: el bundler de Vercel no puede seguir un
 * `import()` con variable, asi que un import dinamico dejaria los handlers fuera del
 * paquete y la funcion fallaria recien en produccion.
 */
import { createApiHandler, type Route } from './router.ts'

import state from '../state.ts'
import categories from '../categories/index.ts'
import categoryById from '../categories/[id].ts'
import tasks from '../tasks/index.ts'
import taskById from '../tasks/[id].ts'
import subtasks from '../subtasks/index.ts'
import subtaskById from '../subtasks/[id].ts'
import quickTasks from '../quick-tasks/index.ts'
import quickTaskById from '../quick-tasks/[id].ts'
import attachments from '../attachments/index.ts'
import attachmentById from '../attachments/[id].ts'
import links from '../links/index.ts'
import linkById from '../links/[id].ts'
import notes from '../notes/index.ts'
import noteById from '../notes/[id].ts'
import uploadsSign from '../uploads/sign.ts'

const routes: Route[] = [
  ['/api/state', state],
  ['/api/categories', categories],
  ['/api/categories/:id', categoryById],
  ['/api/tasks', tasks],
  ['/api/tasks/:id', taskById],
  ['/api/subtasks', subtasks],
  ['/api/subtasks/:id', subtaskById],
  ['/api/quick-tasks', quickTasks],
  ['/api/quick-tasks/:id', quickTaskById],
  ['/api/notes', notes],
  ['/api/notes/:id', noteById],
  ['/api/attachments', attachments],
  ['/api/attachments/:id', attachmentById],
  ['/api/links', links],
  ['/api/links/:id', linkById],
  ['/api/uploads/sign', uploadsSign],
]

export const handleApi = createApiHandler(routes)
