import { apiRequest } from '../api/http'

export type FoodUnit = 'G' | 'ML' | 'UNIT' | 'TABLESPOON' | 'SLICE' | 'PORTION'
export type DataQuality = 'EXACT' | 'ESTIMATED' | 'HIGHLY_ESTIMATED'
export type FoodOrigin = 'USER' | 'SYSTEM' | 'EXTERNAL'
export type WritableFoodOrigin = Exclude<FoodOrigin, 'SYSTEM'>
export type RecipeYieldUnit = 'G' | 'ML' | 'PORTION'

export interface NutritionValues {
  caloriesKcal: number
  proteinG: number
  carbohydrateG: number
  fatG: number
  fiberG: number
  sodiumMg: number | null
}

export interface FoodServing {
  id?: string
  position?: number
  label: string
  unit: FoodUnit
  quantity: number
  referenceQuantityEquivalent: number
}

export interface FoodVersion extends NutritionValues {
  id: string
  versionNumber: number
  name: string
  brand: string | null
  notes: string | null
  referenceQuantity: number
  referenceUnit: FoodUnit
  quality: DataQuality
  kcalUncertainty: number | null
  servings: FoodServing[]
  createdAt: string
}

export interface FoodSummary {
  id: string
  origin: FoodOrigin
  externalSource: string | null
  externalId: string | null
  archived: boolean
  favorite: boolean
  currentVersion: FoodVersion
  createdAt: string
  updatedAt: string
}

export interface FoodDetail extends FoodSummary {
  versions: FoodVersion[]
}

export interface FoodVersionInput extends NutritionValues {
  name: string
  brand: string | null
  notes: string | null
  referenceQuantity: number
  referenceUnit: FoodUnit
  quality: DataQuality
  kcalUncertainty: number | null
  servings: Array<Omit<FoodServing, 'id'>>
}

export interface CreateFoodRequest extends FoodVersionInput {
  origin: WritableFoodOrigin
  externalSource?: string | null
  externalId?: string | null
}

export interface FoodSearchResult {
  content: FoodSummary[]
  page: number
  size: number
  totalElements: number
  totalPages: number
}

export interface RecipeIngredientInput {
  foodVersionId: string
  quantity: number
  unit: FoodUnit
  servingOptionId?: string | null
  referenceQuantityEquivalent?: number | null
}

export interface RecipeIngredient extends RecipeIngredientInput {
  position: number
  foodName: string
  nutrients: NutritionValues
}

export interface RecipeNutrition {
  totalNutrition: NutritionValues
  per100gNutrition: NutritionValues | null
  perServingNutrition: NutritionValues | null
}

export interface RecipeVersion extends RecipeNutrition {
  id: string
  versionNumber: number
  name: string
  notes: string | null
  yieldQuantity: number
  yieldUnit: RecipeYieldUnit
  servingQuantity: number | null
  ingredients: RecipeIngredient[]
  quality: DataQuality
  kcalUncertainty: number | null
  createdAt: string
}

export interface RecipeSummary {
  id: string
  archived: boolean
  favorite: boolean
  currentVersion: RecipeVersion
  createdAt: string
  updatedAt: string
}

export interface RecipeDetail extends RecipeSummary {
  versions: RecipeVersion[]
}

export interface RecipeVersionInput {
  name: string
  notes: string | null
  yieldQuantity: number
  yieldUnit: RecipeYieldUnit
  servingQuantity: number | null
  ingredients: RecipeIngredientInput[]
}

export type CreateRecipeRequest = RecipeVersionInput

export interface RecipeSearchResult {
  content: RecipeSummary[]
  page: number
  size: number
  totalElements: number
  totalPages: number
}

function nullableText(value: string | null | undefined) {
  const normalized = value?.trim()
  return normalized ? normalized : null
}

export function normalizeFoodRequest(input: CreateFoodRequest): CreateFoodRequest {
  return {
    ...input,
    name: input.name.trim(),
    brand: nullableText(input.brand),
    notes: nullableText(input.notes),
    sodiumMg: input.sodiumMg ?? null,
    kcalUncertainty: input.kcalUncertainty ?? null,
    servings: input.servings.map((serving) => ({
      ...serving,
      label: serving.label.trim(),
    })),
  }
}

export function searchFoods(query = '', favorite = false, includeArchived = false): Promise<FoodSearchResult> {
  const params = new URLSearchParams({ page: '0', size: '100' })
  if (query.trim()) params.set('query', query.trim())
  if (favorite) params.set('favorite', 'true')
  if (includeArchived) params.set('includeArchived', 'true')
  return apiRequest<FoodSearchResult>(`/api/v1/foods?${params.toString()}`)
}

export function createFood(request: CreateFoodRequest): Promise<FoodDetail> {
  return apiRequest<FoodDetail>('/api/v1/foods', {
    method: 'POST',
    body: normalizeFoodRequest(request),
    csrf: true,
  })
}

export function getFood(id: string): Promise<FoodDetail> {
  return apiRequest<FoodDetail>(`/api/v1/foods/${encodeURIComponent(id)}`)
}

export function createFoodVersion(id: string, version: FoodVersionInput): Promise<FoodDetail> {
  const normalized = normalizeFoodRequest({ ...version, origin: 'USER' })
  const { origin: _origin, externalSource: _externalSource, externalId: _externalId, ...body } = normalized
  return apiRequest<FoodDetail>(`/api/v1/foods/${encodeURIComponent(id)}/versions`, {
    method: 'POST',
    body,
    csrf: true,
  })
}

export function setFoodFavorite(id: string, favorite: boolean): Promise<void> {
  return apiRequest<void>(`/api/v1/foods/${encodeURIComponent(id)}/favorite`, {
    method: favorite ? 'PUT' : 'DELETE',
    csrf: true,
  })
}

export function archiveFood(id: string): Promise<void> {
  return apiRequest<void>(`/api/v1/foods/${encodeURIComponent(id)}/archive`, {
    method: 'POST',
    csrf: true,
  })
}

export function restoreFood(id: string): Promise<void> {
  return apiRequest<void>(`/api/v1/foods/${encodeURIComponent(id)}/archive`, {
    method: 'DELETE',
    csrf: true,
  })
}

export function listRecipes(query = '', favorite = false, includeArchived = false): Promise<RecipeSearchResult> {
  const params = new URLSearchParams({ page: '0', size: '100' })
  if (query.trim()) params.set('query', query.trim())
  if (favorite) params.set('favorite', 'true')
  if (includeArchived) params.set('includeArchived', 'true')
  return apiRequest<RecipeSearchResult>(`/api/v1/recipes?${params.toString()}`)
}

export function createRecipe(request: CreateRecipeRequest): Promise<RecipeDetail> {
  return apiRequest<RecipeDetail>('/api/v1/recipes', {
    method: 'POST',
    body: {
      ...request,
      name: request.name.trim(),
      notes: nullableText(request.notes),
    },
    csrf: true,
  })
}

export function getRecipe(id: string): Promise<RecipeDetail> {
  return apiRequest<RecipeDetail>(`/api/v1/recipes/${encodeURIComponent(id)}`)
}

export function createRecipeVersion(id: string, version: RecipeVersionInput): Promise<RecipeDetail> {
  return apiRequest<RecipeDetail>(`/api/v1/recipes/${encodeURIComponent(id)}/versions`, {
    method: 'POST',
    body: version,
    csrf: true,
  })
}

export function duplicateRecipe(id: string): Promise<RecipeDetail> {
  return apiRequest<RecipeDetail>(`/api/v1/recipes/${encodeURIComponent(id)}/duplicate`, {
    method: 'POST',
    csrf: true,
  })
}

export function setRecipeFavorite(id: string, favorite: boolean): Promise<void> {
  return apiRequest<void>(`/api/v1/recipes/${encodeURIComponent(id)}/favorite`, {
    method: favorite ? 'PUT' : 'DELETE',
    csrf: true,
  })
}

export function archiveRecipe(id: string): Promise<void> {
  return apiRequest<void>(`/api/v1/recipes/${encodeURIComponent(id)}/archive`, {
    method: 'POST',
    csrf: true,
  })
}

export function restoreRecipe(id: string): Promise<void> {
  return apiRequest<void>(`/api/v1/recipes/${encodeURIComponent(id)}/archive`, {
    method: 'DELETE',
    csrf: true,
  })
}
