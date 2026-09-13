// Validacion de payloads. Funciones puras y sin dependencias de red: son las que
// cubren los tests de Vitest.

import { NOTE_KINDS, STATUSES, URGENCIES } from '../../src/shared/types.ts'
import type {
  CategoryInput,
  NoteInput,
  NoteKind,
  Status,
  TaskInput,
  Urgency,
} from '../../src/shared/types.ts'
import { HttpError } from './http.ts'

function fail(message: string): never {
  throw new HttpError(400, message)
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export function requiredText(value: unknown, field: string, max = 500): string {
  if (typeof value !== 'string') fail(`"${field}" debe ser texto`)
  const trimmed = value.trim()
  if (!trimmed) fail(`"${field}" no puede estar vacio`)
  if (trimmed.length > max) fail(`"${field}" supera los ${max} caracteres`)
  return trimmed
}

export function optionalText(value: unknown, field: string, max = 5000): string | null {
  if (value == null) return null
  if (typeof value !== 'string') fail(`"${field}" debe ser texto`)
  const trimmed = value.trim()
  if (!trimmed) return null
  if (trimmed.length > max) fail(`"${field}" supera los ${max} caracteres`)
  return trimmed
}

export function bool(value: unknown, field: string): boolean {
  if (typeof value !== 'boolean') fail(`"${field}" debe ser true o false`)
  return value
}

export function int(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) fail(`"${field}" debe ser un numero`)
  return Math.trunc(value)
}

export function nullableInt(value: unknown, field: string): number | null {
  return value == null ? null : int(value, field)
}

export function uuidOrNull(value: unknown, field: string): string | null {
  if (value == null) return null
  if (typeof value !== 'string' || !UUID_RE.test(value)) fail(`"${field}" debe ser un uuid valido`)
  return value
}

export function uuid(value: unknown, field: string): string {
  const result = uuidOrNull(value, field)
  if (!result) fail(`Falta "${field}"`)
  return result
}

/** Acepta 'YYYY-MM-DD' o null. Rechaza fechas imposibles como 2026-02-31. */
export function dateOrNull(value: unknown, field: string): string | null {
  if (value == null || value === '') return null
  if (typeof value !== 'string' || !DATE_RE.test(value)) {
    fail(`"${field}" debe tener formato YYYY-MM-DD`)
  }
  const [y, m, d] = value.split('-').map(Number)
  const parsed = new Date(Date.UTC(y, m - 1, d))
  if (
    parsed.getUTCFullYear() !== y ||
    parsed.getUTCMonth() !== m - 1 ||
    parsed.getUTCDate() !== d
  ) {
    fail(`"${field}" no es una fecha real: ${value}`)
  }
  return value
}

/**
 * Normaliza un link. Acepta que venga sin esquema ("drive.google.com/...") y le pone
 * https://, porque es lo que sale de copiar una barra de direcciones a medias.
 * Solo http y https: un `javascript:` guardado seria un XSS esperando a que alguien
 * lo toque desde la lista de adjuntos.
 */
export function httpUrl(value: unknown, field: string, max = 2000): string {
  if (typeof value !== 'string') fail(`"${field}" debe ser texto`)
  const trimmed = value.trim()
  if (!trimmed) fail(`"${field}" no puede estar vacio`)
  if (trimmed.length > max) fail(`"${field}" supera los ${max} caracteres`)

  const candidate = /^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`

  let parsed: URL
  try {
    parsed = new URL(candidate)
  } catch {
    fail(`"${field}" no es una URL valida`)
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    fail(`"${field}" solo puede ser http o https`)
  }
  if (!parsed.hostname) fail(`"${field}" no es una URL valida`)
  return parsed.toString()
}

export function urgency(value: unknown): Urgency {
  if (typeof value !== 'string' || !URGENCIES.includes(value as Urgency)) {
    fail(`"urgency" debe ser una de: ${URGENCIES.join(', ')}`)
  }
  return value as Urgency
}

export function status(value: unknown): Status {
  if (typeof value !== 'string' || !STATUSES.includes(value as Status)) {
    fail(`"status" debe ser una de: ${STATUSES.join(', ')}`)
  }
  return value as Status
}

export function parseCategoryInput(input: Record<string, unknown>): CategoryInput {
  return {
    name: requiredText(input.name, 'name', 60),
    colorKey: requiredText(input.colorKey, 'colorKey', 40),
    position: input.position == null ? undefined : int(input.position, 'position'),
  }
}

export function parseCategoryPatch(input: Record<string, unknown>): Partial<CategoryInput> {
  const patch: Partial<CategoryInput> = {}
  if ('name' in input) patch.name = requiredText(input.name, 'name', 60)
  if ('colorKey' in input) patch.colorKey = requiredText(input.colorKey, 'colorKey', 40)
  if ('position' in input) patch.position = int(input.position, 'position')
  if (Object.keys(patch).length === 0) fail('No hay nada para actualizar')
  return patch
}

export function parseTaskCreate(input: Record<string, unknown>): TaskInput {
  return {
    title: requiredText(input.title, 'title', 200),
    categoryId: uuidOrNull(input.categoryId, 'categoryId'),
    description: optionalText(input.description, 'description'),
    notes: optionalText(input.notes, 'notes'),
    urgency: input.urgency == null ? 'media' : urgency(input.urgency),
    deadline: dateOrNull(input.deadline, 'deadline'),
    status: input.status == null ? 'pendiente' : status(input.status),
    inToday: input.inToday == null ? false : bool(input.inToday, 'inToday'),
  }
}

/** Solo devuelve las claves presentes en el payload: distingue "no tocar" de "poner en null". */
export function parseTaskPatch(input: Record<string, unknown>): Partial<TaskInput> {
  const patch: Partial<TaskInput> = {}
  if ('title' in input) patch.title = requiredText(input.title, 'title', 200)
  if ('categoryId' in input) patch.categoryId = uuidOrNull(input.categoryId, 'categoryId')
  if ('description' in input) patch.description = optionalText(input.description, 'description')
  if ('notes' in input) patch.notes = optionalText(input.notes, 'notes')
  if ('urgency' in input) patch.urgency = urgency(input.urgency)
  if ('deadline' in input) patch.deadline = dateOrNull(input.deadline, 'deadline')
  if ('status' in input) patch.status = status(input.status)
  if ('inToday' in input) patch.inToday = bool(input.inToday, 'inToday')
  if ('hiddenInToday' in input) patch.hiddenInToday = bool(input.hiddenInToday, 'hiddenInToday')
  if ('todayPosition' in input) {
    patch.todayPosition = nullableInt(input.todayPosition, 'todayPosition')
  }
  if ('position' in input) patch.position = int(input.position, 'position')
  if (Object.keys(patch).length === 0) fail('No hay nada para actualizar')
  return patch
}

const MAX_TAGS = 20
const MAX_TAG_LEN = 40

/**
 * Etiquetas de notas: se crean al vuelo. Recorta, salta vacios, deduplica
 * sin importar mayusculas y se queda con la primera capitalizacion.
 */
export function parseTagNames(value: unknown, field = 'tags'): string[] {
  if (value == null) return []
  if (!Array.isArray(value)) fail(`"${field}" debe ser una lista`)
  if (value.length > MAX_TAGS) fail(`"${field}" admite como maximo ${MAX_TAGS} etiquetas`)

  const result: string[] = []
  const seen = new Set<string>()
  for (let index = 0; index < value.length; index++) {
    const raw = value[index]
    if (raw == null) continue
    if (typeof raw !== 'string') fail(`"${field}[${index}]" debe ser texto`)
    const trimmed = raw.trim()
    if (!trimmed) continue
    if (trimmed.length > MAX_TAG_LEN) {
      fail(`"${field}[${index}]" supera los ${MAX_TAG_LEN} caracteres`)
    }
    const key = trimmed.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    result.push(trimmed)
  }
  return result
}

function parseNoteKind(value: unknown): NoteKind {
  if (value == null) return 'note'
  if (typeof value !== 'string' || !(NOTE_KINDS as readonly string[]).includes(value)) {
    fail('"kind" debe ser note o password')
  }
  return value as NoteKind
}

export function parseNoteCreate(input: Record<string, unknown>): NoteInput {
  const kind = parseNoteKind(input.kind)
  const title = requiredText(input.title, 'title', 200)

  if (kind === 'password') {
    return {
      title,
      kind,
      description: null,
      username: optionalText(input.username, 'username', 200),
      password: requiredText(input.password, 'password', 2000),
      tags: [],
    }
  }

  return {
    title,
    kind,
    description: optionalText(input.description, 'description'),
    username: null,
    password: null,
    tags: parseTagNames(input.tags),
  }
}

export function parseNotePatch(input: Record<string, unknown>): Partial<NoteInput> {
  if ('kind' in input) fail('No se puede cambiar el tipo de una nota')

  const patch: Partial<NoteInput> = {}
  if ('title' in input) patch.title = requiredText(input.title, 'title', 200)
  if ('description' in input) patch.description = optionalText(input.description, 'description')
  if ('username' in input) patch.username = optionalText(input.username, 'username', 200)
  if ('password' in input) patch.password = requiredText(input.password, 'password', 2000)
  if ('tags' in input) patch.tags = parseTagNames(input.tags)
  if (Object.keys(patch).length === 0) fail('No hay nada para actualizar')
  return patch
}
