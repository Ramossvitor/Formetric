import { render, screen, within } from '@testing-library/react'
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
        nutrient: 'CALORIES', unit: 'KCAL', bands: [
          { position: 0, minValue: null, maxValue: 2400, minInclusive: false, maxInclusive: false, label: 'Abaixo do planejado', tone: 'WARNING', countsAsAttained: false },
          { position: 1, minValue: 2400, maxValue: 2600, minInclusive: true, maxInclusive: true, label: 'Dentro da faixa', tone: 'POSITIVE', countsAsAttained: true },
          { position: 2, minValue: 2600, maxValue: null, minInclusive: false, maxInclusive: false, label: 'Acima do planejado', tone: 'WARNING', countsAsAttained: false },
        ],
      },
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
  goalProgress: [
    {
      nutrient: 'CALORIES', value: 2137, bandLabel: 'Abaixo do planejado', bandTone: 'WARNING', attained: false,
      reference: {
        label: 'Dentro da faixa', minValue: 2400, maxValue: 2600, minInclusive: true, maxInclusive: true,
        remainingToRange: 263, excessOverRange: null,
      },
    },
    {
      nutrient: 'PROTEIN', value: 195, bandLabel: 'Excelente', bandTone: 'POSITIVE', attained: true,
      reference: {
        label: 'Excelente', minValue: 190, maxValue: null, minInclusive: true, maxInclusive: false,
        remainingToRange: null, excessOverRange: null,
      },
    },
    {
      nutrient: 'CARBOHYDRATE', value: 216, bandLabel: 'Acima do planejado', bandTone: 'WARNING', attained: false,
      reference: {
        label: 'Faixa ideal', minValue: null, maxValue: 210, minInclusive: false, maxInclusive: true,
        remainingToRange: null, excessOverRange: 6,
      },
    },
    {
      nutrient: 'FIBER', value: 30, bandLabel: 'No limite', bandTone: 'NEUTRAL', attained: false,
      reference: {
        label: 'Acima de 30', minValue: 30, maxValue: null, minInclusive: false, maxInclusive: false,
        remainingToRange: 0, excessOverRange: null,
      },
    },
    {
      nutrient: 'WATER', value: 3300, bandLabel: 'Em andamento', bandTone: 'NEUTRAL', attained: false,
      reference: {
        label: 'Meta', minValue: 4400, maxValue: null, minInclusive: true, maxInclusive: false,
        remainingToRange: 1100, excessOverRange: null,
      },
    },
  ],
  createdAt: '2026-08-12T10:00:00Z',
  updatedAt: '2026-08-12T10:00:00Z',
  closedAt: null,
  stateEvents: [],
}

describe('resumo de metas do diário', () => {
  it('mostra referência versionada, distância neutra e água em litros', () => {
    render(<DiarySummary log={log} />)

    expect(screen.getByText('2.137 kcal / meta ≥ 2.400 e ≤ 2.600 kcal')).toBeInTheDocument()
    expect(screen.getByText(/faltam 263 kcal para a faixa/)).toBeInTheDocument()
    expect(screen.getByText('195 g / meta ≥ 190 g')).toBeInTheDocument()
    expect(screen.getByText(/Excelente · dentro da faixa de referência/)).toBeInTheDocument()
    expect(screen.getByText('216 g / meta ≤ 210 g')).toBeInTheDocument()
    expect(screen.getByText(/6 g acima da faixa de referência/)).toBeInTheDocument()
    expect(screen.getByText('3,3 L / meta ≥ 4,4 L')).toBeInTheDocument()
    expect(screen.getByText(/faltam 1,1 L para a faixa/)).toBeInTheDocument()
    expect(screen.getByText(/precisa ultrapassar 30 g/)).toBeInTheDocument()
    const neutralFiber = screen.getByRole('group', { name: /Fibras: classificação parcial, No limite/ })
    expect(neutralFiber).toHaveClass('neutral')
    expect(within(neutralFiber).getByText(/fora da meta/)).toBeInTheDocument()
    expect(screen.getByText(/A meta alimentar é independente do saldo energético calculado com o TDEE/)).toBeInTheDocument()
    expect(screen.queryByText(/faltam 0/)).not.toBeInTheDocument()
  })

  it('distingue fechamento definitivo e classificação calórica legada ausente', () => {
    const legacyLog: DailyLog = {
      ...log,
      status: 'CLOSED',
      closedAt: '2026-08-12T23:00:00Z',
      nutritionGoals: {
        ...log.nutritionGoals!,
        calorieTarget: null,
        targets: log.nutritionGoals!.targets.filter((target) => target.nutrient !== 'CALORIES'),
      },
      goalProgress: log.goalProgress.filter((progress) => progress.nutrient !== 'CALORIES'),
    }

    render(<DiarySummary log={legacyLog} />)

    expect(screen.getByRole('group', { name: 'Calorias: classificação não configurada neste período' })).toBeInTheDocument()
    expect(screen.getByText('Meta nominal não configurada neste período')).toBeInTheDocument()
    expect(screen.getByRole('group', { name: /Proteína: classificação definitiva/ })).toBeInTheDocument()
    expect(screen.getByText(/As classificações são definitivas para este fechamento/)).toBeInTheDocument()
  })

  it('não transforma um diário somente com água em zero nutricional ou TDEE ausente', () => {
    const waterOnlyLog: DailyLog = {
      ...log,
      meals: [],
      waterLogs: [{ id: 'water-1', loggedAt: '2026-08-12T14:30:00Z', volumeMl: 500 }],
      waterTotalMl: 500,
      totals: { kcal: 0, proteinG: 0, carbohydrateG: 0, fatG: 0, fiberG: 0, sodiumMg: 0 },
      energyBalanceKcal: null,
      energyBalanceAvailability: 'UNAVAILABLE',
      goalProgress: log.goalProgress.map((progress) => progress.nutrient === 'WATER'
        ? { ...progress, value: 500 }
        : { ...progress, value: null, bandLabel: null, bandTone: null, attained: null }),
    }

    render(<DiarySummary log={waterOnlyLog} />)

    const heading = screen.getByRole('heading', { name: 'Não informado' })
    expect(heading).toBeInTheDocument()
    const macroGrid = heading.closest('section')!.querySelector<HTMLElement>('.diary-macro-grid')!
    expect(within(macroGrid).getAllByText('Não informado')).toHaveLength(5)
    expect(within(macroGrid).getByText('0,5 L')).toBeInTheDocument()
    expect(screen.getByText('Registre alimentos ou confirme o jejum para calcular o saldo')).toBeInTheDocument()
    expect(screen.queryByText('Cadastre um TDEE para esta data')).not.toBeInTheDocument()
  })

  it('mantém zero como dado real quando o jejum foi confirmado no fechamento', () => {
    const fastingLog: DailyLog = {
      ...log,
      status: 'CLOSED',
      meals: [],
      waterLogs: [],
      waterTotalMl: 0,
      totals: { kcal: 0, proteinG: 0, carbohydrateG: 0, fatG: 0, fiberG: 0, sodiumMg: 0 },
      energyBalanceKcal: -3000,
      energyBalanceAvailability: 'AVAILABLE',
      nutritionGoals: null,
      goalProgress: [],
      closedAt: '2026-08-12T23:00:00Z',
      stateEvents: [{
        type: 'CLOSED',
        fastingConfirmed: true,
        actorUserId: 'user-1',
        occurredAt: '2026-08-12T23:00:00Z',
      }],
    }

    render(<DiarySummary log={fastingLog} />)

    expect(screen.getByRole('heading', { name: '0 kcal' })).toBeInTheDocument()
    expect(screen.getAllByText('0 g')).toHaveLength(4)
    expect(screen.getByText('-3.000 kcal')).toBeInTheDocument()
  })

  it('usa o último fechamento pela ordem dos eventos mesmo com horários iguais', () => {
    const latestNotFasting: DailyLog = {
      ...log,
      status: 'CLOSED',
      meals: [],
      totals: { kcal: 0, proteinG: 0, carbohydrateG: 0, fatG: 0, fiberG: 0, sodiumMg: 0 },
      energyBalanceKcal: null,
      energyBalanceAvailability: 'UNAVAILABLE',
      nutritionGoals: null,
      goalProgress: [],
      closedAt: '2026-08-12T23:00:00Z',
      stateEvents: [
        { type: 'CLOSED', fastingConfirmed: true, actorUserId: 'user-1', occurredAt: '2026-08-12T23:00:00Z' },
        { type: 'CLOSED', fastingConfirmed: false, actorUserId: 'user-1', occurredAt: '2026-08-12T23:00:00Z' },
      ],
    }

    render(<DiarySummary log={latestNotFasting} />)

    expect(screen.getByRole('heading', { name: 'Não informado' })).toBeInTheDocument()
    expect(screen.getByText('Registre alimentos ou confirme o jejum para calcular o saldo')).toBeInTheDocument()
  })
})
