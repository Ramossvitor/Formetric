import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery } from '@tanstack/react-query'
import { useFieldArray, useForm } from 'react-hook-form'
import type { FoodSummary, RecipeVersion, RecipeVersionInput } from './api'
import { CatalogError, CatalogLoading } from './CatalogState'
import { unitLabels } from './format'
import { foodsQuery } from './queries'
import { recipeFormSchema, type RecipeFormValues } from './schemas'

const ingredientUnits = Object.entries(unitLabels) as Array<[RecipeFormValues['ingredients'][number]['unit'], string]>

function nullableNumber(value: unknown) {
  return value === '' || value == null ? null : Number(value)
}

function nullableText(value: unknown) {
  return typeof value === 'string' && value.trim() ? value : null
}

function valuesFromVersion(version?: RecipeVersion): RecipeFormValues {
  return version
    ? {
        name: version.name,
        notes: version.notes,
        yieldQuantity: version.yieldQuantity,
        yieldUnit: version.yieldUnit,
        servingQuantity: version.servingQuantity,
        ingredients: version.ingredients.map((ingredient) => ({
          foodVersionId: ingredient.foodVersionId,
          quantity: ingredient.quantity,
          unit: ingredient.unit,
          referenceQuantityEquivalent: ingredient.referenceQuantityEquivalent ?? null,
        })),
      }
    : {
        name: '',
        notes: null,
        yieldQuantity: 1_000,
        yieldUnit: 'G',
        servingQuantity: 100,
        ingredients: [{ foodVersionId: '', quantity: 100, unit: 'G', referenceQuantityEquivalent: null }],
      }
}

function optionLabel(food: FoodSummary) {
  const version = food.currentVersion
  return `${version.name}${version.brand ? ` · ${version.brand}` : ''} — v${version.versionNumber}`
}

interface RecipeFormProps {
  initialVersion?: RecipeVersion
  pending: boolean
  submitLabel: string
  onCancel?: () => void
  onSubmit: (values: RecipeVersionInput) => void
}

export function RecipeForm({ initialVersion, pending, submitLabel, onCancel, onSubmit }: RecipeFormProps) {
  const foods = useQuery(foodsQuery())
  const {
    control,
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RecipeFormValues>({
    resolver: zodResolver(recipeFormSchema),
    defaultValues: valuesFromVersion(initialVersion),
  })
  const ingredients = useFieldArray({ control, name: 'ingredients' })

  if (foods.isPending) return <CatalogLoading message="Carregando alimentos para a receita…" />
  if (foods.isError) return <CatalogError error={foods.error} onRetry={() => void foods.refetch()} />

  const availableFoods = foods.data.content

  return (
    <form
      className="catalog-form"
      noValidate
      onSubmit={(event) => void handleSubmit((values) => onSubmit(values))(event)}
    >
      <fieldset className="form-section">
        <legend>Receita</legend>
        <div className="catalog-form-grid">
          <div className="field-group full-field">
            <label htmlFor="recipe-name">Nome</label>
            <input {...register('name')} aria-invalid={Boolean(errors.name)} autoFocus id="recipe-name" />
            {errors.name ? <span className="field-error">{errors.name.message}</span> : null}
          </div>
          <div className="field-group full-field">
            <label htmlFor="recipe-notes">Observações <span className="optional-label">opcional</span></label>
            <textarea {...register('notes', { setValueAs: nullableText })} id="recipe-notes" rows={3} />
          </div>
          <div className="field-group">
            <label htmlFor="recipe-yield">Rendimento total</label>
            <input {...register('yieldQuantity', { valueAsNumber: true })} id="recipe-yield" min="0" step="0.01" type="number" />
            {errors.yieldQuantity ? <span className="field-error">{errors.yieldQuantity.message}</span> : null}
          </div>
          <div className="field-group">
            <label htmlFor="recipe-yield-unit">Unidade do rendimento</label>
            <select {...register('yieldUnit')} id="recipe-yield-unit">
              <option value="G">g</option>
              <option value="ML">ml</option>
              <option value="PORTION">porções</option>
            </select>
          </div>
          <div className="field-group full-field">
            <label htmlFor="recipe-serving">Tamanho de uma porção <span className="optional-label">opcional</span></label>
            <input {...register('servingQuantity', { setValueAs: nullableNumber })} id="recipe-serving" min="0" step="0.01" type="number" />
            <span className="field-hint">Use a mesma unidade do rendimento total.</span>
          </div>
        </div>
      </fieldset>

      <fieldset className="form-section">
        <div className="fieldset-heading">
          <div>
            <legend>Ingredientes</legend>
            <p className="form-section-hint">A versão selecionada fica preservada no histórico da receita.</p>
          </div>
          <button
            className="compact-button"
            disabled={availableFoods.length === 0}
            onClick={() => ingredients.append({ foodVersionId: '', quantity: 100, unit: 'G', referenceQuantityEquivalent: null })}
            type="button"
          >
            + Ingrediente
          </button>
        </div>

        {availableFoods.length === 0 ? (
          <div className="inline-empty-state compact-empty">
            <p>Cadastre um alimento primeiro.</p>
            <span>Receitas são calculadas a partir das versões dos alimentos.</span>
          </div>
        ) : null}

        {errors.ingredients?.root ? <p className="form-error">{errors.ingredients.root.message}</p> : null}
        <div className="ingredient-list">
          {ingredients.fields.map((field, index) => (
            <div className="ingredient-row" key={field.id}>
              <div className="field-group ingredient-food">
                <label htmlFor={`ingredient-${index}-food`}>Alimento</label>
                <select {...register(`ingredients.${index}.foodVersionId`)} id={`ingredient-${index}-food`}>
                  <option value="">Selecione…</option>
                  {availableFoods.map((food) => (
                    <option key={food.currentVersion.id} value={food.currentVersion.id}>{optionLabel(food)}</option>
                  ))}
                </select>
                {errors.ingredients?.[index]?.foodVersionId ? <span className="field-error">{errors.ingredients[index]?.foodVersionId?.message}</span> : null}
              </div>
              <div className="field-group">
                <label htmlFor={`ingredient-${index}-quantity`}>Quantidade</label>
                <input {...register(`ingredients.${index}.quantity`, { valueAsNumber: true })} id={`ingredient-${index}-quantity`} min="0" step="0.01" type="number" />
              </div>
              <div className="field-group">
                <label htmlFor={`ingredient-${index}-unit`}>Unidade</label>
                <select {...register(`ingredients.${index}.unit`)} id={`ingredient-${index}-unit`}>
                  {ingredientUnits.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </div>
              <div className="field-group">
                <label htmlFor={`ingredient-${index}-equivalent`}>Equivale na referência</label>
                <input {...register(`ingredients.${index}.referenceQuantityEquivalent`, { setValueAs: nullableNumber })} id={`ingredient-${index}-equivalent`} min="0" step="0.01" type="number" />
                <span className="field-hint">Pode ficar vazio quando as unidades forem iguais.</span>
              </div>
              <button aria-label={`Remover ingrediente ${index + 1}`} className="remove-row-button" disabled={ingredients.fields.length === 1} onClick={() => ingredients.remove(index)} type="button">×</button>
            </div>
          ))}
        </div>
      </fieldset>

      <div className="sticky-form-actions">
        {onCancel ? <button className="secondary-button" onClick={onCancel} type="button">Cancelar</button> : null}
        <button className="submit-button" disabled={pending || availableFoods.length === 0} type="submit">
          {pending ? 'Calculando…' : submitLabel}
        </button>
      </div>
    </form>
  )
}
