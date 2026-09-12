/**
 * Capa de datos: un unico cache (`['state']`) con todo el estado de la app.
 *
 * Cada mutacion escribe primero en el cache y despues confirma contra la API. Esto es
 * lo que hace que soltar una tarjeta o tildar un check se sienta instantaneo; si la
 * request falla, `onError` restaura el snapshot anterior.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { QueryClient } from '@tanstack/react-query'
import { api, type LinkDraft } from './api'
import { toastError } from './toast'
import type { AppState, Category, QuickTask, Task, TaskInput } from '../shared/types'

const KEY = ['state'] as const

const EMPTY: AppState = { categories: [], tasks: [], quickTasks: [], storageConfigured: false }

export function useAppState() {
  return useQuery({ queryKey: KEY, queryFn: api.getState })
}

function patchCache(client: QueryClient, update: (state: AppState) => AppState) {
  client.setQueryData<AppState>(KEY, (state) => update(state ?? EMPTY))
}

/** Snapshot + rollback: el patron que repiten todas las mutaciones de abajo. */
function useOptimistic<TVars, TData>(options: {
  mutationFn: (vars: TVars) => Promise<TData>
  optimistic: (state: AppState, vars: TVars) => AppState
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
    onError(error, _vars, context) {
      if (context?.previous) client.setQueryData(KEY, context.previous)
      toastError(error)
    },
    onSettled() {
      void client.invalidateQueries({ queryKey: KEY })
    },
  })
}

const replaceTask = (state: AppState, id: string, update: (task: Task) => Task): AppState => ({
  ...state,
  tasks: state.tasks.map((task) => (task.id === id ? update(task) : task)),
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
    onSettled() {
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
        return next
      }),
  })
}

export function useDeleteTask() {
  return useOptimistic({
    mutationFn: (id: string) => api.deleteTask(id),
    optimistic: (state, id) => ({ ...state, tasks: state.tasks.filter((t) => t.id !== id) }),
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
    },
    onSettled() {
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
    },
    onSettled() {
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
    onSettled() {
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
    },
    onSettled() {
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

/**
 * Fuerza una relectura de /api/state. Lo usan los flujos que escriben por fuera de
 * las mutaciones de arriba (por ejemplo la subida de adjuntos, que sube al bucket
 * y despues registra el archivo).
 */
export function useRefreshState() {
  const client = useQueryClient()
  return () => client.invalidateQueries({ queryKey: KEY })
}
