import type { GoalBand, NutritionGoalPeriod, Nutrient } from './api'

const nutrientLabels: Record<Nutrient, string> = {
  PROTEIN: 'Proteína',
  CARBOHYDRATE: 'Carboidratos',
  FAT: 'Gorduras',
  FIBER: 'Fibras',
  WATER: 'Água',
}

export function todayAsLocalIsoDate() {
  const today = new Date()
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const day = String(today.getDate()).padStart(2, '0')
  return `${today.getFullYear()}-${month}-${day}`
}

export function formatIsoDate(date: string) {
  const [year, month, day] = date.split('-').map(Number)
  return new Intl.DateTimeFormat('pt-BR').format(new Date(year, month - 1, day))
}

export function formatValidity(validFrom: string, validTo: string | null) {
  if (!validTo) {
    return `Desde ${formatIsoDate(validFrom)}`
  }

  return `${formatIsoDate(validFrom)} — antes de ${formatIsoDate(validTo)}`
}

function thresholdBand(bands: GoalBand[]) {
  return [...bands]
    .sort((first, second) => first.position - second.position)
    .find((band) => band.minValue !== null || band.maxValue !== null)
}

export function goalSummaries(period: NutritionGoalPeriod) {
  return period.targets.map((target) => {
    const sortedBands = [...target.bands].sort((first, second) => first.position - second.position)
    const positiveBand = sortedBands.find((band) => band.tone === 'POSITIVE') ?? thresholdBand(sortedBands)
    const value = positiveBand?.minValue ?? positiveBand?.maxValue
    const operator = positiveBand?.minValue !== null && positiveBand?.minValue !== undefined ? '≥' : '≤'
    const unit = target.unit === 'ML' ? 'ml' : 'g'

    return {
      nutrient: target.nutrient,
      label: nutrientLabels[target.nutrient],
      value: value === null || value === undefined ? 'Faixas configuradas' : `${operator} ${value} ${unit}`,
    }
  })
}
