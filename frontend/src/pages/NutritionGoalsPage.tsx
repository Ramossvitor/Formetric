import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { ApiError, getErrorMessage } from '../api/http'
import { createNutritionGoalPeriod } from '../planning/api'
import { formatValidity, goalSummaries, todayAsLocalIsoDate } from '../planning/format'
import { PlanningError, PlanningLoading } from '../planning/PlanningState'
import {
  effectiveNutritionGoalQuery,
  nutritionGoalPeriodsQuery,
  nutritionGoalPeriodsQueryKey,
} from '../planning/queries'
import {
  nutritionGoalFormSchema,
  type NutritionGoalFormValues,
} from '../planning/schemas'

const nutritionDefaults: Omit<NutritionGoalFormValues, 'validFrom'> = {
  calorieTarget: 2500,
  proteinMin: 175,
  carbohydrateMax: 210,
  fatMax: 65,
  fiberMin: 30,
  waterMin: 4400,
}

const formFields: Array<{
  name: keyof typeof nutritionDefaults
  label: string
  unit: string
  hint: string
}> = [
  { name: 'calorieTarget', label: 'Meta calórica', unit: 'kcal', hint: 'Valor central planejado para o dia.' },
  { name: 'proteinMin', label: 'Proteína mínima', unit: 'g', hint: 'A partir deste valor, a meta estará atingida.' },
  { name: 'carbohydrateMax', label: 'Máximo ideal de carboidratos', unit: 'g', hint: 'Acima deste valor, o dia recebe um alerta.' },
  { name: 'fatMax', label: 'Limite de gorduras', unit: 'g', hint: 'Acima deste valor, o dia recebe um alerta.' },
  { name: 'fiberMin', label: 'Fibras mínimas', unit: 'g', hint: 'A partir deste valor, a meta estará atingida.' },
  { name: 'waterMin', label: 'Água mínima', unit: 'ml', hint: 'Use mililitros, por exemplo 4.400 ml.' },
]

export function NutritionGoalsPage() {
  const today = todayAsLocalIsoDate()
  const queryClient = useQueryClient()
  const periods = useQuery(nutritionGoalPeriodsQuery)
  const effective = useQuery(effectiveNutritionGoalQuery(today))
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<NutritionGoalFormValues>({
    resolver: zodResolver(nutritionGoalFormSchema),
    defaultValues: { validFrom: today, ...nutritionDefaults },
  })
  const createPeriod = useMutation({
    mutationFn: createNutritionGoalPeriod,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: nutritionGoalPeriodsQueryKey })
      reset({ validFrom: today, ...nutritionDefaults })
    },
    onError: (error) => {
      if (!(error instanceof ApiError)) return

      for (const fieldError of error.problem?.fieldErrors ?? []) {
        if (fieldError.field in nutritionGoalFormSchema.shape) {
          setError(fieldError.field as keyof NutritionGoalFormValues, { message: fieldError.message })
        }
      }
    },
  })

  if (periods.isPending || effective.isPending) {
    return <PlanningLoading message="Carregando metas nutricionais…" />
  }

  if (periods.isError || effective.isError) {
    return (
      <PlanningError
        error={periods.error ?? effective.error}
        onRetry={() => {
          void periods.refetch()
          void effective.refetch()
        }}
      />
    )
  }

  const orderedPeriods = [...periods.data].sort((first, second) =>
    second.validFrom.localeCompare(first.validFrom),
  )

  return (
    <main id="conteudo">
      <header className="page-heading planning-heading">
        <div>
          <p className="eyebrow">Planejamento</p>
          <h1>Metas nutricionais</h1>
          <p className="heading-copy">Crie períodos sem alterar as metas usadas no histórico.</p>
        </div>
      </header>

      <section className="effective-card surface-card" aria-labelledby="effective-goal-title">
        <div>
          <p className="eyebrow">Vigente hoje</p>
          <h2 id="effective-goal-title">
            {effective.data ? `${effective.data.calorieTarget.toLocaleString('pt-BR')} kcal` : 'Nenhuma meta vigente'}
          </h2>
          <p>
            {effective.data
              ? formatValidity(effective.data.validFrom, effective.data.validTo)
              : 'Crie um período com início hoje ou em uma data anterior.'}
          </p>
        </div>
        {effective.data ? <span className="status-chip">Ativa</span> : null}
      </section>

      <div className="planning-grid">
        <section className="planning-card surface-card" aria-labelledby="new-goal-title">
          <div className="section-heading profile-section-heading">
            <div>
              <p className="eyebrow">Novo período</p>
              <h2 id="new-goal-title">Definir metas</h2>
            </div>
          </div>

          <form
            className="planning-form"
            noValidate
            onSubmit={(event) => void handleSubmit((values) => createPeriod.mutate(values))(event)}
          >
            <div className="field-group full-field">
              <label htmlFor="goal-valid-from">Válido a partir de</label>
              <input
                {...register('validFrom')}
                aria-invalid={Boolean(errors.validFrom)}
                id="goal-valid-from"
                type="date"
              />
              <span className="field-hint">A data inicia um novo período; o anterior será encerrado.</span>
              {errors.validFrom ? <span className="field-error">{errors.validFrom.message}</span> : null}
            </div>

            {formFields.map((field) => (
              <div className="field-group" key={field.name}>
                <label htmlFor={`goal-${field.name}`}>{field.label}</label>
                <div className="number-with-unit">
                  <input
                    {...register(field.name, { valueAsNumber: true })}
                    aria-invalid={Boolean(errors[field.name])}
                    id={`goal-${field.name}`}
                    min="0"
                    step="1"
                    type="number"
                  />
                  <span>{field.unit}</span>
                </div>
                <span className="field-hint">{field.hint}</span>
                {errors[field.name] ? <span className="field-error">{errors[field.name]?.message}</span> : null}
              </div>
            ))}

            {createPeriod.isError &&
            (!(createPeriod.error instanceof ApiError) ||
              !createPeriod.error.problem?.fieldErrors?.length) ? (
              <p className="form-error full-field" role="alert">{getErrorMessage(createPeriod.error)}</p>
            ) : null}
            {createPeriod.isSuccess ? (
              <p className="form-success full-field" role="status">Novo período de metas criado.</p>
            ) : null}

            <button className="submit-button full-field" disabled={createPeriod.isPending} type="submit">
              {createPeriod.isPending ? 'Salvando período…' : 'Criar período de metas'}
            </button>
          </form>
        </section>

        <section className="planning-card surface-card" aria-labelledby="goal-history-title">
          <div className="section-heading profile-section-heading">
            <div>
              <p className="eyebrow">Linha do tempo</p>
              <h2 id="goal-history-title">Histórico de metas</h2>
            </div>
            <span className="history-count">{orderedPeriods.length}</span>
          </div>

          {orderedPeriods.length === 0 ? (
            <div className="inline-empty-state">
              <p>Nenhum período cadastrado.</p>
              <span>O primeiro aparecerá aqui sem substituir dados históricos.</span>
            </div>
          ) : (
            <ol className="period-list">
              {orderedPeriods.map((period) => (
                <li className="period-item" key={period.id}>
                  <div className="period-heading">
                    <div>
                      <strong>{period.calorieTarget.toLocaleString('pt-BR')} kcal/dia</strong>
                      <span>{formatValidity(period.validFrom, period.validTo)}</span>
                    </div>
                    {effective.data?.id === period.id ? <span className="status-chip">Vigente</span> : null}
                  </div>
                  <dl className="goal-summary-list">
                    {goalSummaries(period).map((summary) => (
                      <div key={summary.nutrient}>
                        <dt>{summary.label}</dt>
                        <dd>{summary.value}</dd>
                      </div>
                    ))}
                  </dl>
                </li>
              ))}
            </ol>
          )}
          <p className="validity-note">A data final exibida pela API é exclusiva.</p>
        </section>
      </div>
    </main>
  )
}
