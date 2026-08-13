import type { DataQuality, FoodUnit, NutritionValues } from './api'

export const unitLabels: Record<FoodUnit, string> = {
  G: 'g',
  ML: 'ml',
  UNIT: 'unidade',
  TABLESPOON: 'colher',
  SLICE: 'fatia',
  PORTION: 'porção',
}

export const qualityLabels: Record<DataQuality, string> = {
  EXACT: 'Exato',
  ESTIMATED: 'Estimado',
  HIGHLY_ESTIMATED: 'Altamente estimado',
}

export function formatNumber(value: number, maximumFractionDigits = 1) {
  return value.toLocaleString('pt-BR', { maximumFractionDigits })
}

export function formatNutrition(nutrition: NutritionValues) {
  return [
    { label: 'Calorias', value: `${formatNumber(nutrition.caloriesKcal)} kcal` },
    { label: 'Proteínas', value: `${formatNumber(nutrition.proteinG)} g` },
    { label: 'Carboidratos', value: `${formatNumber(nutrition.carbohydrateG)} g` },
    { label: 'Gorduras', value: `${formatNumber(nutrition.fatG)} g` },
    { label: 'Fibras', value: `${formatNumber(nutrition.fiberG)} g` },
    ...(nutrition.sodiumMg == null
      ? []
      : [{ label: 'Sódio', value: `${formatNumber(nutrition.sodiumMg, 0)} mg` }]),
  ]
}
