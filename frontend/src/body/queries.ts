import { keepPreviousData, queryOptions } from '@tanstack/react-query'
import { compareBodyEvaluations, getBodyEvaluation, listBodyEvaluations } from './api'
import type { BodyEvaluationArchiveStatus } from './api'

export const bodyEvaluationsQueryKey = ['body', 'evaluations'] as const

export function bodyEvaluationsQuery(from: string, to: string, page = 0, archiveStatus: BodyEvaluationArchiveStatus = 'ACTIVE') {
  return queryOptions({
    queryKey: [...bodyEvaluationsQueryKey, 'list', { from, to, page, archiveStatus }],
    queryFn: () => listBodyEvaluations({ from, to, page, size: 20, archiveStatus }),
    placeholderData: keepPreviousData,
  })
}

export function bodyEvaluationQuery(id: string) {
  return queryOptions({
    queryKey: [...bodyEvaluationsQueryKey, 'detail', id],
    queryFn: () => getBodyEvaluation(id),
    enabled: Boolean(id),
  })
}

export function bodyEvaluationComparisonQuery(baselineVersionId: string, followUpVersionId: string) {
  return queryOptions({
    queryKey: [...bodyEvaluationsQueryKey, 'comparison', { baselineVersionId, followUpVersionId }],
    queryFn: () => compareBodyEvaluations(baselineVersionId, followUpVersionId),
    enabled: Boolean(baselineVersionId && followUpVersionId),
  })
}
