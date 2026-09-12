// Contrato compartido entre el front (src/) y la API (api/).
// Cambiar algo aca rompe la compilacion de los dos lados a la vez, que es justamente la idea.

export const URGENCIES = ['baja', 'media', 'alta'] as const
export type Urgency = (typeof URGENCIES)[number]

export const STATUSES = ['pendiente', 'en_progreso', 'hecha'] as const
export type Status = (typeof STATUSES)[number]

export interface Category {
  id: string
  name: string
  colorKey: string
  position: number
  createdAt: string
}

export interface Subtask {
  id: string
  taskId: string
  title: string
  done: boolean
  position: number
}

export interface TaskLink {
  id: string
  taskId: string
  url: string
  /** Titulo que escribio el usuario, o null: el front muestra el dominio en ese caso. */
  title: string | null
  position: number
}

export interface Attachment {
  id: string
  taskId: string
  objectKey: string
  fileName: string
  contentType: string
  sizeBytes: number
  createdAt: string
}

export interface Task {
  id: string
  categoryId: string | null
  title: string
  description: string | null
  notes: string | null
  urgency: Urgency
  /** Fecha en formato YYYY-MM-DD, o null si la tarea no tiene deadline. */
  deadline: string | null
  status: Status
  inToday: boolean
  hiddenInToday: boolean
  todayPosition: number | null
  position: number
  createdAt: string
  updatedAt: string
  completedAt: string | null
  subtasks: Subtask[]
  attachments: Attachment[]
  links: TaskLink[]
}

export interface QuickTask {
  id: string
  title: string
  done: boolean
  position: number
  createdAt: string
}

/** Respuesta de GET /api/state: todo el estado de la app en una sola llamada. */
export interface AppState {
  categories: Category[]
  tasks: Task[]
  quickTasks: QuickTask[]
  /** false = faltan las S3_*; el modal esconde los adjuntos en vez de fallar al subir. */
  storageConfigured: boolean
}

export interface CategoryInput {
  name: string
  colorKey: string
  position?: number
}

export interface TaskInput {
  title: string
  categoryId?: string | null
  description?: string | null
  notes?: string | null
  urgency?: Urgency
  deadline?: string | null
  status?: Status
  inToday?: boolean
  hiddenInToday?: boolean
  todayPosition?: number | null
  position?: number
}

export interface SubtaskInput {
  taskId: string
  title: string
  done?: boolean
  position?: number
}

export interface QuickTaskInput {
  title: string
  done?: boolean
  position?: number
}
