import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import { setupUser } from '../test/user'
import { MemoryRouter } from 'react-router-dom'
import App from '../App'
import { seedProfileTimeContext } from '../test/profileTimeContext'
import { clearCsrfToken } from '../api/http'

const session = {
  authenticated: true,
  user: {
    id: 'cbcdf167-29ad-4372-906a-843a8fde172d',
    email: 'vitor@example.com',
    displayName: 'Vitor Ramos',
    role: 'USER',
  },
}

const nutrition = {
  caloriesKcal: 112,
  proteinG: 27,
  carbohydrateG: 1.5,
  fatG: 0.8,
  fiberG: 0,
  sodiumMg: 65,
}

const foodVersion = {
  id: 'food-version-1',
  versionNumber: 1,
  name: 'Whey Bodybuilders',
  brand: 'Bodybuilders',
  notes: null,
  referenceQuantity: 30,
  referenceUnit: 'G',
  ...nutrition,
  quality: 'EXACT',
  kcalUncertainty: null,
  servings: [
    {
      id: 'serving-1',
      position: 0,
      label: 'Dosador',
      unit: 'PORTION',
      quantity: 1,
      referenceQuantityEquivalent: 30,
    },
  ],
  createdAt: '2026-08-12T12:00:00Z',
}

const food = {
  id: 'food-1',
  origin: 'USER',
  externalSource: null,
  externalId: null,
  archived: false,
  favorite: false,
  currentVersion: foodVersion,
  versions: [foodVersion],
  createdAt: '2026-08-12T12:00:00Z',
  updatedAt: '2026-08-12T12:00:00Z',
}

const recipeVersion = {
  id: 'recipe-version-1',
  versionNumber: 1,
  name: 'Shake de whey',
  notes: null,
  yieldQuantity: 300,
  yieldUnit: 'ML',
  servingQuantity: 300,
  ingredients: [
    {
      position: 0,
      foodVersionId: foodVersion.id,
      foodName: foodVersion.name,
      quantity: 30,
      unit: 'G',
      referenceQuantityEquivalent: null,
      nutrients: nutrition,
    },
  ],
  totalNutrition: nutrition,
  per100gNutrition: null,
  perServingNutrition: nutrition,
  quality: 'EXACT',
  kcalUncertainty: null,
  createdAt: '2026-08-12T12:00:00Z',
}

const recipe = {
  id: 'recipe-1',
  archived: false,
  favorite: false,
  currentVersion: recipeVersion,
  versions: [recipeVersion],
  createdAt: '2026-08-12T12:00:00Z',
  updatedAt: '2026-08-12T12:00:00Z',
}

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    status: 200,
    ...init,
    headers: { 'Content-Type': 'application/json', ...init.headers },
  })
}

function page(content: unknown[]) {
  return { content, page: 0, size: 100, totalElements: content.length, totalPages: content.length ? 1 : 0 }
}

function unauthorizedResponse() {
  return jsonResponse({ title: 'Não autenticado', status: 401 }, { status: 401 })
}

function renderRoute(route: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  seedProfileTimeContext(queryClient)
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[route]}><App /></MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  clearCsrfToken()
  vi.restoreAllMocks()
})

describe('catálogo', () => {
  it('mantém as rotas do catálogo privadas', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(unauthorizedResponse())
    renderRoute('/foods')
    expect(await screen.findByRole('heading', { name: 'Acesse sua conta' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Alimentos' })).not.toBeInTheDocument()
  })

  it('pesquisa alimentos com debounce e termo tolerante enviado ao backend', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const path = String(input)
      if (path === '/api/v1/auth/session') return jsonResponse(session)
      if (path.includes('/api/v1/foods?')) {
        return jsonResponse(path.includes('query=') ? page([food]) : page([]))
      }
      throw new Error(`Requisição não esperada: ${path}`)
    })
    const user = setupUser()
    renderRoute('/foods')

    await screen.findByRole('heading', { name: 'Sua biblioteca está vazia' })
    await user.type(screen.getByRole('searchbox', { name: 'Pesquisar alimentos' }), 'whey bodybuilders')

    expect(await screen.findByText('Whey Bodybuilders')).toBeInTheDocument()
    expect(fetchMock.mock.calls.some(([path]) => decodeURIComponent(String(path).replaceAll('+', ' ')).includes('query=whey bodybuilders'))).toBe(true)
  })

  it('cria alimento com porção proporcional no payload', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const path = String(input)
      if (path === '/api/v1/auth/session') return jsonResponse(session)
      if (path === '/api/v1/auth/csrf') return jsonResponse({ token: 'catalog-csrf', headerName: 'X-XSRF-TOKEN' })
      if (path === '/api/v1/foods' && init?.method === 'POST') return jsonResponse(food, { status: 201 })
      if (path === '/api/v1/foods/food-1') return jsonResponse(food)
      throw new Error(`Requisição não esperada: ${path}`)
    })
    const user = setupUser()
    renderRoute('/foods/new')

    await screen.findByRole('heading', { name: 'Novo alimento' })
    await user.type(screen.getByLabelText('Nome'), 'Whey Bodybuilders')
    const reference = screen.getByLabelText('Quantidade', { selector: '#food-reference-quantity' })
    await user.clear(reference)
    await user.type(reference, '30')
    const calories = screen.getByLabelText('Calorias')
    await user.clear(calories)
    await user.type(calories, '112')
    const protein = screen.getByLabelText('Proteínas')
    await user.clear(protein)
    await user.type(protein, '27')
    await user.click(screen.getByRole('button', { name: '+ Adicionar' }))
    await user.type(screen.getByLabelText('Nome', { selector: '#serving-0-label' }), 'Dosador')
    await user.selectOptions(screen.getByLabelText('Unidade', { selector: '#serving-0-unit' }), 'PORTION')
    const equivalent = screen.getByLabelText('Equivale na referência', { selector: '#serving-0-equivalent' })
    await user.clear(equivalent)
    await user.type(equivalent, '30')
    await user.click(screen.getByRole('button', { name: 'Cadastrar alimento' }))

    expect(await screen.findByRole('heading', { name: 'Whey Bodybuilders' })).toBeInTheDocument()
    const createCall = fetchMock.mock.calls.find(([path, init]) => path === '/api/v1/foods' && init?.method === 'POST')
    const body = JSON.parse(String(createCall?.[1]?.body))
    expect(body).toEqual(expect.objectContaining({
      origin: 'USER',
      name: 'Whey Bodybuilders',
      referenceQuantity: 30,
      referenceUnit: 'G',
      caloriesKcal: 112,
      proteinG: 27,
    }))
    expect(body.servings).toEqual([{ label: 'Dosador', unit: 'PORTION', quantity: 1, referenceQuantityEquivalent: 30 }])
    expect(new Headers(createCall?.[1]?.headers).get('X-XSRF-TOKEN')).toBe('catalog-csrf')
  })

  it('salva atualização de alimento como uma nova versão', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const path = String(input)
      if (path === '/api/v1/auth/session') return jsonResponse(session)
      if (path === '/api/v1/auth/csrf') return jsonResponse({ token: 'version-csrf', headerName: 'X-XSRF-TOKEN' })
      if (path === '/api/v1/foods/food-1/versions' && init?.method === 'POST') return jsonResponse(food, { status: 201 })
      if (path === '/api/v1/foods/food-1') return jsonResponse(food)
      throw new Error(`Requisição não esperada: ${path}`)
    })
    const user = setupUser()
    renderRoute('/foods/food-1')

    await user.click(await screen.findByRole('button', { name: 'Criar nova versão' }))
    const calories = screen.getByLabelText('Calorias')
    await user.clear(calories)
    await user.type(calories, '115')
    await user.click(screen.getByRole('button', { name: 'Salvar como nova versão' }))

    await waitFor(() => expect(screen.queryByRole('button', { name: 'Salvar como nova versão' })).not.toBeInTheDocument())
    const versionCall = fetchMock.mock.calls.find(([path, init]) => path === '/api/v1/foods/food-1/versions' && init?.method === 'POST')
    const body = JSON.parse(String(versionCall?.[1]?.body))
    expect(body.caloriesKcal).toBe(115)
    expect(body).not.toHaveProperty('origin')
    expect(body.name).toBe('Whey Bodybuilders')
  })

  it('mantém alimento global somente leitura, exceto favorito', async () => {
    const systemFood = { ...food, origin: 'SYSTEM' }
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const path = String(input)
      if (path === '/api/v1/auth/session') return jsonResponse(session)
      if (path === '/api/v1/foods/food-1') return jsonResponse(systemFood)
      throw new Error(`Requisição não esperada: ${path}`)
    })
    renderRoute('/foods/food-1')

    expect(await screen.findByRole('heading', { name: 'Whey Bodybuilders' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Adicionar aos favoritos' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Criar nova versão' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Arquivar' })).not.toBeInTheDocument()
  })

  it('alterna favorito sem misturar o estado privado', async () => {
    let favorite = false
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const path = String(input)
      if (path === '/api/v1/auth/session') return jsonResponse(session)
      if (path === '/api/v1/auth/csrf') return jsonResponse({ token: 'favorite-csrf', headerName: 'X-XSRF-TOKEN' })
      if (path === '/api/v1/foods/food-1/favorite' && init?.method === 'PUT') {
        favorite = true
        return new Response(null, { status: 204 })
      }
      if (path.includes('/api/v1/foods?')) return jsonResponse(page([{ ...food, favorite }]))
      throw new Error(`Requisição não esperada: ${path}`)
    })
    const user = setupUser()
    renderRoute('/foods')

    const toggle = await screen.findByRole('button', { name: 'Favoritar Whey Bodybuilders' })
    await user.click(toggle)
    expect(await screen.findByRole('button', { name: 'Remover Whey Bodybuilders dos favoritos' })).toHaveAttribute('aria-pressed', 'true')
    expect(fetchMock.mock.calls.some(([path, init]) => path === '/api/v1/foods/food-1/favorite' && init?.method === 'PUT')).toBe(true)
  })

  it('lista arquivados separadamente e restaura um alimento com DELETE', async () => {
    const archivedFood = { ...food, archived: true }
    let restored = false
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const path = String(input)
      if (path === '/api/v1/auth/session') return jsonResponse(session)
      if (path === '/api/v1/auth/csrf') return jsonResponse({ token: 'archive-csrf', headerName: 'X-XSRF-TOKEN' })
      if (path === '/api/v1/foods/food-1/archive' && init?.method === 'DELETE') {
        restored = true
        return new Response(null, { status: 204 })
      }
      if (path === '/api/v1/foods/food-1') return jsonResponse(restored ? food : archivedFood)
      if (path.includes('/api/v1/foods?')) return jsonResponse(page([archivedFood]))
      throw new Error(`Requisição não esperada: ${path}`)
    })
    const user = setupUser()
    renderRoute('/foods')

    await screen.findByRole('heading', { name: 'Sua biblioteca está vazia' })
    await user.click(screen.getByRole('button', { name: 'Arquivados' }))
    expect(await screen.findByText('Whey Bodybuilders')).toBeInTheDocument()
    expect(fetchMock.mock.calls.some(([path]) => String(path).includes('includeArchived=true'))).toBe(true)

    await user.click(screen.getByRole('link', { name: 'Abrir Whey Bodybuilders' }))
    await user.click(await screen.findByRole('button', { name: 'Restaurar' }))
    await waitFor(() => expect(fetchMock.mock.calls.some(([path, init]) => path === '/api/v1/foods/food-1/archive' && init?.method === 'DELETE')).toBe(true))
    expect(new Headers(fetchMock.mock.calls.find(([path, init]) => path === '/api/v1/foods/food-1/archive' && init?.method === 'DELETE')?.[1]?.headers).get('X-XSRF-TOKEN')).toBe('archive-csrf')
  })

  it('cria receita com versão fixa do ingrediente e mostra cálculos retornados', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const path = String(input)
      if (path === '/api/v1/auth/session') return jsonResponse(session)
      if (path === '/api/v1/auth/csrf') return jsonResponse({ token: 'recipe-csrf', headerName: 'X-XSRF-TOKEN' })
      if (path.includes('/api/v1/foods?')) return jsonResponse(page([food]))
      if (path === '/api/v1/recipes' && init?.method === 'POST') return jsonResponse(recipe, { status: 201 })
      if (path === '/api/v1/recipes/recipe-1') return jsonResponse(recipe)
      throw new Error(`Requisição não esperada: ${path}`)
    })
    const user = setupUser()
    renderRoute('/recipes/new')

    await user.type(await screen.findByLabelText('Nome'), 'Shake de whey')
    await user.selectOptions(screen.getByLabelText('Alimento'), foodVersion.id)
    const quantity = screen.getByLabelText('Quantidade', { selector: '#ingredient-0-quantity' })
    await user.clear(quantity)
    await user.type(quantity, '30')
    await user.click(screen.getByRole('button', { name: 'Criar e calcular receita' }))

    expect(await screen.findByRole('heading', { name: 'Nutrição da receita' })).toBeInTheDocument()
    const fullRecipe = screen.getByRole('heading', { name: 'Receita completa' }).closest('div')
    expect(fullRecipe).not.toBeNull()
    expect(within(fullRecipe!).getByText('112 kcal')).toBeInTheDocument()
    const createCall = fetchMock.mock.calls.find(([path, init]) => path === '/api/v1/recipes' && init?.method === 'POST')
    const body = JSON.parse(String(createCall?.[1]?.body))
    expect(body.ingredients).toEqual([{ foodVersionId: foodVersion.id, quantity: 30, unit: 'G', referenceQuantityEquivalent: null }])
  })

  it('carrega as páginas seguintes do catálogo em vez de truncar em silêncio', async () => {
    const secondFood = {
      ...food,
      id: 'food-2',
      currentVersion: { ...foodVersion, id: 'food-version-2', name: 'Arroz integral' },
    }
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const path = String(input)
      if (path === '/api/v1/auth/session') return jsonResponse(session)
      if (path.includes('/api/v1/foods?')) {
        const requested = new URLSearchParams(path.split('?')[1]).get('page')
        return jsonResponse(requested === '1'
          ? { content: [secondFood], page: 1, size: 100, totalElements: 2, totalPages: 2 }
          : { content: [food], page: 0, size: 100, totalElements: 2, totalPages: 2 })
      }
      throw new Error(`Requisição não esperada: ${path}`)
    })
    const user = setupUser()
    renderRoute('/foods')

    expect(await screen.findByText('1 de 2 alimentos ativos')).toBeInTheDocument()
    expect(screen.queryByText('Arroz integral')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Carregar mais' }))

    expect(await screen.findByText('Arroz integral')).toBeInTheDocument()
    expect(screen.getByText('2 alimentos ativos')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Carregar mais' })).not.toBeInTheDocument()
  })
})
