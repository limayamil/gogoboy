import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import { TaskModal, type TaskModalRequest } from '../components/TaskModal'
import { CategoryModal } from '../components/CategoryModal'
import { NoteModal } from '../components/NoteModal'
import type { NoteKind } from '../shared/types'

/**
 * Host unico de modales. Cualquier vista puede abrir el detalle de una tarea, una
 * nota o el formulario de categoria sin tener que pasar estado por props.
 */
interface ModalsApi {
  openTask: (request: TaskModalRequest) => void
  openCategory: (categoryId: string | null) => void
  openNote: (noteId: string | null, kind?: NoteKind) => void
}

const Context = createContext<ModalsApi | null>(null)

export function useModals(): ModalsApi {
  const api = useContext(Context)
  if (!api) throw new Error('useModals debe usarse dentro de <ModalProvider>')
  return api
}

export function ModalProvider({ children }: { children: ReactNode }) {
  const [taskRequest, setTaskRequest] = useState<TaskModalRequest | null>(null)
  const [categoryRequest, setCategoryRequest] = useState<{ id: string | null } | null>(null)
  const [noteRequest, setNoteRequest] = useState<{ id: string | null; kind: NoteKind } | undefined>(
    undefined,
  )

  const api = useMemo<ModalsApi>(
    () => ({
      openTask: setTaskRequest,
      openCategory: (id) => setCategoryRequest({ id }),
      openNote: (id, kind = 'note') => setNoteRequest({ id, kind }),
    }),
    [],
  )

  return (
    <Context.Provider value={api}>
      {children}
      {taskRequest ? (
        // La key remonta el formulario al cambiar de tarea, para que no arrastre el
        // estado local del modal anterior.
        <TaskModal
          key={taskRequest.taskId ?? 'nueva'}
          request={taskRequest}
          onClose={() => setTaskRequest(null)}
        />
      ) : null}
      {categoryRequest ? (
        <CategoryModal
          key={categoryRequest.id ?? 'nueva'}
          categoryId={categoryRequest.id}
          onClose={() => setCategoryRequest(null)}
        />
      ) : null}
      {noteRequest ? (
        <NoteModal
          key={noteRequest.id ?? `nueva-${noteRequest.kind}`}
          noteId={noteRequest.id}
          composeKind={noteRequest.kind}
          onClose={() => setNoteRequest(undefined)}
        />
      ) : null}
    </Context.Provider>
  )
}
