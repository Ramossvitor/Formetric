import { z } from 'zod'

const positiveValue = (label: string, maximum: number) =>
  z
    .number({ error: `Informe ${label}.` })
    .positive(`${label} deve ser maior que zero.`)
    .max(maximum, `${label} deve ser no máximo ${maximum.toLocaleString('pt-BR')}.`)

export const nutritionGoalFormSchema = z.object({
  validFrom: z.iso.date('Informe uma data válida.'),
  calorieTarget: positiveValue('a meta calórica', 20_000),
  proteinMin: positiveValue('a proteína mínima', 1_000),
  carbohydrateMax: positiveValue('o limite de carboidratos', 2_000),
  fatMax: positiveValue('o limite de gorduras', 1_000),
  fiberMin: positiveValue('a fibra mínima', 500),
  waterMin: positiveValue('a água mínima', 20_000),
})

export const tdeeFormSchema = z.object({
  validFrom: z.iso.date('Informe uma data válida.'),
  kcalPerDay: positiveValue('o TDEE', 20_000),
})

export type NutritionGoalFormValues = z.infer<typeof nutritionGoalFormSchema>
export type TdeeFormValues = z.infer<typeof tdeeFormSchema>
