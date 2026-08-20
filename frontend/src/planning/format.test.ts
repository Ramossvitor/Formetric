import type { NutritionGoalPeriod } from './api'
import { goalSummaries } from './format'

describe('goalSummaries', () => {
  it('resume a faixa que conta como atingida antes do tom visual', () => {
    const period: NutritionGoalPeriod = {
      id: 'period-1',
      validFrom: '2026-08-01',
      validTo: null,
      calorieTarget: 2500,
      targets: [
        {
          nutrient: 'PROTEIN',
          unit: 'G',
          bands: [
            {
              position: 0,
              minValue: null,
              maxValue: 150,
              minInclusive: false,
              maxInclusive: false,
              label: 'Visualmente positivo',
              tone: 'POSITIVE',
              countsAsAttained: false,
            },
            {
              position: 1,
              minValue: 150,
              maxValue: 174,
              minInclusive: true,
              maxInclusive: true,
              label: 'Conta como atingida',
              tone: 'NEUTRAL',
              countsAsAttained: true,
            },
          ],
        },
      ],
    }

    expect(goalSummaries(period)).toEqual([
      {
        nutrient: 'PROTEIN',
        label: 'Proteína',
        value: '150 ≤ valor ≤ 174 g',
      },
    ])
  })
})
