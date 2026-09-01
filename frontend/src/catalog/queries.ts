import { infiniteQueryOptions, keepPreviousData, queryOptions } from '@tanstack/react-query'

// Trocar data, período, mês ou termo de busca NÃO apaga mais a tela: o resultado anterior
// permanece à vista enquanto o novo chega, e a página avisa que está atualizando em vez de piscar
// para um spinner. É a diferença entre uma tela que responde e uma que reinicia.
import { getFood, getRecipe, listRecipes, searchFoods } from './api'

export const foodsQueryKey = ['catalog', 'foods'] as const
export const recipesQueryKey = ['catalog', 'recipes'] as const

function nextPage(lastPage: { page: number; totalPages: number }) {
  return lastPage.page + 1 < lastPage.totalPages ? lastPage.page + 1 : undefined
}

export function foodsInfiniteQuery(query = '', favorite = false, includeArchived = false) {
  return infiniteQueryOptions({
    queryKey: [...foodsQueryKey, 'infinite', { query, favorite, includeArchived }],
    queryFn: ({ pageParam }) => searchFoods(query, favorite, includeArchived, pageParam),
    initialPageParam: 0,
    getNextPageParam: nextPage,
    placeholderData: keepPreviousData,
  })
}

export function recipesInfiniteQuery(query = '', favorite = false, includeArchived = false) {
  return infiniteQueryOptions({
    queryKey: [...recipesQueryKey, 'infinite', { query, favorite, includeArchived }],
    queryFn: ({ pageParam }) => listRecipes(query, favorite, includeArchived, pageParam),
    initialPageParam: 0,
    getNextPageParam: nextPage,
    placeholderData: keepPreviousData,
  })
}

export function foodsQuery(query = '', favorite = false, includeArchived = false) {
  return queryOptions({
    queryKey: [...foodsQueryKey, { query, favorite, includeArchived }],
    queryFn: () => searchFoods(query, favorite, includeArchived),
    placeholderData: keepPreviousData,
  })
}

export function foodQuery(id: string) {
  return queryOptions({
    queryKey: [...foodsQueryKey, id],
    queryFn: () => getFood(id),
    enabled: Boolean(id),
  })
}

export function recipesQuery(query = '', favorite = false, includeArchived = false) {
  return queryOptions({
    queryKey: [...recipesQueryKey, { query, favorite, includeArchived }],
    queryFn: () => listRecipes(query, favorite, includeArchived),
    placeholderData: keepPreviousData,
  })
}

export function recipeQuery(id: string) {
  return queryOptions({
    queryKey: [...recipesQueryKey, id],
    queryFn: () => getRecipe(id),
    enabled: Boolean(id),
  })
}
