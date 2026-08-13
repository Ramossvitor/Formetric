import { z } from 'zod'

const requiredNumber = (label: string, maximum: number) =>
  z
    .number({ error: `Informe ${label}.` })
    .finite(`${label} deve ser um número válido.`)
    .nonnegative(`${label} não pode ser negativo.`)
    .max(maximum, `${label} excede o valor máximo permitido.`)

const positiveNumber = (label: string, maximum: number) =>
  requiredNumber(label, maximum).positive(`${label} deve ser maior que zero.`)

export const foodUnitSchema = z.enum(['G', 'ML', 'UNIT', 'TABLESPOON', 'SLICE', 'PORTION'])

export const foodFormSchema = z.object({
  name: z.string().trim().min(2, 'Informe o nome do alimento.').max(160),
  brand: z.string().trim().max(120).nullable(),
  notes: z.string().trim().max(1_000).nullable(),
  referenceQuantity: positiveNumber('a quantidade de referência', 100_000),
  referenceUnit: foodUnitSchema,
  caloriesKcal: requiredNumber('as calorias', 100_000),
  proteinG: requiredNumber('as proteínas', 10_000),
  carbohydrateG: requiredNumber('os carboidratos', 10_000),
  fatG: requiredNumber('as gorduras', 10_000),
  fiberG: requiredNumber('as fibras', 10_000),
  sodiumMg: requiredNumber('o sódio', 1_000_000).nullable(),
  quality: z.enum(['EXACT', 'ESTIMATED', 'HIGHLY_ESTIMATED']),
  kcalUncertainty: requiredNumber('a incerteza calórica', 100_000).nullable(),
  servings: z.array(
    z.object({
      label: z.string().trim().min(1, 'Informe o nome da porção.').max(80),
      unit: foodUnitSchema,
      quantity: positiveNumber('a quantidade da porção', 100_000),
      referenceQuantityEquivalent: positiveNumber('o equivalente na referência', 100_000),
    }),
  ).max(20),
})

export const recipeFormSchema = z.object({
  name: z.string().trim().min(2, 'Informe o nome da receita.').max(160),
  notes: z.string().trim().max(1_000).nullable(),
  yieldQuantity: positiveNumber('o rendimento', 1_000_000),
  yieldUnit: z.enum(['G', 'ML', 'PORTION']),
  servingQuantity: positiveNumber('o tamanho da porção', 1_000_000).nullable(),
  ingredients: z.array(
    z.object({
      foodVersionId: z.string().min(1, 'Selecione um alimento.'),
      quantity: positiveNumber('a quantidade do ingrediente', 1_000_000),
      unit: foodUnitSchema,
      referenceQuantityEquivalent: positiveNumber('o equivalente na referência', 1_000_000).nullable(),
    }),
  ).min(1, 'Adicione pelo menos um ingrediente.').max(100),
})

export type FoodFormValues = z.infer<typeof foodFormSchema>
export type RecipeFormValues = z.infer<typeof recipeFormSchema>
