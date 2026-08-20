import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { ApiError, getErrorMessage } from '../api/http'
import { invalidateAnalytics } from '../analytics/queries'
import { createNutritionGoalPeriod } from '../planning/api'
import { formatValidity, goalSummaries, todayAsLocalIsoDate } from '../planning/format'
import { NutrientBandEditor } from '../planning/NutrientBandEditor'
import '../planning/NutritionGoals.css'
import { PlanningError, PlanningLoading } from '../planning/PlanningState'
import {
  effectiveNutritionGoalQuery,
  nutritionGoalPeriodsQuery,
  nutritionGoalPeriodsQueryKey,
} from '../planning/queries'
import {
  defaultNutritionGoalValues,
  nutritionGoalFormSchema,
  type NutritionGoalFormValues,
} from '../planning/schemas'

const targetIndexes = [0, 1, 2, 3, 4] as const

export function NutritionGoalsPage() {
  const today = todayAsLocalIsoDate()
  const queryClient = useQueryClient()
  const periods = useQuery(nutritionGoalPeriodsQuery)
  const effective = useQuery(effectiveNutritionGoalQuery(today))
  const {
    control,
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<NutritionGoalFormValues>({
    resolver: zodResolver(nutritionGoalFormSchema),
    defaultValues: defaultNutritionGoalValues(today),
  })
  const createPeriod = useMutation({
    mutationFn: createNutritionGoalPeriod,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: nutritionGoalPeriodsQueryKey }),
        invalidateAnalytics(queryClient),
      ])
      reset(defaultNutritionGoalValues(today))
    },
    onError: (error) => {
      if (!(error instanceof ApiError)) return

      for (const fieldError of error.problem?.fieldErrors ?? []) {
        if (
          fieldError.field === 'validFrom' ||
          fieldError.field === 'validTo' ||
          fieldError.field === 'calorieTarget'
        ) {
          setError(fieldError.field, { message: fieldError.message })
        } else {
          setError('root.server', { message: fieldError.message })
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
  const effectiveSummaries = effective.data ? goalSummaries(effective.data) : []

  return (
    <main id="conteudo">
      <header className="page-heading planning-heading">
        <div>
          <p className="eyebrow">Planejamento</p>
          <h1>Metas nutricionais</h1>
          <p className="heading-copy">Crie períodos sem alterar as metas usadas no histórico.</p>
        </div>
      </header>

      <section className="effective-card effective-goal-card surface-card" aria-labelledby="effective-goal-title">
        <div className="effective-goal-main">
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
        </div>
        {effectiveSummaries.length > 0 ? (
          <dl className="effective-goal-summary">
            {effectiveSummaries.map((summary) => (
              <div key={summary.nutrient}>
                <dt>{summary.label}</dt>
                <dd>{summary.value}</dd>
              </div>
            ))}
          </dl>
        ) : null}
      </section>

      <div className="planning-grid nutrition-planning-grid">
        <section className="planning-card nutrition-goal-editor surface-card" aria-labelledby="new-goal-title">
          <div className="section-heading profile-section-heading">
            <div>
              <p className="eyebrow">Novo período</p>
              <h2 id="new-goal-title">Definir metas e classificações</h2>
            </div>
          </div>

          <form
            className="planning-form nutrition-goal-form"
            noValidate
            onSubmit={(event) => void handleSubmit((values) => createPeriod.mutate(values))(event)}
          >
            <div className="goal-period-fields">
              <div className="field-group">
                <label htmlFor="goal-valid-from">Válido a partir de</label>
                <input
                  {...register('validFrom')}
                  aria-describedby="goal-validity-hint"
                  aria-invalid={Boolean(errors.validFrom)}
                  id="goal-valid-from"
                  type="date"
                />
                {errors.validFrom ? <span className="field-error">{errors.validFrom.message}</span> : null}
              </div>

              <div className="field-group">
                <label htmlFor="goal-valid-to">
                  Válido até <span className="optional-label">opcional e exclusivo</span>
                </label>
                <input
                  {...register('validTo')}
                  aria-describedby="goal-validity-hint"
                  aria-invalid={Boolean(errors.validTo)}
                  id="goal-valid-to"
                  type="date"
                />
                {errors.validTo ? <span className="field-error">{errors.validTo.message}</span> : null}
              </div>

              <div className="field-group">
                <label htmlFor="goal-calorie-target">Meta calórica</label>
                <div className="number-with-unit">
                  <input
                    {...register('calorieTarget', { valueAsNumber: true })}
                    aria-invalid={Boolean(errors.calorieTarget)}
                    id="goal-calorie-target"
                    min="0"
                    step="1"
                    type="number"
                  />
                  <span>kcal</span>
                </div>
                {errors.calorieTarget ? <span className="field-error">{errors.calorieTarget.message}</span> : null}
              </div>
            </div>
            <p className="goal-validity-hint" id="goal-validity-hint">
              O início é inclusivo. Se preenchido, o término é exclusivo e permite cadastrar um
              intervalo histórico sem manter a meta aberta.
            </p>

            <div className="goal-target-list">
              {targetIndexes.map((targetIndex) => (
                <NutrientBandEditor
                  control={control}
                  errors={errors}
                  key={targetIndex}
                  register={register}
                  targetIndex={targetIndex}
                />
              ))}
            </div>

            {errors.root?.server ? (
              <p className="form-error" role="alert">{errors.root.server.message}</p>
            ) : null}
            {createPeriod.isError &&
            (!(createPeriod.error instanceof ApiError) ||
              !createPeriod.error.problem?.fieldErrors?.length) ? (
              <p className="form-error" role="alert">{getErrorMessage(createPeriod.error)}</p>
            ) : null}
            {createPeriod.isSuccess ? (
              <p className="form-success" role="status">Novo período de metas criado.</p>
            ) : null}

            <button className="submit-button" disabled={createPeriod.isPending} type="submit">
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
                  <dl className="goal-summary-list configurable-goal-summary-list">
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
