import { queryOptions } from '@tanstack/react-query'
import { getFood, getRecipe, listRecipes, searchFoods } from './api'

export const foodsQueryKey = ['catalog', 'foods'] as const
export const recipesQueryKey = ['catalog', 'recipes'] as const

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
