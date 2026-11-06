import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { GoogleCalendarInput, MeetCalendarInput } from '../shared/types'
import { api } from './api'

/**
 * Las Meets van en su propio cache, fuera de `['state']`: se refrescan solas cada
 * 5 minutos y no tienen que arrastrar el estado de las tareas en cada vuelta.
 */
const MEETS_KEY = ['meets'] as const
const CALENDARS_KEY = ['meet-calendars'] as const
const GOOGLE_KEY = ['google-accounts'] as const

export const MEETS_REFRESH_MS = 5 * 60_000

/** `enabled` en false (el ajuste apagado) no dispara ningún request. */
export function useMeetsToday(enabled: boolean) {
  return useQuery({
    queryKey: MEETS_KEY,
    queryFn: api.getMeetsToday,
    enabled,
    refetchInterval: enabled ? MEETS_REFRESH_MS : false,
    staleTime: 60_000,
  })
}

export function useMeetCalendars() {
  return useQuery({ queryKey: CALENDARS_KEY, queryFn: api.listMeetCalendars })
}

function useInvalidateMeets() {
  const client = useQueryClient()
  return () => {
    void client.invalidateQueries({ queryKey: CALENDARS_KEY })
    void client.invalidateQueries({ queryKey: GOOGLE_KEY })
    void client.invalidateQueries({ queryKey: MEETS_KEY })
  }
}

export function useCreateMeetCalendar() {
  const onSettled = useInvalidateMeets()
  return useMutation({ mutationFn: (input: MeetCalendarInput) => api.createMeetCalendar(input), onSettled })
}

export function useUpdateMeetCalendar() {
  const onSettled = useInvalidateMeets()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<MeetCalendarInput> }) =>
      api.updateMeetCalendar(id, patch),
    onSettled,
  })
}

export function useDeleteMeetCalendar() {
  const onSettled = useInvalidateMeets()
  return useMutation({ mutationFn: (id: string) => api.deleteMeetCalendar(id), onSettled })
}

/** Espera la lista nueva: así el `isPending` de la mutación cubre hasta que el tilde refleja el cambio. */
function useInvalidateGoogle() {
  const client = useQueryClient()
  return () => {
    void client.invalidateQueries({ queryKey: MEETS_KEY })
    return client.invalidateQueries({ queryKey: GOOGLE_KEY })
  }
}

/** Pide la lista a Google en cada apertura de Ajustes: no hace falta tenerla fresca antes. */
export function useGoogleAccounts() {
  return useQuery({ queryKey: GOOGLE_KEY, queryFn: api.getGoogleAccounts, staleTime: 0 })
}

/** Sale de la app hacia Google; vuelve por /api/google/callback a `/?google=…`. */
export function useConnectGoogle() {
  return useMutation({
    mutationFn: api.startGoogleConnect,
    onSuccess: ({ url }) => window.location.assign(url),
  })
}

export function useDisconnectGoogle() {
  const onSettled = useInvalidateGoogle()
  return useMutation({ mutationFn: (id: string) => api.disconnectGoogleAccount(id), onSettled })
}

export function useAddGoogleCalendar() {
  const onSettled = useInvalidateGoogle()
  return useMutation({ mutationFn: (input: GoogleCalendarInput) => api.addGoogleCalendar(input), onSettled })
}

export function useUpdateGoogleCalendar() {
  const onSettled = useInvalidateGoogle()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: { name?: string; colorKey?: string } }) =>
      api.updateGoogleCalendar(id, patch),
    onSettled,
  })
}

export function useRemoveGoogleCalendar() {
  const onSettled = useInvalidateGoogle()
  return useMutation({ mutationFn: (id: string) => api.removeGoogleCalendar(id), onSettled })
}
