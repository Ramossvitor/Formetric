import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import { useEffect } from 'react'
import { BrowserRouter, Link, Route, Routes, useSearchParams } from 'react-router-dom'
import type { AuthSession } from '../auth/api'
import { sessionQuery } from '../auth/queries'
import { setupUser } from '../test/user'
import { AuthenticatedLayout } from './AuthenticatedLayout'

const session: AuthSession = {
  authenticated: true,
  user: { id: 'user-1', email: 'vitor@example.com', displayName: 'Vitor Ramos', role: 'USER' },
}

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } })
}

function Home() {
  return (
    <>
      <h1>Hoje</h1>
      <Link to="/foods/1?action=new">Abrir alimento</Link>
    </>
  )
}

/** Uma tela profunda que consome `?action=` com `replace`, como treinos e pesagens fazem. */
function DeepScreen() {
  const [params, setParams] = useSearchParams()
  useEffect(() => {
    if (!params.get('action')) return
    const next = new URLSearchParams(params)
    next.delete('action')
    setParams(next, { replace: true })
  }, [params, setParams])
  return <h1>Tela profunda</h1>
}

// O histórico real do navegador entra no teste porque é nele que a diferença está: um `replace`
// troca a chave da entrada sem criar outra, e o MemoryRouter não reproduz isso.
function renderAt(route: string) {
  window.history.replaceState(null, '', route)
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  queryClient.setQueryData(sessionQuery.queryKey, session)
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const path = String(input)
    if (path === '/api/v1/auth/session') return jsonResponse(session)
    throw new Error(`Requisição não esperada: ${path}`)
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route element={<AuthenticatedLayout />}>
            <Route index element={<Home />} />
            <Route element={<DeepScreen />} path="/foods/:id" />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => vi.restoreAllMocks())

describe('botão voltar do cabeçalho', () => {
  it('sobe para a tela inicial quando o app abriu direto numa tela profunda', async () => {
    // É o que um atalho do ícone instalado faz: a primeira entrada do histórico já é a tela
    // profunda, e o `replace` que limpa `?action=` não cria uma segunda. Voltar no histórico
    // levaria para fora do app.
    const user = setupUser()
    renderAt('/foods/1?action=new')

    expect(await screen.findByRole('heading', { name: 'Tela profunda' })).toBeInTheDocument()
    await waitFor(() => expect(window.location.search).toBe(''))
    await user.click(screen.getByRole('button', { name: 'Voltar' }))

    expect(await screen.findByRole('heading', { name: 'Hoje' })).toBeInTheDocument()
  })

  it('volta no histórico quando a tela profunda foi aberta de dentro do app', async () => {
    const user = setupUser()
    renderAt('/')

    await user.click(await screen.findByRole('link', { name: 'Abrir alimento' }))
    expect(await screen.findByRole('heading', { name: 'Tela profunda' })).toBeInTheDocument()
    await waitFor(() => expect(window.location.search).toBe(''))
    await user.click(screen.getByRole('button', { name: 'Voltar' }))

    expect(await screen.findByRole('heading', { name: 'Hoje' })).toBeInTheDocument()
  })
})
