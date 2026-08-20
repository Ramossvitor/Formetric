import { defaultNutritionGoalValues, nutritionGoalFormSchema, tdeeFormSchema } from './schemas'

describe('nutritionGoalFormSchema', () => {
  it('aceita os presets configuráveis dos cinco nutrientes', () => {
    expect(nutritionGoalFormSchema.safeParse(defaultNutritionGoalValues('2026-08-20')).success).toBe(true)
  })

  it('rejeita término não posterior ao início', () => {
    const values = defaultNutritionGoalValues('2026-08-20')
    values.validTo = '2026-08-20'

    const result = nutritionGoalFormSchema.safeParse(values)

    expect(result.success).toBe(false)
    expect(result.error?.issues).toContainEqual(
      expect.objectContaining({
        path: ['validTo'],
        message: 'A data final deve ser posterior à data inicial.',
      }),
    )
  })

  it('rejeita sobreposição em fronteira incluída pelas duas faixas', () => {
    const values = defaultNutritionGoalValues('2026-08-20')
    values.targets[0].bands[0].maxInclusive = true

    const result = nutritionGoalFormSchema.safeParse(values)

    expect(result.success).toBe(false)
    expect(result.error?.issues).toContainEqual(
      expect.objectContaining({
        path: ['targets', 0, 'bands', 1, 'minValue'],
      }),
    )
  })

  it('rejeita faixa vazia e mais de vinte faixas', () => {
    const emptyBandValues = defaultNutritionGoalValues('2026-08-20')
    emptyBandValues.targets[0].bands = [
      {
        minValue: 175,
        maxValue: 175,
        minInclusive: true,
        maxInclusive: false,
        label: 'Faixa vazia',
        tone: 'NEUTRAL',
        countsAsAttained: false,
      },
    ]
    const tooManyValues = defaultNutritionGoalValues('2026-08-20')
    tooManyValues.targets[0].bands = Array.from({ length: 21 }, (_, index) => ({
      minValue: index,
      maxValue: index,
      minInclusive: true,
      maxInclusive: true,
      label: `Faixa ${index + 1}`,
      tone: 'NEUTRAL' as const,
      countsAsAttained: false,
    }))

    const emptyResult = nutritionGoalFormSchema.safeParse(emptyBandValues)
    const countResult = nutritionGoalFormSchema.safeParse(tooManyValues)

    expect(emptyResult.success).toBe(false)
    expect(emptyResult.error?.issues).toContainEqual(
      expect.objectContaining({
        path: ['targets', 0, 'bands', 0, 'maxValue'],
        message: 'Limites iguais precisam incluir as duas fronteiras para representar um valor.',
      }),
    )
    expect(countResult.success).toBe(false)
    expect(countResult.error?.issues).toContainEqual(
      expect.objectContaining({
        path: ['targets', 0, 'bands'],
        message: 'Cada nutriente pode possuir no máximo 20 faixas.',
      }),
    )
  })

  it('exige ao menos uma faixa que conte como meta atingida', () => {
    const values = defaultNutritionGoalValues('2026-08-20')
    values.targets[0].bands.forEach((band) => {
      band.countsAsAttained = false
    })

    const result = nutritionGoalFormSchema.safeParse(values)

    expect(result.success).toBe(false)
    expect(result.error?.issues).toContainEqual(
      expect.objectContaining({
        path: ['targets', 0, 'bands'],
        message: 'Marque ao menos uma faixa como meta atingida.',
      }),
    )
  })
})

describe('tdeeFormSchema', () => {
  it('aceita intervalo histórico finito e rejeita término não posterior', () => {
    expect(tdeeFormSchema.safeParse({
      validFrom: '2026-07-01',
      validTo: '2026-08-01',
      kcalPerDay: 3000,
    }).success).toBe(true)

    const invalid = tdeeFormSchema.safeParse({
      validFrom: '2026-08-01',
      validTo: '2026-08-01',
      kcalPerDay: 3000,
    })

    expect(invalid.success).toBe(false)
    expect(invalid.error?.issues).toContainEqual(
      expect.objectContaining({
        path: ['validTo'],
        message: 'A data final deve ser posterior à data inicial.',
      }),
    )
  })
})
