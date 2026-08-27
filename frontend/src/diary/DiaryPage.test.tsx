import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import App from '../App'
import { fixedProfileTimeContext, seedProfileTimeContext } from '../test/profileTimeContext'
import type { ProfileTimeContext } from '../time/api'
import { parseInstant } from '../time/instant'
import { clearCsrfToken } from '../api/http'
import { analyticsQueryKey } from '../analytics/queries'

const session = {
  authenticated: true,
  user: { id: 'user-1', email: 'vitor@example.com', displayName: 'Vitor Ramos', role: 'USER' },
}

const zeroTotals = { kcal: 0, proteinG: 0, carbohydrateG: 0, fatG: 0, fiberG: 0, sodiumMg: 0 }
const itemTotals = { kcal: 112, proteinG: 27, carbohydrateG: 1.5, fatG: 0.8, fiberG: 0, sodiumMg: 65 }

function meal(overrides: Record<string, unknown> = {}) {
  return { id: 'meal-1', name: 'Almoço', position: 0, mealTime: '12:30:00', items: [], totals: zeroTotals, ...overrides }
}

function dailyLog(overrides: Record<string, unknown> = {}) {
  return {
    id: 'log-1',
    date: '2026-08-12',
    status: 'OPEN',
    meals: [],
    waterLogs: [],
    waterTotalMl: 0,
    totals: zeroTotals,
    tdeeKcal: 3000,
    energyBalanceKcal: -3000,
    energyBalanceAvailability: 'AVAILABLE',
    nutritionGoals: null,
    goalProgress: [],
    createdAt: '2026-08-12T10:00:00Z',
    updatedAt: '2026-08-12T10:00:00Z',
    closedAt: null,
    stateEvents: [{ type: 'CREATED', fastingConfirmed: false, actorUserId: 'user-1', occurredAt: '2026-08-12T10:00:00Z' }],
    ...overrides,
  }
}

const foodVersion = {
  id: 'food-version-1', versionNumber: 1, name: 'Whey', brand: null, notes: null,
  referenceQuantity: 30, referenceUnit: 'G', caloriesKcal: 112, proteinG: 27,
  carbohydrateG: 1.5, fatG: 0.8, fiberG: 0, sodiumMg: 65, quality: 'EXACT',
  kcalUncertainty: null,
  servings: [{ id: 'serving-1', position: 0, label: 'Dosador', unit: 'PORTION', quantity: 1, referenceQuantityEquivalent: 30 }],
  createdAt: '2026-08-12T10:00:00Z',
}
const food = {
  id: 'food-1', origin: 'USER', externalSource: null, externalId: null, archived: false, favorite: true,
  currentVersion: foodVersion, createdAt: '2026-08-12T10:00:00Z', updatedAt: '2026-08-12T10:00:00Z',
}

function page(content: unknown[]) {
  return { content, page: 0, size: 100, totalElements: content.length, totalPages: content.length ? 1 : 0 }
}

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), { status: 200, ...init, headers: { 'Content-Type': 'application/json', ...init.headers } })
}

function notFound() {
  return jsonResponse({ title: 'Registro não encontrado', status: 404 }, { status: 404 })
}

function renderDiary(route = '/diary?date=2026-08-12', temporal: ProfileTimeContext = fixedProfileTimeContext) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  seedProfileTimeContext(queryClient, temporal)
  const view = render(<QueryClientProvider client={queryClient}><MemoryRouter initialEntries={[route]}><App /></MemoryRouter></QueryClientProvider>)
  return { ...view, queryClient }
}

beforeEach(() => {
  clearCsrfToken()
  vi.restoreAllMocks()
  vi.spyOn(crypto, 'randomUUID').mockReturnValue('11111111-1111-4111-8111-111111111111')
})

describe('diário', () => {
  it('resolve hoje e o cadastro rápido pelo contexto do perfil, não pelo navegador', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const path = String(input)
      if (path === '/api/v1/auth/session') return jsonResponse(session)
      if (path === '/api/v1/daily-logs/2026-08-12' && !init?.method) return notFound()
      throw new Error(`Requisição não esperada: ${path}`)
    })

    renderDiary('/diary?action=quick')

    expect(await screen.findByRole('heading', { level: 1, name: 'Hoje' })).toBeInTheDocument()
    expect(await screen.findByRole('dialog', { name: 'Cadastro rápido' })).toBeInTheDocument()
    expect(fetchMock.mock.calls.some(([path]) => path === '/api/v1/daily-logs/2026-08-12')).toBe(true)
  })

  it('formata fechamento e água no locale e fuso do perfil', async () => {
    const temporal: ProfileTimeContext = {
      ...fixedProfileTimeContext,
      timeZone: 'America/Los_Angeles',
      serverNow: parseInstant('2026-08-12T18:00:00Z'),
      nextDayAt: parseInstant('2026-08-13T07:00:00Z'),
    }
    const closed = dailyLog({
      status: 'CLOSED',
      closedAt: '2026-08-12T23:00:00Z',
      waterLogs: [{ id: 'water-1', loggedAt: '2026-08-12T14:30:00Z', volumeMl: 500 }],
      waterTotalMl: 500,
    })
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const path = String(input)
      if (path === '/api/v1/auth/session') return jsonResponse(session)
      if (path === '/api/v1/daily-logs/2026-08-12') return jsonResponse(closed)
      throw new Error(`Requisição não esperada: ${path}`)
    })

    renderDiary(undefined, temporal)

    expect(await screen.findByText(/Fechado em/)).toHaveTextContent('12/08/2026, 16:00')
    expect(screen.getByText('07:30')).toHaveAttribute('dateTime', '2026-08-12T14:30:00Z')
  })

  it('trata 404 como dia vazio e cria na primeira refeição', async () => {
    const created = dailyLog({ meals: [meal()] })
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const path = String(input)
      if (path === '/api/v1/auth/session') return jsonResponse(session)
      if (path === '/api/v1/auth/csrf') return jsonResponse({ token: 'diary-csrf', headerName: 'X-XSRF-TOKEN' })
      if (path === '/api/v1/daily-logs/2026-08-12' && !init?.method) return notFound()
      if (path === '/api/v1/daily-logs/2026-08-12/meals' && init?.method === 'POST') return jsonResponse(created, { status: 201 })
      throw new Error(`Requisição não esperada: ${path}`)
    })
    const user = userEvent.setup()
    const analyticsKey = [...analyticsQueryKey, 'daily', '2026-08-12'] as const
    const { queryClient } = renderDiary()
    queryClient.setQueryData(analyticsKey, { nutrition: { caloriesKcal: 0 } })

    expect(await screen.findByRole('heading', { name: 'Nenhum registro neste dia' })).toBeInTheDocument()
    await user.click(screen.getAllByRole('button', { name: 'Adicionar refeição' }).at(-1)!)
    await user.type(screen.getByLabelText('Nome da refeição'), 'Almoço')
    await user.click(screen.getAllByRole('button', { name: 'Adicionar refeição' }).at(-1)!)
    expect(await screen.findByRole('heading', { name: 'Almoço' })).toBeInTheDocument()

    const call = fetchMock.mock.calls.find(([path, init]) => path === '/api/v1/daily-logs/2026-08-12/meals' && init?.method === 'POST')
    expect(JSON.parse(String(call?.[1]?.body))).toEqual({ name: 'Almoço', mealTime: null, position: null, requestId: '11111111-1111-4111-8111-111111111111' })
    expect(new Headers(call?.[1]?.headers).get('X-XSRF-TOKEN')).toBe('diary-csrf')
    expect(queryClient.getQueryState(analyticsKey)?.isInvalidated).toBe(true)
  })

  it('adiciona item usando servingOptionId e snapshot retornado', async () => {
    const initial = dailyLog({ meals: [meal()] })
    const snapshotItem = {
      id: 'item-1', itemType: 'FOOD', versionId: foodVersion.id, servingOptionId: 'serving-1', position: 0,
      quantity: 1, unit: 'PORTION', equivalentBasisQuantity: 30, basisQuantity: 30, basisUnit: 'G',
      conversionFactor: 30, name: 'Whey', ...itemTotals, dataQuality: 'EXACT', uncertaintyKcal: null,
    }
    const updatedMeal = meal({ items: [snapshotItem], totals: itemTotals })
    const updated = dailyLog({ meals: [updatedMeal], totals: itemTotals, energyBalanceKcal: -2888 })
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const path = String(input)
      if (path === '/api/v1/auth/session') return jsonResponse(session)
      if (path === '/api/v1/auth/csrf') return jsonResponse({ token: 'item-csrf', headerName: 'X-XSRF-TOKEN' })
      if (path === '/api/v1/daily-logs/2026-08-12') return jsonResponse(initial)
      if (path.includes('/api/v1/foods?')) return jsonResponse(page([food]))
      if (path.includes('/api/v1/recipes?')) return jsonResponse(page([]))
      if (path.endsWith('/meals/meal-1/items') && init?.method === 'POST') return jsonResponse(updated, { status: 201 })
      throw new Error(`Requisição não esperada: ${path}`)
    })
    const user = userEvent.setup()
    renderDiary()

    await user.click(await screen.findByRole('button', { name: '+ Adicionar alimento ou receita' }))
    await user.selectOptions(await screen.findByLabelText('Alimento ou receita'), foodVersion.id)
    await user.selectOptions(screen.getByLabelText('Unidade ou porção'), 'serving:serving-1')
    const quantity = screen.getByLabelText('Quantidade')
    await user.clear(quantity)
    await user.type(quantity, '1')
    await user.click(screen.getByRole('button', { name: 'Adicionar ao diário' }))

    expect((await screen.findAllByText('112 kcal')).length).toBeGreaterThan(0)
    expect(screen.getByText(/v\. preservada/i)).toBeInTheDocument()
    const call = fetchMock.mock.calls.find(([path, init]) => String(path).endsWith('/items') && init?.method === 'POST')
    expect(JSON.parse(String(call?.[1]?.body))).toEqual(expect.objectContaining({
      itemType: 'FOOD', versionId: foodVersion.id, quantity: 1, unit: 'PORTION', servingOptionId: 'serving-1',
      requestId: '11111111-1111-4111-8111-111111111111',
    }))
  })

  it('registra água com requestId idempotente e permite excluir histórico', async () => {
    const initial = dailyLog()
    const withWater = dailyLog({ waterLogs: [{ id: 'water-1', loggedAt: '2026-08-12T14:30:00Z', volumeMl: 500 }], waterTotalMl: 500 })
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const path = String(input)
      if (path === '/api/v1/auth/session') return jsonResponse(session)
      if (path === '/api/v1/auth/csrf') return jsonResponse({ token: 'water-csrf', headerName: 'X-XSRF-TOKEN' })
      if (path === '/api/v1/daily-logs/2026-08-12') return jsonResponse(initial)
      if (path.endsWith('/water') && init?.method === 'POST') return jsonResponse(withWater, { status: 201 })
      if (path.endsWith('/water/water-1') && init?.method === 'DELETE') return jsonResponse(initial)
      throw new Error(`Requisição não esperada: ${path}`)
    })
    const user = userEvent.setup()
    renderDiary()

    await user.click(await screen.findByRole('button', { name: '+500 ml' }))
    expect(await screen.findByText('0,5 L')).toBeInTheDocument()
    const addCall = fetchMock.mock.calls.find(([path, init]) => String(path).endsWith('/water') && init?.method === 'POST')
    expect(JSON.parse(String(addCall?.[1]?.body))).toEqual(expect.objectContaining({ volumeMl: 500, requestId: '11111111-1111-4111-8111-111111111111' }))
    await user.click(screen.getByRole('button', { name: 'Excluir água de 500 ml' }))
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Excluir água de 500 ml' })).not.toBeInTheDocument())
  })

  it('fecha jejum vazio, bloqueia mutações e reabre explicitamente', async () => {
    const initial = dailyLog()
    const closed = dailyLog({ status: 'CLOSED', closedAt: '2026-08-12T23:00:00Z', stateEvents: [{ type: 'CLOSED', fastingConfirmed: true, actorUserId: 'user-1', occurredAt: '2026-08-12T23:00:00Z' }] })
    const reopened = dailyLog({ stateEvents: [{ type: 'REOPENED', fastingConfirmed: false, actorUserId: 'user-1', occurredAt: '2026-08-13T08:00:00Z' }] })
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const path = String(input)
      if (path === '/api/v1/auth/session') return jsonResponse(session)
      if (path === '/api/v1/auth/csrf') return jsonResponse({ token: 'close-csrf', headerName: 'X-XSRF-TOKEN' })
      if (path === '/api/v1/daily-logs/2026-08-12') return jsonResponse(initial)
      if (path.endsWith('/close') && init?.method === 'POST') return jsonResponse(closed)
      if (path.endsWith('/reopen') && init?.method === 'POST') return jsonResponse(reopened)
      throw new Error(`Requisição não esperada: ${path}`)
    })
    const user = userEvent.setup()
    renderDiary()

    await user.click(await screen.findByRole('button', { name: 'Fechar dia' }))
    expect(screen.getByRole('button', { name: 'Confirmar fechamento' })).toBeDisabled()
    await user.click(screen.getByRole('checkbox', { name: /Confirmo que este foi um dia de jejum/ }))
    await user.click(screen.getByRole('button', { name: 'Confirmar fechamento' }))
    expect(await screen.findByText('Histórico confirmado')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '+ Refeição' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '+250 ml' })).not.toBeInTheDocument()

    const closeCall = fetchMock.mock.calls.find(([path]) => String(path).endsWith('/close'))
    expect(JSON.parse(String(closeCall?.[1]?.body))).toEqual({ fastingConfirmed: true })
    await user.click(screen.getByRole('button', { name: 'Reabrir dia' }))
    expect(await screen.findByRole('button', { name: '+ Refeição' })).toBeInTheDocument()
  })

  it('fecha dia somente com água sem forçar confirmação de jejum', async () => {
    const waterOnly = dailyLog({ waterLogs: [{ id: 'water-1', loggedAt: '2026-08-12T14:30:00Z', volumeMl: 250 }], waterTotalMl: 250 })
    const closed = dailyLog({ ...waterOnly, status: 'CLOSED', closedAt: '2026-08-12T23:00:00Z' })
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const path = String(input)
      if (path === '/api/v1/auth/session') return jsonResponse(session)
      if (path === '/api/v1/auth/csrf') return jsonResponse({ token: 'close-csrf', headerName: 'X-XSRF-TOKEN' })
      if (path === '/api/v1/daily-logs/2026-08-12') return jsonResponse(waterOnly)
      if (path.endsWith('/close') && init?.method === 'POST') return jsonResponse(closed)
      throw new Error(`Requisição não esperada: ${path}`)
    })
    const user = userEvent.setup()
    renderDiary()

    await user.click(await screen.findByRole('button', { name: 'Fechar dia' }))
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Confirmar fechamento' }))
    const call = fetchMock.mock.calls.find(([path]) => String(path).endsWith('/close'))
    expect(JSON.parse(String(call?.[1]?.body))).toEqual({ fastingConfirmed: false })
  })

  it('copia refeição pela rota final com requestId e preserva snapshots', async () => {
    const source = dailyLog({ date: '2026-08-11', meals: [meal({ id: 'source-meal' })] })
    const target = dailyLog({ meals: [meal({ id: 'copied-meal' })] })
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const path = String(input)
      if (path === '/api/v1/auth/session') return jsonResponse(session)
      if (path === '/api/v1/auth/csrf') return jsonResponse({ token: 'copy-csrf', headerName: 'X-XSRF-TOKEN' })
      if (path === '/api/v1/daily-logs/2026-08-12' && !init?.method) return jsonResponse(dailyLog())
      if (path === '/api/v1/daily-logs/2026-08-11' && !init?.method) return jsonResponse(source)
      if (path.endsWith('/meals/copy') && init?.method === 'POST') return jsonResponse(target, { status: 201 })
      throw new Error(`Requisição não esperada: ${path}`)
    })
    const user = userEvent.setup()
    renderDiary()

    await user.click(await screen.findByRole('button', { name: 'Copiar registros' }))
    await screen.findByLabelText('Refeição para copiar')
    await user.selectOptions(screen.getByLabelText('Refeição para copiar'), 'source-meal')
    await user.click(screen.getByRole('button', { name: 'Copiar refeição' }))
    expect(await screen.findByRole('heading', { name: 'Almoço' })).toBeInTheDocument()
    const mealCall = fetchMock.mock.calls.find(([path]) => String(path).endsWith('/meals/copy'))
    expect(JSON.parse(String(mealCall?.[1]?.body))).toEqual({ sourceDate: '2026-08-11', sourceMealId: 'source-meal', requestId: '11111111-1111-4111-8111-111111111111' })

    await user.click(screen.getByRole('button', { name: 'Copiar registros' }))
    expect(await screen.findByRole('button', { name: 'Duplicar dia inteiro' })).toBeDisabled()
    expect(screen.getByText(/destino não pode ter refeições nem água/i)).toBeInTheDocument()
  })

  it('duplica um dia inteiro somente em destino vazio', async () => {
    const source = dailyLog({ date: '2026-08-11', meals: [meal({ id: 'source-meal' })] })
    const target = dailyLog({ meals: [meal({ id: 'copied-meal' })] })
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const path = String(input)
      if (path === '/api/v1/auth/session') return jsonResponse(session)
      if (path === '/api/v1/auth/csrf') return jsonResponse({ token: 'copy-csrf', headerName: 'X-XSRF-TOKEN' })
      if (path === '/api/v1/daily-logs/2026-08-12' && !init?.method) return jsonResponse(dailyLog())
      if (path === '/api/v1/daily-logs/2026-08-11' && !init?.method) return jsonResponse(source)
      if (path.endsWith('/copy') && init?.method === 'POST') return jsonResponse(target, { status: 201 })
      throw new Error(`Requisição não esperada: ${path}`)
    })
    const user = userEvent.setup()
    renderDiary()

    await user.click(await screen.findByRole('button', { name: 'Copiar registros' }))
    await user.click(await screen.findByRole('button', { name: 'Duplicar dia inteiro' }))
    const call = fetchMock.mock.calls.find(([path, init]) => path === '/api/v1/daily-logs/2026-08-12/copy' && init?.method === 'POST')
    expect(JSON.parse(String(call?.[1]?.body))).toEqual({ sourceDate: '2026-08-11', requestId: '11111111-1111-4111-8111-111111111111' })
  })

  it('mostra o erro de gravação dentro do diálogo, sem fechá-lo', async () => {
    const initial = dailyLog({ meals: [] })
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const path = String(input)
      if (path === '/api/v1/auth/session') return jsonResponse(session)
      if (path === '/api/v1/auth/csrf') return jsonResponse({ token: 'diary-csrf', headerName: 'X-XSRF-TOKEN' })
      if (path === '/api/v1/daily-logs/2026-08-12' && !init?.method) return jsonResponse(initial)
      if (path === '/api/v1/daily-logs/2026-08-12/meals' && init?.method === 'POST') {
        return jsonResponse({ title: 'Conflito', detail: 'Já existe uma refeição nessa posição.', status: 409 }, { status: 409 })
      }
      throw new Error(`Requisição não esperada: ${path}`)
    })
    const user = userEvent.setup()
    renderDiary()

    await user.click(await screen.findByRole('button', { name: '+ Refeição' }))
    await user.type(screen.getByLabelText('Nome da refeição'), 'Almoço')
    await user.click(screen.getAllByRole('button', { name: 'Adicionar refeição' }).at(-1)!)

    const dialog = await screen.findByRole('dialog')
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Já existe uma refeição nessa posição.')
    expect(within(dialog).getByLabelText('Nome da refeição')).toHaveValue('Almoço')
    expect(screen.getAllByRole('alert')).toHaveLength(1)
  })

  it('limpa o erro anterior ao reabrir o diálogo', async () => {
    const initial = dailyLog({ meals: [] })
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const path = String(input)
      if (path === '/api/v1/auth/session') return jsonResponse(session)
      if (path === '/api/v1/auth/csrf') return jsonResponse({ token: 'diary-csrf', headerName: 'X-XSRF-TOKEN' })
      if (path === '/api/v1/daily-logs/2026-08-12' && !init?.method) return jsonResponse(initial)
      if (path === '/api/v1/daily-logs/2026-08-12/meals' && init?.method === 'POST') {
        return jsonResponse({ title: 'Conflito', detail: 'Já existe uma refeição nessa posição.', status: 409 }, { status: 409 })
      }
      throw new Error(`Requisição não esperada: ${path}`)
    })
    const user = userEvent.setup()
    renderDiary()

    await user.click(await screen.findByRole('button', { name: '+ Refeição' }))
    await user.type(screen.getByLabelText('Nome da refeição'), 'Almoço')
    await user.click(screen.getAllByRole('button', { name: 'Adicionar refeição' }).at(-1)!)
    expect(await within(await screen.findByRole('dialog')).findByRole('alert')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Fechar' }))
    await user.click(screen.getByRole('button', { name: '+ Refeição' }))

    expect(within(await screen.findByRole('dialog')).queryByRole('alert')).not.toBeInTheDocument()
  })

  it('não devolve o erro do diálogo como aviso da página depois de fechá-lo', async () => {
    const initial = dailyLog({ meals: [] })
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const path = String(input)
      if (path === '/api/v1/auth/session') return jsonResponse(session)
      if (path === '/api/v1/auth/csrf') return jsonResponse({ token: 'diary-csrf', headerName: 'X-XSRF-TOKEN' })
      if (path === '/api/v1/daily-logs/2026-08-12' && !init?.method) return jsonResponse(initial)
      if (path === '/api/v1/daily-logs/2026-08-12/meals' && init?.method === 'POST') {
        return jsonResponse({ title: 'Conflito', detail: 'Já existe uma refeição nessa posição.', status: 409 }, { status: 409 })
      }
      throw new Error(`Requisição não esperada: ${path}`)
    })
    const user = userEvent.setup()
    renderDiary()

    await user.click(await screen.findByRole('button', { name: '+ Refeição' }))
    await user.type(screen.getByLabelText('Nome da refeição'), 'Almoço')
    await user.click(screen.getAllByRole('button', { name: 'Adicionar refeição' }).at(-1)!)
    expect(await within(await screen.findByRole('dialog')).findByRole('alert')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Fechar' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
