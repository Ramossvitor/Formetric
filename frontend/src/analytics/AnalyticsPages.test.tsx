import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import App from '../App'
import { fixedProfileTimeContext, seedProfileTimeContext } from '../test/profileTimeContext'
import type { ProfileTimeContext } from '../time/api'
import { parseInstant } from '../time/instant'
import { parsePlainDate } from '../time/plainDate'
import { profileTimeContextQueryKey } from '../time/queries'
import { sessionQuery } from '../auth/queries'
import type { DailyAnalytics, MonthlyAnalytics } from './api'

const session = {
  authenticated: true as const,
  user: { id: 'user-1', email: 'vitor@example.com', displayName: 'Vitor Ramos', role: 'USER' as const },
}

const openDaily: DailyAnalytics = {
  date: '2026-08-12',
  diaryStatus: 'OPEN',
  fastingConfirmed: false,
  historicalEligible: false,
  foodItemCount: 3,
  waterEntryCount: 2,
  nutrition: { caloriesKcal: 500, proteinG: 40, carbohydrateG: 50, fatG: 15, fiberG: 5, waterMl: 1250 },
  tdeeKcal: 3000,
  energyBalanceKcal: null,
  projectedEnergyBalanceKcal: -2500,
  energyBalanceAvailability: 'OPEN_LOG',
  calorieTargetKcal: 2200,
  goalProgress: [
    {
      nutrient: 'CALORIES', value: 500, bandLabel: 'Abaixo do planejado', bandTone: 'WARNING', attained: false,
      reference: {
        label: 'Dentro da faixa', minValue: 2100, maxValue: 2300, minInclusive: true, maxInclusive: true,
        remainingToRange: 1600, excessOverRange: null,
      },
    },
    {
      nutrient: 'PROTEIN', value: 40, bandLabel: 'Abaixo do planejado', bandTone: 'WARNING', attained: false,
      reference: {
        label: 'Meta', minValue: 175, maxValue: null, minInclusive: true, maxInclusive: false,
        remainingToRange: 135, excessOverRange: null,
      },
    },
    {
      nutrient: 'WATER', value: 1250, bandLabel: 'Em andamento', bandTone: 'NEUTRAL', attained: false,
      reference: {
        label: 'Meta', minValue: 4400, maxValue: null, minInclusive: true, maxInclusive: false,
        remainingToRange: 3150, excessOverRange: null,
      },
    },
  ],
  weightKg: 89.2,
  workouts: { sessionCount: 1, trainingDays: 1, totalDurationMinutes: 70, sessionsPerWeek: null, modalities: ['STRENGTH'] },
}

const monthlyData: MonthlyAnalytics = {
  month: '2026-08',
  periodStart: '2026-08-01',
  periodEnd: '2026-08-31',
  throughDate: '2026-08-12',
  elapsedCalendarDays: 12,
  closedDays: 5,
  openDays: 1,
  missingDiaryDays: 6,
  nutrition: {
    caloriesKcal: { total: 8000, average: 2000, sampleCount: 4 },
    proteinG: { total: 640, average: 160, sampleCount: 4 },
    carbohydrateG: { total: 900, average: 225, sampleCount: 4 },
    fatG: { total: 260, average: 65, sampleCount: 4 },
    fiberG: { total: 88, average: 22, sampleCount: 4 },
    waterMl: { total: 1500, average: 750, sampleCount: 2 },
  },
  energy: {
    netBalanceKcal: -2500,
    deficitMagnitudeKcal: 3000,
    surplusKcal: 500,
    averageBalanceKcal: -833.333,
    eligibleDays: 3,
    missingTdeeDays: 1,
    missingNutritionDays: 1,
    deficitDays: 2,
    surplusDays: 1,
    neutralDays: 0,
    largestDeficit: { date: '2026-08-02', balanceKcal: -2500 },
    largestSurplus: { date: '2026-08-05', balanceKcal: 500 },
  },
  goalAttainment: [
    { nutrient: 'CALORIES', configured: true, attainedDays: 2, eligibleDays: 4, attainedPercentage: 50 },
    { nutrient: 'PROTEIN', configured: true, attainedDays: 1, eligibleDays: 4, attainedPercentage: 25 },
    { nutrient: 'WATER', configured: false, attainedDays: 0, eligibleDays: 0, attainedPercentage: null },
  ],
  workouts: { sessionCount: 4, trainingDays: 3, totalDurationMinutes: 260, sessionsPerWeek: 2.33, modalities: ['STRENGTH', 'Pilates'] },
  weight: { observationCount: 3, initialWeightKg: 90, finalWeightKg: 88, changeKg: -2, minimumWeightKg: 88, maximumWeightKg: 90 },
  highestConsumption: { date: '2026-08-05', caloriesKcal: 3500 },
  lowestConsumption: { date: '2026-08-02', caloriesKcal: 0 },
}

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } })
}

function renderApp(route: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  seedProfileTimeContext(queryClient)
  queryClient.setQueryData(sessionQuery.queryKey, session)
  const view = render(<QueryClientProvider client={queryClient}><MemoryRouter initialEntries={[route]}><App /></MemoryRouter></QueryClientProvider>)
  return { ...view, queryClient }
}

beforeEach(() => vi.restoreAllMocks())

describe('painéis determinísticos', () => {
  it('usa o hoje do servidor e distingue projeção aberta de saldo histórico', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const path = String(input)
      if (path === '/api/v1/analytics/daily?date=2026-08-12') return jsonResponse(openDaily)
      throw new Error(`Requisição não esperada: ${path}`)
    })

    renderApp('/')

    expect(await screen.findByRole('heading', { level: 1, name: 'Hoje' })).toBeInTheDocument()
    expect(await screen.findByText('Saldo previsto')).toBeInTheDocument()
    expect(screen.getByText('−2.500 kcal')).toBeInTheDocument()
    expect(screen.getByText('projeção')).toBeInTheDocument()
    expect(screen.getByText('TDEE vigente:')).toHaveTextContent('3.000 kcal')
    const calorieClassification = screen.getByRole('group', { name: /Classificação calórica parcial: Abaixo do planejado/ })
    expect(within(calorieClassification).getByText(/faltam 1.600 kcal para a faixa/)).toBeInTheDocument()
    expect(calorieClassification.querySelector('.goal-state-dot')).toHaveClass('not-attained')
    expect(screen.getByRole('group', { name: /Proteína: Abaixo do planejado/ })).toBeInTheDocument()
    expect(screen.getByText(/meta ≥ 175 g/)).toBeInTheDocument()
    expect(screen.getByText(/faltam 135 g para a faixa/)).toBeInTheDocument()
    expect(screen.getByText('1,25')).toBeInTheDocument()
    expect(screen.getByText(/meta ≥ 4,4 L/)).toBeInTheDocument()
    expect(screen.getByText(/faltam 3,15 L para a faixa/)).toBeInTheDocument()
    expect(screen.getByText('Musculação')).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/analytics/daily?date=2026-08-12', expect.objectContaining({ credentials: 'include' }))
  })

  it('distingue uma meta configurada de um valor ainda não registrado', async () => {
    const withoutValues: DailyAnalytics = {
      ...openDaily,
      nutrition: { ...openDaily.nutrition, caloriesKcal: null, proteinG: null, waterMl: null },
      goalProgress: openDaily.goalProgress.map((goal) => ({
        ...goal,
        value: null,
        bandLabel: null,
        bandTone: null,
        attained: null,
        reference: goal.reference && {
          ...goal.reference,
          remainingToRange: null,
          excessOverRange: null,
        },
      })),
    }
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const path = String(input)
      if (path === '/api/v1/analytics/daily?date=2026-08-12') return jsonResponse(withoutValues)
      throw new Error(`Requisição não esperada: ${path}`)
    })

    renderApp('/')

    expect(await screen.findByText('Ainda não registrado')).toBeInTheDocument()
    expect(screen.getByRole('group', { name: /Classificação calórica parcial: Ainda não registradas/ })).toBeInTheDocument()
    expect(screen.getByText(/Ainda não registrada · meta ≥ 4,4 L/)).toBeInTheDocument()
    expect(screen.getByText(/meta ≥ 175 g/)).toBeInTheDocument()
    expect(screen.getByText(/meta ≥ 4,4 L/)).toBeInTheDocument()
  })

  it('refaz o resumo do hoje do perfil após uma falha', async () => {
    let dailyAttempts = 0
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const path = String(input)
      if (path === '/api/v1/analytics/daily?date=2026-08-12') {
        dailyAttempts += 1
        if (dailyAttempts === 1) {
          return new Response(JSON.stringify({ title: 'Indisponível', status: 503, detail: 'Tente novamente.' }), {
            status: 503,
            headers: { 'Content-Type': 'application/problem+json' },
          })
        }
        return jsonResponse(openDaily)
      }
      throw new Error(`Requisição não esperada: ${path}`)
    })
    const user = userEvent.setup()

    renderApp('/')
    await user.click(await screen.findByRole('button', { name: 'Tentar novamente' }))

    expect(await screen.findByText('Saldo previsto')).toBeInTheDocument()
    expect(fetchMock.mock.calls.map(([path]) => String(path)).some((path) => path.includes('undefined'))).toBe(false)
  })

  it('move Home, Mensal e Gráficos quando o contexto do perfil atravessa o mês', async () => {
    const nextTime: ProfileTimeContext = {
      ...fixedProfileTimeContext,
      serverNow: parseInstant('2026-09-01T03:00:01Z'),
      today: parsePlainDate('2026-09-01'),
      nextDayAt: parseInstant('2026-09-02T03:00:00Z'),
    }
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const path = String(input)
      if (path.startsWith('/api/v1/analytics/daily?date=')) {
        const date = new URL(path, 'https://formetric.test').searchParams.get('date')!
        return jsonResponse({ ...openDaily, date })
      }
      if (path.startsWith('/api/v1/analytics/monthly?month=')) {
        const month = new URL(path, 'https://formetric.test').searchParams.get('month')!
        return jsonResponse({ ...monthlyData, month })
      }
      if (path.startsWith('/api/v1/analytics/series?')) {
        const url = new URL(path, 'https://formetric.test')
        return jsonResponse({
          metric: url.searchParams.get('metric'),
          from: url.searchParams.get('from'),
          to: url.searchParams.get('to'),
          unit: 'KCAL',
          points: [],
          availabilityCounts: {},
        })
      }
      throw new Error(`Requisição não esperada: ${path}`)
    })

    const home = renderApp('/')
    await screen.findByRole('heading', { level: 1, name: 'Hoje' })
    act(() => home.queryClient.setQueryData(profileTimeContextQueryKey, nextTime))
    await waitFor(() => expect(fetchMock.mock.calls.some(([path]) => path === '/api/v1/analytics/daily?date=2026-09-01')).toBe(true))
    home.unmount()

    const monthly = renderApp('/analytics/monthly')
    act(() => monthly.queryClient.setQueryData(profileTimeContextQueryKey, nextTime))
    await waitFor(() => expect(fetchMock.mock.calls.some(([path]) => path === '/api/v1/analytics/monthly?month=2026-09')).toBe(true))
    monthly.unmount()

    const charts = renderApp('/analytics/charts')
    act(() => charts.queryClient.setQueryData(profileTimeContextQueryKey, nextTime))
    await waitFor(() => expect(fetchMock.mock.calls.some(([path]) => String(path).includes('to=2026-09-01'))).toBe(true))
  })

  it('renderiza médias independentes, energia, metas e peso do contrato mensal', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const path = String(input)
      if (path === '/api/v1/analytics/monthly?month=2026-08') return jsonResponse(monthlyData)
      throw new Error(`Requisição não esperada: ${path}`)
    })

    renderApp('/analytics/monthly')

    expect(await screen.findByRole('heading', { level: 1, name: 'Agosto de 2026' })).toBeInTheDocument()
    const nutrition = (await screen.findByRole('heading', { name: 'Médias dos dias elegíveis' })).closest('section')!
    expect(within(nutrition).getByText('2.000')).toBeInTheDocument()
    expect(within(nutrition).getAllByText('4 dias na média')).toHaveLength(5)
    expect(within(nutrition).getByText('2 dias na média')).toBeInTheDocument()
    expect(screen.getAllByText('−2.500 kcal')).toHaveLength(2)
    expect(screen.getByText('50%')).toBeInTheDocument()
    expect(screen.getByText('25%')).toBeInTheDocument()
    expect(screen.getByText('−2 kg')).toBeInTheDocument()
    expect(screen.getByText('1 dia sem TDEE')).toBeInTheDocument()
    expect(screen.getByText('Musculação, Pilates')).toBeInTheDocument()
    expect(screen.getByText(/O denominador usa apenas diários fechados/)).toBeInTheDocument()
  })

  it('identifica a classificação calórica mensal ausente em dados legados', async () => {
    const legacyMonthly: MonthlyAnalytics = {
      ...monthlyData,
      goalAttainment: monthlyData.goalAttainment.map((item) => item.nutrient === 'CALORIES'
        ? {
            ...item,
            configured: false,
            attainedDays: 0,
            eligibleDays: 0,
            attainedPercentage: null,
          }
        : item),
    }
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const path = String(input)
      if (path === '/api/v1/analytics/monthly?month=2026-08') return jsonResponse(legacyMonthly)
      throw new Error(`Requisição não esperada: ${path}`)
    })

    renderApp('/analytics/monthly')

    const attainment = (await screen.findByRole('heading', { name: 'Atingimento explícito' })).closest('section')!
    const calorieRow = within(attainment).getByText('Calorias').closest('li')!
    expect(calorieRow).toHaveClass('unconfigured')
    expect(within(calorieRow).getByText('Classificação não configurada no período')).toBeInTheDocument()
    expect(within(calorieRow).queryByRole('progressbar')).not.toBeInTheDocument()
  })

  it('solicita séries dentro do limite e preserva os motivos das lacunas', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const path = String(input)
      if (path.startsWith('/api/v1/analytics/series?')) {
        const params = new URL(path, 'https://formetric.test').searchParams
        const metric = params.get('metric')!
        const from = params.get('from')!
        const to = params.get('to')!
        return jsonResponse({
          metric,
          unit: metric === 'WEIGHT' ? 'kg' : 'kcal',
          from,
          to,
          points: [
            { date: from, value: metric === 'WEIGHT' ? 90 : 2000, availability: 'AVAILABLE' },
            { date: '2026-08-11', value: null, availability: 'MISSING_VALUE' },
            { date: to, value: metric === 'WEIGHT' ? 89 : 1800, availability: 'AVAILABLE' },
          ],
        })
      }
      throw new Error(`Requisição não esperada: ${path}`)
    })
    const user = userEvent.setup()

    renderApp('/analytics/charts')
    expect(await screen.findByRole('img', { name: /Calorias por dia/ })).toBeInTheDocument()
    expect(screen.getByText('Valor não informado')).toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText('Métrica'), 'WEIGHT')
    await user.click(screen.getByRole('button', { name: '7 dias' }))
    expect(await screen.findByRole('img', { name: /Peso por dia/ })).toBeInTheDocument()
    await waitFor(() => expect(fetchMock.mock.calls.some(([path]) => String(path) === '/api/v1/analytics/series?metric=WEIGHT&from=2026-08-06&to=2026-08-12')).toBe(true))

    await user.click(screen.getByRole('button', { name: '365 dias' }))
    await waitFor(() => expect(fetchMock.mock.calls.some(([path]) => String(path) === '/api/v1/analytics/series?metric=WEIGHT&from=2025-08-13&to=2026-08-12')).toBe(true))
  })
})
