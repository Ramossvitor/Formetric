import {
  calorieToleranceBands,
  defaultNutritionGoalValues,
  nutritionGoalFormSchema,
  tdeeFormSchema,
} from './schemas'

describe('nutritionGoalFormSchema', () => {
  it('aceita os presets configuráveis de calorias e dos cinco nutrientes', () => {
    expect(nutritionGoalFormSchema.safeParse(defaultNutritionGoalValues('2026-08-20')).success).toBe(true)
  })

  it('gera limites absolutos inclusivos a partir da tolerância calórica', () => {
    expect(calorieToleranceBands(2500, 100)).toEqual([
      expect.objectContaining({ maxValue: 2400, maxInclusive: false, countsAsAttained: false }),
      expect.objectContaining({
        minValue: 2400,
        maxValue: 2600,
        minInclusive: true,
        maxInclusive: true,
        countsAsAttained: true,
      }),
      expect.objectContaining({ minValue: 2600, minInclusive: false, countsAsAttained: false }),
    ])

    const lowerBoundary = defaultNutritionGoalValues('2026-08-20')
    lowerBoundary.calorieTarget = 2400
    const upperBoundary = defaultNutritionGoalValues('2026-08-20')
    upperBoundary.calorieTarget = 2600

    expect(nutritionGoalFormSchema.safeParse(lowerBoundary).success).toBe(true)
    expect(nutritionGoalFormSchema.safeParse(upperBoundary).success).toBe(true)
  })

  it('normaliza a aritmética decimal do preset para a escala persistida', () => {
    const bands = calorieToleranceBands(2500.1, 0.2)

    expect(bands[0].maxValue).toBe(2499.9)
    expect(bands[1]).toEqual(expect.objectContaining({ minValue: 2499.9, maxValue: 2500.3 }))
    expect(bands[2].minValue).toBe(2500.3)
    expect(JSON.stringify(bands)).toContain('"maxValue":2500.3')
    expect(JSON.stringify(bands)).not.toContain('2500.299999')
  })

  it('rejeita uma meta nominal que esteja apenas em faixa não atingida', () => {
    const values = defaultNutritionGoalValues('2026-08-20')
    values.calorieTarget = 2300

    const result = nutritionGoalFormSchema.safeParse(values)

    expect(result.success).toBe(false)
    expect(result.error?.issues).toContainEqual(expect.objectContaining({
      path: ['calorieTarget'],
      message: 'A meta calórica nominal precisa estar dentro de uma faixa marcada como atingida.',
    }))
  })

  it('rejeita quatro casas decimais sem arredondar a meta ou os limites', () => {
    const invalidTarget = defaultNutritionGoalValues('2026-08-20')
    invalidTarget.calorieTarget = 2500.0001
    const invalidBoundary = defaultNutritionGoalValues('2026-08-20')
    invalidBoundary.targets[0].bands[1].minValue = 2400.0001

    const targetResult = nutritionGoalFormSchema.safeParse(invalidTarget)
    const boundaryResult = nutritionGoalFormSchema.safeParse(invalidBoundary)

    expect(targetResult.success).toBe(false)
    expect(targetResult.error?.issues).toContainEqual(expect.objectContaining({
      path: ['calorieTarget'],
      message: 'Use no máximo 3 casas decimais.',
    }))
    expect(boundaryResult.success).toBe(false)
    expect(boundaryResult.error?.issues).toContainEqual(expect.objectContaining({
      path: ['targets', 0, 'bands', 1, 'minValue'],
      message: 'Use no máximo 3 casas decimais.',
    }))
    expect(invalidTarget.calorieTarget).toBe(2500.0001)
    expect(invalidBoundary.targets[0].bands[1].minValue).toBe(2400.0001)
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

    const excessiveScale = tdeeFormSchema.safeParse({
      validFrom: '2026-08-01',
      validTo: '',
      kcalPerDay: 3000.0001,
    })
    expect(excessiveScale.success).toBe(false)
    expect(excessiveScale.error?.issues).toContainEqual(expect.objectContaining({
      path: ['kcalPerDay'],
      message: 'Use no máximo 3 casas decimais.',
    }))
  })
})
