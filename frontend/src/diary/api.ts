import { ApiError, apiRequest } from '../api/http'
import type { DataQuality, FoodUnit } from '../catalog/api'
import type { GoalTone, Nutrient, NutritionGoalPeriod } from '../planning/api'

export type DailyLogStatus = 'OPEN' | 'CLOSED'
export type CatalogItemType = 'FOOD' | 'RECIPE'

export interface DiaryTotals {
  kcal: number
  proteinG: number
  carbohydrateG: number
  fatG: number
  fiberG: number
  sodiumMg: number | null
}

export interface MealItem extends DiaryTotals {
  id: string
  itemType: CatalogItemType
  versionId: string
  servingOptionId: string | null
  position: number
  quantity: number
  unit: FoodUnit
  equivalentBasisQuantity: number
  basisQuantity: number
  basisUnit: FoodUnit
  conversionFactor: number
  name: string
  dataQuality: DataQuality
  uncertaintyKcal: number | null
}

export interface Meal {
  id: string
  name: string
  position: number
  mealTime: string | null
  items: MealItem[]
  totals: DiaryTotals
}

export interface WaterLog {
  id: string
  loggedAt: string
  volumeMl: number
}

export interface StateEvent {
  type: 'CREATED' | 'CLOSED' | 'REOPENED'
  fastingConfirmed: boolean
  actorUserId: string
  occurredAt: string
}

export interface EffectiveNutritionGoals extends Pick<NutritionGoalPeriod, 'calorieTarget' | 'targets'> {}

export interface DailyGoalReference {
  label: string
  minValue: number | null
  maxValue: number | null
  minInclusive: boolean
  maxInclusive: boolean
  remainingToRange: number | null
  excessOverRange: number | null
}

export interface DailyGoalProgress {
  nutrient: Nutrient
  value: number | null
  bandLabel: string | null
  bandTone: GoalTone | null
  attained: boolean | null
  reference: DailyGoalReference | null
}

export interface DailyLog {
  id: string
  date: string
  status: DailyLogStatus
  meals: Meal[]
  waterLogs: WaterLog[]
  waterTotalMl: number
  totals: DiaryTotals
  tdeeKcal: number | null
  energyBalanceKcal: number | null
  energyBalanceAvailability: 'AVAILABLE' | 'UNAVAILABLE'
  nutritionGoals: EffectiveNutritionGoals | null
  goalProgress: DailyGoalProgress[]
  createdAt: string
  updatedAt: string
  closedAt: string | null
  stateEvents: StateEvent[]
}

export interface MealInput {
  name: string
  position?: number | null
  mealTime: string | null
}

export interface MealItemInput {
  itemType: CatalogItemType
  versionId: string
  quantity: number
  unit: FoodUnit
  servingOptionId: string | null
  position?: number | null
  dataQuality: DataQuality | null
  uncertaintyKcal: number | null
}

export async function getDailyLog(date: string): Promise<DailyLog | null> {
  try {
    return await apiRequest<DailyLog>(`/api/v1/daily-logs/${date}`)
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null
    throw error
  }
}

export function createMeal(date: string, input: MealInput): Promise<DailyLog> {
  return apiRequest<DailyLog>(`/api/v1/daily-logs/${date}/meals`, {
    method: 'POST',
    body: { ...input, position: input.position ?? null, requestId: crypto.randomUUID() },
    csrf: true,
  })
}

export function updateMeal(date: string, mealId: string, input: MealInput & { position: number }): Promise<DailyLog> {
  return apiRequest<DailyLog>(`/api/v1/daily-logs/${date}/meals/${mealId}`, {
    method: 'PATCH', body: input, csrf: true,
  })
}

export function deleteMeal(date: string, mealId: string): Promise<DailyLog> {
  return apiRequest<DailyLog>(`/api/v1/daily-logs/${date}/meals/${mealId}`, { method: 'DELETE', csrf: true })
}

export function addMealItem(date: string, mealId: string, input: MealItemInput): Promise<DailyLog> {
  return apiRequest<DailyLog>(`/api/v1/daily-logs/${date}/meals/${mealId}/items`, {
    method: 'POST',
    body: { ...input, position: input.position ?? null, requestId: crypto.randomUUID() },
    csrf: true,
  })
}

export function updateMealItem(date: string, mealId: string, itemId: string, input: MealItemInput): Promise<DailyLog> {
  return apiRequest<DailyLog>(`/api/v1/daily-logs/${date}/meals/${mealId}/items/${itemId}`, {
    method: 'PUT', body: input, csrf: true,
  })
}

export function deleteMealItem(date: string, mealId: string, itemId: string): Promise<DailyLog> {
  return apiRequest<DailyLog>(`/api/v1/daily-logs/${date}/meals/${mealId}/items/${itemId}`, { method: 'DELETE', csrf: true })
}

export interface AddWaterOptions {
  loggedAt?: string
}

export function addWater(date: string, volumeMl: number, options: AddWaterOptions = {}): Promise<DailyLog> {
  return apiRequest<DailyLog>(`/api/v1/daily-logs/${date}/water`, {
    method: 'POST',
    body: {
      volumeMl,
      requestId: crypto.randomUUID(),
      ...(options.loggedAt ? { loggedAt: options.loggedAt } : {}),
    },
    csrf: true,
  })
}

export function deleteWater(date: string, waterId: string): Promise<DailyLog> {
  return apiRequest<DailyLog>(`/api/v1/daily-logs/${date}/water/${waterId}`, { method: 'DELETE', csrf: true })
}

export function closeDailyLog(date: string, fastingConfirmed: boolean): Promise<DailyLog> {
  return apiRequest<DailyLog>(`/api/v1/daily-logs/${date}/close`, {
    method: 'POST', body: { fastingConfirmed }, csrf: true,
  })
}

export function reopenDailyLog(date: string): Promise<DailyLog> {
  return apiRequest<DailyLog>(`/api/v1/daily-logs/${date}/reopen`, { method: 'POST', csrf: true })
}

export function copyMeal(date: string, sourceDate: string, sourceMealId: string): Promise<DailyLog> {
  return apiRequest<DailyLog>(`/api/v1/daily-logs/${date}/meals/copy`, {
    method: 'POST', body: { sourceDate, sourceMealId, requestId: crypto.randomUUID() }, csrf: true,
  })
}

export function copyDay(date: string, sourceDate: string): Promise<DailyLog> {
  return apiRequest<DailyLog>(`/api/v1/daily-logs/${date}/copy`, {
    method: 'POST', body: { sourceDate, requestId: crypto.randomUUID() }, csrf: true,
  })
}
