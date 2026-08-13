import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter, MemoryRouter } from 'react-router-dom'
import App from './App'
import { clearCsrfToken } from './api/http'
import type { AuthSession } from './auth/api'
import { sessionQuery, useLogout } from './auth/queries'

const authenticatedSession = {
  authenticated: true as const,
  user: {
    id: 'e1ee45b2-7185-40d5-a661-77b68246d104',
    email: 'vitor@example.com',
    displayName: 'Vitor Ramos',
    role: 'USER',
  },
}

const userProfile = {
  ...authenticatedSession.user,
  locale: 'pt-BR',
  timeZone: 'America/Sao_Paulo',
  unitSystem: 'METRIC',
  birthDate: null,
  formulaSex: null,
}

const analyticsBounds = { earliestDate: null, latestDate: null, today: '2026-08-13' }

const emptyDailyAnalytics = {
  date: '2026-08-13',
  diaryStatus: 'MISSING',
  fastingConfirmed: false,
  historicalEligible: false,
  foodItemCount: 0,
  waterEntryCount: 0,
  nutrition: { caloriesKcal: null, proteinG: null, carbohydrateG: null, fatG: null, fiberG: null, waterMl: null },
  tdeeKcal: null,
  energyBalanceKcal: null,
  projectedEnergyBalanceKcal: null,
  energyBalanceAvailability: 'MISSING_LOG',
  calorieTargetKcal: null,
  goalProgress: [],
  weightKg: null,
  workouts: { sessionCount: 0, trainingDays: 0, totalDurationMinutes: 0, sessionsPerWeek: null, modalities: [] },
}

function analyticsResponse(path: string) {
  if (path === '/api/v1/analytics/bounds') return jsonResponse(analyticsBounds)
  if (path === '/api/v1/analytics/daily?date=2026-08-13') return jsonResponse(emptyDailyAnalytics)
  return undefined
}

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    status: 200,
    ...init,
    headers: { 'Content-Type': 'application/json', ...init.headers },
  })
}

function unauthorizedResponse() {
  return jsonResponse(
    { title: 'Não autenticado', status: 401, detail: 'Entre para continuar.' },
    { status: 401, headers: { 'Content-Type': 'application/problem+json' } },
  )
}

function renderApp(route: string, prepare?: (queryClient: QueryClient) => void) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
  prepare?.(queryClient)

  const view = render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[route]}>
        <App />
      </MemoryRouter>
    </QueryClientProvider>,
  )
  return { ...view, queryClient }
}

function renderBrowserApp(route: string, prepare?: (queryClient: QueryClient) => void) {
  window.history.replaceState(null, '', route)
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
  prepare?.(queryClient)

  const view = render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>,
  )
  return { ...view, queryClient }
}

function LogoutHarness() {
  const logout = useLogout()

  return (
    <button disabled={logout.isPending} onClick={() => logout.mutate()} type="button">
      Sair
    </button>
  )
}

beforeEach(() => {
  clearCsrfToken()
  vi.restoreAllMocks()
  window.history.replaceState(null, '', '/')
})

describe('autenticação', () => {
  it('protege uma rota privada e encaminha visitantes ao login', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(unauthorizedResponse())

    renderApp('/')

    expect(screen.getByRole('status')).toHaveTextContent('Verificando sua sessão')
    expect(await screen.findByRole('heading', { name: 'Acesse sua conta' })).toBeInTheDocument()
    expect(screen.queryByText('Sua sessÃ£o expirou')).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Hoje' })).not.toBeInTheDocument()
    expect(fetch).toHaveBeenCalledWith(
      '/api/v1/auth/session',
      expect.objectContaining({ credentials: 'include' }),
    )
  })

  it('faz login com cookie e CSRF e abre a home privada', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const path = String(input)

      if (path === '/api/v1/auth/session') return unauthorizedResponse()
      const analytics = analyticsResponse(path)
      if (analytics) return analytics
      if (path === '/api/v1/auth/csrf') {
        return jsonResponse({ token: 'csrf-login-token', headerName: 'X-XSRF-TOKEN' })
      }
      if (path === '/api/v1/auth/login' && init?.method === 'POST') {
        return jsonResponse(authenticatedSession)
      }

      throw new Error(`Requisição não esperada: ${path}`)
    })
    const user = userEvent.setup()

    const oldPrivateKey = ['analytics', 'monthly', 'old-account'] as const
    const { queryClient } = renderApp('/login', (client) => {
      client.setQueryData(oldPrivateKey, { netBalanceKcal: -9999 })
      client.setQueryData(['profile'], { displayName: 'Conta anterior' })
    })
    await screen.findByRole('heading', { name: 'Acesse sua conta' })
    await user.type(screen.getByLabelText('E-mail'), 'vitor@example.com')
    await user.type(screen.getByLabelText('Senha'), 'senha-super-segura')
    await user.click(screen.getByRole('button', { name: 'Entrar' }))

    expect(await screen.findByRole('heading', { name: 'Hoje' })).toBeInTheDocument()

    const loginCall = fetchMock.mock.calls.find(([path]) => path === '/api/v1/auth/login')
    expect(loginCall).toBeDefined()
    expect(loginCall?.[1]).toEqual(
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify({ email: 'vitor@example.com', password: 'senha-super-segura' }),
      }),
    )
    expect(new Headers(loginCall?.[1]?.headers).get('X-XSRF-TOKEN')).toBe('csrf-login-token')
    expect(queryClient.getQueryData(oldPrivateKey)).toBeUndefined()
    expect(queryClient.getQueryData(['profile'])).toBeUndefined()
    expect(queryClient.getQueryData(sessionQuery.queryKey)).toEqual(authenticatedSession)
  })

  it('mantÃ©m credenciais invÃ¡lidas no fluxo local sem disparar a fronteira global', async () => {
    const oldPrivateKey = ['profile', 'old-account'] as const
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const path = String(input)
      if (path === '/api/v1/auth/session') return unauthorizedResponse()
      if (path === '/api/v1/auth/csrf') return jsonResponse({ token: 'invalid-login-csrf', headerName: 'X-XSRF-TOKEN' })
      if (path === '/api/v1/auth/login' && init?.method === 'POST') {
        return jsonResponse(
          { title: 'Credenciais invÃ¡lidas', status: 401, detail: 'E-mail ou senha incorretos.' },
          { status: 401, headers: { 'Content-Type': 'application/problem+json' } },
        )
      }
      throw new Error(`RequisiÃ§Ã£o nÃ£o esperada: ${path}`)
    })
    const user = userEvent.setup()
    const { queryClient } = renderApp('/login', (client) => client.setQueryData(oldPrivateKey, { private: true }))

    await screen.findByRole('heading', { name: 'Acesse sua conta' })
    await user.type(screen.getByLabelText('E-mail'), 'vitor@example.com')
    await user.type(screen.getByLabelText('Senha'), 'senha-incorreta-segura')
    await user.click(screen.getByRole('button', { name: 'Entrar' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('E-mail ou senha incorretos')
    expect(screen.getByRole('heading', { name: 'Acesse sua conta' })).toBeInTheDocument()
    expect(screen.queryByText('Sua sessÃ£o expirou')).not.toBeInTheDocument()
    expect(queryClient.getQueryData(oldPrivateKey)).toEqual({ private: true })
    expect(fetchMock.mock.calls.filter(([path]) => path === '/api/v1/auth/login')).toHaveLength(1)
  })

  it('limpa a sessÃ£o expirada e retorna ao destino privado depois de autenticar', async () => {
    const oldAnalyticsKey = ['analytics', 'monthly', 'old-account'] as const
    let profileRequests = 0
    let sessionRequests = 0
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const path = String(input)
      if (path === '/api/v1/profile' && !init?.method) {
        profileRequests += 1
        return profileRequests === 1 ? unauthorizedResponse() : jsonResponse(userProfile)
      }
      if (path === '/api/v1/auth/session') {
        sessionRequests += 1
        return unauthorizedResponse()
      }
      if (path === '/api/v1/auth/csrf') return jsonResponse({ token: 'renewed-session-csrf', headerName: 'X-XSRF-TOKEN' })
      if (path === '/api/v1/auth/login' && init?.method === 'POST') return jsonResponse(authenticatedSession)
      throw new Error(`RequisiÃ§Ã£o nÃ£o esperada: ${path}`)
    })
    const user = userEvent.setup()
    const { queryClient } = renderBrowserApp('/profile?tab=privacy', (client) => {
      client.setQueryData(sessionQuery.queryKey, authenticatedSession)
      client.setQueryData(oldAnalyticsKey, { netBalanceKcal: -4500 })
      client.setQueryData(['activity', 'weight-logs'], [{ weightKg: 91 }])
    })

    expect(await screen.findByRole('heading', { name: 'Acesse sua conta' })).toBeInTheDocument()
    expect(screen.getByText('Sua sessÃ£o expirou. Entre novamente para continuar.')).toBeInTheDocument()
    expect(window.history.state.usr).toEqual(expect.objectContaining({ from: '/profile?tab=privacy' }))
    expect(queryClient.getQueryData(oldAnalyticsKey)).toBeUndefined()
    expect(queryClient.getQueryData(['activity', 'weight-logs'])).toBeUndefined()
    expect(sessionRequests).toBeGreaterThanOrEqual(1)

    await user.type(screen.getByLabelText('E-mail'), 'vitor@example.com')
    await user.type(screen.getByLabelText('Senha'), 'senha-super-segura')
    await user.click(screen.getByRole('button', { name: 'Entrar' }))

    expect(await screen.findByRole('heading', { level: 1, name: 'Perfil' })).toBeInTheDocument()
    expect(`${window.location.pathname}${window.location.search}`).toBe('/profile?tab=privacy')
    expect(profileRequests).toBe(2)
    expect(fetchMock.mock.calls.filter(([path]) => path === '/api/v1/auth/login')).toHaveLength(1)
  })

  it('aceita um convite usando o token da URL sem persistir a senha', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const path = String(input)

      const analytics = analyticsResponse(path)
      if (analytics) return analytics
      if (path === '/api/v1/auth/csrf') {
        return jsonResponse({ token: 'csrf-invite-token', headerName: 'X-XSRF-TOKEN' })
      }
      if (path === '/api/v1/invites/accept' && init?.method === 'POST') {
        return jsonResponse(authenticatedSession, { status: 201 })
      }

      throw new Error(`Requisição não esperada: ${path}`)
    })
    const user = userEvent.setup()

    const oldPrivateKey = ['analytics', 'daily', 'old-account'] as const
    const { queryClient } = renderBrowserApp('/accept-invite#token=convite-unico', (client) => {
      client.setQueryData(oldPrivateKey, { weightKg: 123 })
      client.setQueryData(['activity', 'weight-logs'], [{ weightKg: 123 }])
    })
    await waitFor(() => expect(window.location.hash).toBe(''))
    expect(window.location.search).toBe('')
    await user.type(screen.getByLabelText('Nome'), 'Vitor Ramos')
    await user.type(screen.getByLabelText('Senha', { selector: '#new-password' }), 'senha-super-segura')
    await user.type(screen.getByLabelText('Confirmar senha'), 'senha-super-segura')
    await user.click(screen.getByRole('button', { name: 'Criar conta' }))

    expect(await screen.findByRole('heading', { name: 'Hoje' })).toBeInTheDocument()

    const acceptCall = fetchMock.mock.calls.find(([path]) => path === '/api/v1/invites/accept')
    expect(acceptCall?.[1]).toEqual(
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify({
          token: 'convite-unico',
          displayName: 'Vitor Ramos',
          password: 'senha-super-segura',
        }),
      }),
    )
    expect(new Headers(acceptCall?.[1]?.headers).get('X-XSRF-TOKEN')).toBe('csrf-invite-token')
    expect(fetchMock.mock.calls.every(([path]) => !String(path).includes('convite-unico'))).toBe(true)
    expect(window.localStorage).toHaveLength(0)
    expect(window.sessionStorage).toHaveLength(0)
    expect(queryClient.getQueryData(oldPrivateKey)).toBeUndefined()
    expect(queryClient.getQueryData(['activity', 'weight-logs'])).toBeUndefined()
    expect(queryClient.getQueryData(sessionQuery.queryKey)).toEqual(authenticatedSession)
  })

  it('ignora e remove tokens de convite enviados pela query string', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')

    renderBrowserApp('/accept-invite?token=token-legado')

    expect(await screen.findByRole('heading', { name: 'Link incompleto' })).toBeInTheDocument()
    await waitFor(() => expect(window.location.search).toBe(''))
    expect(window.location.hash).toBe('')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('mantém a home baseada em dados disponível após autenticação', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const path = String(input)
      if (path === '/api/v1/auth/session') return jsonResponse(authenticatedSession)
      const analytics = analyticsResponse(path)
      if (analytics) return analytics
      throw new Error(`Requisição não esperada: ${path}`)
    })

    renderApp('/')

    expect(await screen.findByRole('heading', { level: 1, name: 'Hoje' })).toBeInTheDocument()
    expect(await screen.findByRole('note')).toHaveTextContent('Registre ou confirme o diário')
    expect(screen.getByText('TDEE vigente:')).toHaveTextContent('não configurado')
    expect(screen.getByRole('button', { name: 'Abrir cadastro rápido' })).toBeInTheDocument()
    await waitFor(() => expect(screen.getAllByRole('link', { name: 'Hoje' })).toHaveLength(2))
  })

  it('elimina dados privados em cache antes de permitir a troca de usuário', async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    })
    queryClient.setQueryData(sessionQuery.queryKey, authenticatedSession)
    queryClient.setQueryData(['profile'], { displayName: 'Vitor Ramos' })
    queryClient.setQueryData(['planning', 'nutrition-goal-periods'], [
      { id: 'private-goal-from-first-account' },
    ])
    queryClient.setQueryData(['planning', 'tdee-periods'], [
      { id: 'private-tdee-from-first-account' },
    ])
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const path = String(input)

      if (path === '/api/v1/auth/csrf') {
        return jsonResponse({ token: 'logout-csrf', headerName: 'X-XSRF-TOKEN' })
      }
      if (path === '/api/v1/auth/logout' && init?.method === 'POST') {
        return new Response(null, { status: 204 })
      }

      throw new Error(`Requisição não esperada: ${path}`)
    })
    const user = userEvent.setup()

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/']}>
          <LogoutHarness />
        </MemoryRouter>
      </QueryClientProvider>,
    )
    await user.click(screen.getByRole('button', { name: 'Sair' }))

    await waitFor(() => expect(queryClient.getQueryData(sessionQuery.queryKey)).toBeNull())
    expect(queryClient.getQueryData(['profile'])).toBeUndefined()
    expect(queryClient.getQueryData(['planning', 'nutrition-goal-periods'])).toBeUndefined()
    expect(queryClient.getQueryData(['planning', 'tdee-periods'])).toBeUndefined()

    const secondSession: AuthSession = {
      authenticated: true,
      user: {
        id: 'second-user',
        email: 'second@example.com',
        displayName: 'Second User',
        role: 'USER',
      },
    }
    queryClient.setQueryData(sessionQuery.queryKey, secondSession)
    expect(queryClient.getQueryData(['planning', 'nutrition-goal-periods'])).toBeUndefined()
    expect(queryClient.getQueryData(['planning', 'tdee-periods'])).toBeUndefined()
  })
})
