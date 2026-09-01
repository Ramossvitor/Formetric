import { useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { DataQuality, FoodSummary, FoodUnit, RecipeSummary } from '../catalog/api'
import { formatNumber, qualityLabels, unitLabels } from '../catalog/format'
import { foodsQuery, recipesQuery } from '../catalog/queries'
import { useDebouncedValue } from '../catalog/useDebouncedValue'
import { CatalogError, CatalogLoading, CatalogTruncationHint } from '../catalog/CatalogState'
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

/** O que o `<select>` não conseguia mostrar, e é justamente o que decide entre dois itens de nome parecido. */
function choiceSummary(choice: CatalogChoice) {
  if (choice.type === 'FOOD') {
    const version = choice.food.currentVersion
    return `${formatNumber(version.referenceQuantity)} ${unitLabels[version.referenceUnit]} · ${formatNumber(version.caloriesKcal)} kcal · ${formatNumber(version.proteinG)} g proteína`
  }
  if (choice.type === 'RECIPE') {
    const version = choice.recipe.currentVersion
    return `receita · ${formatNumber(version.yieldQuantity)} ${unitLabels[version.yieldUnit]}`
  }
  return 'versão preservada neste registro'
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

  // A carga NÃO interrompe o formulário. Antes este ponto devolvia cedo, o que desmontava o
  // próprio campo de busca a cada termo digitado: no celular o teclado fechava e o foco se perdia
  // a cada pausa de 250ms. Agora só a lista troca de estado; a busca continua no lugar.
  const loadingCatalog = foods.isLoading || recipes.isLoading
  const catalogError = foods.isError || recipes.isError

  // O seletor busca uma página só. Sem este aviso, um catálogo maior que a página perde itens
  // silenciosamente e o usuário conclui que o alimento não existe.
  const truncated = (foods.data != null && foods.data.totalElements > foods.data.content.length)
    || (recipes.data != null && recipes.data.totalElements > recipes.data.content.length)

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
        <input autoCapitalize="none" autoCorrect="off" enterKeyHint="search" spellCheck={false} autoComplete="off" id="diary-catalog-search" onChange={(event) => setSearch(event.target.value)} placeholder="banana, whey, macarrão…" type="search" value={search} />
      </div>
      {/* Era um `<select>` com até duzentas opções. No iOS isso vira uma roda de rolagem sem campo
          de digitação, e a busca ficava FORA dela: abrir, não achar, fechar, digitar, reabrir. Como
          lista, o alimento é escolhido com um toque, com as calorias e a porção de referência à
          vista — que é o que separa dois itens de nome parecido. */}
      <fieldset aria-describedby={truncated ? 'diary-item-truncated' : undefined} className="catalog-choice-group">
        <legend>Alimento ou receita</legend>
        {catalogError ? (
          <CatalogError error={foods.error ?? recipes.error} onRetry={() => { void foods.refetch(); void recipes.refetch() }} />
        ) : loadingCatalog ? (
          <CatalogLoading message="Carregando alimentos e receitas…" />
        ) : choices.length === 0 ? (
          <div className="inline-empty-state">
            <p>{search ? 'Nenhum item corresponde à busca.' : 'Seu catálogo ainda está vazio.'}</p>
            <span>
              {search
                ? 'Tente outro termo, ou cadastre este alimento para reaproveitá-lo depois.'
                : 'Cadastre o primeiro alimento para poder registrá-lo no diário.'}
            </span>
            <Link className="secondary-button" to="/foods/new">Cadastrar alimento</Link>
          </div>
        ) : (
          <div className="catalog-choice-list">
            {choices.map((choice) => (
              <label className="catalog-choice" key={`${choice.type}-${choice.id}`}>
                <input
                  aria-label={choice.name}
                  checked={selectedId === choice.id}
                  name="diary-item"
                  onChange={() => { setSelectedId(choice.id); setMeasureKey('base') }}
                  type="radio"
                  value={choice.id}
                />
                <span className="catalog-choice-copy">
                  <strong>{choice.name}</strong>
                  <small>{choiceSummary(choice)}</small>
                </span>
              </label>
            ))}
          </div>
        )}
        {truncated ? <CatalogTruncationHint id="diary-item-truncated" message="A lista mostra apenas os primeiros resultados. Pesquise para encontrar o que falta." /> : null}
      </fieldset>
      <div className="item-measure-grid">
        <div className="field-group">
          <label htmlFor="diary-item-quantity">Quantidade</label>
          <input id="diary-item-quantity" min="0" onChange={(event) => setQuantity(event.target.value)} step="0.01" inputMode="decimal" type="number" value={quantity} />
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
          <div className="number-with-unit"><input id="diary-item-uncertainty" min="0" onChange={(event) => setUncertainty(event.target.value)} step="1" inputMode="numeric" type="number" value={uncertainty} /><span>± kcal</span></div>
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
