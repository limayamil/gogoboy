import { Suspense, createContext, lazy, useContext, useMemo, useState, type ReactNode } from 'react'
import type { TaskModalRequest } from '../components/TaskModal'
import { CategoryModal } from '../components/CategoryModal'
import type { NoteKind } from '../shared/types'

/**
 * El detalle de tarea y el de nota son los componentes mas grandes y no se ven
 * hasta que se abre el modal: van en su propio chunk para que no pesen en la carga inicial.
 */
const TaskModal = lazy(() =>
  import('../components/TaskModal').then((m) => ({ default: m.TaskModal })),
)

const NoteModal = lazy(() =>
  import('../components/NoteModal').then((m) => ({ default: m.NoteModal })),
)

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
        // Sin fallback: el chunk llega en milisegundos y un spinner de paso a paso
        // parpadearia mas de lo que informa.
        <Suspense fallback={null}>
          {/* La key remonta el formulario al cambiar de tarea, para que no arrastre el
              estado local del modal anterior. */}
          <TaskModal
            key={taskRequest.taskId ?? 'nueva'}
            request={taskRequest}
            onClose={() => setTaskRequest(null)}
          />
        </Suspense>
      ) : null}
      {categoryRequest ? (
        <CategoryModal
          key={categoryRequest.id ?? 'nueva'}
          categoryId={categoryRequest.id}
          onClose={() => setCategoryRequest(null)}
        />
      ) : null}
      {noteRequest ? (
        <Suspense fallback={null}>
          <NoteModal
            key={noteRequest.id ?? `nueva-${noteRequest.kind}`}
            noteId={noteRequest.id}
            composeKind={noteRequest.kind}
            onClose={() => setNoteRequest(undefined)}
          />
        </Suspense>
      ) : null}
    </Context.Provider>
  )
}
