import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { ApiError, getErrorMessage } from '../api/http'
import { invalidateAnalytics } from '../analytics/queries'
import { createTdeePeriod } from '../planning/api'
import { formatValidity } from '../planning/format'
import { PlanningError, PlanningLoading } from '../planning/PlanningState'
import {
  effectiveTdeeQuery,
  tdeePeriodsQuery,
  tdeePeriodsQueryKey,
} from '../planning/queries'
import { tdeeFormSchema, type TdeeFormValues } from '../planning/schemas'
import { useProfileTimeContext } from '../time/ProfileTimeContext'

const defaultTdee = 3000

export function TdeeSettingsPage() {
  const { today, locale } = useProfileTimeContext()
  const queryClient = useQueryClient()
  const periods = useQuery(tdeePeriodsQuery)
  const effective = useQuery(effectiveTdeeQuery(today))
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<TdeeFormValues>({
    resolver: zodResolver(tdeeFormSchema),
    defaultValues: { validFrom: today, validTo: '', kcalPerDay: defaultTdee },
  })
  const createPeriod = useMutation({
    mutationFn: createTdeePeriod,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: tdeePeriodsQueryKey }),
        invalidateAnalytics(queryClient),
      ])
      reset({ validFrom: today, validTo: '', kcalPerDay: defaultTdee })
    },
    onError: (error) => {
      if (!(error instanceof ApiError)) return

      for (const fieldError of error.problem?.fieldErrors ?? []) {
        if (fieldError.field in tdeeFormSchema.shape) {
          setError(fieldError.field as keyof TdeeFormValues, { message: fieldError.message })
        }
      }
    },
  })

  if (periods.isPending || effective.isPending) {
    return <PlanningLoading message="Carregando histórico de TDEE…" />
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
          <h1>TDEE</h1>
          <p className="heading-copy">Mantenha o gasto energético versionado para cálculos históricos confiáveis.</p>
        </div>
      </header>

      <section className="effective-card surface-card" aria-labelledby="effective-tdee-title">
        <div>
          <p className="eyebrow">Vigente hoje</p>
          <h2 id="effective-tdee-title">
            {effective.data
              ? `${effective.data.kcalPerDay.toLocaleString('pt-BR')} kcal/dia`
              : 'Nenhum TDEE vigente'}
          </h2>
          <p>
            {effective.data
              ? formatValidity(effective.data.validFrom, effective.data.validTo, locale)
              : 'Crie um período com início hoje ou em uma data anterior.'}
          </p>
        </div>
        {effective.data ? <span className="status-chip">Ativo</span> : null}
      </section>

      <div className="planning-grid tdee-grid">
        <section className="planning-card surface-card" aria-labelledby="new-tdee-title">
          <div className="section-heading profile-section-heading">
            <div>
              <p className="eyebrow">Novo período</p>
              <h2 id="new-tdee-title">Definir TDEE</h2>
            </div>
          </div>

          <form
            className="planning-form"
            noValidate
            onSubmit={(event) => void handleSubmit((values) => createPeriod.mutate(values))(event)}
          >
            <div className="goal-period-fields full-field">
              <div className="field-group">
                <label htmlFor="tdee-valid-from">Válido a partir de</label>
                <input
                  {...register('validFrom')}
                  aria-describedby="tdee-validity-hint"
                  aria-invalid={Boolean(errors.validFrom)}
                  id="tdee-valid-from"
                  type="date"
                />
                {errors.validFrom ? <span className="field-error">{errors.validFrom.message}</span> : null}
              </div>

              <div className="field-group">
                <label htmlFor="tdee-valid-to">
                  Válido até <span className="optional-label">opcional e exclusivo</span>
                </label>
                <input
                  {...register('validTo')}
                  aria-describedby="tdee-validity-hint"
                  aria-invalid={Boolean(errors.validTo)}
                  id="tdee-valid-to"
                  type="date"
                />
                {errors.validTo ? <span className="field-error">{errors.validTo.message}</span> : null}
              </div>
            </div>
            <p className="goal-validity-hint full-field" id="tdee-validity-hint">
              O início é inclusivo. Use o término exclusivo para cadastrar um TDEE histórico sem
              sobrepor o período atual.
            </p>

            <div className="field-group full-field">
              <label htmlFor="tdee-kcal">TDEE estimado</label>
              <div className="number-with-unit">
                <input
                  {...register('kcalPerDay', { valueAsNumber: true })}
                  aria-invalid={Boolean(errors.kcalPerDay)}
                  id="tdee-kcal"
                  min="0"
                  step="0.001"
                  type="number"
                />
                <span>kcal/dia</span>
              </div>
              <span className="field-hint">O treino não será descontado novamente do saldo diário.</span>
              {errors.kcalPerDay ? <span className="field-error">{errors.kcalPerDay.message}</span> : null}
            </div>

            {createPeriod.isError &&
            (!(createPeriod.error instanceof ApiError) ||
              !createPeriod.error.problem?.fieldErrors?.length) ? (
              <p className="form-error full-field" role="alert">{getErrorMessage(createPeriod.error)}</p>
            ) : null}
            {createPeriod.isSuccess ? (
              <p className="form-success full-field" role="status">Novo período de TDEE criado.</p>
            ) : null}

            <button className="submit-button full-field" disabled={createPeriod.isPending} type="submit">
              {createPeriod.isPending ? 'Salvando período…' : 'Criar período de TDEE'}
            </button>
          </form>
        </section>

        <section className="planning-card surface-card" aria-labelledby="tdee-history-title">
          <div className="section-heading profile-section-heading">
            <div>
              <p className="eyebrow">Linha do tempo</p>
              <h2 id="tdee-history-title">Histórico de TDEE</h2>
            </div>
            <span className="history-count">{orderedPeriods.length}</span>
          </div>

          {orderedPeriods.length === 0 ? (
            <div className="inline-empty-state">
              <p>Nenhum período cadastrado.</p>
              <span>O primeiro aparecerá aqui sem recalcular o passado.</span>
            </div>
          ) : (
            <ol className="period-list">
              {orderedPeriods.map((period) => (
                <li className="period-item tdee-period" key={period.id}>
                  <div className="period-heading">
                    <div>
                      <strong>{period.kcalPerDay.toLocaleString('pt-BR')} kcal/dia</strong>
                      <span>{formatValidity(period.validFrom, period.validTo, locale)}</span>
                    </div>
                    {effective.data?.id === period.id ? <span className="status-chip">Vigente</span> : null}
                  </div>
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
