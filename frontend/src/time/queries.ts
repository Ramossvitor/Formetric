import { queryOptions } from '@tanstack/react-query'
import { getProfileTimeContext } from './api'

export const profileTimeContextQueryKey = ['profile', 'time-context'] as const

export const profileTimeContextQuery = queryOptions({
  queryKey: profileTimeContextQueryKey,
  queryFn: getProfileTimeContext,
  staleTime: Infinity,
  retry: false,
  refetchOnWindowFocus: 'always',
})
