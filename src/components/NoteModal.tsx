import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Modal } from './Modal'
import { RichTextEditor } from './RichTextEditor'
import {
  IconClose,
  IconCopy,
  IconEye,
  IconEyeOff,
  IconFile,
  IconImage,
  IconPlus,
  IconSpinner,
  IconTrash,
  IconUpload,
} from './Icons'
import { api } from '../lib/api'
import { compressImage } from '../lib/image'
import { uniqueNoteTags } from '../lib/notes'
import { serializeRichText } from '../lib/rich-text'
import { errorMessage, toastError } from '../lib/toast'
import {
  useAppState,
  useCreateNote,
  useDeleteNote,
  useRefreshState,
  useUpdateNote,
} from '../lib/store'
import type { NoteKind } from '../shared/types'
import styles from './TaskModal.module.css'
import noteStyles from './NoteModal.module.css'

const ACCEPT = 'image/*,application/pdf'
const MAX_BYTES = 25 * 1024 * 1024
const MAX_TAG_LEN = 40

const isImage = (type: string) => type.startsWith('image/')
const allowed = (file: File) => isImage(file.type) || file.type === 'application/pdf'
const uid = () => Math.random().toString(36).slice(2)

interface DraftFile {
  key: string
  file: File
  preview: string | null
  progress: number
  done: boolean
  error: string | null
}

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

export function NoteModal({
  noteId,
  composeKind = 'note',
  onClose,
}: {
  noteId: string | null
  composeKind?: NoteKind
  onClose: () => void
}) {
  const { data } = useAppState()
  const note = noteId ? data?.notes.find((item) => item.id === noteId) : undefined
  const isEdit = Boolean(note)
  const isPassword = (note?.kind ?? composeKind) === 'password'
  const knownTags = uniqueNoteTags(data?.notes ?? [])

  const createNote = useCreateNote()
  const updateNote = useUpdateNote()
  const deleteNote = useDeleteNote()
  const refreshState = useRefreshState()

  const [title, setTitle] = useState(note?.title ?? '')
  const [description, setDescription] = useState(note?.description ?? '')
  const [username, setUsername] = useState(note?.username ?? '')
  const [password, setPassword] = useState(note?.password ?? '')
  const [tags, setTags] = useState<string[]>(() => note?.tags.map((tag) => tag.name) ?? [])
  const [tagDraft, setTagDraft] = useState('')
  const [draftFiles, setDraftFiles] = useState<DraftFile[]>([])
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fileInput = useRef<HTMLInputElement>(null)
  const dragDepth = useRef(0)
  const storageOn = data?.storageConfigured ?? true

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

  const refreshRef = useRef(refreshState)
  refreshRef.current = refreshState

  const uploadOne = useCallback(async (id: string, draft: DraftFile): Promise<string | null> => {
    try {
      const file = await compressImage(draft.file)
      const contentType = file.type || 'application/octet-stream'
      const { objectKey, uploadUrl } = await api.signUpload({
        noteId: id,
        fileName: file.name,
        contentType,
      })
      await putFile(uploadUrl, file, (fraction) => {
        setDraftFiles((prev) =>
          prev.map((item) => (item.key === draft.key ? { ...item, progress: fraction } : item)),
        )
      })
      await api.createAttachment({
        noteId: id,
        objectKey,
        fileName: file.name,
        contentType,
        sizeBytes: file.size,
      })
      setDraftFiles((prev) =>
        prev.map((item) => (item.key === draft.key ? { ...item, progress: 1, done: true } : item)),
      )
      return null
    } catch (caught) {
      const message = errorMessage(caught)
      setDraftFiles((prev) =>
        prev.map((item) => (item.key === draft.key ? { ...item, error: message } : item)),
      )
      return message
    }
  }, [])

  const uploadDrafts = useCallback(
    async (id: string, drafts: DraftFile[]): Promise<string[]> => {
      setUploading(true)
      const failures: string[] = []
      for (const draft of drafts) {
        const failure = await uploadOne(id, draft)
        if (failure) failures.push(`“${draft.file.name}” (${failure})`)
      }
      await refreshRef.current()
      setDraftFiles((prev) => {
        for (const draft of prev) {
          if (draft.done && draft.preview) URL.revokeObjectURL(draft.preview)
        }
        return prev.filter((draft) => !draft.done)
      })
      setUploading(false)
      return failures
    },
    [uploadOne],
  )

  const addFiles = useCallback(
    (incoming: File[]) => {
      if (isPassword) return
      if (!storageOn) {
        setError('Para adjuntar archivos faltan las variables S3_* en el .env.')
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
      setDraftFiles((prev) => [...prev, ...drafts])
      if (note) void uploadDrafts(note.id, drafts)
    },
    [isPassword, note, storageOn, uploadDrafts],
  )

  function removeDraftFile(key: string) {
    setDraftFiles((prev) => {
      const gone = prev.find((draft) => draft.key === key)
      if (gone?.preview) URL.revokeObjectURL(gone.preview)
      return prev.filter((draft) => draft.key !== key)
    })
  }

  useEffect(() => {
    function onPaste(event: ClipboardEvent) {
      const clip = event.clipboardData
      if (!clip) return
      const files = [...clip.files].filter((file) => file.size > 0)
      if (files.length === 0) return
      event.preventDefault()
      addFiles(files)
    }
    document.addEventListener('paste', onPaste)
    return () => document.removeEventListener('paste', onPaste)
  }, [addFiles])

  function onDragEnter(event: React.DragEvent) {
    if (isPassword) return
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
    if (isPassword) return
    const files = [...event.dataTransfer.files]
    if (files.length > 0) addFiles(files)
  }

  function addTag(raw = tagDraft) {
    const name = raw.trim().replace(/,$/, '')
    if (!name) return
    if (name.length > MAX_TAG_LEN) {
      setError(`La etiqueta no puede pasar los ${MAX_TAG_LEN} caracteres`)
      return
    }
    setTags((prev) =>
      prev.some((tag) => tag.toLowerCase() === name.toLowerCase()) ? prev : [...prev, name],
    )
    setTagDraft('')
    setError(null)
  }

  function removeTag(name: string) {
    setTags((prev) => prev.filter((tag) => tag !== name))
  }

  const suggestions = useMemo(
    () =>
      knownTags
        .map((tag) => tag.name)
        .filter(
          (name) =>
            !tags.some((tag) => tag.toLowerCase() === name.toLowerCase()) &&
            (!tagDraft.trim() || name.toLowerCase().includes(tagDraft.trim().toLowerCase())),
        )
        .slice(0, 8),
    [knownTags, tagDraft, tags],
  )

  async function handleSave() {
    const trimmed = title.trim()
    if (!trimmed) {
      setError(isPassword ? 'La contraseña necesita un título' : 'La nota necesita un título')
      return
    }

    if (isPassword && !password.trim()) {
      setError('La clave no puede estar vacía')
      return
    }

    const payload = isPassword
      ? {
          title: trimmed,
          kind: 'password' as const,
          username: username.trim() || null,
          password: password.trim(),
          tags: [] as string[],
        }
      : {
          title: trimmed,
          description: serializeRichText(description),
          tags,
        }

    try {
      if (note) {
        await updateNote.mutateAsync({
          id: note.id,
          patch: isPassword
            ? {
                title: trimmed,
                username: username.trim() || null,
                password: password.trim(),
              }
            : {
                title: trimmed,
                description: serializeRichText(description),
                tags,
              },
        })
        onClose()
        return
      }

      const created = await createNote.mutateAsync(payload)
      if (!isPassword && draftFiles.length > 0) {
        const failures = await uploadDrafts(created.id, draftFiles)
        if (failures.length > 0) {
          toastError(
            `La nota se creó, pero no se pudo subir ${failures.join(', ')}. Abrila y volvé a adjuntarlo.`,
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
    if (!note) return
    if (!window.confirm(`¿Eliminar “${note.title}”? Esta acción no se puede deshacer.`)) return
    try {
      await deleteNote.mutateAsync(note.id)
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

  const attachments = note?.attachments ?? []
  const busy = createNote.isPending || updateNote.isPending || uploading

  return (
    <Modal
      title={
        isPassword
          ? isEdit
            ? 'Detalle de contraseña'
            : 'Nueva contraseña'
          : isEdit
            ? 'Detalle de nota'
            : 'Nueva nota'
      }
      onClose={onClose}
      footer={
        <>
          {note ? (
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
          <button type="button" className={styles.primary} onClick={() => void handleSave()} disabled={busy}>
            {busy ? (
              <>
                <IconSpinner size={16} className={styles.spinner} />
                {uploading ? 'Subiendo' : 'Guardando'}
              </>
            ) : isEdit ? (
              'Guardar'
            ) : isPassword ? (
              'Crear contraseña'
            ) : (
              'Crear nota'
            )}
          </button>
        </>
      }
    >
      <div
        className={styles.form}
        onDragEnter={onDragEnter}
        onDragOver={(event) => {
          if ([...event.dataTransfer.types].includes('Files')) event.preventDefault()
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
          value={title}
          autoFocus
          maxLength={200}
          placeholder={isPassword ? 'Sitio o app' : 'Título de la nota'}
          aria-label={isPassword ? 'Sitio o app' : 'Título de la nota'}
          autoComplete="off"
          onChange={(event) => setTitle(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              void handleSave()
            }
          }}
        />

        {isPassword ? (
          <>
            <CredentialField
              label="Usuario"
              value={username}
              placeholder="nombre de usuario o email"
              ariaLabel="Usuario"
              onChange={setUsername}
            />
            <CredentialField
              label="Contraseña"
              value={password}
              placeholder="clave"
              ariaLabel="Contraseña"
              secret
              onChange={setPassword}
            />
          </>
        ) : (
          <div className={styles.group}>
            <span className={styles.label}>Descripción</span>
            <RichTextEditor
              value={description}
              placeholder="Escribí lo que quieras guardar"
              minHeight={180}
              aria-label="Descripción"
              onChange={setDescription}
            />
          </div>
        )}

        {!isPassword ? (
          <>
        <div className={styles.group}>
          <span className={styles.label}>Etiquetas</span>
          <div className={noteStyles.tagBox}>
            {tags.map((name) => (
              <span key={name} className={`${styles.chip} ${styles.chipOn}`}>
                {name}
                <button
                  type="button"
                  className={noteStyles.tagRemove}
                  aria-label={`Quitar ${name}`}
                  onClick={() => removeTag(name)}
                >
                  <IconClose size={12} />
                </button>
              </span>
            ))}
            <input
              className={noteStyles.tagInput}
              value={tagDraft}
              maxLength={MAX_TAG_LEN}
              placeholder={tags.length === 0 ? 'Escribí una y apretá Enter' : 'Otra…'}
              aria-label="Agregar etiqueta"
              onChange={(event) => setTagDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ',') {
                  event.preventDefault()
                  addTag()
                }
                if (event.key === 'Backspace' && !tagDraft && tags.length > 0) {
                  removeTag(tags[tags.length - 1])
                }
              }}
              onBlur={() => addTag()}
            />
          </div>
          {suggestions.length > 0 ? (
            <div className={styles.chips}>
              {suggestions.map((name) => (
                <button
                  key={name}
                  type="button"
                  className={styles.chip}
                  onClick={() => addTag(name)}
                >
                  <IconPlus size={12} />
                  {name}
                </button>
              ))}
            </div>
          ) : null}
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
                  onDelete={() => void handleDeleteAttachment(attachment.id, attachment.fileName)}
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
                        <span className={styles.ringInner}>{Math.round(draft.progress * 100)}%</span>
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

          <div
            className={`${styles.drop} ${attachments.length + draftFiles.length > 0 ? styles.dropSlim : ''}`}
          >
            {attachments.length + draftFiles.length === 0 ? (
              <>
                <span className={styles.dropIcon}>
                  <IconUpload size={22} />
                </span>
                <p className={styles.dropTitle}>
                  {storageOn ? 'Arrastrá acá, o pegá con ⌘V' : 'Los archivos necesitan S3_*'}
                </p>
                <p className={styles.dropSub}>
                  {storageOn
                    ? 'Imágenes y PDF hasta 25 MB'
                    : 'Completá las variables S3_* en el .env para adjuntar'}
                </p>
              </>
            ) : (
              <span className={styles.dropTitle}>Arrastrá, pegá con ⌘V, o</span>
            )}
            {storageOn ? (
              <div className={styles.dropActions}>
                <button
                  type="button"
                  className={styles.dropBtn}
                  onClick={() => fileInput.current?.click()}
                >
                  <IconImage size={15} />
                  Elegir archivo
                </button>
              </div>
            ) : null}
          </div>

          <input
            ref={fileInput}
            type="file"
            hidden
            multiple
            accept={ACCEPT}
            onChange={(event) => {
              addFiles([...(event.target.files ?? [])])
              event.target.value = ''
            }}
          />
        </div>
          </>
        ) : null}
      </div>
    </Modal>
  )
}

function CredentialField({
  label,
  value,
  placeholder,
  ariaLabel,
  secret = false,
  onChange,
}: {
  label: string
  value: string
  placeholder: string
  ariaLabel: string
  secret?: boolean
  onChange: (value: string) => void
}) {
  const [visible, setVisible] = useState(false)
  const [copied, setCopied] = useState(false)
  const [copyError, setCopyError] = useState(false)

  async function copy() {
    if (!value) return
    setCopyError(false)
    const ok = await copyText(value)
    if (!ok) {
      setCopyError(true)
      return
    }
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1400)
  }

  return (
    <div className={styles.group}>
      <span className={styles.label}>{label}</span>
      <div className={noteStyles.secretRow}>
        <input
          className={`${styles.input} ${secret ? noteStyles.secretInput : ''}`}
          type={secret && !visible ? 'password' : 'text'}
          value={value}
          placeholder={placeholder}
          aria-label={ariaLabel}
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          onChange={(event) => onChange(event.target.value)}
        />
        {secret ? (
          <button
            type="button"
            className={noteStyles.iconBtn}
            aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            aria-pressed={visible}
            onClick={() => setVisible((current) => !current)}
          >
            {visible ? <IconEyeOff size={16} /> : <IconEye size={16} />}
          </button>
        ) : null}
        <button
          type="button"
          className={noteStyles.iconBtn}
          aria-label={copied ? 'Copiado' : `Copiar ${label.toLowerCase()}`}
          disabled={!value}
          onClick={() => void copy()}
        >
          <IconCopy size={16} />
        </button>
      </div>
      {copied ? <span className={noteStyles.copied}>Copiado al portapapeles</span> : null}
      {copyError ? <span className={noteStyles.copyError}>No se pudo copiar</span> : null}
    </div>
  )
}

/** La Clipboard API falla en algunos webviews; execCommand es el fallback clasico. */
function copyText(value: string): Promise<boolean> {
  return navigator.clipboard.writeText(value).then(
    () => true,
    () => {
      const el = document.createElement('textarea')
      el.value = value
      el.setAttribute('readonly', '')
      el.style.position = 'fixed'
      el.style.opacity = '0'
      document.body.appendChild(el)
      el.select()
      const ok = document.execCommand('copy')
      el.remove()
      return ok
    },
  )
}

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
        // Sin miniatura se ve el icono generico.
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
