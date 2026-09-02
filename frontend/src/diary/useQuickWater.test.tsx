import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { clearCsrfToken } from '../api/http'
import type { DailyLog } from './api'
import { dailyLogQuery } from './queries'
import { useQuickWater } from './useQuickWater'

const DATE = '2026-08-12'
const queryKey = dailyLogQuery(DATE).queryKey

function log(id: string, waterTotalMl: number) {
  return { id, date: DATE, status: 'OPEN', meals: [], waterLogs: [], waterTotalMl } as unknown as DailyLog
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => { resolve = done })
  return { promise, resolve }
}

function setup() {
  // `staleTime: Infinity` para o dado semeado não ser rebuscado ao montar: aqui o único GET legítimo
  // é a recarga que a própria mutation pede.
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity }, mutations: { retry: false } } })
  queryClient.setQueryData(queryKey, log('cache', 0))
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
  // A página observa o diário; sem um observador, invalidar não rebusca nada.
  const { result } = renderHook(() => {
    useQuery(dailyLogQuery(DATE))
    return useQuickWater(DATE)
  }, { wrapper })
  return { queryClient, result }
}

function isReload(call: { method: string; path: string }) {
  return call.method === 'GET' && call.path === `/api/v1/daily-logs/${DATE}`
}

/** Mock de rede em que cada POST de água devolve a próxima resposta da fila, quando ela resolver. */
function mockNetwork(posts: Array<Promise<Response>>, reload: () => Response) {
  const calls: Array<{ method: string; path: string }> = []
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const path = String(input)
    const method = init?.method ?? 'GET'
    calls.push({ method, path })
    if (path === '/api/v1/auth/csrf') return jsonResponse({ token: 'water-csrf', headerName: 'X-XSRF-TOKEN' })
    if (path === `/api/v1/daily-logs/${DATE}/water` && method === 'POST') return posts.shift()!
    if (path === `/api/v1/daily-logs/${DATE}` && method === 'GET') return reload()
    throw new Error(`Requisição não esperada: ${method} ${path}`)
  })
  return calls
}

beforeEach(() => {
  clearCsrfToken()
  vi.restoreAllMocks()
})

describe('registro rápido de água', () => {
  it('um toque sozinho confia na própria resposta, sem recarregar', async () => {
    const calls = mockNetwork([Promise.resolve(jsonResponse(log('m1', 250), 201))], () => jsonResponse(log('server', 250)))
    const { queryClient, result } = setup()

    act(() => result.current.mutate(250))

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(queryClient.getQueryData<DailyLog>(queryKey)?.id).toBe('m1')
    expect(calls.filter(isReload)).toHaveLength(0)
  })

  it('uma rajada de toques recarrega o diário ao terminar, em vez de gravar a resposta que chegou por último', async () => {
    // Duas respostas em voo: a do primeiro toque chega DEPOIS da do segundo. Ela traz o total que o
    // servidor tinha ao processar o primeiro toque — gravá-la devolveria o total a 250 ml, com o
    // servidor em 750.
    const first = deferred<Response>()
    const second = deferred<Response>()
    const calls = mockNetwork([first.promise, second.promise], () => jsonResponse(log('server', 750)))
    const { queryClient, result } = setup()

    act(() => {
      result.current.mutate(250)
      result.current.mutate(500)
    })
    await waitFor(() => expect(calls.filter((call) => call.method === 'POST')).toHaveLength(2))
    expect(queryClient.getQueryData<DailyLog>(queryKey)?.waterTotalMl).toBe(750)

    second.resolve(jsonResponse(log('m2', 750), 201))
    await waitFor(() => expect(queryClient.isMutating()).toBe(1))
    expect(queryClient.getQueryData<DailyLog>(queryKey)?.waterTotalMl).toBe(750)

    first.resolve(jsonResponse(log('m1', 250), 201))
    await waitFor(() => expect(queryClient.isMutating()).toBe(0))

    await waitFor(() => expect(queryClient.getQueryData<DailyLog>(queryKey)?.id).toBe('server'))
    expect(queryClient.getQueryData<DailyLog>(queryKey)?.waterTotalMl).toBe(750)
    expect(calls.filter(isReload)).toHaveLength(1)
  })
})
