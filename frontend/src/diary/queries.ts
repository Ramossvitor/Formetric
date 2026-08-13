import { queryOptions } from '@tanstack/react-query'
import { getDailyLog } from './api'

export const diaryQueryKey = ['diary'] as const

export function dailyLogQuery(date: string) {
  return queryOptions({
    queryKey: [...diaryQueryKey, date],
    queryFn: () => getDailyLog(date),
  })
}
