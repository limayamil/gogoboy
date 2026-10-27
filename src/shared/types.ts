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
  /** Duenio: exactamente uno de los dos, el otro queda en null. */
  taskId: string | null
  noteId: string | null
  objectKey: string
  fileName: string
  contentType: string
  sizeBytes: number
  createdAt: string
}

export interface NoteTag {
  id: string
  name: string
}

export const NOTE_KINDS = ['note', 'password'] as const
export type NoteKind = (typeof NOTE_KINDS)[number]

/** Tope de description (HTML). El markup es mas verboso que el texto plano de 5000. */
export const RICH_TEXT_MAX = 20_000

export interface Note {
  id: string
  kind: NoteKind
  title: string
  description: string | null
  username: string | null
  password: string | null
  createdAt: string
  updatedAt: string
  tags: NoteTag[]
  attachments: Attachment[]
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
  /**
   * Hecha cuya semana (lunes–domingo) ya termino. Distinto de `hiddenInToday`:
   * no es el ojito, es para que las completadas no se acumulen en Hoy/Categorias.
   */
  expired: boolean
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

/**
 * Propuesta del bot, todavia no es una tarea. Vive en su tabla: si fuera una
 * fila de `tasks`, un filtro olvidado la meteria en Hoy o en Semana.
 * Aceptar o tirar borra la fila; no hay estado "aceptada".
 */
export interface Proposal {
  id: string
  title: string
  description: string | null
  urgency: Urgency
  /** Fecha sugerida, YYYY-MM-DD, o null. */
  deadline: string | null
  /** Nombre sugerido, exista o no la categoria. */
  categoryName: string | null
  /** Solo si el bot la vio en `categorias`. No autoriza a crearla. */
  categoryId: string | null
  origen: string | null
  origenUrl: string | null
  origenClave: string | null
  createdAt: string
  updatedAt: string
}

/** Lo que manda el paso Tomar. Las claves ausentes no pisan el default del servidor. */
export interface TakeProposalInput {
  categoryId?: string | null
  categoryName?: string | null
  deadline?: string | null
  inToday?: boolean
}

export interface TakeProposalResult {
  task: Task
  /** Categoria recien creada, o null si se reutilizo una o la tarea quedo sin categoria. */
  category: Category | null
}

/** Respuesta de GET /api/state: todo el estado de la app en una sola llamada. */
export interface AppState {
  categories: Category[]
  tasks: Task[]
  notes: Note[]
  quickTasks: QuickTask[]
  proposals: Proposal[]
  /** false = faltan las S3_*; el modal esconde los adjuntos en vez de fallar al subir. */
  storageConfigured: boolean
  /** Firma de estos datos. El front la compara contra GET /api/version para avisar
   *  que hay novedades cargadas desde otro dispositivo o desde el MCP. */
  version: string
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

export interface NoteInput {
  title: string
  kind?: NoteKind
  description?: string | null
  username?: string | null
  password?: string | null
  /** Nombres, no ids: el servidor hace upsert de la etiqueta. */
  tags?: string[]
}

/**
 * Zona de las Meets del día. Fija a propósito: ni la del navegador ni GOGOBOY_TZ.
 * Argentina no tiene horario de verano, así que es siempre GMT-3.
 */
export const MEETS_TIME_ZONE = 'America/Argentina/Buenos_Aires'

/** Calendario de Google tal como lo ve el front: la dirección secreta nunca vuelve. */
export interface MeetCalendar {
  id: string
  name: string
  colorKey: string
  /** Para reconocerla, no para usarla: `calendar.google.com/…/private-••••a1b2/basic.ics`. */
  maskedUrl: string
  position: number
  createdAt: string
}

export interface MeetCalendarInput {
  name: string
  colorKey: string
  icalUrl: string
}

export type MeetResponse = 'si' | 'no' | 'tal_vez' | 'sin_responder'

export interface MeetPerson {
  name: string | null
  email: string | null
}

export interface MeetAttendee extends MeetPerson {
  response: MeetResponse
}

export interface MeetAttachment {
  title: string
  url: string
}

export interface MeetEvent {
  /** Único por ocurrencia: una serie repite uid pero no inicio. */
  id: string
  calendarId: string
  title: string
  /** ISO en UTC. En un evento de todo el día es la medianoche GMT-3 de su primer día. */
  start: string
  end: string
  allDay: boolean
  location: string | null
  /** Texto plano: el HTML del feed se convierte en el servidor y los links se arman en el front. */
  description: string | null
  meetUrl: string | null
  organizer: MeetPerson | null
  attendees: MeetAttendee[]
  attachments: MeetAttachment[]
}

export interface MeetCalendarStatus {
  id: string
  name: string
  colorKey: string
  /** null si el feed cargó; si no, el motivo para mostrar al lado del nombre. */
  error: string | null
}

export interface MeetsToday {
  /** 'YYYY-MM-DD' en MEETS_TIME_ZONE. */
  date: string
  events: MeetEvent[]
  calendars: MeetCalendarStatus[]
}
