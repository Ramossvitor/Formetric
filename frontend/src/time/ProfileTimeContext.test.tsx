import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { fixedProfileTimeContext, seedProfileTimeContext } from '../test/profileTimeContext'
import type { ProfileTimeContext as ProfileTimeContextValue } from './api'
import { parseInstant } from './instant'
import { ProfileTimeContextProvider, useProfileTimeContext } from './ProfileTimeContext'

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } })
}

function Consumer() {
  const value = useProfileTimeContext()
  return <output>{`${value.today}|${value.timeZone}|${value.locale}`}</output>
}

function Wrapper({ children, queryClient }: { children: ReactNode; queryClient: QueryClient }) {
  return <QueryClientProvider client={queryClient}><ProfileTimeContextProvider>{children}</ProfileTimeContextProvider></QueryClientProvider>
}

function queryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
}

beforeEach(() => vi.restoreAllMocks())
afterEach(() => vi.useRealTimers())

describe('ProfileTimeContextProvider', () => {
  it('usa o hoje retornado pelo perfil mesmo quando o relógio do navegador diverge', async () => {
    // Only Date is faked: the query still needs real timers to settle.
    vi.useFakeTimers({ now: new Date('2040-01-01T12:00:00Z'), toFake: ['Date'] })
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse(fixedProfileTimeContext))
    const client = queryClient()

    render(<Consumer />, { wrapper: ({ children }) => <Wrapper queryClient={client}>{children}</Wrapper> })

    expect(await screen.findByText('2026-08-12|America/Sao_Paulo|pt-BR')).toBeInTheDocument()
  })

  it('mantém um único timer calculado por nextDayAt menos serverNow', () => {
    vi.useFakeTimers()
    const client = queryClient()
    const snapshot: ProfileTimeContextValue = {
      ...fixedProfileTimeContext,
      serverNow: parseInstant('2026-12-31T23:30:00Z'),
      nextDayAt: parseInstant('2027-01-01T00:00:00Z'),
    }
    seedProfileTimeContext(client, snapshot)
    const invalidate = vi.spyOn(client, 'invalidateQueries').mockResolvedValue()

    const view = render(<Consumer />, { wrapper: ({ children }) => <Wrapper queryClient={client}>{children}</Wrapper> })
    expect(screen.getByText(/2026-08-12/)).toBeInTheDocument()
    expect(vi.getTimerCount()).toBe(1)

    act(() => vi.advanceTimersByTime(30 * 60 * 1000 - 1))
    expect(invalidate).not.toHaveBeenCalled()
    act(() => vi.advanceTimersByTime(1))
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['profile', 'time-context'], refetchType: 'active' })
    view.unmount()
  })

  it('refaz a consulta ao recuperar o foco e substitui o snapshot', async () => {
    const nextSnapshot: ProfileTimeContextValue = {
      ...fixedProfileTimeContext,
      today: '2026-08-13' as ProfileTimeContextValue['today'],
      serverNow: parseInstant('2026-08-13T03:00:01Z'),
      nextDayAt: parseInstant('2026-08-14T03:00:00Z'),
    }
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse(fixedProfileTimeContext))
      .mockResolvedValueOnce(jsonResponse(nextSnapshot))
    const client = queryClient()

    render(<Consumer />, { wrapper: ({ children }) => <Wrapper queryClient={client}>{children}</Wrapper> })
    expect(await screen.findByText(/2026-08-12/)).toBeInTheDocument()

    // React Query watches visibilitychange, so this is how a tab regains focus.
    window.dispatchEvent(new Event('visibilitychange'))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    expect(await screen.findByText(/2026-08-13/)).toBeInTheDocument()
  })
})
