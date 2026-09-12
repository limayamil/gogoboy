/**
 * Punto de entrada unico de la API en Vercel. Una sola funcion catch-all atiende toda
 * la familia /api/* y reparte con la tabla de rutas de abajo, equivalente al ruteo del
 * servidor de desarrollo.
 *
 * Los imports son estaticos a proposito: el bundler de Vercel no puede seguir un
 * `import()` con variable, asi que un import dinamico dejaria los handlers fuera del
 * paquete y la funcion fallaria recien en produccion.
 */
import { createApiHandler, type Route } from '../server/lib/router.ts'

import state from '../server/state.ts'
import categories from '../server/categories/index.ts'
import categoryById from '../server/categories/[id].ts'
import tasks from '../server/tasks/index.ts'
import taskById from '../server/tasks/[id].ts'
import subtasks from '../server/subtasks/index.ts'
import subtaskById from '../server/subtasks/[id].ts'
import quickTasks from '../server/quick-tasks/index.ts'
import quickTaskById from '../server/quick-tasks/[id].ts'
import attachments from '../server/attachments/index.ts'
import attachmentById from '../server/attachments/[id].ts'
import links from '../server/links/index.ts'
import linkById from '../server/links/[id].ts'
import uploadsSign from '../server/uploads/sign.ts'

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
  ['/api/attachments', attachments],
  ['/api/attachments/:id', attachmentById],
  ['/api/links', links],
  ['/api/links/:id', linkById],
  ['/api/uploads/sign', uploadsSign],
]

export default createApiHandler(routes)
