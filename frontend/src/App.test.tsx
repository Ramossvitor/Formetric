import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
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

function renderApp(route: string) {
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
})

describe('autenticação', () => {
  it('protege uma rota privada e encaminha visitantes ao login', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(unauthorizedResponse())

    renderApp('/')

    expect(screen.getByRole('status')).toHaveTextContent('Verificando sua sessão')
    expect(await screen.findByRole('heading', { name: 'Acesse sua conta' })).toBeInTheDocument()
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
      if (path === '/api/v1/auth/csrf') {
        return jsonResponse({ token: 'csrf-login-token', headerName: 'X-XSRF-TOKEN' })
      }
      if (path === '/api/v1/auth/login' && init?.method === 'POST') {
        return jsonResponse(authenticatedSession)
      }

      throw new Error(`Requisição não esperada: ${path}`)
    })
    const user = userEvent.setup()

    renderApp('/login')
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
  })

  it('aceita um convite usando o token da URL sem persistir a senha', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const path = String(input)

      if (path === '/api/v1/auth/csrf') {
        return jsonResponse({ token: 'csrf-invite-token', headerName: 'X-XSRF-TOKEN' })
      }
      if (path === '/api/v1/invites/accept' && init?.method === 'POST') {
        return jsonResponse(authenticatedSession, { status: 201 })
      }

      throw new Error(`Requisição não esperada: ${path}`)
    })
    const user = userEvent.setup()

    renderApp('/accept-invite?token=convite-unico')
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
    expect(window.localStorage).toHaveLength(0)
    expect(window.sessionStorage).toHaveLength(0)
  })

  it('mantém a home visual disponível após autenticação', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(jsonResponse(authenticatedSession))

    renderApp('/')

    expect(await screen.findByRole('heading', { level: 1, name: 'Hoje' })).toBeInTheDocument()
    expect(screen.getByRole('note')).toHaveTextContent('Todos os valores abaixo são ilustrativos')
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
