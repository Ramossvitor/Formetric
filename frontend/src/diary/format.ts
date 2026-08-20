import type { GoalBand, Nutrient } from '../planning/api'
import type { DailyLog, DiaryTotals } from './api'

export interface GoalReference {
  label: string
  minValue: number | null
  maxValue: number | null
  minInclusive: boolean
  maxInclusive: boolean
  remainingToRange: number | null
  excessOverRange: number | null
}

export function localIsoDate(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function displayDate(date: string) {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'full', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`))
}

export function number(value: number, digits = 1) {
  return value.toLocaleString('pt-BR', { maximumFractionDigits: digits })
}

export function requiresFastingConfirmation(log: DailyLog | null) {
  return !log || (log.waterLogs.length === 0 && log.meals.every((meal) => meal.items.length === 0))
}

const nutrientValue: Record<Nutrient, (totals: DiaryTotals, log: DailyLog) => number> = {
  PROTEIN: (totals) => totals.proteinG,
  CARBOHYDRATE: (totals) => totals.carbohydrateG,
  FAT: (totals) => totals.fatG,
  FIBER: (totals) => totals.fiberG,
  WATER: (_totals, log) => log.waterTotalMl,
}

function contains(band: GoalBand, value: number) {
  const minimum = band.minValue == null || (band.minInclusive ? value >= band.minValue : value > band.minValue)
  const maximum = band.maxValue == null || (band.maxInclusive ? value <= band.maxValue : value < band.maxValue)
  return minimum && maximum
}

function distanceToRange(band: GoalBand, value: number) {
  if (band.minValue != null && value < band.minValue) return band.minValue - value
  if (band.maxValue != null && value > band.maxValue) return value - band.maxValue
  return 0
}

function referenceBand(bands: GoalBand[], value: number) {
  const attained = [...bands]
    .filter((band) => band.countsAsAttained)
    .sort((first, second) => first.position - second.position)
  return attained.find((band) => contains(band, value))
    ?? attained.reduce<GoalBand | undefined>((nearest, candidate) => {
      if (!nearest) return candidate
      const candidateDistance = distanceToRange(candidate, value)
      const nearestDistance = distanceToRange(nearest, value)
      return candidateDistance < nearestDistance ? candidate : nearest
    }, undefined)
}

function toReference(band: GoalBand | undefined, value: number): GoalReference | null {
  if (!band) return null
  const below = band.minValue != null
    && (value < band.minValue || (value === band.minValue && !band.minInclusive))
  const above = band.maxValue != null
    && (value > band.maxValue || (value === band.maxValue && !band.maxInclusive))
  return {
    label: band.label,
    minValue: band.minValue,
    maxValue: band.maxValue,
    minInclusive: band.minInclusive,
    maxInclusive: band.maxInclusive,
    remainingToRange: below ? band.minValue! - value : null,
    excessOverRange: above ? value - band.maxValue! : null,
  }
}

function displayValue(value: number, nutrient: Nutrient) {
  return number(nutrient === 'WATER' ? value / 1000 : value, nutrient === 'WATER' ? 2 : 1)
}

function unit(nutrient: Nutrient) {
  return nutrient === 'WATER' ? 'L' : 'g'
}

export function formatGoalAmount(value: number, nutrient: Nutrient) {
  return `${displayValue(value, nutrient)} ${unit(nutrient)}`
}

export function formatGoalRange(reference: GoalReference, nutrient: Nutrient) {
  const minimum = reference.minValue == null ? null : displayValue(reference.minValue, nutrient)
  const maximum = reference.maxValue == null ? null : displayValue(reference.maxValue, nutrient)
  if (minimum != null && maximum != null) {
    return `${reference.minInclusive ? '≥' : '>'} ${minimum} e ${reference.maxInclusive ? '≤' : '<'} ${maximum} ${unit(nutrient)}`
  }
  if (minimum != null) return `${reference.minInclusive ? '≥' : '>'} ${minimum} ${unit(nutrient)}`
  if (maximum != null) return `${reference.maxInclusive ? '≤' : '<'} ${maximum} ${unit(nutrient)}`
  return reference.label
}

export function formatGoalComparison(reference: GoalReference | null, value: number, nutrient: Nutrient) {
  if (!reference) return null
  if (reference.remainingToRange != null) {
    return reference.remainingToRange === 0
      ? `precisa ultrapassar ${formatGoalAmount(reference.minValue!, nutrient)}`
      : `faltam ${formatGoalAmount(reference.remainingToRange, nutrient)} para a faixa`
  }
  if (reference.excessOverRange != null) {
    return reference.excessOverRange === 0
      ? `no limite superior exclusivo; a faixa exige menos de ${formatGoalAmount(reference.maxValue!, nutrient)}`
      : `${formatGoalAmount(reference.excessOverRange, nutrient)} acima da faixa de referência`
  }
  if (reference.minValue != null && reference.maxValue == null) {
    const difference = value - reference.minValue
    if (difference === 0) {
      return reference.minInclusive
        ? 'na referência mínima'
        : `precisa ultrapassar ${formatGoalAmount(reference.minValue, nutrient)}`
    }
    return `${formatGoalAmount(difference, nutrient)} acima da referência mínima`
  }
  if (reference.maxValue != null && reference.minValue == null) {
    const difference = reference.maxValue - value
    if (difference === 0) {
      return reference.maxInclusive
        ? 'na referência máxima'
        : `no limite superior exclusivo; a faixa exige menos de ${formatGoalAmount(reference.maxValue, nutrient)}`
    }
    return `${formatGoalAmount(difference, nutrient)} até a referência máxima`
  }
  if (reference.minValue != null || reference.maxValue != null) return 'dentro da faixa de referência'
  return null
}

export function goalStates(log: DailyLog) {
  return (log.nutritionGoals?.targets ?? []).map((target) => {
    const value = nutrientValue[target.nutrient](log.totals, log)
    const band = [...target.bands].sort((a, b) => a.position - b.position).find((candidate) => contains(candidate, value))
    const reference = toReference(referenceBand(target.bands, value), value)
    return { target, value, band, reference }
  })
}
