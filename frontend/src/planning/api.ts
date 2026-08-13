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

export interface SimpleNutritionGoalInput {
  validFrom: string
  calorieTarget: number
  proteinMin: number
  carbohydrateMax: number
  fatMax: number
  fiberMin: number
  waterMin: number
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

function minimumBands(minimum: number, achievedLabel: string): GoalBand[] {
  return [
    {
      position: 0,
      minValue: null,
      maxValue: minimum,
      minInclusive: false,
      maxInclusive: false,
      label: 'Abaixo da meta',
      tone: 'WARNING',
    },
    {
      position: 1,
      minValue: minimum,
      maxValue: null,
      minInclusive: true,
      maxInclusive: false,
      label: achievedLabel,
      tone: 'POSITIVE',
    },
  ]
}

function maximumBands(maximum: number, idealLabel: string): GoalBand[] {
  return [
    {
      position: 0,
      minValue: null,
      maxValue: maximum,
      minInclusive: false,
      maxInclusive: true,
      label: idealLabel,
      tone: 'POSITIVE',
    },
    {
      position: 1,
      minValue: maximum,
      maxValue: null,
      minInclusive: false,
      maxInclusive: false,
      label: 'Acima do planejado',
      tone: 'WARNING',
    },
  ]
}

export function toNutritionGoalRequest(
  input: SimpleNutritionGoalInput,
): CreateNutritionGoalPeriodRequest {
  return {
    validFrom: input.validFrom,
    validTo: null,
    calorieTarget: input.calorieTarget,
    targets: [
      {
        nutrient: 'PROTEIN',
        unit: 'G',
        bands: minimumBands(input.proteinMin, 'Meta atingida'),
      },
      {
        nutrient: 'CARBOHYDRATE',
        unit: 'G',
        bands: maximumBands(input.carbohydrateMax, 'Faixa ideal'),
      },
      {
        nutrient: 'FAT',
        unit: 'G',
        bands: maximumBands(input.fatMax, 'Dentro do limite'),
      },
      {
        nutrient: 'FIBER',
        unit: 'G',
        bands: minimumBands(input.fiberMin, 'Meta atingida'),
      },
      {
        nutrient: 'WATER',
        unit: 'ML',
        bands: minimumBands(input.waterMin, 'Meta atingida'),
      },
    ],
  }
}

export function listNutritionGoalPeriods(): Promise<NutritionGoalPeriod[]> {
  return apiRequest<NutritionGoalPeriod[]>('/api/v1/nutrition-goal-periods')
}

export function createNutritionGoalPeriod(
  input: SimpleNutritionGoalInput,
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
  kcalPerDay: number
}): Promise<TdeePeriod> {
  const request: CreateTdeePeriodRequest = {
    ...input,
    validTo: null,
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
