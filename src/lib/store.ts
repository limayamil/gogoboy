import { useCallback } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { QueryClient } from '@tanstack/react-query'
import { api, type LinkDraft } from './api'
import { toastError } from './toast'
import type { AppState, Category, Note, NoteInput, QuickTask, Task, TaskInput } from '../shared/types'

const KEY = ['state'] as const

const EMPTY: AppState = {
  categories: [],
  tasks: [],
  notes: [],
  quickTasks: [],
  storageConfigured: false,
  version: '',
}

export function useAppState() {
  return useQuery({ queryKey: KEY, queryFn: api.getState })
}

function patchCache(client: QueryClient, update: (state: AppState) => AppState) {
  client.setQueryData<AppState>(KEY, (state) => update(state ?? EMPTY))
}

/**
 * Snapshot + rollback: el patron que repiten todas las mutaciones de abajo.
 *
 * `commit` escribe en el cache la entidad que devolvio el servidor. Es lo que evita
 * tener que invalidar `['state']` y re-descargar las tablas enteras despues de cada
 * click: la respuesta del PATCH ya trae la version autoritativa de lo que cambio.
 * La invalidacion queda solo para el camino de error, despues del rollback, como red.
 */
function useOptimistic<TVars, TData>(options: {
  mutationFn: (vars: TVars) => Promise<TData>
  optimistic: (state: AppState, vars: TVars) => AppState
  commit?: (state: AppState, data: TData, vars: TVars) => AppState
}) {
  const client = useQueryClient()

  return useMutation({
    mutationFn: options.mutationFn,
    async onMutate(vars: TVars) {
      await client.cancelQueries({ queryKey: KEY })
      const previous = client.getQueryData<AppState>(KEY)
      patchCache(client, (state) => options.optimistic(state, vars))
      return { previous }
    },
    onSuccess(data, vars) {
      const commit = options.commit
      if (commit) patchCache(client, (state) => commit(state, data, vars))
    },
    onError(error, _vars, context) {
      if (context?.previous) client.setQueryData(KEY, context.previous)
      toastError(error)
      void client.invalidateQueries({ queryKey: KEY })
    },
  })
}

const replaceTask = (state: AppState, id: string, update: (task: Task) => Task): AppState => ({
  ...state,
  tasks: state.tasks.map((task) => (task.id === id ? update(task) : task)),
})

const replaceNote = (state: AppState, id: string, update: (note: Note) => Note): AppState => ({
  ...state,
  notes: state.notes.map((note) => (note.id === id ? update(note) : note)),
})

// --- Tareas ---------------------------------------------------------------

export function useCreateTask() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (input: TaskInput & { subtasks?: string[]; links?: LinkDraft[] }) =>
      api.createTask(input),
    onSuccess(task) {
      patchCache(client, (state) => ({ ...state, tasks: [...state.tasks, task] }))
    },
    // Sin toast: el error de crear se muestra inline en el modal, que es donde esta
    // mirando el usuario. Aca solo resincronizamos por las dudas.
    onError() {
      void client.invalidateQueries({ queryKey: KEY })
    },
  })
}

export function useUpdateTask() {
  return useOptimistic({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<TaskInput> }) =>
      api.updateTask(id, patch),
    optimistic: (state, { id, patch }) =>
      replaceTask(state, id, (task) => {
        const next = { ...task, ...patch } as Task
        // Espeja la regla del servidor: sacar de Hoy tambien des-oculta.
        if (next.inToday === false) {
          next.hiddenInToday = false
          next.todayPosition = null
        }
        // Completar ahora no vence hasta que cierre la semana; reabrir limpia expired.
        if (next.status === 'hecha') {
          if (task.status !== 'hecha') {
            next.completedAt = task.completedAt ?? new Date().toISOString()
            next.expired = false
          }
        } else {
          next.completedAt = null
          next.expired = false
        }
        return next
      }),
    // El PATCH devuelve la tarea completa y ya resuelta (todayPosition, completedAt):
    // pisamos el parche optimista con ella en vez de releer todo el estado.
    commit: (state, task) => replaceTask(state, task.id, () => task),
  })
}

export function useDeleteTask() {
  return useOptimistic({
    mutationFn: (id: string) => api.deleteTask(id),
    optimistic: (state, id) => ({ ...state, tasks: state.tasks.filter((t) => t.id !== id) }),
  })
}

/** Un solo mutate para no invalidar el cache una vez por fila al reordenar Hoy. */
export function useReorderToday() {
  return useOptimistic({
    mutationFn: (positions: { id: string; todayPosition: number }[]) =>
      Promise.all(positions.map(({ id, todayPosition }) => api.updateTask(id, { todayPosition }))),
    optimistic: (state, positions) => {
      const byId = new Map(positions.map((item) => [item.id, item.todayPosition]))
      return {
        ...state,
        tasks: state.tasks.map((task) =>
          byId.has(task.id) ? { ...task, todayPosition: byId.get(task.id)! } : task,
        ),
      }
    },
  })
}

// --- Subtareas ------------------------------------------------------------

export function useCreateSubtask() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (input: { taskId: string; title: string }) => api.createSubtask(input),
    onSuccess(subtask) {
      patchCache(client, (state) =>
        replaceTask(state, subtask.taskId, (task) => ({
          ...task,
          subtasks: [...task.subtasks, subtask],
        })),
      )
    },
    onError(error) {
      toastError(error)
      void client.invalidateQueries({ queryKey: KEY })
    },
  })
}

export function useUpdateSubtask() {
  return useOptimistic({
    mutationFn: ({ id, patch }: { id: string; patch: { title?: string; done?: boolean } }) =>
      api.updateSubtask(id, patch),
    optimistic: (state, { id, patch }) => ({
      ...state,
      tasks: state.tasks.map((task) => ({
        ...task,
        subtasks: task.subtasks.map((s) => (s.id === id ? { ...s, ...patch } : s)),
      })),
    }),
    commit: (state, subtask) =>
      replaceTask(state, subtask.taskId, (task) => ({
        ...task,
        subtasks: task.subtasks.map((s) => (s.id === subtask.id ? subtask : s)),
      })),
  })
}

export function useDeleteSubtask() {
  return useOptimistic({
    mutationFn: (id: string) => api.deleteSubtask(id),
    optimistic: (state, id) => ({
      ...state,
      tasks: state.tasks.map((task) => ({
        ...task,
        subtasks: task.subtasks.filter((s) => s.id !== id),
      })),
    }),
  })
}

// --- Links ----------------------------------------------------------------

export function useCreateLink() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (input: { taskId: string; url: string; title?: string | null }) =>
      api.createLink(input),
    onSuccess(link) {
      patchCache(client, (state) =>
        replaceTask(state, link.taskId, (task) => ({ ...task, links: [...task.links, link] })),
      )
    },
    onError(error) {
      toastError(error)
      void client.invalidateQueries({ queryKey: KEY })
    },
  })
}

export function useDeleteLink() {
  return useOptimistic({
    mutationFn: (id: string) => api.deleteLink(id),
    optimistic: (state, id) => ({
      ...state,
      tasks: state.tasks.map((task) => ({
        ...task,
        links: task.links.filter((l) => l.id !== id),
      })),
    }),
  })
}

// --- Categorias -----------------------------------------------------------

export function useCreateCategory() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (input: { name: string; colorKey: string }) => api.createCategory(input),
    onSuccess(category) {
      patchCache(client, (state) => ({ ...state, categories: [...state.categories, category] }))
    },
    onError() {
      void client.invalidateQueries({ queryKey: KEY })
    },
  })
}

export function useUpdateCategory() {
  return useOptimistic({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<Omit<Category, 'id' | 'createdAt'>> }) =>
      api.updateCategory(id, patch),
    optimistic: (state, { id, patch }) => ({
      ...state,
      categories: state.categories.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    }),
    commit: (state, category) => ({
      ...state,
      categories: state.categories.map((c) => (c.id === category.id ? category : c)),
    }),
  })
}

export function useDeleteCategory() {
  return useOptimistic({
    mutationFn: (id: string) => api.deleteCategory(id),
    // Igual que la FK `on delete set null`: las tareas quedan sin categoria, no se borran.
    optimistic: (state, id) => ({
      ...state,
      categories: state.categories.filter((c) => c.id !== id),
      tasks: state.tasks.map((t) => (t.categoryId === id ? { ...t, categoryId: null } : t)),
    }),
  })
}

// --- Tareas rapidas -------------------------------------------------------

export function useCreateQuickTask() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (title: string) => api.createQuickTask(title),
    onSuccess(quickTask) {
      patchCache(client, (state) => ({ ...state, quickTasks: [...state.quickTasks, quickTask] }))
    },
    onError(error) {
      toastError(error)
      void client.invalidateQueries({ queryKey: KEY })
    },
  })
}

export function useUpdateQuickTask() {
  return useOptimistic({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<QuickTask> }) =>
      api.updateQuickTask(id, patch),
    optimistic: (state, { id, patch }) => ({
      ...state,
      quickTasks: state.quickTasks.map((q) => (q.id === id ? { ...q, ...patch } : q)),
    }),
    commit: (state, quickTask) => ({
      ...state,
      quickTasks: state.quickTasks.map((q) => (q.id === quickTask.id ? quickTask : q)),
    }),
  })
}

export function useDeleteQuickTask() {
  return useOptimistic({
    mutationFn: (id: string) => api.deleteQuickTask(id),
    optimistic: (state, id) => ({
      ...state,
      quickTasks: state.quickTasks.filter((q) => q.id !== id),
    }),
  })
}

export function useCreateNote() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (input: NoteInput) => api.createNote(input),
    onSuccess(note) {
      patchCache(client, (state) => ({
        ...state,
        notes: [note, ...state.notes.filter((item) => item.id !== note.id)],
      }))
    },
    onError() {
      void client.invalidateQueries({ queryKey: KEY })
    },
  })
}

export function useUpdateNote() {
  return useOptimistic({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<NoteInput> }) =>
      api.updateNote(id, patch),
    optimistic: (state, { id, patch }) =>
      replaceNote(state, id, (note) => {
        const { tags, ...rest } = patch
        const next = { ...note, ...rest }
        if (tags) {
          next.tags = tags.map((name, index) => {
            const existing = note.tags.find((tag) => tag.name.toLowerCase() === name.toLowerCase())
            return existing ?? { id: `tmp-${index}`, name }
          })
        }
        return next
      }),
    commit: (state, note) => replaceNote(state, note.id, () => note),
  })
}

export function useDeleteNote() {
  return useOptimistic({
    mutationFn: (id: string) => api.deleteNote(id),
    optimistic: (state, id) => ({ ...state, notes: state.notes.filter((n) => n.id !== id) }),
  })
}

/**
 * Fuerza una relectura de /api/state. Lo usan los flujos que escriben por fuera de
 * las mutaciones de arriba (por ejemplo la subida de adjuntos, que sube al bucket
 * y despues registra el archivo).
 */
export function useRefreshState() {
  const client = useQueryClient()
  return useCallback(() => client.invalidateQueries({ queryKey: KEY }), [client])
}
