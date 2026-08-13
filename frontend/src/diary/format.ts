import type { GoalBand, Nutrient } from '../planning/api'
import type { DailyLog, DiaryTotals } from './api'

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

export function goalStates(log: DailyLog) {
  return (log.nutritionGoals?.targets ?? []).map((target) => {
    const value = nutrientValue[target.nutrient](log.totals, log)
    const band = [...target.bands].sort((a, b) => a.position - b.position).find((candidate) => contains(candidate, value))
    return { target, value, band }
  })
}
