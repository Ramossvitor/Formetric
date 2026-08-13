import { queryOptions } from '@tanstack/react-query'
import {
  getEffectiveNutritionGoal,
  getEffectiveTdee,
  listNutritionGoalPeriods,
  listTdeePeriods,
} from './api'

export const nutritionGoalPeriodsQueryKey = ['planning', 'nutrition-goal-periods'] as const
export const tdeePeriodsQueryKey = ['planning', 'tdee-periods'] as const

export const nutritionGoalPeriodsQuery = queryOptions({
  queryKey: nutritionGoalPeriodsQueryKey,
  queryFn: listNutritionGoalPeriods,
})

export const tdeePeriodsQuery = queryOptions({
  queryKey: tdeePeriodsQueryKey,
  queryFn: listTdeePeriods,
})

export function effectiveNutritionGoalQuery(date: string) {
  return queryOptions({
    queryKey: [...nutritionGoalPeriodsQueryKey, 'effective', date],
    queryFn: () => getEffectiveNutritionGoal(date),
  })
}

export function effectiveTdeeQuery(date: string) {
  return queryOptions({
    queryKey: [...tdeePeriodsQueryKey, 'effective', date],
    queryFn: () => getEffectiveTdee(date),
  })
}
