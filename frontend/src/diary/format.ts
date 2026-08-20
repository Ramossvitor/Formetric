import type { Nutrient } from '../planning/api'
import type { DailyGoalReference, DailyLog } from './api'

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

function displayValue(value: number, nutrient: Nutrient) {
  if (nutrient === 'WATER') return number(value / 1000, 2)
  return number(value, nutrient === 'CALORIES' ? 0 : 1)
}

function unit(nutrient: Nutrient) {
  if (nutrient === 'CALORIES') return 'kcal'
  return nutrient === 'WATER' ? 'L' : 'g'
}

export function formatGoalAmount(value: number, nutrient: Nutrient) {
  return `${displayValue(value, nutrient)} ${unit(nutrient)}`
}

export function formatGoalRange(reference: DailyGoalReference, nutrient: Nutrient) {
  const minimum = reference.minValue == null ? null : displayValue(reference.minValue, nutrient)
  const maximum = reference.maxValue == null ? null : displayValue(reference.maxValue, nutrient)
  if (minimum != null && maximum != null) {
    return `${reference.minInclusive ? '≥' : '>'} ${minimum} e ${reference.maxInclusive ? '≤' : '<'} ${maximum} ${unit(nutrient)}`
  }
  if (minimum != null) return `${reference.minInclusive ? '≥' : '>'} ${minimum} ${unit(nutrient)}`
  if (maximum != null) return `${reference.maxInclusive ? '≤' : '<'} ${maximum} ${unit(nutrient)}`
  return reference.label
}

export function formatGoalComparison(reference: DailyGoalReference | null, nutrient: Nutrient) {
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
  if (reference.minValue != null || reference.maxValue != null) return 'dentro da faixa de referência'
  return null
}
