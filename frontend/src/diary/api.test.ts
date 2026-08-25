import { clearCsrfToken } from '../api/http'
import { addWater } from './api'

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } })
}

beforeEach(() => {
  clearCsrfToken()
  vi.restoreAllMocks()
})

describe('addWater', () => {
  it('deixa o backend registrar o instante por padrão e aceita um Instant explícito', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      if (String(input) === '/api/v1/auth/csrf') {
        return jsonResponse({ token: 'water-csrf', headerName: 'X-XSRF-TOKEN' })
      }
      return jsonResponse({})
    })

    await addWater('2026-08-12', 250)
    await addWater('2026-08-12', 500, { loggedAt: '2026-08-12T14:30:00Z' })

    const requests = fetchMock.mock.calls
      .filter(([path]) => path === '/api/v1/daily-logs/2026-08-12/water')
      .map(([, init]) => JSON.parse(String(init?.body)) as Record<string, unknown>)
    expect(requests).toHaveLength(2)
    expect(requests[0]).toEqual(expect.objectContaining({ volumeMl: 250 }))
    expect(requests[0]).not.toHaveProperty('loggedAt')
    expect(requests[1]).toEqual(expect.objectContaining({
      volumeMl: 500,
      loggedAt: '2026-08-12T14:30:00Z',
    }))
  })
})
