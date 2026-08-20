import { useFieldArray, useWatch } from 'react-hook-form'
import type {
  Control,
  FieldErrors,
  UseFormRegister,
} from 'react-hook-form'
import type { GoalTone, Nutrient } from './api'
import { defaultNutritionGoalValues, type NutritionGoalFormValues } from './schemas'

const nutrientLabels: Record<Nutrient, string> = {
  PROTEIN: 'Proteína',
  CARBOHYDRATE: 'Carboidratos',
  FAT: 'Gorduras',
  FIBER: 'Fibras',
  WATER: 'Água',
}

const toneOptions: Array<{ value: GoalTone; label: string }> = [
  { value: 'POSITIVE', label: 'Positivo' },
  { value: 'NEUTRAL', label: 'Neutro' },
  { value: 'WARNING', label: 'Alerta' },
]

const blankBand: NutritionGoalFormValues['targets'][number]['bands'][number] = {
  minValue: null,
  maxValue: null,
  minInclusive: false,
  maxInclusive: false,
  label: 'Nova faixa',
  tone: 'NEUTRAL',
  countsAsAttained: false,
}

function nullableNumber(value: unknown) {
  return value === '' || value == null ? null : Number(value)
}

interface NutrientBandEditorProps {
  control: Control<NutritionGoalFormValues>
  errors: FieldErrors<NutritionGoalFormValues>
  register: UseFormRegister<NutritionGoalFormValues>
  targetIndex: number
}

export function NutrientBandEditor({
  control,
  errors,
  register,
  targetIndex,
}: NutrientBandEditorProps) {
  const bands = useFieldArray({
    control,
    name: `targets.${targetIndex}.bands`,
  })
  const nutrient = useWatch({
    control,
    name: `targets.${targetIndex}.nutrient`,
  })
  const bandValues = useWatch({
    control,
    name: `targets.${targetIndex}.bands`,
  })
  const targetErrors = errors.targets?.[targetIndex]
  const suggestedTarget = defaultNutritionGoalValues('2000-01-01').targets[targetIndex]
  const safeNutrient = nutrient ?? suggestedTarget?.nutrient ?? 'PROTEIN'
  const nutrientLabel = nutrientLabels[safeNutrient]
  const unit = safeNutrient === 'WATER' ? 'ml' : 'g'
  const presetBands = suggestedTarget?.bands

  return (
    <fieldset className="goal-target-editor">
      <legend>{nutrientLabel}</legend>
      <input {...register(`targets.${targetIndex}.nutrient`)} type="hidden" />
      <div className="goal-target-heading">
        <p>
          Unidade canônica: <strong>{unit}</strong> · {bands.fields.length}/20 faixas
        </p>
        <button
          className="goal-preset-button"
          onClick={() => presetBands && bands.replace(presetBands)}
          type="button"
        >
          Restaurar sugestão
        </button>
      </div>

      <p className="goal-target-hint">
        A ordem é usada na classificação. Deixe um limite vazio para torná-lo aberto e evite
        sobreposição entre faixas vizinhas.
      </p>

      {targetErrors?.nutrient ? (
        <p className="form-error" role="alert">{targetErrors.nutrient.message}</p>
      ) : null}
      {targetErrors?.bands?.root ? (
        <p className="form-error" role="alert">{targetErrors.bands.root.message}</p>
      ) : null}

      <div className="goal-band-list">
        {bands.fields.map((field, bandIndex) => {
          const bandError = targetErrors?.bands?.[bandIndex]
          const bandValue = bandValues?.[bandIndex]
          const bandNumber = bandIndex + 1
          const fieldPrefix = `goal-${safeNutrient.toLowerCase()}-band-${bandNumber}`

          return (
            <article
              aria-labelledby={`${fieldPrefix}-title`}
              className="goal-band-card"
              key={field.id}
            >
              <header className="goal-band-heading">
                <div>
                  <strong id={`${fieldPrefix}-title`}>Faixa {bandNumber}</strong>
                  <span>Posição {bandIndex}</span>
                </div>
                <div className="goal-band-actions">
                  <button
                    aria-label={`Mover faixa ${bandNumber} de ${nutrientLabel} para cima`}
                    disabled={bandIndex === 0}
                    onClick={() => bands.move(bandIndex, bandIndex - 1)}
                    title="Mover para cima"
                    type="button"
                  >
                    ↑
                  </button>
                  <button
                    aria-label={`Mover faixa ${bandNumber} de ${nutrientLabel} para baixo`}
                    disabled={bandIndex === bands.fields.length - 1}
                    onClick={() => bands.move(bandIndex, bandIndex + 1)}
                    title="Mover para baixo"
                    type="button"
                  >
                    ↓
                  </button>
                  <button
                    aria-label={`Remover faixa ${bandNumber} de ${nutrientLabel}`}
                    className="goal-band-remove"
                    disabled={bands.fields.length === 1}
                    onClick={() => bands.remove(bandIndex)}
                    title="Remover faixa"
                    type="button"
                  >
                    ×
                  </button>
                </div>
              </header>

              <div className="goal-band-fields">
                <div className="field-group">
                  <label htmlFor={`${fieldPrefix}-minimum`}>Limite mínimo</label>
                  <div className="number-with-unit">
                    <input
                      {...register(`targets.${targetIndex}.bands.${bandIndex}.minValue`, {
                        setValueAs: nullableNumber,
                      })}
                      aria-invalid={Boolean(bandError?.minValue)}
                      id={`${fieldPrefix}-minimum`}
                      min="0"
                      placeholder="Sem mínimo"
                      step="0.01"
                      type="number"
                    />
                    <span>{unit}</span>
                  </div>
                  {bandError?.minValue ? (
                    <span className="field-error">{bandError.minValue.message}</span>
                  ) : null}
                  {bandValue?.minValue !== null ? (
                    <label className="goal-checkbox" htmlFor={`${fieldPrefix}-minimum-inclusive`}>
                      <input
                        {...register(`targets.${targetIndex}.bands.${bandIndex}.minInclusive`)}
                        id={`${fieldPrefix}-minimum-inclusive`}
                        type="checkbox"
                      />
                      Incluir o valor mínimo
                    </label>
                  ) : (
                    <span className="goal-open-boundary">Sem limite inferior</span>
                  )}
                </div>

                <div className="field-group">
                  <label htmlFor={`${fieldPrefix}-maximum`}>Limite máximo</label>
                  <div className="number-with-unit">
                    <input
                      {...register(`targets.${targetIndex}.bands.${bandIndex}.maxValue`, {
                        setValueAs: nullableNumber,
                      })}
                      aria-invalid={Boolean(bandError?.maxValue)}
                      id={`${fieldPrefix}-maximum`}
                      min="0"
                      placeholder="Sem máximo"
                      step="0.01"
                      type="number"
                    />
                    <span>{unit}</span>
                  </div>
                  {bandError?.maxValue ? (
                    <span className="field-error">{bandError.maxValue.message}</span>
                  ) : null}
                  {bandValue?.maxValue !== null ? (
                    <label className="goal-checkbox" htmlFor={`${fieldPrefix}-maximum-inclusive`}>
                      <input
                        {...register(`targets.${targetIndex}.bands.${bandIndex}.maxInclusive`)}
                        id={`${fieldPrefix}-maximum-inclusive`}
                        type="checkbox"
                      />
                      Incluir o valor máximo
                    </label>
                  ) : (
                    <span className="goal-open-boundary">Sem limite superior</span>
                  )}
                </div>

                <div className="field-group goal-band-label">
                  <label htmlFor={`${fieldPrefix}-label`}>Rótulo</label>
                  <input
                    {...register(`targets.${targetIndex}.bands.${bandIndex}.label`)}
                    aria-invalid={Boolean(bandError?.label)}
                    id={`${fieldPrefix}-label`}
                    maxLength={40}
                  />
                  {bandError?.label ? (
                    <span className="field-error">{bandError.label.message}</span>
                  ) : null}
                </div>

                <div className="field-group">
                  <label htmlFor={`${fieldPrefix}-tone`}>Tom visual</label>
                  <select
                    {...register(`targets.${targetIndex}.bands.${bandIndex}.tone`)}
                    id={`${fieldPrefix}-tone`}
                  >
                    {toneOptions.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <label className="goal-checkbox goal-attainment" htmlFor={`${fieldPrefix}-attained`}>
                <input
                  {...register(`targets.${targetIndex}.bands.${bandIndex}.countsAsAttained`)}
                  id={`${fieldPrefix}-attained`}
                  type="checkbox"
                />
                Valores nesta faixa contam como meta atingida
              </label>
            </article>
          )
        })}
      </div>

      <button
        className="secondary-button goal-add-band"
        disabled={bands.fields.length >= 20}
        onClick={() => bands.append({ ...blankBand })}
        type="button"
      >
        + Adicionar faixa de {nutrientLabel}
      </button>
      {bands.fields.length >= 20 ? (
        <span className="field-hint" role="status">Limite de 20 faixas atingido.</span>
      ) : null}
    </fieldset>
  )
}
