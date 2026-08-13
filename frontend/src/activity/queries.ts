import { queryOptions } from '@tanstack/react-query'
import { getWeightOverview, listWorkouts } from './api'

export const activityQueryKey = ['activity'] as const
export const workoutsQueryKey = [...activityQueryKey, 'workouts'] as const
export const weightLogsQueryKey = [...activityQueryKey, 'weight-logs'] as const

export function workoutsQuery(from: string, to: string) {
  return queryOptions({
    queryKey: [...workoutsQueryKey, { from, to }],
    queryFn: () => listWorkouts(from, to),
  })
}

export function weightOverviewQuery(from: string, to: string) {
  return queryOptions({
    queryKey: [...weightLogsQueryKey, 'overview', { from, to }],
    queryFn: () => getWeightOverview(from, to),
  })
}
