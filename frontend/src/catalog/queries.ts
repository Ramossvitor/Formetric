import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query'
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
  })
}

export function recipesInfiniteQuery(query = '', favorite = false, includeArchived = false) {
  return infiniteQueryOptions({
    queryKey: [...recipesQueryKey, 'infinite', { query, favorite, includeArchived }],
    queryFn: ({ pageParam }) => listRecipes(query, favorite, includeArchived, pageParam),
    initialPageParam: 0,
    getNextPageParam: nextPage,
  })
}

export function foodsQuery(query = '', favorite = false, includeArchived = false) {
  return queryOptions({
    queryKey: [...foodsQueryKey, { query, favorite, includeArchived }],
    queryFn: () => searchFoods(query, favorite, includeArchived),
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
  })
}

export function recipeQuery(id: string) {
  return queryOptions({
    queryKey: [...recipesQueryKey, id],
    queryFn: () => getRecipe(id),
    enabled: Boolean(id),
  })
}
