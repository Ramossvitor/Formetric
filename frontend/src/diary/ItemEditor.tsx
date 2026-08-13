import { useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import type { DataQuality, FoodSummary, FoodUnit, RecipeSummary } from '../catalog/api'
import { qualityLabels, unitLabels } from '../catalog/format'
import { foodsQuery, recipesQuery } from '../catalog/queries'
import { useDebouncedValue } from '../catalog/useDebouncedValue'
import { CatalogError, CatalogLoading } from '../catalog/CatalogState'
import type { MealItem, MealItemInput } from './api'

type CatalogChoice =
  | { type: 'FOOD'; id: string; name: string; food: FoodSummary }
  | { type: 'RECIPE'; id: string; name: string; recipe: RecipeSummary }
  | { type: 'SNAPSHOT'; id: string; name: string; item: MealItem }

interface MeasureChoice {
  key: string
  label: string
  unit: FoodUnit
  servingOptionId: string | null
}

function catalogChoices(foods: FoodSummary[], recipes: RecipeSummary[]): CatalogChoice[] {
  return [
    ...foods.map((food): CatalogChoice => ({ type: 'FOOD', id: food.currentVersion.id, name: food.currentVersion.name, food })),
    ...recipes.map((recipe): CatalogChoice => ({ type: 'RECIPE', id: recipe.currentVersion.id, name: recipe.currentVersion.name, recipe })),
  ].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
}

function measures(choice: CatalogChoice | undefined): MeasureChoice[] {
  if (!choice) return []
  if (choice.type === 'SNAPSHOT') {
    const key = choice.item.servingOptionId
      ? `serving:${choice.item.servingOptionId}`
      : choice.item.itemType === 'RECIPE' && choice.item.unit === 'PORTION' ? 'recipe-portion' : 'base'
    return [{ key, label: unitLabels[choice.item.unit], unit: choice.item.unit, servingOptionId: choice.item.servingOptionId }]
  }
  if (choice.type === 'FOOD') {
    const version = choice.food.currentVersion
    return [
      { key: 'base', label: unitLabels[version.referenceUnit], unit: version.referenceUnit, servingOptionId: null },
      ...version.servings.map((serving) => ({
        key: `serving:${serving.id}`,
        label: `${serving.label} (${serving.quantity.toLocaleString('pt-BR')} ${unitLabels[serving.unit]})`,
        unit: serving.unit,
        servingOptionId: serving.id ?? null,
      })),
    ]
  }
  const version = choice.recipe.currentVersion
  const options: MeasureChoice[] = [{ key: 'base', label: unitLabels[version.yieldUnit], unit: version.yieldUnit, servingOptionId: null }]
  if (version.servingQuantity != null) options.push({ key: 'recipe-portion', label: `porção (${version.servingQuantity.toLocaleString('pt-BR')} ${unitLabels[version.yieldUnit]})`, unit: 'PORTION', servingOptionId: null })
  return options
}

function inheritedQuality(choice?: CatalogChoice) {
  if (!choice) return null
  if (choice.type === 'FOOD') return choice.food.currentVersion.quality
  if (choice.type === 'RECIPE') return choice.recipe.currentVersion.quality
  return choice.item.dataQuality
}

export function ItemEditor({ item, pending, onCancel, onSubmit }: {
  item?: MealItem
  pending: boolean
  onCancel: () => void
  onSubmit: (input: MealItemInput) => void
}) {
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search)
  const foods = useQuery(foodsQuery(debouncedSearch))
  const recipes = useQuery(recipesQuery(debouncedSearch))
  const remoteChoices = useMemo(() => catalogChoices(foods.data?.content ?? [], recipes.data?.content ?? []), [foods.data, recipes.data])
  const snapshotChoice: CatalogChoice | undefined = useMemo(
    () => item && !remoteChoices.some((choice) => choice.id === item.versionId)
      ? { type: 'SNAPSHOT', id: item.versionId, name: `${item.name} · versão registrada`, item }
      : undefined,
    [item, remoteChoices],
  )
  const choices = useMemo(
    () => snapshotChoice ? [snapshotChoice, ...remoteChoices] : remoteChoices,
    [remoteChoices, snapshotChoice],
  )
  const [selectedId, setSelectedId] = useState(item?.versionId ?? '')
  const selected = choices.find((choice) => choice.id === selectedId)
  const measureChoices = measures(selected)
  const initialMeasure = item?.servingOptionId
    ? `serving:${item.servingOptionId}`
    : item?.itemType === 'RECIPE' && item.unit === 'PORTION' ? 'recipe-portion' : 'base'
  const [measureKey, setMeasureKey] = useState(initialMeasure)
  const [quantity, setQuantity] = useState(item?.quantity.toString() ?? '100')
  const [quality, setQuality] = useState<DataQuality | ''>(item?.dataQuality ?? '')
  const [uncertainty, setUncertainty] = useState(item?.uncertaintyKcal?.toString() ?? '')

  useEffect(() => {
    if (!selectedId && choices.length === 1) setSelectedId(choices[0].id)
  }, [choices, selectedId])

  useEffect(() => {
    if (!measureChoices.some((measure) => measure.key === measureKey)) setMeasureKey(measureChoices[0]?.key ?? 'base')
  }, [measureChoices, measureKey])

  if (foods.isPending || recipes.isPending) return <CatalogLoading message="Carregando alimentos e receitas…" />
  if (foods.isError || recipes.isError) return <CatalogError error={foods.error ?? recipes.error} onRetry={() => { void foods.refetch(); void recipes.refetch() }} />

  const measure = measureChoices.find((candidate) => candidate.key === measureKey)
  const numericQuantity = Number(quantity)
  const valid = selected && measure && Number.isFinite(numericQuantity) && numericQuantity > 0

  return (
    <form className="dialog-form item-dialog-form" onSubmit={(event) => {
      event.preventDefault()
      if (!valid) return
      onSubmit({
        itemType: selected.type === 'SNAPSHOT' ? selected.item.itemType : selected.type,
        versionId: selected.id,
        quantity: numericQuantity,
        unit: measure.unit,
        servingOptionId: measure.servingOptionId,
        dataQuality: quality || null,
        uncertaintyKcal: uncertainty === '' ? null : Number(uncertainty),
      })
    }}>
      <div className="field-group">
        <label htmlFor="diary-catalog-search">Pesquisar catálogo</label>
        <input id="diary-catalog-search" onChange={(event) => setSearch(event.target.value)} placeholder="banana, whey, macarrão…" type="search" value={search} />
      </div>
      <div className="field-group">
        <label htmlFor="diary-item">Alimento ou receita</label>
        <select id="diary-item" onChange={(event) => { setSelectedId(event.target.value); setMeasureKey('base') }} value={selectedId}>
          <option value="">Selecione…</option>
          {choices.map((choice) => <option key={`${choice.type}-${choice.id}`} value={choice.id}>{choice.name}{choice.type === 'RECIPE' ? ' · receita' : ''}</option>)}
        </select>
      </div>
      <div className="item-measure-grid">
        <div className="field-group">
          <label htmlFor="diary-item-quantity">Quantidade</label>
          <input id="diary-item-quantity" min="0" onChange={(event) => setQuantity(event.target.value)} step="0.01" type="number" value={quantity} />
        </div>
        <div className="field-group">
          <label htmlFor="diary-item-unit">Unidade ou porção</label>
          <select disabled={!selected} id="diary-item-unit" onChange={(event) => setMeasureKey(event.target.value)} value={measureKey}>
            {measureChoices.map((choice) => <option key={choice.key} value={choice.key}>{choice.label}</option>)}
          </select>
        </div>
      </div>
      <div className="snapshot-settings">
        <div className="field-group">
          <label htmlFor="diary-item-quality">Qualidade do registro</label>
          <select id="diary-item-quality" onChange={(event) => setQuality(event.target.value as DataQuality | '')} value={quality}>
            <option value="">Herdar do catálogo{selected ? ` (${qualityLabels[inheritedQuality(selected)!]})` : ''}</option>
            {Object.entries(qualityLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </div>
        <div className="field-group">
          <label htmlFor="diary-item-uncertainty">Incerteza <span className="optional-label">opcional</span></label>
          <div className="number-with-unit"><input id="diary-item-uncertainty" min="0" onChange={(event) => setUncertainty(event.target.value)} step="1" type="number" value={uncertainty} /><span>± kcal</span></div>
        </div>
      </div>
      <p className="snapshot-note">Ao salvar, nutrientes, nome, versão, qualidade e conversão são copiados para o diário. Alterações futuras no catálogo não mudam este registro.</p>
      <div className="dialog-actions">
        <button className="secondary-button" onClick={onCancel} type="button">Cancelar</button>
        <button className="submit-button" disabled={!valid || pending} type="submit">{pending ? 'Salvando…' : item ? 'Atualizar item' : 'Adicionar ao diário'}</button>
      </div>
    </form>
  )
}
