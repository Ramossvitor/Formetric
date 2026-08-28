import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { setupUser } from '../test/user'
import { MemoryRouter } from 'react-router-dom'
import App from '../App'
import { seedProfileTimeContext } from '../test/profileTimeContext'
import { clearCsrfToken } from '../api/http'
import { analyticsQueryKey } from '../analytics/queries'

const session = {
  authenticated: true,
  user: {
    id: 'cbcdf167-29ad-4372-906a-843a8fde172d',
    email: 'vitor@example.com',
    displayName: 'Vitor Ramos',
    role: 'USER',
  },
}

const nutritionPeriod = {
  id: 'nutrition-period-1',
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
          maxValue: 175,
          minInclusive: false,
          maxInclusive: false,
          label: 'Abaixo da meta',
          tone: 'WARNING',
          countsAsAttained: false,
        },
        {
          position: 1,
          minValue: 175,
          maxValue: null,
          minInclusive: true,
          maxInclusive: false,
          label: 'Meta atingida',
          tone: 'POSITIVE',
          countsAsAttained: true,
        },
      ],
    },
  ],
}

const tdeePeriod = {
  id: 'tdee-period-1',
  validFrom: '2026-08-01',
  validTo: null,
  kcalPerDay: 3000,
}

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    status: 200,
    ...init,
    headers: { 'Content-Type': 'application/json', ...init.headers },
  })
}

function renderRoute(route: string) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
  seedProfileTimeContext(queryClient)

  const view = render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[route]}>
        <App />
      </MemoryRouter>
    </QueryClientProvider>,
  )
  return { ...view, queryClient }
}

beforeEach(() => {
  clearCsrfToken()
  vi.restoreAllMocks()
})

describe('planejamento', () => {
  it('carrega a meta nutricional vigente e o histórico', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const path = String(input)

      if (path === '/api/v1/auth/session') return jsonResponse(session)
      if (path === '/api/v1/nutrition-goal-periods') return jsonResponse([nutritionPeriod])
      if (path.startsWith('/api/v1/nutrition-goal-periods/effective?date=')) {
        return jsonResponse(nutritionPeriod)
      }

      throw new Error(`Requisição não esperada: ${path}`)
    })

    renderRoute('/settings/nutrition-goals')

    expect(await screen.findByRole('heading', { level: 1, name: 'Metas nutricionais' })).toBeInTheDocument()
    expect(screen.getByLabelText('Válido a partir de')).toHaveValue('2026-08-12')
    expect(screen.getByRole('heading', { name: '2.500 kcal' })).toBeInTheDocument()
    const history = screen.getByRole('heading', { name: 'Histórico de metas' }).closest('section')
    expect(history).not.toBeNull()
    expect(within(history!).getByText('Classificação não configurada')).toBeInTheDocument()
    expect(within(history!).getByText('≥ 175 g')).toBeInTheDocument()
  })

  it('apresenta uma meta nominal legada ausente sem inventar zero', async () => {
    const legacyPeriod = { ...nutritionPeriod, calorieTarget: null }
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const path = String(input)

      if (path === '/api/v1/auth/session') return jsonResponse(session)
      if (path === '/api/v1/nutrition-goal-periods') return jsonResponse([legacyPeriod])
      if (path.startsWith('/api/v1/nutrition-goal-periods/effective?date=')) {
        return jsonResponse(legacyPeriod)
      }

      throw new Error(`Requisição não esperada: ${path}`)
    })

    renderRoute('/settings/nutrition-goals')

    expect(await screen.findByRole('heading', { name: 'Meta nominal não configurada' })).toBeInTheDocument()
    expect(screen.queryByText('0 kcal/dia')).not.toBeInTheDocument()
  })

  it('cria um período histórico com faixas arbitrárias e unidades canônicas', async () => {
    let created = false
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const path = String(input)

      if (path === '/api/v1/auth/session') return jsonResponse(session)
      if (path === '/api/v1/auth/csrf') {
        return jsonResponse({ token: 'planning-csrf', headerName: 'X-XSRF-TOKEN' })
      }
      if (path === '/api/v1/nutrition-goal-periods' && init?.method === 'POST') {
        created = true
        return jsonResponse(nutritionPeriod, { status: 201 })
      }
      if (path === '/api/v1/nutrition-goal-periods') {
        return jsonResponse(created ? [nutritionPeriod] : [])
      }
      if (path.startsWith('/api/v1/nutrition-goal-periods/effective?date=')) {
        return created ? jsonResponse(nutritionPeriod) : jsonResponse({ status: 404 }, { status: 404 })
      }

      throw new Error(`Requisição não esperada: ${path}`)
    })
    const analyticsKey = [...analyticsQueryKey, 'daily', '2026-08-12'] as const
    const { queryClient } = renderRoute('/settings/nutrition-goals')
    queryClient.setQueryData(analyticsKey, { goalProgress: [] })
    await screen.findByRole('heading', { name: 'Definir metas e classificações' })

    const validFrom = screen.getByLabelText('Válido a partir de')
    const validTo = screen.getByLabelText(/Válido até/)
    fireEvent.change(validFrom, { target: { value: '2026-07-01' } })
    fireEvent.change(validTo, { target: { value: '2026-08-01' } })
    fireEvent.change(screen.getByLabelText('Meta calórica'), { target: { value: '2500.1' } })

    const calories = screen.getByRole('group', { name: 'Calorias' })
    const calorieBandsBeforePreset = within(calories).getAllByRole('article')
    fireEvent.change(within(calorieBandsBeforePreset[0]).getByLabelText('Limite máximo'), {
      target: { value: '2375' },
    })
    expect(within(calorieBandsBeforePreset[0]).getByLabelText('Limite máximo')).toHaveValue(2375)
    expect(within(calorieBandsBeforePreset[1]).getByLabelText('Limite máximo')).toHaveValue(2600)
    fireEvent.change(within(calories).getByLabelText('Tolerância sugerida (±)'), {
      target: { value: '0.2' },
    })
    expect(within(calorieBandsBeforePreset[0]).getByLabelText('Limite máximo')).toHaveValue(2375)
    fireEvent.click(within(calories).getByRole('button', { name: 'Aplicar ±0,2 kcal' }))
    const calorieBandsAfterPreset = within(calories).getAllByRole('article')
    expect(within(calorieBandsAfterPreset[0]).getByLabelText('Limite máximo')).toHaveValue(2499.9)
    expect(within(calorieBandsAfterPreset[1]).getByLabelText('Limite máximo')).toHaveValue(2500.3)

    const protein = screen.getByRole('group', { name: 'Proteína' })
    fireEvent.click(within(protein).getByRole('button', { name: /Adicionar faixa de Proteína/ }))
    fireEvent.click(
      within(within(protein).getAllByRole('article')[2]).getByRole('button', {
        name: 'Mover faixa 3 de Proteína para cima',
      }),
    )
    const movedBand = within(protein).getAllByRole('article')[1]
    expect(within(movedBand).getByLabelText('Rótulo')).toHaveValue('Nova faixa')
    fireEvent.click(
      within(movedBand).getByRole('button', {
        name: 'Mover faixa 2 de Proteína para baixo',
      }),
    )
    const [firstBand, secondBand, thirdBand] = within(protein).getAllByRole('article')

    const firstMaximum = within(firstBand).getByLabelText('Limite máximo')
    fireEvent.change(firstMaximum, { target: { value: '150' } })
    fireEvent.change(within(firstBand).getByLabelText('Rótulo'), {
      target: { value: 'Insuficiente' },
    })

    const secondMinimum = within(secondBand).getByLabelText('Limite mínimo')
    fireEvent.change(secondMinimum, { target: { value: '150' } })
    fireEvent.change(within(secondBand).getByLabelText('Limite máximo'), {
      target: { value: '174' },
    })
    fireEvent.click(within(secondBand).getByLabelText('Incluir o valor máximo'))
    fireEvent.change(within(secondBand).getByLabelText('Rótulo'), {
      target: { value: 'Aceitável' },
    })
    fireEvent.change(within(secondBand).getByLabelText('Tom visual'), {
      target: { value: 'NEUTRAL' },
    })
    fireEvent.click(within(secondBand).getByLabelText('Valores nesta faixa contam como meta atingida'))

    fireEvent.change(within(thirdBand).getByLabelText('Limite mínimo'), {
      target: { value: '175' },
    })
    fireEvent.change(within(thirdBand).getByLabelText('Limite máximo'), {
      target: { value: '189' },
    })
    fireEvent.click(within(thirdBand).getByLabelText('Incluir o valor mínimo'))
    fireEvent.click(within(thirdBand).getByLabelText('Incluir o valor máximo'))
    fireEvent.change(within(thirdBand).getByLabelText('Rótulo'), { target: { value: 'Meta' } })
    fireEvent.change(within(thirdBand).getByLabelText('Tom visual'), {
      target: { value: 'POSITIVE' },
    })
    fireEvent.click(within(thirdBand).getByLabelText('Valores nesta faixa contam como meta atingida'))

    fireEvent.click(screen.getByRole('button', { name: 'Criar período de metas' }))

    expect(await screen.findByRole('status')).toHaveTextContent('Novo período de metas criado')
    const resetCalories = screen.getByRole('group', { name: 'Calorias' })
    expect(within(resetCalories).getByLabelText('Tolerância sugerida (±)')).toHaveValue(100)
    expect(
      within(within(resetCalories).getAllByRole('article')[0]).getByLabelText('Limite máximo'),
    ).toHaveValue(2400)
    const createCall = fetchMock.mock.calls.find(
      ([path, init]) => path === '/api/v1/nutrition-goal-periods' && init?.method === 'POST',
    )
    expect(createCall).toBeDefined()
    const requestBody = JSON.parse(String(createCall?.[1]?.body)) as {
      validFrom: string
      validTo: string
      calorieTarget: number
      targets: Array<{ nutrient: string; unit: string; bands: unknown[] }>
    }
    expect(requestBody.validFrom).toBe('2026-07-01')
    expect(requestBody.validTo).toBe('2026-08-01')
    expect(requestBody.calorieTarget).toBe(2500.1)
    expect(requestBody.targets).toHaveLength(6)
    expect(requestBody.targets.find((target) => target.nutrient === 'CALORIES')).toEqual({
      nutrient: 'CALORIES',
      unit: 'KCAL',
      bands: [
        expect.objectContaining({ position: 0, maxValue: 2499.9, countsAsAttained: false }),
        expect.objectContaining({ position: 1, minValue: 2499.9, maxValue: 2500.3, countsAsAttained: true }),
        expect.objectContaining({ position: 2, minValue: 2500.3, countsAsAttained: false }),
      ],
    })
    expect(String(createCall?.[1]?.body)).toContain('"maxValue":2500.3')
    expect(String(createCall?.[1]?.body)).not.toContain('2500.299999')
    expect(requestBody).not.toHaveProperty('tolerance')
    expect(requestBody.targets.find((target) => target.nutrient === 'PROTEIN')).toEqual({
      nutrient: 'PROTEIN',
      unit: 'G',
      bands: [
        {
          position: 0,
          minValue: null,
          maxValue: 150,
          minInclusive: false,
          maxInclusive: false,
          label: 'Insuficiente',
          tone: 'WARNING',
          countsAsAttained: false,
        },
        {
          position: 1,
          minValue: 150,
          maxValue: 174,
          minInclusive: true,
          maxInclusive: true,
          label: 'Aceitável',
          tone: 'NEUTRAL',
          countsAsAttained: false,
        },
        {
          position: 2,
          minValue: 175,
          maxValue: 189,
          minInclusive: true,
          maxInclusive: true,
          label: 'Meta',
          tone: 'POSITIVE',
          countsAsAttained: true,
        },
      ],
    })
    expect(requestBody.targets.find((target) => target.nutrient === 'WATER')?.unit).toBe('ML')
    expect(new Headers(createCall?.[1]?.headers).get('X-XSRF-TOKEN')).toBe('planning-csrf')
    expect(queryClient.getQueryState(analyticsKey)?.isInvalidated).toBe(true)
  }, 10_000)

  it('impede o envio de faixas sobrepostas e anuncia o erro no campo', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const path = String(input)

      if (path === '/api/v1/auth/session') return jsonResponse(session)
      if (path === '/api/v1/nutrition-goal-periods') return jsonResponse([])
      if (path.startsWith('/api/v1/nutrition-goal-periods/effective?date=')) {
        return jsonResponse({ status: 404 }, { status: 404 })
      }

      throw new Error(`Requisição não esperada: ${path}`)
    })
    const user = setupUser()

    renderRoute('/settings/nutrition-goals')
    await screen.findByRole('heading', { name: 'Definir metas e classificações' })
    const protein = screen.getByRole('group', { name: 'Proteína' })
    const secondBand = within(protein).getAllByRole('article')[1]
    const secondMinimum = within(secondBand).getByLabelText('Limite mínimo')
    await user.clear(secondMinimum)
    await user.type(secondMinimum, '170')
    await user.click(screen.getByRole('button', { name: 'Criar período de metas' }))

    expect(await within(secondBand).findByText(/se sobrepõe à anterior/)).toBeInTheDocument()
    expect(
      fetchMock.mock.calls.some(
        ([path, init]) => path === '/api/v1/nutrition-goal-periods' && init?.method === 'POST',
      ),
    ).toBe(false)
  })

  it('carrega e cria períodos de TDEE', async () => {
    let created = false
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const path = String(input)

      if (path === '/api/v1/auth/session') return jsonResponse(session)
      if (path === '/api/v1/auth/csrf') {
        return jsonResponse({ token: 'tdee-csrf', headerName: 'X-XSRF-TOKEN' })
      }
      if (path === '/api/v1/tdee-periods' && init?.method === 'POST') {
        created = true
        return jsonResponse({ ...tdeePeriod, kcalPerDay: 3150 }, { status: 201 })
      }
      if (path === '/api/v1/tdee-periods') return jsonResponse(created ? [tdeePeriod] : [tdeePeriod])
      if (path.startsWith('/api/v1/tdee-periods/effective?date=')) return jsonResponse(tdeePeriod)

      throw new Error(`Requisição não esperada: ${path}`)
    })
    const user = setupUser()

    renderRoute('/settings/tdee')
    expect(await screen.findByRole('heading', { name: '3.000 kcal/dia' })).toBeInTheDocument()
    expect(screen.getByLabelText('Válido a partir de')).toHaveValue('2026-08-12')
    const validFrom = screen.getByLabelText('Válido a partir de')
    const validTo = screen.getByLabelText(/Válido até/)
    await user.clear(validFrom)
    await user.type(validFrom, '2026-07-01')
    await user.type(validTo, '2026-08-01')
    const tdeeInput = screen.getByLabelText('TDEE estimado')
    await user.clear(tdeeInput)
    await user.type(tdeeInput, '3150')
    await user.click(screen.getByRole('button', { name: 'Criar período de TDEE' }))

    expect(await screen.findByRole('status')).toHaveTextContent('Novo período de TDEE criado')
    const createCall = fetchMock.mock.calls.find(
      ([path, init]) => path === '/api/v1/tdee-periods' && init?.method === 'POST',
    )
    expect(JSON.parse(String(createCall?.[1]?.body))).toEqual(
      expect.objectContaining({
        validFrom: '2026-07-01',
        validTo: '2026-08-01',
        kcalPerDay: 3150,
      }),
    )
  })
})
