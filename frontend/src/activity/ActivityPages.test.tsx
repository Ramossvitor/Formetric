import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import App from '../App'
import { seedProfileTimeContext } from '../test/profileTimeContext'
import { clearCsrfToken } from '../api/http'
import { analyticsQueryKey } from '../analytics/queries'
import type { WeightLog, WeightOverview, Workout } from './api'

const session = {
  authenticated: true,
  user: { id: 'user-1', email: 'vitor@example.com', displayName: 'Vitor Ramos', role: 'USER' },
}

const workout: Workout = {
  id: 'workout-1',
  date: '2026-08-12',
  modality: 'STRENGTH',
  customModality: null,
  title: 'Peito + bíceps',
  muscleGroups: ['Peito', 'Bíceps'],
  startTime: '18:30:00',
  durationMinutes: 70,
  estimatedKcal: 450,
  notes: 'Boa progressão de carga.',
  createdAt: '2026-08-12T22:00:00Z',
  updatedAt: '2026-08-12T22:00:00Z',
  version: 2,
}

const weightEntries: WeightLog[] = [
  { date: '2026-08-12', weightKg: 89.8, measuredAt: '08:10:00', condition: 'Em jejum', notes: null, createdAt: '2026-08-12T11:10:00Z', updatedAt: '2026-08-12T11:10:00Z', version: 3 },
  { date: '2026-08-10', weightKg: 90.2, measuredAt: '08:05:00', condition: 'Em jejum', notes: null, createdAt: '2026-08-10T11:05:00Z', updatedAt: '2026-08-10T11:05:00Z', version: 1 },
  { date: '2026-08-08', weightKg: 90.6, measuredAt: '08:00:00', condition: null, notes: 'Após descanso.', createdAt: '2026-08-08T11:00:00Z', updatedAt: '2026-08-08T11:00:00Z', version: 1 },
]

function overview(overrides: Partial<WeightOverview> = {}): WeightOverview {
  return {
    entries: weightEntries,
    currentWeightKg: 89.8,
    minimumWeightKg: 89.8,
    maximumWeightKg: 90.6,
    changeKg: -0.8,
    movingAverage7: { valueKg: 90.2, sampleCount: 3 },
    movingAverage14: { valueKg: 90.2, sampleCount: 3 },
    trend: { kgPerWeek: -1.4, sampleCount: 3, from: '2026-08-08', to: '2026-08-12' },
    ...overrides,
  }
}

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    status: 200,
    ...init,
    headers: { 'Content-Type': 'application/json', ...init.headers },
  })
}

function notFound() {
  return jsonResponse({ title: 'Registro não encontrado', status: 404 }, { status: 404 })
}

function renderApp(route: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  seedProfileTimeContext(queryClient)
  const view = render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[route]}><App /></MemoryRouter>
    </QueryClientProvider>,
  )
  return { ...view, queryClient }
}

beforeEach(() => {
  clearCsrfToken()
  vi.restoreAllMocks()
  vi.spyOn(crypto, 'randomUUID').mockReturnValue('11111111-1111-4111-8111-111111111111')
})

describe('navegação de registros', () => {
  it('oferece treino e peso no cadastro rápido mobile', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      if (String(input) === '/api/v1/auth/session') return jsonResponse(session)
      throw new Error(`Requisição não esperada: ${String(input)}`)
    })
    const user = userEvent.setup()
    renderApp('/')

    await user.click(await screen.findByRole('button', { name: 'Abrir cadastro rápido' }))
    const dialog = screen.getByRole('dialog', { name: 'O que deseja registrar?' })
    expect(within(dialog).getByRole('link', { name: /Treino/ })).toHaveAttribute('href', '/workouts?action=new')
    expect(within(dialog).getByRole('link', { name: /Peso/ })).toHaveAttribute('href', '/progress/weight?action=new')
  })
})

describe('treinos', () => {
  it('preserva a chave idempotente ao repetir uma criação após falha ambígua', async () => {
    let postCount = 0
    let workouts: Workout[] = []
    let resolveRetry!: (response: Response) => void
    const retryResponse = new Promise<Response>((resolve) => { resolveRetry = resolve })
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const path = String(input)
      if (path === '/api/v1/auth/session') return jsonResponse(session)
      if (path === '/api/v1/auth/csrf') return jsonResponse({ token: 'activity-csrf', headerName: 'X-XSRF-TOKEN' })
      if (path.startsWith('/api/v1/workouts?') && !init?.method) return jsonResponse(workouts)
      if (path === '/api/v1/workouts' && init?.method === 'POST') {
        postCount += 1
        if (postCount === 1) throw new TypeError('Failed to fetch after request transmission')
        const body = JSON.parse(String(init.body))
        const created: Workout = { ...workout, id: 'workout-retried', ...body, version: 0 }
        workouts = [created]
        return retryResponse
      }
      throw new Error(`Requisição não esperada: ${path}`)
    })
    const user = userEvent.setup()
    const analyticsKey = [...analyticsQueryKey, 'monthly', '2026-08'] as const
    const { queryClient } = renderApp('/workouts')
    queryClient.setQueryData(analyticsKey, { workouts: { sessionCount: 0 } })

    await user.click((await screen.findAllByRole('button', { name: 'Registrar treino' }))[0])
    const dialog = screen.getByRole('dialog', { name: 'Registrar treino' })
    expect(within(dialog).getByLabelText('Data')).toHaveValue('2026-08-12')
    await user.type(within(dialog).getByLabelText('Título'), 'Treino idempotente')
    await user.type(within(dialog).getByLabelText('Grupos musculares'), 'Costas')
    await user.click(within(dialog).getByRole('button', { name: 'Registrar treino' }))
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Não foi possível conectar')

    await user.click(within(dialog).getByRole('button', { name: 'Registrar treino' }))
    const closeButton = within(dialog).getByRole('button', { name: 'Fechar' })
    expect(closeButton).toBeDisabled()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.getByRole('dialog', { name: 'Registrar treino' })).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Registrar treino' })[0]).toBeDisabled()

    const postBodies = fetchMock.mock.calls
      .filter(([path, init]) => path === '/api/v1/workouts' && init?.method === 'POST')
      .map(([, init]) => JSON.parse(String(init?.body)))
    expect(postBodies).toHaveLength(2)
    expect(postBodies[0].requestId).toBe('11111111-1111-4111-8111-111111111111')
    expect(postBodies[1].requestId).toBe(postBodies[0].requestId)
    expect(crypto.randomUUID).toHaveBeenCalledTimes(1)

    resolveRetry(jsonResponse(workouts[0], { status: 201 }))
    expect(await screen.findByRole('heading', { name: 'Treino idempotente' })).toBeInTheDocument()
    expect(queryClient.getQueryState(analyticsKey)?.isInvalidated).toBe(true)
  })

  it('valida grupos de musculação no campo e restaura o foco ao fechar', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const path = String(input)
      if (path === '/api/v1/auth/session') return jsonResponse(session)
      if (path.startsWith('/api/v1/workouts?')) return jsonResponse([workout])
      throw new Error(`Requisição não esperada: ${path}`)
    })
    const user = userEvent.setup()
    renderApp('/workouts')

    const opener = await screen.findByRole('button', { name: 'Registrar treino' })
    await user.click(opener)
    const dialog = await screen.findByRole('dialog', { name: 'Registrar treino' })
    expect(dialog).toHaveFocus()
    await user.type(within(dialog).getByLabelText('Título'), 'Treino de força')
    await user.click(within(dialog).getByRole('button', { name: 'Registrar treino' }))
    expect(within(dialog).getByText('Informe ao menos um grupo muscular para musculação.')).toBeInTheDocument()
    expect(within(dialog).getByLabelText('Grupos musculares')).toHaveAttribute('aria-invalid', 'true')
    expect(fetchMock.mock.calls.some(([path]) => path === '/api/v1/workouts')).toBe(false)

    await user.click(within(dialog).getByRole('button', { name: 'Fechar' }))
    expect(opener).toHaveFocus()
  })

  it('abre o cadastro por deep link, registra OTHER e mantém kcal apenas informativa', async () => {
    let workouts = [workout]
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const path = String(input)
      if (path === '/api/v1/auth/session') return jsonResponse(session)
      if (path === '/api/v1/auth/csrf') return jsonResponse({ token: 'activity-csrf', headerName: 'X-XSRF-TOKEN' })
      if (path.startsWith('/api/v1/workouts?') && !init?.method) return jsonResponse(workouts)
      if (path === '/api/v1/workouts' && init?.method === 'POST') {
        const body = JSON.parse(String(init.body))
        const created: Workout = { ...workout, id: 'workout-2', ...body, customModality: body.customModality, version: 0 }
        workouts = [created, workout]
        return jsonResponse(created, { status: 201 })
      }
      throw new Error(`Requisição não esperada: ${path}`)
    })
    const user = userEvent.setup()
    renderApp('/workouts?action=new')

    const dialog = await screen.findByRole('dialog', { name: 'Registrar treino' })
    expect(dialog).toBeInTheDocument()
    expect(screen.getByText('450 kcal estimadas')).toBeInTheDocument()
    expect(screen.getByText('informativo; não altera o saldo')).toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText('Modalidade'), 'OTHER')
    await user.type(screen.getByLabelText('Qual modalidade?'), 'Natação')
    await user.type(screen.getByLabelText('Título'), 'Série aeróbica')
    await user.type(screen.getByLabelText('Grupos musculares', { selector: 'input' }), 'Costas, Ombros')
    await user.type(screen.getByLabelText('Horário'), '07:30')
    const duration = screen.getByLabelText('Duração')
    await user.clear(duration)
    await user.type(duration, '45')
    await user.type(screen.getByLabelText('Gasto calórico estimado'), '320')
    await user.type(screen.getByLabelText('Observações'), 'Ritmo moderado')
    await user.click(within(dialog).getByRole('button', { name: 'Registrar treino' }))

    expect(await screen.findByRole('heading', { name: 'Série aeróbica' })).toBeInTheDocument()
    const createCall = fetchMock.mock.calls.find(([path, init]) => path === '/api/v1/workouts' && init?.method === 'POST')
    expect(JSON.parse(String(createCall?.[1]?.body))).toEqual(expect.objectContaining({
      modality: 'OTHER',
      customModality: 'Natação',
      title: 'Série aeróbica',
      muscleGroups: ['Costas', 'Ombros'],
      startTime: '07:30',
      durationMinutes: 45,
      estimatedKcal: 320,
      requestId: '11111111-1111-4111-8111-111111111111',
    }))
    expect(new Headers(createCall?.[1]?.headers).get('X-XSRF-TOKEN')).toBe('activity-csrf')
    expect(fetchMock.mock.calls.some(([path]) => /balance|daily-logs|analytics/.test(String(path)))).toBe(false)
  })

  it('envia a versão ao editar e confirma antes de excluir', async () => {
    let workouts = [workout]
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const path = String(input)
      if (path === '/api/v1/auth/session') return jsonResponse(session)
      if (path === '/api/v1/auth/csrf') return jsonResponse({ token: 'activity-csrf', headerName: 'X-XSRF-TOKEN' })
      if (path.startsWith('/api/v1/workouts?')) return jsonResponse(workouts)
      if (path === '/api/v1/workouts/workout-1' && init?.method === 'PUT') {
        const body = JSON.parse(String(init.body))
        workouts = [{ ...workout, ...body, version: 3 }]
        return jsonResponse(workouts[0])
      }
      if (path === '/api/v1/workouts/workout-1' && init?.method === 'DELETE') {
        workouts = []
        return new Response(null, { status: 204 })
      }
      throw new Error(`Requisição não esperada: ${path}`)
    })
    const user = userEvent.setup()
    renderApp('/workouts')

    await user.click(await screen.findByRole('button', { name: 'Editar Peito + bíceps' }))
    const title = screen.getByLabelText('Título')
    await user.clear(title)
    await user.type(title, 'Peito intenso')
    await user.click(screen.getByRole('button', { name: 'Salvar alterações' }))
    expect(await screen.findByRole('heading', { name: 'Peito intenso' })).toBeInTheDocument()

    const updateCall = fetchMock.mock.calls.find(([path, init]) => path === '/api/v1/workouts/workout-1' && init?.method === 'PUT')
    expect(JSON.parse(String(updateCall?.[1]?.body))).toEqual(expect.objectContaining({ title: 'Peito intenso', version: 2 }))
    await user.click(screen.getByRole('button', { name: 'Excluir Peito intenso' }))
    expect(window.confirm).toHaveBeenCalledOnce()
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Nenhum treino neste período' })).toBeInTheDocument())
  })
})

describe('histórico de peso', () => {
  it('consulta a data pontualmente, ignora resposta antiga e edita com a versão encontrada', async () => {
    const outsideEntry: WeightLog = {
      date: '2025-01-02', weightKg: 94.3, measuredAt: '07:45:00', condition: 'Em jejum', notes: null,
      createdAt: '2025-01-02T10:45:00Z', updatedAt: '2025-01-02T10:45:00Z', version: 7,
    }
    const staleEntry: WeightLog = { ...outsideEntry, date: '2025-01-01', weightKg: 99, version: 4 }
    let resolveStale!: (response: Response) => void
    const staleResponse = new Promise<Response>((resolve) => { resolveStale = resolve })
    let savedInput: Record<string, unknown> | null = null
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const path = String(input)
      if (path === '/api/v1/auth/session') return jsonResponse(session)
      if (path === '/api/v1/auth/csrf') return jsonResponse({ token: 'weight-csrf', headerName: 'X-XSRF-TOKEN' })
      if (path.startsWith('/api/v1/weight-logs/overview?')) return jsonResponse(overview())
      if (path === '/api/v1/weight-logs/2025-01-01' && !init?.method) return staleResponse
      if (path === '/api/v1/weight-logs/2025-01-02' && !init?.method) return jsonResponse(outsideEntry)
      if (path.startsWith('/api/v1/weight-logs/') && !init?.method) return notFound()
      if (path === '/api/v1/weight-logs/2025-01-02' && init?.method === 'PUT') {
        savedInput = JSON.parse(String(init.body))
        return jsonResponse({ ...outsideEntry, ...savedInput, version: 8 })
      }
      throw new Error(`Requisição não esperada: ${path}`)
    })
    const user = userEvent.setup()
    renderApp('/progress/weight')

    await user.click(await screen.findByRole('button', { name: 'Registrar peso' }))
    const dialog = screen.getByRole('dialog', { name: 'Registrar peso' })
    // The profile's today already has a weigh-in, so the form opens in edit mode.
    await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Salvar alterações' })).toBeEnabled())
    const dateInput = within(dialog).getByLabelText('Data')
    expect(dateInput).toHaveValue('2026-08-12')
    expect(within(dialog).getByLabelText('Horário')).toHaveValue('08:10')
    fireEvent.change(dateInput, { target: { value: '2025-01-01' } })
    expect(await within(dialog).findByText('Verificando se já existe uma pesagem…')).toBeInTheDocument()
    fireEvent.change(dateInput, { target: { value: '2025-01-02' } })

    expect(await within(dialog).findByText('Já existe uma pesagem nesta data. Ao salvar, você editará o registro existente.')).toBeInTheDocument()
    expect(within(dialog).getByLabelText('Peso')).toHaveValue(94.3)
    resolveStale(jsonResponse(staleEntry))
    await staleResponse
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(within(dialog).getByLabelText('Data')).toHaveValue('2025-01-02')
    expect(within(dialog).getByLabelText('Peso')).toHaveValue(94.3)

    const weightInput = within(dialog).getByLabelText('Peso')
    await user.clear(weightInput)
    await user.type(weightInput, '94.1')
    await user.click(within(dialog).getByRole('button', { name: 'Salvar alterações' }))
    await waitFor(() => expect(savedInput).toEqual({
      weightKg: 94.1,
      measuredAt: '07:45',
      condition: 'Em jejum',
      notes: null,
      version: 7,
    }))
    expect(fetchMock.mock.calls.filter(([path, init]) => path === '/api/v1/weight-logs/2025-01-02' && !init?.method)).toHaveLength(1)
  })

  it('mostra médias e tendência determinísticas e atualiza com version', async () => {
    let currentOverview = overview()
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const path = String(input)
      if (path === '/api/v1/auth/session') return jsonResponse(session)
      if (path === '/api/v1/auth/csrf') return jsonResponse({ token: 'weight-csrf', headerName: 'X-XSRF-TOKEN' })
      if (path.startsWith('/api/v1/weight-logs/overview?')) return jsonResponse(currentOverview)
      if (path === '/api/v1/weight-logs/2026-08-12' && init?.method === 'PUT') {
        const body = JSON.parse(String(init.body))
        const updated = { ...weightEntries[0], ...body, version: 4 }
        currentOverview = overview({ entries: [updated, ...weightEntries.slice(1)], currentWeightKg: body.weightKg, minimumWeightKg: body.weightKg })
        return jsonResponse(updated)
      }
      throw new Error(`Requisição não esperada: ${path}`)
    })
    const user = userEvent.setup()
    renderApp('/progress/weight')

    expect((await screen.findAllByText('89,8 kg')).length).toBeGreaterThan(0)
    expect(screen.getByText('Último peso no período')).toBeInTheDocument()
    expect(screen.getByText('−0,8 kg')).toBeInTheDocument()
    expect(screen.getAllByText('90,2 kg').length).toBeGreaterThan(0)
    expect(screen.getByText('−1,4 kg/semana')).toBeInTheDocument()
    expect(screen.getByRole('note')).toHaveTextContent('regressão dos últimos 28 dias')

    await user.click(screen.getAllByRole('button', { name: /Editar pesagem/ })[0])
    const value = screen.getByLabelText('Peso')
    await user.clear(value)
    await user.type(value, '89.55')
    await user.click(screen.getByRole('button', { name: 'Salvar alterações' }))
    expect((await screen.findAllByText('89,55 kg')).length).toBeGreaterThan(0)

    const updateCall = fetchMock.mock.calls.find(([path, init]) => path === '/api/v1/weight-logs/2026-08-12' && init?.method === 'PUT')
    expect(JSON.parse(String(updateCall?.[1]?.body))).toEqual({
      weightKg: 89.55,
      measuredAt: '08:10',
      condition: 'Em jejum',
      notes: null,
      version: 3,
    })
    expect(new Headers(updateCall?.[1]?.headers).get('X-XSRF-TOKEN')).toBe('weight-csrf')
  })

  it('explica dados insuficientes e confirma a remoção da pesagem', async () => {
    let currentOverview = overview({
      entries: [weightEntries[0]],
      currentWeightKg: 89.8,
      minimumWeightKg: 89.8,
      maximumWeightKg: 89.8,
      changeKg: null,
      movingAverage7: null,
      movingAverage14: null,
      trend: null,
    })
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const path = String(input)
      if (path === '/api/v1/auth/session') return jsonResponse(session)
      if (path === '/api/v1/auth/csrf') return jsonResponse({ token: 'weight-csrf', headerName: 'X-XSRF-TOKEN' })
      if (path.startsWith('/api/v1/weight-logs/overview?')) return jsonResponse(currentOverview)
      if (path === '/api/v1/weight-logs/2026-08-12' && init?.method === 'DELETE') {
        currentOverview = overview({ entries: [], currentWeightKg: null, minimumWeightKg: null, maximumWeightKg: null, changeKg: null, movingAverage7: null, movingAverage14: null, trend: null })
        return new Response(null, { status: 204 })
      }
      throw new Error(`Requisição não esperada: ${path}`)
    })
    const user = userEvent.setup()
    renderApp('/progress/weight')

    expect((await screen.findAllByText('Dados insuficientes')).length).toBeGreaterThanOrEqual(4)
    await user.click(screen.getByRole('button', { name: /Excluir pesagem/ }))
    expect(window.confirm).toHaveBeenCalledOnce()
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Nenhuma pesagem neste período' })).toBeInTheDocument())
    expect(fetchMock.mock.calls.some(([path, init]) => path === '/api/v1/weight-logs/2026-08-12' && init?.method === 'DELETE')).toBe(true)
  })
})
