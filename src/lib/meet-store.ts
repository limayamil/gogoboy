import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { MeetCalendarInput } from '../shared/types'
import { api } from './api'

/**
 * Las Meets van en su propio cache, fuera de `['state']`: se refrescan solas cada
 * 5 minutos y no tienen que arrastrar el estado de las tareas en cada vuelta.
 */
const MEETS_KEY = ['meets'] as const
const CALENDARS_KEY = ['meet-calendars'] as const

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
