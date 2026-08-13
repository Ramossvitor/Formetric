import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import App from '../App'
import { sessionQuery } from '../auth/queries'
import type { DailyAnalytics, MonthlyAnalytics } from './api'

const session = {
  authenticated: true as const,
  user: { id: 'user-1', email: 'vitor@example.com', displayName: 'Vitor Ramos', role: 'USER' },
}

const bounds = { earliestDate: '2026-07-01', latestDate: '2026-08-12', today: '2026-08-12' }

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
    { nutrient: 'PROTEIN', value: 40, bandLabel: 'Abaixo do planejado', attained: false },
    { nutrient: 'WATER', value: 1250, bandLabel: 'Em andamento', attained: false },
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
  queryClient.setQueryData(sessionQuery.queryKey, session)
  return render(<QueryClientProvider client={queryClient}><MemoryRouter initialEntries={[route]}><App /></MemoryRouter></QueryClientProvider>)
}

beforeEach(() => vi.restoreAllMocks())

describe('painéis determinísticos', () => {
  it('usa o hoje do servidor e distingue projeção aberta de saldo histórico', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const path = String(input)
      if (path === '/api/v1/analytics/bounds') return jsonResponse(bounds)
      if (path === '/api/v1/analytics/daily?date=2026-08-12') return jsonResponse(openDaily)
      throw new Error(`Requisição não esperada: ${path}`)
    })

    renderApp('/')

    expect(await screen.findByRole('heading', { level: 1, name: 'Hoje' })).toBeInTheDocument()
    expect(await screen.findByText('Saldo previsto')).toBeInTheDocument()
    expect(screen.getByText('−2.500 kcal')).toBeInTheDocument()
    expect(screen.getByText('projeção')).toBeInTheDocument()
    expect(screen.getByText('TDEE vigente:')).toHaveTextContent('3.000 kcal')
    expect(screen.getByText('Abaixo do planejado')).toBeInTheDocument()
    expect(screen.getByText('1,25')).toBeInTheDocument()
    expect(screen.getByText('Musculação')).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/analytics/daily?date=2026-08-12', expect.objectContaining({ credentials: 'include' }))
  })

  it('refaz os limites antes de habilitar a consulta diária após uma falha', async () => {
    let boundsAttempts = 0
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const path = String(input)
      if (path === '/api/v1/analytics/bounds') {
        boundsAttempts += 1
        if (boundsAttempts === 1) {
          return new Response(JSON.stringify({ title: 'Indisponível', status: 503, detail: 'Tente novamente.' }), {
            status: 503,
            headers: { 'Content-Type': 'application/problem+json' },
          })
        }
        return jsonResponse(bounds)
      }
      if (path === '/api/v1/analytics/daily?date=2026-08-12') return jsonResponse(openDaily)
      throw new Error(`Requisição não esperada: ${path}`)
    })
    const user = userEvent.setup()

    renderApp('/')
    await user.click(await screen.findByRole('button', { name: 'Tentar novamente' }))

    expect(await screen.findByText('Saldo previsto')).toBeInTheDocument()
    expect(fetchMock.mock.calls.map(([path]) => String(path)).some((path) => path.includes('undefined'))).toBe(false)
  })

  it('renderiza médias independentes, energia, metas e peso do contrato mensal', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const path = String(input)
      if (path === '/api/v1/analytics/bounds') return jsonResponse(bounds)
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
    expect(screen.getByText('25%')).toBeInTheDocument()
    expect(screen.getByText('−2 kg')).toBeInTheDocument()
    expect(screen.getByText('1 dia sem TDEE')).toBeInTheDocument()
    expect(screen.getByText('Musculação, Pilates')).toBeInTheDocument()
  })

  it('solicita séries dentro do limite e preserva os motivos das lacunas', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const path = String(input)
      if (path === '/api/v1/analytics/bounds') return jsonResponse(bounds)
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
