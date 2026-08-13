import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import App from '../App'
import { clearCsrfToken } from '../api/http'

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

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[route]}>
        <App />
      </MemoryRouter>
    </QueryClientProvider>,
  )
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
    expect(screen.getByRole('heading', { name: '2.500 kcal' })).toBeInTheDocument()
    const history = screen.getByRole('heading', { name: 'Histórico de metas' }).closest('section')
    expect(history).not.toBeNull()
    expect(within(history!).getByText('≥ 175 g')).toBeInTheDocument()
  })

  it('cria uma meta nutricional convertendo o formulário simples em bandas determinísticas', async () => {
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
    const user = userEvent.setup()

    renderRoute('/settings/nutrition-goals')
    await screen.findByRole('heading', { name: 'Definir metas' })
    const proteinInput = screen.getByLabelText('Proteína mínima')
    await user.clear(proteinInput)
    await user.type(proteinInput, '180')
    await user.click(screen.getByRole('button', { name: 'Criar período de metas' }))

    expect(await screen.findByRole('status')).toHaveTextContent('Novo período de metas criado')
    const createCall = fetchMock.mock.calls.find(
      ([path, init]) => path === '/api/v1/nutrition-goal-periods' && init?.method === 'POST',
    )
    expect(createCall).toBeDefined()
    const requestBody = JSON.parse(String(createCall?.[1]?.body)) as {
      validTo: null
      targets: Array<{ nutrient: string; unit: string; bands: unknown[] }>
    }
    expect(requestBody.validTo).toBeNull()
    expect(requestBody.targets).toHaveLength(5)
    expect(requestBody.targets.find((target) => target.nutrient === 'PROTEIN')).toEqual({
      nutrient: 'PROTEIN',
      unit: 'G',
      bands: [
        expect.objectContaining({
          position: 0,
          maxValue: 180,
          maxInclusive: false,
          tone: 'WARNING',
          countsAsAttained: false,
        }),
        expect.objectContaining({
          position: 1,
          minValue: 180,
          minInclusive: true,
          tone: 'POSITIVE',
          countsAsAttained: true,
        }),
      ],
    })
    expect(new Headers(createCall?.[1]?.headers).get('X-XSRF-TOKEN')).toBe('planning-csrf')
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
    const user = userEvent.setup()

    renderRoute('/settings/tdee')
    expect(await screen.findByRole('heading', { name: '3.000 kcal/dia' })).toBeInTheDocument()
    const tdeeInput = screen.getByLabelText('TDEE estimado')
    await user.clear(tdeeInput)
    await user.type(tdeeInput, '3150')
    await user.click(screen.getByRole('button', { name: 'Criar período de TDEE' }))

    expect(await screen.findByRole('status')).toHaveTextContent('Novo período de TDEE criado')
    const createCall = fetchMock.mock.calls.find(
      ([path, init]) => path === '/api/v1/tdee-periods' && init?.method === 'POST',
    )
    expect(JSON.parse(String(createCall?.[1]?.body))).toEqual(
      expect.objectContaining({ validTo: null, kcalPerDay: 3150 }),
    )
  })
})
