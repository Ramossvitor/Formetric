import { zodResolver } from '@hookform/resolvers/zod'
import { useFieldArray, useForm } from 'react-hook-form'
import type { FoodVersion, FoodVersionInput } from './api'
import { qualityLabels, unitLabels } from './format'
import { foodFormSchema, type FoodFormValues } from './schemas'

const foodUnits = Object.entries(unitLabels) as Array<[FoodFormValues['referenceUnit'], string]>
const qualities = Object.entries(qualityLabels) as Array<[FoodFormValues['quality'], string]>

const blankValues: FoodFormValues = {
  name: '',
  brand: null,
  notes: null,
  referenceQuantity: 100,
  referenceUnit: 'G',
  caloriesKcal: 0,
  proteinG: 0,
  carbohydrateG: 0,
  fatG: 0,
  fiberG: 0,
  sodiumMg: null,
  quality: 'EXACT',
  kcalUncertainty: null,
  servings: [],
}

function fromVersion(version?: FoodVersion): FoodFormValues {
  if (!version) return blankValues
  return {
    name: version.name,
    brand: version.brand,
    notes: version.notes,
    referenceQuantity: version.referenceQuantity,
    referenceUnit: version.referenceUnit,
    caloriesKcal: version.caloriesKcal,
    proteinG: version.proteinG,
    carbohydrateG: version.carbohydrateG,
    fatG: version.fatG,
    fiberG: version.fiberG,
    sodiumMg: version.sodiumMg,
    quality: version.quality,
    kcalUncertainty: version.kcalUncertainty,
    servings: version.servings.map((serving) => ({
      label: serving.label,
      unit: serving.unit,
      quantity: serving.quantity,
      referenceQuantityEquivalent: serving.referenceQuantityEquivalent,
    })),
  }
}

function nullableNumber(value: unknown) {
  return value === '' || value == null ? null : Number(value)
}

function nullableText(value: unknown) {
  return typeof value === 'string' && value.trim() ? value : null
}

interface FoodFormProps {
  initialVersion?: FoodVersion
  pending: boolean
  submitLabel: string
  onCancel?: () => void
  onSubmit: (values: FoodVersionInput) => void
}

export function FoodForm({ initialVersion, pending, submitLabel, onCancel, onSubmit }: FoodFormProps) {
  const {
    control,
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FoodFormValues>({
    resolver: zodResolver(foodFormSchema),
    defaultValues: fromVersion(initialVersion),
  })
  const servings = useFieldArray({ control, name: 'servings' })

  return (
    <form
      className="catalog-form"
      noValidate
      onSubmit={(event) => void handleSubmit((values) => onSubmit(values))(event)}
    >
      <fieldset className="form-section">
        <legend>Identificação</legend>
        <div className="catalog-form-grid">
          <div className="field-group full-field">
            <label htmlFor="food-name">Nome</label>
            <input {...register('name')} aria-invalid={Boolean(errors.name)} autoFocus id="food-name" />
            {errors.name ? <span className="field-error">{errors.name.message}</span> : null}
          </div>
          <div className="field-group full-field">
            <label htmlFor="food-brand">Marca <span className="optional-label">opcional</span></label>
            <input {...register('brand', { setValueAs: nullableText })} id="food-brand" />
          </div>
          <div className="field-group full-field">
            <label htmlFor="food-notes">Observações <span className="optional-label">opcional</span></label>
            <textarea {...register('notes', { setValueAs: nullableText })} id="food-notes" rows={3} />
          </div>
        </div>
      </fieldset>

      <fieldset className="form-section">
        <legend>Porção de referência</legend>
        <div className="catalog-form-grid compact-columns">
          <div className="field-group">
            <label htmlFor="food-reference-quantity">Quantidade</label>
            <input {...register('referenceQuantity', { valueAsNumber: true })} id="food-reference-quantity" min="0" step="0.01" type="number" />
            {errors.referenceQuantity ? <span className="field-error">{errors.referenceQuantity.message}</span> : null}
          </div>
          <div className="field-group">
            <label htmlFor="food-reference-unit">Unidade</label>
            <select {...register('referenceUnit')} id="food-reference-unit">
              {foodUnits.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </div>
        </div>
      </fieldset>

      <fieldset className="form-section">
        <legend>Informação nutricional</legend>
        <p className="form-section-hint">Valores para a porção de referência informada acima.</p>
        <div className="catalog-form-grid nutrient-fields">
          {([
            ['caloriesKcal', 'Calorias', 'kcal'],
            ['proteinG', 'Proteínas', 'g'],
            ['carbohydrateG', 'Carboidratos', 'g'],
            ['fatG', 'Gorduras', 'g'],
            ['fiberG', 'Fibras', 'g'],
          ] as const).map(([name, label, unit]) => (
            <div className="field-group" key={name}>
              <label htmlFor={`food-${name}`}>{label}</label>
              <div className="number-with-unit">
                <input {...register(name, { valueAsNumber: true })} aria-invalid={Boolean(errors[name])} id={`food-${name}`} min="0" step="0.01" type="number" />
                <span>{unit}</span>
              </div>
              {errors[name] ? <span className="field-error">{errors[name]?.message}</span> : null}
            </div>
          ))}
          <div className="field-group">
            <label htmlFor="food-sodium">Sódio <span className="optional-label">opcional</span></label>
            <div className="number-with-unit">
              <input {...register('sodiumMg', { setValueAs: nullableNumber })} id="food-sodium" min="0" step="0.01" type="number" />
              <span>mg</span>
            </div>
            {errors.sodiumMg ? <span className="field-error">{errors.sodiumMg.message}</span> : null}
          </div>
        </div>
      </fieldset>

      <fieldset className="form-section">
        <legend>Confiabilidade</legend>
        <div className="catalog-form-grid compact-columns">
          <div className="field-group">
            <label htmlFor="food-quality">Qualidade do dado</label>
            <select {...register('quality')} id="food-quality">
              {qualities.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </div>
          <div className="field-group">
            <label htmlFor="food-uncertainty">Incerteza <span className="optional-label">opcional</span></label>
            <div className="number-with-unit">
              <input {...register('kcalUncertainty', { setValueAs: nullableNumber })} id="food-uncertainty" min="0" step="1" type="number" />
              <span>± kcal</span>
            </div>
          </div>
        </div>
      </fieldset>

      <fieldset className="form-section">
        <div className="fieldset-heading">
          <div>
            <legend>Porções alternativas</legend>
            <p className="form-section-hint">Ex.: 1 fatia equivale a 30 g da referência.</p>
          </div>
          <button
            className="compact-button"
            onClick={() => servings.append({ label: '', unit: 'UNIT', quantity: 1, referenceQuantityEquivalent: 1 })}
            type="button"
          >
            + Adicionar
          </button>
        </div>
        {servings.fields.length === 0 ? <p className="inline-hint">Nenhuma porção alternativa.</p> : null}
        <div className="serving-list">
          {servings.fields.map((field, index) => (
            <div className="serving-row" key={field.id}>
              <div className="field-group serving-label">
                <label htmlFor={`serving-${index}-label`}>Nome</label>
                <input {...register(`servings.${index}.label`)} id={`serving-${index}-label`} placeholder="Fatia" />
                {errors.servings?.[index]?.label ? <span className="field-error">{errors.servings[index]?.label?.message}</span> : null}
              </div>
              <div className="field-group">
                <label htmlFor={`serving-${index}-quantity`}>Quantidade</label>
                <input {...register(`servings.${index}.quantity`, { valueAsNumber: true })} id={`serving-${index}-quantity`} min="0" step="0.01" type="number" />
              </div>
              <div className="field-group">
                <label htmlFor={`serving-${index}-unit`}>Unidade</label>
                <select {...register(`servings.${index}.unit`)} id={`serving-${index}-unit`}>
                  {foodUnits.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </div>
              <div className="field-group">
                <label htmlFor={`serving-${index}-equivalent`}>Equivale na referência</label>
                <input {...register(`servings.${index}.referenceQuantityEquivalent`, { valueAsNumber: true })} id={`serving-${index}-equivalent`} min="0" step="0.01" type="number" />
              </div>
              <button aria-label={`Remover porção ${index + 1}`} className="remove-row-button" onClick={() => servings.remove(index)} type="button">×</button>
            </div>
          ))}
        </div>
      </fieldset>

      <div className="sticky-form-actions">
        {onCancel ? <button className="secondary-button" onClick={onCancel} type="button">Cancelar</button> : null}
        <button className="submit-button" disabled={pending} type="submit">
          {pending ? 'Salvando…' : submitLabel}
        </button>
      </div>
    </form>
  )
}
