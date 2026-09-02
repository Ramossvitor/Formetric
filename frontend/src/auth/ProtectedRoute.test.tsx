import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import { useState } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { setupUser } from '../test/user'
import type { AuthSession } from './api'
import { ProtectedRoute } from './ProtectedRoute'
import { sessionQuery } from './queries'
import { fixedProfileTimeContext, seedProfileTimeContext } from '../test/profileTimeContext'
import { useProfileTimeContext } from '../time/ProfileTimeContext'
import type { ProfileTimeContext } from '../time/api'
import { parseInstant } from '../time/instant'
import { parsePlainDate } from '../time/plainDate'

const accountA: AuthSession = {
  authenticated: true,
  user: { id: 'account-a', email: 'a@example.com', displayName: 'Conta A', role: 'USER' },
}
const accountB: AuthSession = {
  authenticated: true,
  user: { id: 'account-b', email: 'b@example.com', displayName: 'Conta B', role: 'USER' },
}
const accountBTime: ProfileTimeContext = {
  serverNow: parseInstant('2026-08-13T04:00:00Z'),
  today: parsePlainDate('2026-08-13'),
  timeZone: 'America/New_York',
  locale: 'en-US',
  nextDayAt: parseInstant('2026-08-14T04:00:00Z'),
}

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    status: 200,
    ...init,
    headers: { 'Content-Type': 'application/json', ...init.headers },
  })
}

function PrivateScreen() {
  const { data: session } = useQuery(sessionQuery)
  const temporal = useProfileTimeContext()
  // Estado de React abaixo da barreira: numa tela real é o sheet aberto ou o rascunho do formulário.
  const [taps, setTaps] = useState(0)
  return (
    <>
      <h1>{`${session?.user.displayName}|${temporal.today}|${temporal.timeZone}`}</h1>
      <button onClick={() => setTaps((count) => count + 1)} type="button">Contar</button>
      <output aria-label="Toques">{taps}</output>
    </>
  )
}

function renderProtected(queryClient: QueryClient) {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route element={<ProtectedRoute />}>
            <Route index element={<PrivateScreen />} />
          </Route>
          <Route element={<h1>Login seguro</h1>} path="/login" />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

/** React Query watches visibilitychange, so this is how a tab regains focus. */
function returnToTab() {
  window.dispatchEvent(new Event('visibilitychange'))
}

function preparedClient() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  queryClient.setQueryData(sessionQuery.queryKey, accountA)
  seedProfileTimeContext(queryClient, fixedProfileTimeContext)
  queryClient.setQueryData(['private', 'account-a'], { weightKg: 91.2 })
  return queryClient
}

beforeEach(() => vi.restoreAllMocks())

describe('fronteira de identidade ao recuperar foco', () => {
  it('não mistura cache nem contexto temporal quando o cookie passa a outra conta', async () => {
    // Holds the revalidation open so the protective state is observable, not a race.
    let releaseSession = () => {}
    const sessionInFlight = new Promise<void>((resolve) => { releaseSession = resolve })
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const path = String(input)
      if (path === '/api/v1/auth/session') {
        await sessionInFlight
        return jsonResponse(accountB)
      }
      if (path === '/api/v1/profile/time-context') return jsonResponse(accountBTime)
      throw new Error(`Requisição não esperada: ${path}`)
    })
    const queryClient = preparedClient()
    const user = setupUser()
    renderProtected(queryClient)
    expect(screen.getByRole('heading', { name: 'Conta A|2026-08-12|America/Sao_Paulo' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Contar' }))
    expect(screen.getByLabelText('Toques')).toHaveTextContent('1')

    returnToTab()

    expect(await screen.findByText('Atualizando sua sessão…')).toBeInTheDocument()
    // A barreira esconde a conta anterior em vez de desmontá-la. É uma diferença deliberada: com o
    // desmonte, cada volta ao app destruía diálogo aberto, rascunho e rolagem, porque todo o estado
    // de React abaixo da rota morria junto. O que precisa continuar valendo é que ninguém VEJA o
    // que era da outra conta — e é isso que se assere aqui, junto com a inércia que impede foco e
    // ponteiro de alcançarem o conteúdo escondido.
    //
    // O texto encontrado durante a revalidação mostra por que a barreira existe: o nome ainda é o
    // da Conta A, mas o fuso já é o da Conta B.
    expect(screen.getByText(/Conta A/)).not.toBeVisible()
    expect(screen.getByText(/Conta A/).closest('.identity-shield')).toHaveAttribute('inert')
    releaseSession()
    expect(await screen.findByRole('heading', { name: 'Conta B|2026-08-13|America/New_York' })).toBeInTheDocument()
    expect(queryClient.getQueryData(['private', 'account-a'])).toBeUndefined()
    expect(queryClient.getQueryData(sessionQuery.queryKey)).toEqual(accountB)
    expect(fetchMock.mock.calls.some(([path]) => path === '/api/v1/profile/time-context')).toBe(true)
    expect(screen.queryByText(/Conta A/)).not.toBeInTheDocument()
    // Limpar o cache não alcança o estado de React das telas; a troca de conta remonta a árvore
    // para que um sheet ou rascunho da Conta A não apareça para a Conta B.
    expect(screen.getByLabelText('Toques')).toHaveTextContent('0')
  })

  it('preserva o estado das telas quando a revalidação confirma a mesma conta', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const path = String(input)
      if (path === '/api/v1/auth/session') return jsonResponse(accountA)
      if (path === '/api/v1/profile/time-context') return jsonResponse(fixedProfileTimeContext)
      throw new Error(`Requisição não esperada: ${path}`)
    })
    const queryClient = preparedClient()
    const user = setupUser()
    renderProtected(queryClient)
    await user.click(screen.getByRole('button', { name: 'Contar' }))

    returnToTab()

    await waitFor(() => expect(queryClient.isFetching()).toBe(0))
    expect(screen.getByRole('heading', { name: 'Conta A|2026-08-12|America/Sao_Paulo' })).toBeVisible()
    expect(screen.getByLabelText('Toques')).toHaveTextContent('1')
  })

  it('limpa dados privados e redireciona quando outra aba encerra a sessão', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const path = String(input)
      if (path === '/api/v1/auth/session') {
        return jsonResponse(
          { title: 'Não autenticado', status: 401 },
          { status: 401, headers: { 'Content-Type': 'application/problem+json' } },
        )
      }
      if (path === '/api/v1/profile/time-context') return jsonResponse(fixedProfileTimeContext)
      throw new Error(`Requisição não esperada: ${path}`)
    })
    const queryClient = preparedClient()
    renderProtected(queryClient)

    returnToTab()

    expect(await screen.findByRole('heading', { name: 'Login seguro' })).toBeInTheDocument()
    await waitFor(() => expect(queryClient.getQueryData(['private', 'account-a'])).toBeUndefined())
    expect(queryClient.getQueryData(sessionQuery.queryKey)).toBeNull()
    expect(screen.queryByText(/Conta A/)).not.toBeInTheDocument()
  })
})
