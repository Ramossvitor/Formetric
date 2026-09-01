import { keepPreviousData, queryOptions, type QueryClient } from '@tanstack/react-query'
import { getAnalyticsSeries, getDailyAnalytics, getMonthlyAnalytics, type AnalyticsMetric } from './api'

export const analyticsQueryKey = ['analytics'] as const

/** Marks every derived analytics view stale after one of its source records changes. */
export function invalidateAnalytics(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: analyticsQueryKey })
}

export function dailyAnalyticsQuery(date: string | undefined) {
  return queryOptions({
    queryKey: [...analyticsQueryKey, 'daily', date],
    queryFn: () => getDailyAnalytics(date!),
    placeholderData: keepPreviousData,
    enabled: Boolean(date),
  })
}

export function monthlyAnalyticsQuery(month: string | undefined) {
  return queryOptions({
    queryKey: [...analyticsQueryKey, 'monthly', month],
    queryFn: () => getMonthlyAnalytics(month!),
    placeholderData: keepPreviousData,
    enabled: Boolean(month),
  })
}

export function analyticsSeriesQuery(metric: AnalyticsMetric, from: string | undefined, to: string | undefined) {
  return queryOptions({
    queryKey: [...analyticsQueryKey, 'series', metric, { from, to }],
    queryFn: () => getAnalyticsSeries(metric, from!, to!),
    placeholderData: keepPreviousData,
    enabled: Boolean(from && to),
  })
}
