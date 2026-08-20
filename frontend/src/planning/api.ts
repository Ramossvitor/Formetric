import { ApiError, apiRequest } from '../api/http'

export type Nutrient = 'PROTEIN' | 'CARBOHYDRATE' | 'FAT' | 'FIBER' | 'WATER'
export type NutrientUnit = 'G' | 'ML'
export type GoalTone = 'POSITIVE' | 'NEUTRAL' | 'WARNING'

export interface GoalBand {
  position: number
  minValue: number | null
  maxValue: number | null
  minInclusive: boolean
  maxInclusive: boolean
  label: string
  tone: GoalTone
  countsAsAttained: boolean
}

export interface NutrientTarget {
  nutrient: Nutrient
  unit: NutrientUnit
  bands: GoalBand[]
}

export interface NutritionGoalPeriod {
  id: string
  validFrom: string
  validTo: string | null
  calorieTarget: number
  targets: NutrientTarget[]
}

export interface TdeePeriod {
  id: string
  validFrom: string
  validTo: string | null
  kcalPerDay: number
}

export type EditableGoalBand = Omit<GoalBand, 'position'>

export interface EditableNutrientTarget {
  nutrient: Nutrient
  bands: EditableGoalBand[]
}

export interface NutritionGoalInput {
  validFrom: string
  validTo: string | null
  calorieTarget: number
  targets: EditableNutrientTarget[]
}

export interface CreateNutritionGoalPeriodRequest {
  validFrom: string
  validTo: string | null
  calorieTarget: number
  targets: NutrientTarget[]
}

export interface CreateTdeePeriodRequest {
  validFrom: string
  validTo: string | null
  kcalPerDay: number
}

export function canonicalNutrientUnit(nutrient: Nutrient): NutrientUnit {
  return nutrient === 'WATER' ? 'ML' : 'G'
}

export function toNutritionGoalRequest(
  input: NutritionGoalInput,
): CreateNutritionGoalPeriodRequest {
  return {
    validFrom: input.validFrom,
    validTo: input.validTo || null,
    calorieTarget: input.calorieTarget,
    targets: input.targets.map((target) => ({
      nutrient: target.nutrient,
      unit: canonicalNutrientUnit(target.nutrient),
      bands: target.bands.map((band, position) => ({
        ...band,
        position,
        minInclusive: band.minValue === null ? false : band.minInclusive,
        maxInclusive: band.maxValue === null ? false : band.maxInclusive,
        label: band.label.trim(),
      })),
    })),
  }
}

export function listNutritionGoalPeriods(): Promise<NutritionGoalPeriod[]> {
  return apiRequest<NutritionGoalPeriod[]>('/api/v1/nutrition-goal-periods')
}

export function createNutritionGoalPeriod(
  input: NutritionGoalInput,
): Promise<NutritionGoalPeriod> {
  return apiRequest<NutritionGoalPeriod>('/api/v1/nutrition-goal-periods', {
    method: 'POST',
    body: toNutritionGoalRequest(input),
    csrf: true,
  })
}

export function listTdeePeriods(): Promise<TdeePeriod[]> {
  return apiRequest<TdeePeriod[]>('/api/v1/tdee-periods')
}

export function createTdeePeriod(input: {
  validFrom: string
  validTo: string | null
  kcalPerDay: number
}): Promise<TdeePeriod> {
  const request: CreateTdeePeriodRequest = {
    ...input,
    validTo: input.validTo || null,
  }

  return apiRequest<TdeePeriod>('/api/v1/tdee-periods', {
    method: 'POST',
    body: request,
    csrf: true,
  })
}

async function getEffectivePeriod<T>(path: string, date: string): Promise<T | null> {
  try {
    return (await apiRequest<T | undefined>(`${path}/effective?date=${encodeURIComponent(date)}`)) ?? null
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return null
    }

    throw error
  }
}

export function getEffectiveNutritionGoal(date: string): Promise<NutritionGoalPeriod | null> {
  return getEffectivePeriod<NutritionGoalPeriod>('/api/v1/nutrition-goal-periods', date)
}

export function getEffectiveTdee(date: string): Promise<TdeePeriod | null> {
  return getEffectivePeriod<TdeePeriod>('/api/v1/tdee-periods', date)
}
