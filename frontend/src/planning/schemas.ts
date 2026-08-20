import { z } from 'zod'
import type { EditableGoalBand, Nutrient } from './api'

export function hasAtMostThreeFractionDigits(value: number) {
  const scaled = value * 1000
  return Math.abs(scaled - Math.round(scaled)) < 1e-7
}

const positiveValue = (label: string, maximum: number) =>
  z
    .number({ error: `Informe ${label}.` })
    .positive(`${label} deve ser maior que zero.`)
    .max(maximum, `${label} deve ser no máximo ${maximum.toLocaleString('pt-BR')}.`)
    .refine(hasAtMostThreeFractionDigits, 'Use no máximo 3 casas decimais.')

const optionalBoundary = z
  .number({ error: 'Informe um número válido ou deixe o limite em branco.' })
  .min(0, 'O limite não pode ser negativo.')
  .max(999_999_999, 'O limite informado é muito alto.')
  .nullable()
  .refine(
    (value) => value === null || hasAtMostThreeFractionDigits(value),
    'Use no máximo 3 casas decimais.',
  )

const goalBandSchema = z
  .object({
    minValue: optionalBoundary,
    maxValue: optionalBoundary,
    minInclusive: z.boolean(),
    maxInclusive: z.boolean(),
    label: z
      .string()
      .trim()
      .min(1, 'Informe um rótulo para a faixa.')
      .max(40, 'O rótulo deve possuir no máximo 40 caracteres.'),
    tone: z.enum(['POSITIVE', 'NEUTRAL', 'WARNING']),
    countsAsAttained: z.boolean(),
  })
  .superRefine((band, context) => {
    if (
      band.minValue !== null &&
      band.maxValue !== null &&
      band.minValue > band.maxValue
    ) {
      context.addIssue({
        code: 'custom',
        path: ['maxValue'],
        message: 'O limite máximo deve ser maior ou igual ao mínimo.',
      })
    }
    if (
      band.minValue !== null &&
      band.maxValue !== null &&
      band.minValue === band.maxValue &&
      !(band.minInclusive && band.maxInclusive)
    ) {
      context.addIssue({
        code: 'custom',
        path: ['maxValue'],
        message: 'Limites iguais precisam incluir as duas fronteiras para representar um valor.',
      })
    }
  })

const targetSchema = z
  .object({
    nutrient: z.enum(['CALORIES', 'PROTEIN', 'CARBOHYDRATE', 'FAT', 'FIBER', 'WATER']),
    bands: z
      .array(goalBandSchema)
      .min(1, 'Adicione ao menos uma faixa para este nutriente.')
      .max(20, 'Cada nutriente pode possuir no máximo 20 faixas.'),
  })
  .superRefine((target, context) => {
    if (!target.bands.some((band) => band.countsAsAttained)) {
      context.addIssue({
        code: 'custom',
        path: ['bands'],
        message: 'Marque ao menos uma faixa como meta atingida.',
      })
    }
  })

export const nutritionGoalFormSchema = z
  .object({
    validFrom: z.iso.date('Informe uma data inicial válida.'),
    validTo: z.union([z.literal(''), z.iso.date('Informe uma data final válida.')]),
    calorieTarget: positiveValue('a meta calórica', 20_000),
    targets: z
      .array(targetSchema)
      .length(6, 'Configure as faixas de calorias e dos cinco nutrientes.'),
  })
  .superRefine((form, context) => {
    if (form.validTo && form.validTo <= form.validFrom) {
      context.addIssue({
        code: 'custom',
        path: ['validTo'],
        message: 'A data final deve ser posterior à data inicial.',
      })
    }

    const seenNutrients = new Set<Nutrient>()
    form.targets.forEach((target, targetIndex) => {
      if (seenNutrients.has(target.nutrient)) {
        context.addIssue({
          code: 'custom',
          path: ['targets', targetIndex, 'nutrient'],
          message: 'Cada nutriente pode ser configurado apenas uma vez.',
        })
      }
      seenNutrients.add(target.nutrient)

      for (let bandIndex = 1; bandIndex < target.bands.length; bandIndex += 1) {
        const previous = target.bands[bandIndex - 1]
        const current = target.bands[bandIndex]
        const openBoundary = previous.maxValue === null || current.minValue === null
        const invertedBoundary =
          previous.maxValue !== null &&
          current.minValue !== null &&
          previous.maxValue > current.minValue
        const duplicatedBoundary =
          previous.maxValue !== null &&
          current.minValue !== null &&
          previous.maxValue === current.minValue &&
          previous.maxInclusive &&
          current.minInclusive

        if (openBoundary || invertedBoundary || duplicatedBoundary) {
          context.addIssue({
            code: 'custom',
            path: ['targets', targetIndex, 'bands', bandIndex, 'minValue'],
            message:
              'Esta faixa se sobrepõe à anterior. Ajuste os limites ou a inclusão da fronteira compartilhada.',
          })
        }
      }
    })

    const calorieBands = form.targets.find((target) => target.nutrient === 'CALORIES')?.bands
    if (
      calorieBands &&
      !calorieBands.some(
        (band) => band.countsAsAttained && goalBandContainsValue(band, form.calorieTarget),
      )
    ) {
      context.addIssue({
        code: 'custom',
        path: ['calorieTarget'],
        message: 'A meta calórica nominal precisa estar dentro de uma faixa marcada como atingida.',
      })
    }
  })

export type NutritionGoalFormValues = z.infer<typeof nutritionGoalFormSchema>

export const tdeeFormSchema = z
  .object({
    validFrom: z.iso.date('Informe uma data inicial válida.'),
    validTo: z.union([z.literal(''), z.iso.date('Informe uma data final válida.')]),
    kcalPerDay: positiveValue('o TDEE', 20_000),
  })
  .superRefine((form, context) => {
    if (form.validTo && form.validTo <= form.validFrom) {
      context.addIssue({
        code: 'custom',
        path: ['validTo'],
        message: 'A data final deve ser posterior à data inicial.',
      })
    }
  })

export type TdeeFormValues = z.infer<typeof tdeeFormSchema>

function minimumBands(minimum: number, achievedLabel: string): EditableGoalBand[] {
  return [
    {
      minValue: null,
      maxValue: minimum,
      minInclusive: false,
      maxInclusive: false,
      label: 'Abaixo da meta',
      tone: 'WARNING',
      countsAsAttained: false,
    },
    {
      minValue: minimum,
      maxValue: null,
      minInclusive: true,
      maxInclusive: false,
      label: achievedLabel,
      tone: 'POSITIVE',
      countsAsAttained: true,
    },
  ]
}

function maximumBands(maximum: number, idealLabel: string): EditableGoalBand[] {
  return [
    {
      minValue: null,
      maxValue: maximum,
      minInclusive: false,
      maxInclusive: true,
      label: idealLabel,
      tone: 'POSITIVE',
      countsAsAttained: true,
    },
    {
      minValue: maximum,
      maxValue: null,
      minInclusive: false,
      maxInclusive: false,
      label: 'Acima do planejado',
      tone: 'WARNING',
      countsAsAttained: false,
    },
  ]
}

export function goalBandContainsValue(band: EditableGoalBand, value: number) {
  const aboveMinimum = band.minValue === null
    || (band.minInclusive ? value >= band.minValue : value > band.minValue)
  const belowMaximum = band.maxValue === null
    || (band.maxInclusive ? value <= band.maxValue : value < band.maxValue)
  return aboveMinimum && belowMaximum
}

export function calorieToleranceBands(
  calorieTarget: number,
  tolerance: number,
): EditableGoalBand[] {
  const normalize = (value: number) => Math.round(value * 1000) / 1000
  const minimum = Math.max(0, normalize(calorieTarget - tolerance))
  const maximum = normalize(calorieTarget + tolerance)
  return [
    {
      minValue: null,
      maxValue: minimum,
      minInclusive: false,
      maxInclusive: false,
      label: 'Abaixo do planejado',
      tone: 'WARNING',
      countsAsAttained: false,
    },
    {
      minValue: minimum,
      maxValue: maximum,
      minInclusive: true,
      maxInclusive: true,
      label: 'Dentro da faixa',
      tone: 'POSITIVE',
      countsAsAttained: true,
    },
    {
      minValue: maximum,
      maxValue: null,
      minInclusive: false,
      maxInclusive: false,
      label: 'Acima do planejado',
      tone: 'WARNING',
      countsAsAttained: false,
    },
  ]
}

export function defaultNutritionGoalValues(validFrom: string): NutritionGoalFormValues {
  return {
    validFrom,
    validTo: '',
    calorieTarget: 2500,
    targets: [
      { nutrient: 'CALORIES', bands: calorieToleranceBands(2500, 100) },
      { nutrient: 'PROTEIN', bands: minimumBands(175, 'Meta atingida') },
      { nutrient: 'CARBOHYDRATE', bands: maximumBands(210, 'Faixa ideal') },
      { nutrient: 'FAT', bands: maximumBands(65, 'Dentro do limite') },
      { nutrient: 'FIBER', bands: minimumBands(30, 'Meta atingida') },
      { nutrient: 'WATER', bands: minimumBands(4400, 'Meta atingida') },
    ],
  }
}
