import { apiRequest } from '../api/http'

export type DiaryAnalyticsStatus = 'MISSING' | 'OPEN' | 'CLOSED'

export type AnalyticsAvailability =
  | 'AVAILABLE'
  | 'MISSING_LOG'
  | 'OPEN_LOG'
  | 'MISSING_VALUE'
  | 'MISSING_TDEE'

export type AnalyticsMetric =
  | 'CALORIES'
  | 'PROTEIN'
  | 'CARBOHYDRATE'
  | 'FAT'
  | 'FIBER'
  | 'WATER'
  | 'ENERGY_BALANCE'
  | 'WEIGHT'

export type NutrientType = 'PROTEIN' | 'CARBOHYDRATE' | 'FAT' | 'FIBER' | 'WATER'

export interface NutritionValues {
  caloriesKcal: number | null
  proteinG: number | null
  carbohydrateG: number | null
  fatG: number | null
  fiberG: number | null
  waterMl: number | null
}

export interface GoalProgress {
  nutrient: NutrientType
  value: number | null
  bandLabel: string | null
  attained: boolean | null
}

export interface WorkoutSummary {
  sessionCount: number
  trainingDays: number
  totalDurationMinutes: number
  sessionsPerWeek: number | null
  modalities: string[]
}

export interface DailyAnalytics {
  date: string
  diaryStatus: DiaryAnalyticsStatus
  fastingConfirmed: boolean
  historicalEligible: boolean
  foodItemCount: number
  waterEntryCount: number
  nutrition: NutritionValues
  tdeeKcal: number | null
  energyBalanceKcal: number | null
  projectedEnergyBalanceKcal: number | null
  energyBalanceAvailability: AnalyticsAvailability
  calorieTargetKcal: number | null
  goalProgress: GoalProgress[]
  weightKg: number | null
  workouts: WorkoutSummary
}

export interface MetricAggregate {
  total: number | null
  average: number | null
  sampleCount: number
}

export interface MonthlyNutrition {
  caloriesKcal: MetricAggregate
  proteinG: MetricAggregate
  carbohydrateG: MetricAggregate
  fatG: MetricAggregate
  fiberG: MetricAggregate
  waterMl: MetricAggregate
}

export interface EnergyExtreme {
  date: string
  balanceKcal: number
}

export interface EnergySummary {
  netBalanceKcal: number | null
  deficitMagnitudeKcal: number | null
  surplusKcal: number | null
  averageBalanceKcal: number | null
  eligibleDays: number
  missingTdeeDays: number
  missingNutritionDays: number
  deficitDays: number
  surplusDays: number
  neutralDays: number
  largestDeficit: EnergyExtreme | null
  largestSurplus: EnergyExtreme | null
}

export interface GoalAttainment {
  nutrient: NutrientType
  configured: boolean
  attainedDays: number
  eligibleDays: number
  attainedPercentage: number | null
}

export interface WeightPeriodSummary {
  observationCount: number
  initialWeightKg: number | null
  finalWeightKg: number | null
  changeKg: number | null
  minimumWeightKg: number | null
  maximumWeightKg: number | null
}

export interface ConsumptionExtreme {
  date: string
  caloriesKcal: number
}

export interface MonthlyAnalytics {
  month: string
  periodStart: string
  periodEnd: string
  throughDate: string | null
  elapsedCalendarDays: number
  closedDays: number
  openDays: number
  missingDiaryDays: number
  nutrition: MonthlyNutrition
  energy: EnergySummary
  goalAttainment: GoalAttainment[]
  workouts: WorkoutSummary
  weight: WeightPeriodSummary
  highestConsumption: ConsumptionExtreme | null
  lowestConsumption: ConsumptionExtreme | null
}

export interface AnalyticsSeriesPoint {
  date: string
  value: number | null
  availability: AnalyticsAvailability
}

export interface AnalyticsSeries {
  metric: AnalyticsMetric
  unit: string
  from: string
  to: string
  points: AnalyticsSeriesPoint[]
}

export interface AnalyticsBounds {
  earliestDate: string | null
  latestDate: string | null
  today: string
}

export function getDailyAnalytics(date: string): Promise<DailyAnalytics> {
  return apiRequest<DailyAnalytics>(`/api/v1/analytics/daily?${new URLSearchParams({ date })}`)
}

export function getMonthlyAnalytics(month: string): Promise<MonthlyAnalytics> {
  return apiRequest<MonthlyAnalytics>(`/api/v1/analytics/monthly?${new URLSearchParams({ month })}`)
}

export function getAnalyticsSeries(metric: AnalyticsMetric, from: string, to: string): Promise<AnalyticsSeries> {
  return apiRequest<AnalyticsSeries>(`/api/v1/analytics/series?${new URLSearchParams({ metric, from, to })}`)
}

export function getAnalyticsBounds(): Promise<AnalyticsBounds> {
  return apiRequest<AnalyticsBounds>('/api/v1/analytics/bounds')
}
