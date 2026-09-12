import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import { TaskModal, type TaskModalRequest } from '../components/TaskModal'
import { CategoryModal } from '../components/CategoryModal'

/**
 * Host unico de modales. Cualquier vista puede abrir el detalle de una tarea o el
 * formulario de categoria sin tener que pasar estado por props entre vistas y FABs.
 */
interface ModalsApi {
  openTask: (request: TaskModalRequest) => void
  openCategory: (categoryId: string | null) => void
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

  const api = useMemo<ModalsApi>(
    () => ({
      openTask: setTaskRequest,
      openCategory: (id) => setCategoryRequest({ id }),
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
    </Context.Provider>
  )
}
