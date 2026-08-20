import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { clearCsrfToken } from '../api/http'
import type { UserProfile } from '../auth/api'
import { ProfilePage } from './ProfilePage'

const baseProfile: UserProfile = {
  id: 'user-1',
  email: 'person@example.com',
  displayName: 'Pessoa usuária',
  role: 'USER',
  locale: 'pt-BR',
  timeZone: 'America/Sao_Paulo',
  unitSystem: 'METRIC',
  birthDate: null,
  formulaSex: null,
}

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

function renderProfile() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  clearCsrfToken()
  vi.restoreAllMocks()
})

describe('preferência de unidades do perfil', () => {
  it('oferece somente o sistema métrico para perfis métricos', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse(baseProfile))

    renderProfile()

    const unitSystem = await screen.findByLabelText('Sistema de unidades')
    const options = within(unitSystem).getAllByRole('option') as HTMLOptionElement[]

    expect(unitSystem).toHaveValue('METRIC')
    expect(options.map((option) => option.value)).toEqual(['METRIC'])
    expect(screen.getByText('Imperial em breve. Nesta versão, a interface usa kg, cm e ml.')).toBeInTheDocument()
  })

  it('mostra e preserva um valor imperial existente até a troca explícita', async () => {
    const imperialProfile: UserProfile = { ...baseProfile, unitSystem: 'IMPERIAL' }
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const path = String(input)
      if (path === '/api/v1/profile' && !init?.method) return jsonResponse(imperialProfile)
      if (path === '/api/v1/auth/csrf') {
        return jsonResponse({ token: 'profile-csrf-token', headerName: 'X-XSRF-TOKEN' })
      }
      if (path === '/api/v1/profile' && init?.method === 'PATCH') {
        return jsonResponse({ ...imperialProfile, displayName: 'Nome atualizado' })
      }
      throw new Error(`Requisição não esperada: ${path}`)
    })
    const user = userEvent.setup()

    renderProfile()

    const unitSystem = await screen.findByLabelText('Sistema de unidades')
    const imperialOption = within(unitSystem).getByRole('option', { name: /configuração atual/ })
    const selectableOptions = within(unitSystem)
      .getAllByRole('option')
      .filter((option) => !(option as HTMLOptionElement).disabled)

    expect(unitSystem).toHaveValue('IMPERIAL')
    expect(imperialOption).toBeDisabled()
    expect(selectableOptions).toHaveLength(1)
    expect(selectableOptions[0]).toHaveValue('METRIC')
    expect(screen.getByText(/O perfil continuará marcado como imperial até você escolher Métrico e salvar/)).toBeInTheDocument()

    await user.clear(screen.getByLabelText('Nome'))
    await user.type(screen.getByLabelText('Nome'), 'Nome atualizado')
    await user.click(screen.getByRole('button', { name: 'Salvar alterações' }))

    expect(await screen.findByRole('status')).toHaveTextContent('Perfil atualizado.')
    const updateCall = fetchMock.mock.calls.find(
      ([path, init]) => String(path) === '/api/v1/profile' && init?.method === 'PATCH',
    )
    expect(JSON.parse(String(updateCall?.[1]?.body))).toEqual(expect.objectContaining({
      displayName: 'Nome atualizado',
      unitSystem: 'IMPERIAL',
    }))
  })
})
