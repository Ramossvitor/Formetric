import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { clearCsrfToken } from '../api/http'
import type { AuthSession, UserProfile } from '../auth/api'
import { OwnerRoute, ProtectedRoute } from '../auth/ProtectedRoute'
import { sessionQuery } from '../auth/queries'
import { seedProfileTimeContext } from '../test/profileTimeContext'
import { InvitationsPage } from './InvitationsPage'
import { ProfilePage } from './ProfilePage'

const ownerSession: AuthSession = {
  authenticated: true,
  user: {
    id: 'owner-1',
    email: 'owner@example.com',
    displayName: 'Pessoa proprietária',
    role: 'OWNER',
  },
}

const memberSession: AuthSession = {
  authenticated: true,
  user: {
    id: 'member-1',
    email: 'member@example.com',
    displayName: 'Pessoa usuária',
    role: 'USER',
  },
}

const memberProfile: UserProfile = {
  ...memberSession.user,
  locale: 'pt-BR',
  timeZone: 'America/Sao_Paulo',
  unitSystem: 'METRIC',
  birthDate: null,
  formulaSex: null,
}

const ownerProfile: UserProfile = {
  ...ownerSession.user,
  locale: 'pt-BR',
  timeZone: 'America/Sao_Paulo',
  unitSystem: 'METRIC',
  birthDate: null,
  formulaSex: null,
}

const originalClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard')
const originalExecCommand = Object.getOwnPropertyDescriptor(document, 'execCommand')

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    status: 200,
    ...init,
    headers: { 'Content-Type': 'application/json', ...init.headers },
  })
}

function renderPrivateRoute(route: string, session: AuthSession) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
  queryClient.setQueryData(sessionQuery.queryKey, session)
  seedProfileTimeContext(queryClient)

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[route]}>
        <Routes>
          <Route element={<ProtectedRoute />}>
            <Route element={<OwnerRoute />}>
              <Route element={<InvitationsPage />} path="settings/invitations" />
            </Route>
            <Route element={<ProfilePage />} path="profile" />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  clearCsrfToken()
  vi.restoreAllMocks()
  window.localStorage.clear()
  window.sessionStorage.clear()
})

afterEach(() => {
  if (originalClipboard) Object.defineProperty(navigator, 'clipboard', originalClipboard)
  else Reflect.deleteProperty(navigator, 'clipboard')

  if (originalExecCommand) Object.defineProperty(document, 'execCommand', originalExecCommand)
  else Reflect.deleteProperty(document, 'execCommand')
})

describe('administração de convites', () => {
  it('oferece o acesso aos convites na navegação de perfil do proprietário', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      if (String(input) === '/api/v1/profile') return jsonResponse(ownerProfile)
      throw new Error(`Requisição não esperada: ${String(input)}`)
    })

    renderPrivateRoute('/profile', ownerSession)

    expect(await screen.findByRole('link', { name: /Convites/ })).toHaveAttribute('href', '/settings/invitations')
  })

  it('restringe a rota a proprietários e não mostra o link administrativo a usuários comuns', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      if (String(input) === '/api/v1/profile') return jsonResponse(memberProfile)
      throw new Error(`Requisição não esperada: ${String(input)}`)
    })

    renderPrivateRoute('/settings/invitations', memberSession)

    expect(await screen.findByRole('heading', { level: 1, name: 'Perfil' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { level: 1, name: 'Convites' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Convites/ })).not.toBeInTheDocument()
    expect(fetchMock.mock.calls.some(([path]) => String(path) === '/api/v1/invites')).toBe(false)
  })

  it('valida o DTO no navegador antes de enviar a requisição', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
    const user = userEvent.setup()
    renderPrivateRoute('/settings/invitations', ownerSession)

    await user.type(screen.getByLabelText('E-mail'), 'endereço-inválido')
    await user.clear(screen.getByLabelText('Validade'))
    await user.type(screen.getByLabelText('Validade'), '721')
    await user.click(screen.getByRole('button', { name: 'Criar convite' }))

    expect(await screen.findByText('Informe um e-mail válido.')).toBeInTheDocument()
    expect(screen.getByText('A validade máxima é de 720 horas.')).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('envia o contrato exato com CSRF e gera um link cujo token existe apenas no fragmento', async () => {
    const createdInvite = {
      id: 'f34891cf-9f9b-41a1-af27-a612fb2b4101',
      email: 'new.member@example.com',
      role: 'USER',
      expiresAt: '2026-08-27T15:30:00Z',
      token: 'one-time-secret',
    }
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const path = String(input)
      if (path === '/api/v1/auth/csrf') {
        return jsonResponse({ token: 'csrf-owner-token', headerName: 'X-XSRF-TOKEN' })
      }
      if (path === '/api/v1/invites' && init?.method === 'POST') {
        return jsonResponse(createdInvite, { status: 201 })
      }
      throw new Error(`Requisição não esperada: ${path}`)
    })
    const user = userEvent.setup()
    const clipboardWrite = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: clipboardWrite },
    })
    renderPrivateRoute('/settings/invitations', ownerSession)

    await user.type(screen.getByLabelText('E-mail'), createdInvite.email)
    await user.click(screen.getByRole('button', { name: 'Criar convite' }))

    expect(await screen.findByRole('heading', { name: 'Convite criado' })).toHaveFocus()
    const inviteCall = fetchMock.mock.calls.find(([path]) => String(path) === '/api/v1/invites')
    expect(inviteCall?.[1]).toEqual(expect.objectContaining({
      method: 'POST',
      credentials: 'include',
      body: JSON.stringify({ email: createdInvite.email, role: 'USER', expiresInHours: 168 }),
    }))
    expect(new Headers(inviteCall?.[1]?.headers).get('X-XSRF-TOKEN')).toBe('csrf-owner-token')

    const linkField = screen.getByLabelText('Link de convite') as HTMLInputElement
    const invitationUrl = new URL(linkField.value)
    expect(invitationUrl.pathname).toBe('/accept-invite')
    expect(invitationUrl.search).toBe('')
    expect(new URLSearchParams(invitationUrl.hash.slice(1)).get('token')).toBe(createdInvite.token)
    expect(fetchMock.mock.calls.every(([path]) => !String(path).includes(createdInvite.token))).toBe(true)

    await user.click(screen.getByRole('button', { name: 'Copiar link' }))
    expect(clipboardWrite).toHaveBeenCalledWith(linkField.value)
    expect(await screen.findByText('Link copiado para a área de transferência.')).toBeInTheDocument()
    expect(window.localStorage).toHaveLength(0)
    expect(window.sessionStorage).toHaveLength(0)
  })

  it('mantém o formulário bloqueado durante o envio e apresenta falhas sem expor dados sensíveis', async () => {
    let completeInvite!: (response: Response) => void
    const pendingInvite = new Promise<Response>((resolve) => {
      completeInvite = resolve
    })
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const path = String(input)
      if (path === '/api/v1/auth/csrf') {
        return jsonResponse({ token: 'csrf-error-token', headerName: 'X-XSRF-TOKEN' })
      }
      if (path === '/api/v1/invites' && init?.method === 'POST') return pendingInvite
      throw new Error(`Requisição não esperada: ${path}`)
    })
    const user = userEvent.setup()
    renderPrivateRoute('/settings/invitations', ownerSession)

    await user.type(screen.getByLabelText('E-mail'), 'existing@example.com')
    await user.click(screen.getByRole('button', { name: 'Criar convite' }))

    expect(await screen.findByRole('button', { name: 'Criando convite…' })).toBeDisabled()
    completeInvite(jsonResponse(
      { title: 'Conflito', status: 409, detail: 'Já existe uma conta para este e-mail.' },
      { status: 409, headers: { 'Content-Type': 'application/problem+json' } },
    ))

    expect(await screen.findByRole('alert')).toHaveTextContent('Já existe uma conta para este e-mail.')
    await waitFor(() => expect(screen.getByRole('button', { name: 'Criar convite' })).toBeEnabled())
    expect(screen.queryByLabelText('Link de convite')).not.toBeInTheDocument()
  })

  it('usa a seleção manual como fallback quando a Clipboard API não está disponível', async () => {
    const createdInvite = {
      id: 'be201273-3cf8-43df-9c5c-037b5a2fc44e',
      email: 'fallback@example.com',
      role: 'USER',
      expiresAt: '2026-08-21T15:30:00Z',
      token: 'fallback-secret',
    }
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const path = String(input)
      if (path === '/api/v1/auth/csrf') {
        return jsonResponse({ token: 'csrf-fallback-token', headerName: 'X-XSRF-TOKEN' })
      }
      if (path === '/api/v1/invites' && init?.method === 'POST') {
        return jsonResponse(createdInvite, { status: 201 })
      }
      throw new Error(`Requisição não esperada: ${path}`)
    })
    const user = userEvent.setup()
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined })
    const execCommand = vi.fn(() => true)
    Object.defineProperty(document, 'execCommand', { configurable: true, value: execCommand })
    renderPrivateRoute('/settings/invitations', ownerSession)

    await user.type(screen.getByLabelText('E-mail'), createdInvite.email)
    await user.click(screen.getByRole('button', { name: 'Criar convite' }))
    const linkField = await screen.findByLabelText('Link de convite')
    await user.click(screen.getByRole('button', { name: 'Copiar link' }))

    expect(execCommand).toHaveBeenCalledWith('copy')
    expect(linkField).toHaveFocus()
    expect(screen.getByText('Link copiado para a área de transferência.')).toBeInTheDocument()
  })
})
