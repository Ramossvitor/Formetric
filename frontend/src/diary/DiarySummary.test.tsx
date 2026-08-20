import { render, screen } from '@testing-library/react'
import type { DailyLog } from './api'
import { DiarySummary } from './DiarySummary'

const log: DailyLog = {
  id: 'log-1',
  date: '2026-08-12',
  status: 'OPEN',
  meals: [],
  waterLogs: [],
  waterTotalMl: 3300,
  totals: {
    kcal: 2137,
    proteinG: 195,
    carbohydrateG: 216,
    fatG: 63,
    fiberG: 30,
    sodiumMg: null,
  },
  tdeeKcal: 3000,
  energyBalanceKcal: -863,
  energyBalanceAvailability: 'AVAILABLE',
  nutritionGoals: {
    calorieTarget: 2500,
    targets: [
      {
        nutrient: 'PROTEIN', unit: 'G', bands: [
          { position: 0, minValue: null, maxValue: 175, minInclusive: false, maxInclusive: false, label: 'Abaixo', tone: 'WARNING', countsAsAttained: false },
          { position: 1, minValue: 175, maxValue: 190, minInclusive: true, maxInclusive: false, label: 'Meta', tone: 'POSITIVE', countsAsAttained: true },
          { position: 2, minValue: 190, maxValue: null, minInclusive: true, maxInclusive: false, label: 'Excelente', tone: 'POSITIVE', countsAsAttained: true },
        ],
      },
      {
        nutrient: 'CARBOHYDRATE', unit: 'G', bands: [
          { position: 0, minValue: null, maxValue: 210, minInclusive: false, maxInclusive: true, label: 'Faixa ideal', tone: 'POSITIVE', countsAsAttained: true },
          { position: 1, minValue: 210, maxValue: null, minInclusive: false, maxInclusive: false, label: 'Acima do planejado', tone: 'WARNING', countsAsAttained: false },
        ],
      },
      {
        nutrient: 'FIBER', unit: 'G', bands: [
          { position: 0, minValue: null, maxValue: 30, minInclusive: false, maxInclusive: true, label: 'No limite', tone: 'NEUTRAL', countsAsAttained: false },
          { position: 1, minValue: 30, maxValue: null, minInclusive: false, maxInclusive: false, label: 'Acima de 30', tone: 'POSITIVE', countsAsAttained: true },
        ],
      },
      {
        nutrient: 'WATER', unit: 'ML', bands: [
          { position: 0, minValue: null, maxValue: 4400, minInclusive: false, maxInclusive: false, label: 'Em andamento', tone: 'NEUTRAL', countsAsAttained: false },
          { position: 1, minValue: 4400, maxValue: null, minInclusive: true, maxInclusive: false, label: 'Meta', tone: 'POSITIVE', countsAsAttained: true },
        ],
      },
    ],
  },
  createdAt: '2026-08-12T10:00:00Z',
  updatedAt: '2026-08-12T10:00:00Z',
  closedAt: null,
  stateEvents: [],
}

describe('resumo de metas do diário', () => {
  it('mostra referência versionada, distância neutra e água em litros', () => {
    render(<DiarySummary log={log} />)

    expect(screen.getByText('195 g / meta ≥ 190 g')).toBeInTheDocument()
    expect(screen.getByText(/Excelente · 5 g acima da referência mínima/)).toBeInTheDocument()
    expect(screen.getByText('216 g / meta ≤ 210 g')).toBeInTheDocument()
    expect(screen.getByText(/6 g acima da faixa de referência/)).toBeInTheDocument()
    expect(screen.getByText('3,3 L / meta ≥ 4,4 L')).toBeInTheDocument()
    expect(screen.getByText(/faltam 1,1 L para a faixa/)).toBeInTheDocument()
    expect(screen.getByText(/precisa ultrapassar 30 g/)).toBeInTheDocument()
    expect(screen.queryByText(/faltam 0/)).not.toBeInTheDocument()
  })
})
