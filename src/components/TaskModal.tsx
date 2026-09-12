import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Modal } from './Modal'
import {
  IconChevronDown,
  IconClose,
  IconFile,
  IconImage,
  IconLink,
  IconPlus,
  IconSpinner,
  IconSun,
  IconTrash,
  IconUpload,
} from './Icons'
import { api } from '../lib/api'
import { addDays, formatShortDate, toDateKey, todayKey } from '../lib/dates'
import { compressImage } from '../lib/image'
import { useColorOf } from '../lib/palette'
import { errorMessage, toastError } from '../lib/toast'
import {
  useAppState,
  useCreateLink,
  useCreateSubtask,
  useCreateTask,
  useDeleteLink,
  useDeleteSubtask,
  useDeleteTask,
  useRefreshState,
  useUpdateSubtask,
  useUpdateTask,
} from '../lib/store'
import { STATUSES, URGENCIES, type Status, type TaskLink, type Urgency } from '../shared/types'
import styles from './TaskModal.module.css'

export interface TaskModalRequest {
  /** null = crear una tarea nueva. */
  taskId: string | null
  defaults?: { categoryId?: string | null; inToday?: boolean; deadline?: string | null }
}

const URGENCY_LABEL: Record<Urgency, string> = { baja: 'Baja', media: 'Media', alta: 'Alta' }
const STATUS_LABEL: Record<Status, string> = {
  pendiente: 'Pendiente',
  en_progreso: 'En progreso',
  hecha: 'Hecha',
}

/** Solo imagenes y PDF: es lo unico que la app sabe previsualizar y abrir. */
const ACCEPT = 'image/*,application/pdf'
const MAX_BYTES = 25 * 1024 * 1024

const isImage = (type: string) => type.startsWith('image/')
const allowed = (file: File) => isImage(file.type) || file.type === 'application/pdf'

/**
 * Un archivo elegido pero todavia no subido. Al crear una tarea no hay `taskId`, y el
 * bucket lo necesita para armar la clave (`buildObjectKey`), asi que los archivos
 * esperan en el navegador hasta que la tarea existe.
 */
interface DraftFile {
  key: string
  file: File
  /** objectURL para la miniatura; hay que revocarlo al sacarlo o al desmontar. */
  preview: string | null
  progress: number
  done: boolean
  error: string | null
}

interface DraftLink {
  key: string
  url: string
  title: string | null
}

const uid = () => Math.random().toString(36).slice(2)

/** Reconoce una URL pegada, con o sin esquema. Pide un punto y nada de espacios. */
function looksLikeUrl(text: string): boolean {
  if (/\s/.test(text)) return false
  if (/^https?:\/\/\S+$/i.test(text)) return true
  return /^[\w-]+(\.[\w-]+)+(\/\S*)?$/.test(text)
}

/** Mismo criterio que `httpUrl` en api/_lib/validate.ts, para que el borrador se vea
 *  igual que lo que va a quedar guardado. */
function normalizeUrl(raw: string): string {
  const trimmed = raw.trim()
  return /^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`
}

function linkTitle(link: { url: string; title: string | null }): string {
  if (link.title) return link.title
  try {
    return new URL(link.url).hostname.replace(/^www\./, '')
  } catch {
    return link.url
  }
}

function linkSubtitle(url: string): string {
  try {
    const parsed = new URL(url)
    return `${parsed.hostname.replace(/^www\./, '')}${parsed.pathname}${parsed.search}`.replace(
      /\/$/,
      '',
    )
  } catch {
    return url
  }
}

/**
 * PUT al bucket con XHR en vez de fetch: fetch no reporta progreso de subida, y sin
 * progreso una foto de 8 MB parece que colgo.
 */
function putFile(url: string, file: File, onProgress: (fraction: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', url)
    xhr.setRequestHeader('content-type', file.type || 'application/octet-stream')
    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable) onProgress(event.loaded / event.total)
    })
    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve()
      else reject(new Error(`El bucket rechazó la subida (${xhr.status})`))
    })
    xhr.addEventListener('error', () => reject(new Error('No se pudo conectar con el bucket')))
    xhr.addEventListener('abort', () => reject(new Error('Subida cancelada')))
    xhr.send(file)
  })
}

export function TaskModal({ request, onClose }: { request: TaskModalRequest; onClose: () => void }) {
  const { data } = useAppState()
  const categories = data?.categories ?? []
  const task = request.taskId ? data?.tasks.find((t) => t.id === request.taskId) : undefined
  const isEdit = Boolean(task)

  const createTask = useCreateTask()
  const updateTask = useUpdateTask()
  const deleteTask = useDeleteTask()
  const createSubtask = useCreateSubtask()
  const updateSubtask = useUpdateSubtask()
  const deleteSubtask = useDeleteSubtask()
  const createLink = useCreateLink()
  const deleteLink = useDeleteLink()
  const refreshState = useRefreshState()
  const colorOf = useColorOf()

  const [form, setForm] = useState(() => ({
    title: task?.title ?? '',
    categoryId: task?.categoryId ?? request.defaults?.categoryId ?? null,
    urgency: task?.urgency ?? ('media' as Urgency),
    deadline: task?.deadline ?? request.defaults?.deadline ?? '',
    description: task?.description ?? '',
    notes: task?.notes ?? '',
    status: task?.status ?? ('pendiente' as Status),
    inToday: task?.inToday ?? request.defaults?.inToday ?? false,
  }))

  const [draftSubtasks, setDraftSubtasks] = useState<string[]>([])
  const [draftFiles, setDraftFiles] = useState<DraftFile[]>([])
  const [draftLinks, setDraftLinks] = useState<DraftLink[]>([])
  const [subtaskDraft, setSubtaskDraft] = useState('')
  const [linkDraft, setLinkDraft] = useState('')
  const [showLinkInput, setShowLinkInput] = useState(false)
  const [showCalendar, setShowCalendar] = useState(false)
  const [details, setDetails] = useState(isEdit)
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fileInput = useRef<HTMLInputElement>(null)
  const dragDepth = useRef(0)
  const linkInput = useRef<HTMLInputElement>(null)

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  const subtasks = useMemo(() => task?.subtasks ?? [], [task])
  const savedLinks = useMemo(() => task?.links ?? [], [task])

  const presets = useMemo(() => {
    const now = new Date()
    return [
      { key: 'hoy', label: 'Hoy', value: todayKey() },
      { key: 'manana', label: 'Mañana', value: toDateKey(addDays(now, 1)) },
      { key: 'semana', label: 'En una semana', value: toDateKey(addDays(now, 7)) },
    ]
  }, [])

  const customDate = Boolean(form.deadline) && !presets.some((p) => p.value === form.deadline)

  // --- Adjuntos -----------------------------------------------------------

  /** Sin las S3_* no hay bucket; los links, en cambio, funcionan igual. */
  const storageOn = data?.storageConfigured ?? true

  // Los objectURL de las miniaturas no se liberan solos.
  const draftFilesRef = useRef(draftFiles)
  draftFilesRef.current = draftFiles
  useEffect(
    () => () => {
      for (const draft of draftFilesRef.current) {
        if (draft.preview) URL.revokeObjectURL(draft.preview)
      }
    },
    [],
  )

  // useRefreshState devuelve una funcion nueva en cada render; por el ref, las
  // callbacks de abajo no se recrean (y el listener de paste no se resuscribe).
  const refreshRef = useRef(refreshState)
  refreshRef.current = refreshState

  /** Sube un archivo al bucket y lo registra. Devuelve el mensaje de error, o null. */
  const uploadOne = useCallback(
    async (taskId: string, draft: DraftFile): Promise<string | null> => {
      try {
        // Las imagenes viajan como WebP redimensionado: lo que se firma, se sube y se
        // registra es este archivo, no el que eligio el usuario. La miniatura del
        // borrador sigue saliendo del original, que ya esta en pantalla.
        const file = await compressImage(draft.file)
        const contentType = file.type || 'application/octet-stream'
        const { objectKey, uploadUrl } = await api.signUpload({
          taskId,
          fileName: file.name,
          contentType,
        })
        await putFile(uploadUrl, file, (fraction) => {
          setDraftFiles((prev) =>
            prev.map((d) => (d.key === draft.key ? { ...d, progress: fraction } : d)),
          )
        })
        await api.createAttachment({
          taskId,
          objectKey,
          fileName: file.name,
          contentType,
          sizeBytes: file.size,
        })
        setDraftFiles((prev) =>
          prev.map((d) => (d.key === draft.key ? { ...d, progress: 1, done: true } : d)),
        )
        return null
      } catch (caught) {
        const message = errorMessage(caught)
        setDraftFiles((prev) =>
          prev.map((d) => (d.key === draft.key ? { ...d, error: message } : d)),
        )
        return message
      }
    },
    [],
  )

  /**
   * Sube una tanda y saca del borrador las que salieron bien: esas ya viven en
   * `task.attachments`. Las que fallaron se quedan a la vista con su error.
   */
  const uploadDrafts = useCallback(
    async (taskId: string, drafts: DraftFile[]): Promise<string[]> => {
      setUploading(true)
      const failures: string[] = []
      for (const draft of drafts) {
        const failure = await uploadOne(taskId, draft)
        if (failure) failures.push(`“${draft.file.name}” (${failure})`)
      }
      await refreshRef.current()
      setDraftFiles((prev) => {
        for (const d of prev) {
          if (d.done && d.preview) URL.revokeObjectURL(d.preview)
        }
        return prev.filter((d) => !d.done)
      })
      setUploading(false)
      return failures
    },
    [uploadOne],
  )

  const addFiles = useCallback(
    (incoming: File[]) => {
      if (!storageOn) {
        setError(
          'Para adjuntar archivos faltan las variables S3_* en el .env. Los links andan igual.',
        )
        return
      }

      const usable: File[] = []
      for (const file of incoming) {
        if (!allowed(file)) {
          setError(`“${file.name}” no es una imagen ni un PDF`)
          continue
        }
        if (file.size > MAX_BYTES) {
          setError(`“${file.name}” pasa los 25 MB`)
          continue
        }
        usable.push(file)
      }
      if (usable.length === 0) return

      const drafts: DraftFile[] = usable.map((file) => ({
        key: uid(),
        file,
        preview: isImage(file.type) ? URL.createObjectURL(file) : null,
        progress: 0,
        done: false,
        error: null,
      }))
      setDetails(true)
      setDraftFiles((prev) => [...prev, ...drafts])

      // En edicion la tarea ya existe, asi que el bucket ya acepta la clave: suben solos.
      if (task) void uploadDrafts(task.id, drafts)
    },
    [storageOn, task, uploadDrafts],
  )

  const addLink = useCallback(
    (raw: string) => {
      if (!raw.trim()) return
      const url = normalizeUrl(raw)
      setDetails(true)
      setShowLinkInput(false)
      setLinkDraft('')
      if (task) createLink.mutate({ taskId: task.id, url })
      else setDraftLinks((prev) => [...prev, { key: uid(), url, title: null }])
    },
    // createLink cambia de identidad en cada render; solo nos importa la tarea.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [task?.id],
  )

  function removeDraftFile(key: string) {
    setDraftFiles((prev) => {
      const gone = prev.find((d) => d.key === key)
      if (gone?.preview) URL.revokeObjectURL(gone.preview)
      return prev.filter((d) => d.key !== key)
    })
  }

  /**
   * ⌘V. Una imagen se adjunta siempre: no hay campo donde pegar una imagen signifique
   * otra cosa. Un link solo si NO estas escribiendo en un campo de texto largo, porque
   * ahi pegar una URL tiene que escribirla, no robarsela.
   */
  useEffect(() => {
    function onPaste(event: ClipboardEvent) {
      const clip = event.clipboardData
      if (!clip) return

      const files = [...clip.files].filter((file) => file.size > 0)
      if (files.length > 0) {
        event.preventDefault()
        addFiles(files)
        return
      }

      const target = event.target as HTMLElement | null
      if (target?.tagName === 'TEXTAREA' || target?.hasAttribute('data-paste-text')) return

      const text = clip.getData('text/plain').trim()
      if (!text || !looksLikeUrl(text)) return
      event.preventDefault()
      addLink(text)
    }

    document.addEventListener('paste', onPaste)
    return () => document.removeEventListener('paste', onPaste)
  }, [addFiles, addLink])

  function onDragEnter(event: React.DragEvent) {
    if (![...event.dataTransfer.types].includes('Files')) return
    dragDepth.current += 1
    setDragging(true)
  }

  function onDragLeave() {
    dragDepth.current = Math.max(0, dragDepth.current - 1)
    if (dragDepth.current === 0) setDragging(false)
  }

  function onDrop(event: React.DragEvent) {
    event.preventDefault()
    dragDepth.current = 0
    setDragging(false)
    const files = [...event.dataTransfer.files]
    if (files.length > 0) {
      addFiles(files)
      return
    }
    // Arrastrar un link desde otra pestaña tambien cuenta.
    const uri =
      event.dataTransfer.getData('text/uri-list') || event.dataTransfer.getData('text/plain')
    if (uri && looksLikeUrl(uri.trim())) addLink(uri.trim())
  }

  // --- Guardar ------------------------------------------------------------

  function addSubtask() {
    const title = subtaskDraft.trim()
    if (!title) return
    if (task) createSubtask.mutate({ taskId: task.id, title })
    else setDraftSubtasks((prev) => [...prev, title])
    setSubtaskDraft('')
  }

  async function handleSave() {
    const title = form.title.trim()
    if (!title) {
      setError('La tarea necesita un título')
      return
    }

    const payload = {
      title,
      categoryId: form.categoryId,
      urgency: form.urgency,
      deadline: form.deadline || null,
      description: form.description.trim() || null,
      notes: form.notes.trim() || null,
      status: form.status,
      inToday: form.inToday,
    }

    try {
      if (task) {
        await updateTask.mutateAsync({ id: task.id, patch: payload })
        onClose()
        return
      }

      const created = await createTask.mutateAsync({
        ...payload,
        subtasks: draftSubtasks,
        links: draftLinks.map((l) => ({ url: l.url, title: l.title })),
      })

      // La tarea ya existe, asi que recien ahora el bucket acepta los archivos.
      if (draftFiles.length > 0) {
        const failures = await uploadDrafts(created.id, draftFiles)
        if (failures.length > 0) {
          // Cerramos igual: la tarea ya se creo, y dejar el modal abierto haria que
          // "Crear tarea" de nuevo cree una segunda. Se reintenta desde el detalle.
          toastError(
            `La tarea se creó, pero no se pudo subir ${failures.join(', ')}. Abrila y volvé a adjuntarlo.`,
          )
        }
      }

      onClose()
    } catch (caught) {
      setError(errorMessage(caught))
    }
  }

  async function openAttachment(id: string) {
    try {
      const { url } = await api.getAttachmentUrl(id)
      window.open(url, '_blank', 'noopener')
    } catch (caught) {
      setError(errorMessage(caught))
    }
  }

  async function handleDelete() {
    if (!task) return
    if (!window.confirm(`¿Eliminar “${task.title}”? Esta acción no se puede deshacer.`)) return
    try {
      await deleteTask.mutateAsync(task.id)
      onClose()
    } catch (caught) {
      const message = errorMessage(caught)
      setError(message)
      toastError(message)
    }
  }

  async function handleDeleteAttachment(id: string, fileName: string) {
    if (!window.confirm(`¿Eliminar el adjunto “${fileName}”?`)) return
    try {
      await api.deleteAttachment(id)
      await refreshState()
    } catch (caught) {
      const message = errorMessage(caught)
      setError(message)
      toastError(message)
    }
  }

  const attachments = task?.attachments ?? []
  const busy = createTask.isPending || updateTask.isPending || uploading
  const extras =
    draftSubtasks.length +
    draftFiles.length +
    draftLinks.length +
    (form.description.trim() ? 1 : 0) +
    (form.notes.trim() ? 1 : 0)

  return (
    <Modal
      title={isEdit ? 'Detalle de tarea' : 'Nueva tarea'}
      onClose={onClose}
      footer={
        <>
          {task ? (
            <button type="button" className={styles.danger} onClick={() => void handleDelete()}>
              <IconTrash size={16} />
              Eliminar
            </button>
          ) : (
            <span className={styles.kbd}>
              <kbd className={styles.kbdKey}>⏎</kbd>
              para crear
            </span>
          )}
          <span className={styles.spacer} />
          <button type="button" className={styles.ghost} onClick={onClose}>
            Cancelar
          </button>
          <button type="button" className={styles.primary} onClick={handleSave} disabled={busy}>
            {busy ? (
              <>
                <IconSpinner size={16} className={styles.spinner} />
                {uploading ? 'Subiendo' : 'Guardando'}
              </>
            ) : isEdit ? (
              'Guardar'
            ) : (
              'Crear tarea'
            )}
          </button>
        </>
      }
    >
      <div
        className={styles.form}
        onDragEnter={onDragEnter}
        onDragOver={(e) => {
          if ([...e.dataTransfer.types].includes('Files')) e.preventDefault()
        }}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
        {dragging ? (
          <div className={styles.dropVeil}>
            <IconUpload size={26} />
            Soltá para adjuntar
          </div>
        ) : null}

        {error ? <p className={styles.error}>{error}</p> : null}

        <input
          className={styles.titleInput}
          value={form.title}
          autoFocus
          maxLength={200}
          placeholder="¿Qué hay que hacer?"
          aria-label="Nombre de la tarea"
          onChange={(e) => set('title', e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void handleSave()
          }}
        />

        {isEdit ? (
          <div className={styles.group}>
            <span className={styles.label}>Estado</span>
            <div className={styles.segment} role="radiogroup" aria-label="Estado">
              {STATUSES.map((level) => (
                <button
                  key={level}
                  type="button"
                  role="radio"
                  aria-checked={form.status === level}
                  className={`${styles.segmentItem} ${form.status === level ? styles.segmentOn : ''}`}
                  style={form.status === level ? { background: 'var(--accent-2)' } : undefined}
                  onClick={() => set('status', level)}
                >
                  {STATUS_LABEL[level]}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div className={styles.group}>
          <span className={styles.label}>Categoría</span>
          <div className={styles.chips} role="radiogroup" aria-label="Categoría">
            <button
              type="button"
              className={`${styles.chip} ${form.categoryId === null ? styles.chipOn : ''}`}
              onClick={() => set('categoryId', null)}
              aria-checked={form.categoryId === null}
              role="radio"
            >
              Sin categoría
            </button>
            {categories.map((category) => {
              const color = colorOf(category.colorKey)
              const active = form.categoryId === category.id
              return (
                <button
                  key={category.id}
                  type="button"
                  className={`${styles.chip} ${active ? styles.chipOn : ''}`}
                  role="radio"
                  aria-checked={active}
                  style={
                    active
                      ? { background: color.bg, color: color.ink, borderColor: color.dot }
                      : undefined
                  }
                  onClick={() => set('categoryId', category.id)}
                >
                  <span className={styles.dot} style={{ background: color.dot }} />
                  {category.name}
                </button>
              )
            })}
          </div>
        </div>

        <div className={styles.group}>
          <span className={styles.label}>Urgencia</span>
          <div className={styles.segment} role="radiogroup" aria-label="Urgencia">
            {URGENCIES.map((level) => (
              <button
                key={level}
                type="button"
                role="radio"
                aria-checked={form.urgency === level}
                className={`${styles.segmentItem} ${form.urgency === level ? styles.segmentOn : ''}`}
                style={
                  form.urgency === level
                    ? {
                        background: `var(--urgency-${level})`,
                        // Blanco sobre el amarillo de "media" da un contraste ilegible.
                        color: level === 'media' ? '#4a3a10' : '#fff',
                      }
                    : undefined
                }
                onClick={() => set('urgency', level)}
              >
                {URGENCY_LABEL[level]}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.group}>
          <span className={styles.label}>Fecha límite</span>
          <div className={styles.chips} role="radiogroup" aria-label="Fecha límite">
            {presets.map((preset) => {
              const active = form.deadline === preset.value
              return (
                <button
                  key={preset.key}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  className={`${styles.chip} ${active ? styles.chipOn : ''}`}
                  onClick={() => {
                    set('deadline', active ? '' : preset.value)
                    setShowCalendar(false)
                  }}
                >
                  {preset.label}
                </button>
              )
            })}
            <button
              type="button"
              className={`${styles.chip} ${customDate ? styles.chipOn : ''}`}
              aria-expanded={showCalendar}
              onClick={() => setShowCalendar((value) => !value)}
            >
              <IconChevronDown size={14} />
              {customDate ? formatShortDate(form.deadline) : 'Fecha…'}
            </button>
            {form.deadline ? (
              <button
                type="button"
                className={styles.chipClear}
                aria-label="Sacar la fecha límite"
                onClick={() => {
                  set('deadline', '')
                  setShowCalendar(false)
                }}
              >
                <IconClose size={13} />
              </button>
            ) : null}
          </div>
          {showCalendar ? (
            <input
              type="date"
              className={styles.input}
              value={form.deadline ?? ''}
              aria-label="Elegir fecha"
              onChange={(e) => set('deadline', e.target.value)}
            />
          ) : null}
        </div>

        <button
          type="button"
          className={`${styles.todayRow} ${form.inToday ? styles.todayRowOn : ''}`}
          role="switch"
          aria-checked={form.inToday}
          onClick={() => set('inToday', !form.inToday)}
        >
          <span className={styles.todayIcon}>
            <IconSun size={19} />
          </span>
          <span className={styles.todayText}>
            <span className={styles.todayTitle}>Agregar a Hoy</span>
            <span className={styles.todaySub}>Aparece en el panel de Hoy hasta que la ocultes</span>
          </span>
          <span className={`${styles.switch} ${form.inToday ? styles.switchOn : ''}`}>
            <span className={styles.knob} />
          </span>
        </button>

        {!isEdit ? (
          <button
            type="button"
            className={`${styles.disclosure} ${details ? styles.disclosureOpen : ''}`}
            aria-expanded={details}
            onClick={() => setDetails((value) => !value)}
          >
            <IconChevronDown size={18} className={details ? styles.chevUp : undefined} />
            Más detalles
            {!details && extras > 0 ? <span className={styles.count}>{extras}</span> : null}
          </button>
        ) : null}

        {details ? (
          <>
            <label className={styles.group}>
              <span className={styles.label}>Descripción</span>
              <textarea
                className={styles.textarea}
                rows={3}
                maxLength={5000}
                placeholder="Para acordarte del contexto…"
                value={form.description}
                onChange={(e) => set('description', e.target.value)}
              />
            </label>

            <label className={styles.group}>
              <span className={styles.label}>Notas</span>
              <textarea
                className={styles.textarea}
                rows={2}
                maxLength={5000}
                placeholder="Lo que se te cruce"
                value={form.notes}
                onChange={(e) => set('notes', e.target.value)}
              />
            </label>

            <div className={styles.group}>
              <span className={styles.label}>Subtareas</span>
              <ul className={styles.subtasks}>
                {subtasks.map((subtask) => (
                  <li key={subtask.id} className={styles.subtask}>
                    <label className={styles.subtaskLabel}>
                      <input
                        type="checkbox"
                        className={styles.checkbox}
                        checked={subtask.done}
                        onChange={(e) =>
                          updateSubtask.mutate({ id: subtask.id, patch: { done: e.target.checked } })
                        }
                      />
                      <span className={subtask.done ? styles.subtaskDone : undefined}>
                        {subtask.title}
                      </span>
                    </label>
                    <button
                      type="button"
                      className={styles.iconButton}
                      onClick={() => deleteSubtask.mutate(subtask.id)}
                      aria-label={`Eliminar subtarea ${subtask.title}`}
                    >
                      <IconTrash size={15} />
                    </button>
                  </li>
                ))}

                {draftSubtasks.map((title, index) => (
                  <li key={`draft-${index}`} className={styles.subtask}>
                    <input type="checkbox" className={styles.checkbox} disabled />
                    <span className={styles.subtaskName}>{title}</span>
                    <button
                      type="button"
                      className={styles.iconButton}
                      onClick={() => setDraftSubtasks((prev) => prev.filter((_, i) => i !== index))}
                      aria-label={`Quitar subtarea ${title}`}
                    >
                      <IconClose size={14} />
                    </button>
                  </li>
                ))}
              </ul>

              <div className={styles.addRow}>
                <input
                  className={styles.input}
                  placeholder="Agregar subtarea"
                  maxLength={200}
                  data-paste-text
                  value={subtaskDraft}
                  onChange={(e) => setSubtaskDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      addSubtask()
                    }
                  }}
                />
                <button
                  type="button"
                  className={styles.addButton}
                  onClick={addSubtask}
                  aria-label="Agregar subtarea"
                >
                  <IconPlus size={16} />
                </button>
              </div>
            </div>

            <div className={styles.group}>
              <span className={styles.label}>Adjuntos</span>

              {attachments.length > 0 || draftFiles.length > 0 ? (
                <div className={styles.media}>
                  {attachments.map((attachment) => (
                    <SavedTile
                      key={attachment.id}
                      id={attachment.id}
                      fileName={attachment.fileName}
                      contentType={attachment.contentType}
                      onOpen={() => void openAttachment(attachment.id)}
                      onDelete={() =>
                        void handleDeleteAttachment(attachment.id, attachment.fileName)
                      }
                    />
                  ))}

                  {draftFiles.map((draft) => (
                    <div key={draft.key} className={styles.tile}>
                      {draft.preview ? (
                        <img className={styles.photo} src={draft.preview} alt={draft.file.name} />
                      ) : (
                        <>
                          <span className={styles.tileDoc}>
                            <IconFile size={26} />
                          </span>
                          <span className={styles.tileName}>{draft.file.name}</span>
                        </>
                      )}

                      {draft.error ? (
                        <span className={`${styles.tileBusy} ${styles.tileFailed}`} title={draft.error}>
                          !
                        </span>
                      ) : draft.done ? (
                        <span className={styles.tileOk}>
                          <span className={styles.okBadge}>✓</span>
                        </span>
                      ) : draft.progress > 0 ? (
                        <span className={styles.tileBusy}>
                          <span
                            className={styles.ring}
                            style={{
                              background: `conic-gradient(var(--accent) ${Math.round(draft.progress * 100)}%, rgb(255 255 255 / 35%) 0)`,
                            }}
                          >
                            <span className={styles.ringInner}>
                              {Math.round(draft.progress * 100)}%
                            </span>
                          </span>
                        </span>
                      ) : (
                        <button
                          type="button"
                          className={styles.tileX}
                          aria-label={`Quitar ${draft.file.name}`}
                          onClick={() => removeDraftFile(draft.key)}
                        >
                          <IconClose size={13} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              ) : null}

              {savedLinks.length > 0 || draftLinks.length > 0 ? (
                <div className={styles.links}>
                  {savedLinks.map((link) => (
                    <LinkRow
                      key={link.id}
                      link={link}
                      onRemove={() => deleteLink.mutate(link.id)}
                      saved
                    />
                  ))}
                  {draftLinks.map((link) => (
                    <LinkRow
                      key={link.key}
                      link={{ url: link.url, title: link.title }}
                      onRemove={() =>
                        setDraftLinks((prev) => prev.filter((l) => l.key !== link.key))
                      }
                    />
                  ))}
                </div>
              ) : null}

              {showLinkInput ? (
                <div className={styles.addRow}>
                  <input
                    ref={linkInput}
                    className={styles.input}
                    placeholder="https://…"
                    data-paste-text
                    autoFocus
                    value={linkDraft}
                    onChange={(e) => setLinkDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        addLink(linkDraft)
                      }
                      if (e.key === 'Escape') {
                        e.stopPropagation()
                        setShowLinkInput(false)
                        setLinkDraft('')
                      }
                    }}
                  />
                  <button
                    type="button"
                    className={styles.addButton}
                    onClick={() => addLink(linkDraft)}
                    aria-label="Agregar link"
                  >
                    <IconPlus size={16} />
                  </button>
                </div>
              ) : (
                <div
                  className={`${styles.drop} ${attachments.length + draftFiles.length + savedLinks.length + draftLinks.length > 0 ? styles.dropSlim : ''}`}
                >
                  {attachments.length + draftFiles.length + savedLinks.length + draftLinks.length ===
                  0 ? (
                    <>
                      <span className={styles.dropIcon}>
                        <IconUpload size={22} />
                      </span>
                      <p className={styles.dropTitle}>
                        {storageOn ? 'Arrastrá acá, o pegá con ⌘V' : 'Pegá un link con ⌘V'}
                      </p>
                      <p className={styles.dropSub}>
                        {storageOn
                          ? 'Imágenes y PDF hasta 25 MB · o pegá un link'
                          : 'Los archivos necesitan las variables S3_* en el .env'}
                      </p>
                    </>
                  ) : (
                    <span className={styles.dropTitle}>Arrastrá, pegá con ⌘V, o</span>
                  )}
                  <div className={styles.dropActions}>
                    {storageOn ? (
                      <button
                        type="button"
                        className={styles.dropBtn}
                        onClick={() => fileInput.current?.click()}
                      >
                        <IconImage size={15} />
                        Elegir archivo
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className={styles.dropBtn}
                      onClick={() => setShowLinkInput(true)}
                    >
                      <IconLink size={15} />
                      Pegar link
                    </button>
                  </div>
                </div>
              )}

              <input
                ref={fileInput}
                type="file"
                hidden
                multiple
                accept={ACCEPT}
                onChange={(e) => {
                  addFiles([...(e.target.files ?? [])])
                  e.target.value = ''
                }}
              />
            </div>
          </>
        ) : null}
      </div>
    </Modal>
  )
}

/** Miniatura de un adjunto ya guardado. La URL del bucket se firma al montar. */
function SavedTile({
  id,
  fileName,
  contentType,
  onOpen,
  onDelete,
}: {
  id: string
  fileName: string
  contentType: string
  onOpen: () => void
  onDelete: () => void
}) {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!isImage(contentType)) return
    let alive = true
    void api
      .getAttachmentUrl(id)
      .then(({ url: signed }) => {
        if (alive) setUrl(signed)
      })
      .catch(() => {
        // Sin miniatura se ve el icono generico; no vale un cartel de error por esto.
      })
    return () => {
      alive = false
    }
  }, [id, contentType])

  return (
    <div className={styles.tile}>
      <button type="button" className={styles.tileOpen} onClick={onOpen} title={fileName}>
        {url ? (
          <img className={styles.photo} src={url} alt={fileName} />
        ) : (
          <>
            <span className={styles.tileDoc}>
              {isImage(contentType) ? <IconImage size={26} /> : <IconFile size={26} />}
            </span>
            <span className={styles.tileName}>{fileName}</span>
          </>
        )}
      </button>
      <button
        type="button"
        className={`${styles.tileX} ${styles.tileXsaved}`}
        aria-label={`Eliminar ${fileName}`}
        onClick={onDelete}
      >
        <IconTrash size={13} />
      </button>
    </div>
  )
}

function LinkRow({
  link,
  onRemove,
  saved = false,
}: {
  link: Pick<TaskLink, 'url' | 'title'>
  onRemove: () => void
  saved?: boolean
}) {
  return (
    <div className={styles.link}>
      <span className={styles.linkIcon}>
        <IconLink size={15} />
      </span>
      <a
        className={styles.linkText}
        href={link.url}
        target="_blank"
        rel="noopener noreferrer"
        title={link.url}
      >
        <span className={styles.linkTitle}>{linkTitle(link)}</span>
        <span className={styles.linkUrl}>{linkSubtitle(link.url)}</span>
      </a>
      <button
        type="button"
        className={styles.iconButton}
        aria-label={saved ? `Eliminar link ${linkTitle(link)}` : `Quitar link ${linkTitle(link)}`}
        onClick={onRemove}
      >
        {saved ? <IconTrash size={15} /> : <IconClose size={14} />}
      </button>
    </div>
  )
}
