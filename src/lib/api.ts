import type {
  AppState,
  Attachment,
  Category,
  QuickTask,
  Subtask,
  Task,
  TaskInput,
  TaskLink,
} from '../shared/types'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...init,
    headers: init?.body ? { 'content-type': 'application/json' } : undefined,
  })

  if (!response.ok) {
    const detail = await response.json().catch(() => null)
    throw new Error(detail?.error ?? `Error ${response.status} en ${path}`)
  }

  return (await response.json()) as T
}

const json = (payload: unknown) => JSON.stringify(payload)

/** Link que todavia no existe en la base: lo que junta el modal antes de crear la tarea. */
export interface LinkDraft {
  url: string
  title?: string | null
}

export const api = {
  getState: () => request<AppState>('/state'),

  createCategory: (input: { name: string; colorKey: string }) =>
    request<Category>('/categories', { method: 'POST', body: json(input) }),
  updateCategory: (id: string, patch: { name?: string; colorKey?: string; position?: number }) =>
    request<Category>(`/categories/${id}`, { method: 'PATCH', body: json(patch) }),
  deleteCategory: (id: string) => request<unknown>(`/categories/${id}`, { method: 'DELETE' }),

  createTask: (input: TaskInput & { subtasks?: string[]; links?: LinkDraft[] }) =>
    request<Task>('/tasks', { method: 'POST', body: json(input) }),
  updateTask: (id: string, patch: Partial<TaskInput>) =>
    request<Task>(`/tasks/${id}`, { method: 'PATCH', body: json(patch) }),
  deleteTask: (id: string) => request<unknown>(`/tasks/${id}`, { method: 'DELETE' }),

  createSubtask: (input: { taskId: string; title: string }) =>
    request<Subtask>('/subtasks', { method: 'POST', body: json(input) }),
  updateSubtask: (id: string, patch: { title?: string; done?: boolean }) =>
    request<Subtask>(`/subtasks/${id}`, { method: 'PATCH', body: json(patch) }),
  deleteSubtask: (id: string) => request<unknown>(`/subtasks/${id}`, { method: 'DELETE' }),

  createQuickTask: (title: string) =>
    request<QuickTask>('/quick-tasks', { method: 'POST', body: json({ title }) }),
  updateQuickTask: (id: string, patch: { title?: string; done?: boolean }) =>
    request<QuickTask>(`/quick-tasks/${id}`, { method: 'PATCH', body: json(patch) }),
  deleteQuickTask: (id: string) => request<unknown>(`/quick-tasks/${id}`, { method: 'DELETE' }),

  createLink: (input: { taskId: string; url: string; title?: string | null }) =>
    request<TaskLink>('/links', { method: 'POST', body: json(input) }),
  updateLink: (id: string, patch: { url?: string; title?: string | null }) =>
    request<TaskLink>(`/links/${id}`, { method: 'PATCH', body: json(patch) }),
  deleteLink: (id: string) => request<unknown>(`/links/${id}`, { method: 'DELETE' }),

  signUpload: (input: { taskId: string; fileName: string; contentType: string }) =>
    request<{ objectKey: string; uploadUrl: string }>('/uploads/sign', {
      method: 'POST',
      body: json(input),
    }),
  createAttachment: (input: {
    taskId: string
    objectKey: string
    fileName: string
    contentType: string
    sizeBytes: number
  }) => request<Attachment>('/attachments', { method: 'POST', body: json(input) }),
  getAttachmentUrl: (id: string) => request<{ url: string }>(`/attachments/${id}`),
  deleteAttachment: (id: string) => request<unknown>(`/attachments/${id}`, { method: 'DELETE' }),
}
