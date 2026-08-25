import { formatPlainDate } from '../time/plainDate'
import type { GoalBand, NutritionGoalPeriod, Nutrient } from './api'

const nutrientLabels: Record<Nutrient, string> = {
  CALORIES: 'Calorias',
  PROTEIN: 'Proteína',
  CARBOHYDRATE: 'Carboidratos',
  FAT: 'Gorduras',
  FIBER: 'Fibras',
  WATER: 'Água',
}

export function formatIsoDate(date: string, locale: string) {
  return formatPlainDate(date, locale, { dateStyle: 'short' })
}

export function formatValidity(validFrom: string, validTo: string | null, locale: string) {
  if (!validTo) {
    return `Desde ${formatIsoDate(validFrom, locale)}`
  }

  return `${formatIsoDate(validFrom, locale)} — antes de ${formatIsoDate(validTo, locale)}`
}

function thresholdBand(bands: GoalBand[]) {
  return [...bands]
    .sort((first, second) => first.position - second.position)
    .find((band) => band.minValue !== null || band.maxValue !== null)
}

function formatGoalBandRange(band: GoalBand, unit: string) {
  const formatValue = (value: number) => value.toLocaleString('pt-BR', { maximumFractionDigits: 3 })
  const { minValue, maxValue } = band

  if (minValue === null && maxValue === null) return 'Qualquer valor'
  if (minValue === null && maxValue !== null) {
    return `${band.maxInclusive ? '≤' : '<'} ${formatValue(maxValue)} ${unit}`
  }
  if (minValue !== null && maxValue === null) {
    return `${band.minInclusive ? '≥' : '>'} ${formatValue(minValue)} ${unit}`
  }
  if (minValue === null || maxValue === null) return 'Faixa configurada'
  if (minValue === maxValue) return `= ${formatValue(minValue)} ${unit}`

  return `${formatValue(minValue)} ${band.minInclusive ? '≤' : '<'} valor ${band.maxInclusive ? '≤' : '<'} ${formatValue(maxValue)} ${unit}`
}

export function goalSummaries(period: NutritionGoalPeriod) {
  const summaries = period.targets.map((target) => {
    const sortedBands = [...target.bands].sort((first, second) => first.position - second.position)
    const attainedBand =
      sortedBands.find((band) => band.countsAsAttained) ??
      sortedBands.find((band) => band.tone === 'POSITIVE') ??
      thresholdBand(sortedBands)
    const unit = target.unit === 'KCAL' ? 'kcal' : target.unit === 'ML' ? 'ml' : 'g'

    return {
      nutrient: target.nutrient,
      label: nutrientLabels[target.nutrient],
      value: attainedBand ? formatGoalBandRange(attainedBand, unit) : 'Faixas configuradas',
    }
  })

  return summaries.some((summary) => summary.nutrient === 'CALORIES')
    ? summaries
    : [
        {
          nutrient: 'CALORIES' as const,
          label: nutrientLabels.CALORIES,
          value: 'Classificação não configurada',
        },
        ...summaries,
      ]
}
