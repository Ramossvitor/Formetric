import { useQuery } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { getErrorMessage } from '../api/http'
import type { GoalAttainment, MetricAggregate, MonthlyAnalytics, NutrientType } from '../analytics/api'
import { formatDate, formatDuration, formatMonth, formatNumber, formatSigned, formatWorkoutModality, nutrientLabels } from '../analytics/format'
import { monthlyAnalyticsQuery } from '../analytics/queries'
import { useProfileTimeContext } from '../time/ProfileTimeContext'

function AnalyticsTabs() {
  return (
    <nav aria-label="Seções de análises" className="analytics-tabs">
      <Link aria-current="page" className="active" to="/analytics/monthly">Resumo mensal</Link>
      <Link to="/analytics/charts">Gráficos</Link>
    </nav>
  )
}

function AggregateCard({ aggregate, label, unit, fractionDigits = 0 }: {
  aggregate: MetricAggregate
  label: string
  unit: string
  fractionDigits?: number
}) {
  return (
    <article className="analytics-aggregate-card surface-card">
      <span>{label}</span>
      {aggregate.average == null
        ? <strong className="analytics-missing">Sem média</strong>
        : <strong>{formatNumber(aggregate.average, fractionDigits)} <small>{unit}/dia</small></strong>}
      <small>{aggregate.sampleCount === 0 ? 'nenhum dia elegível' : `${aggregate.sampleCount} dia${aggregate.sampleCount === 1 ? '' : 's'} na média`}</small>
    </article>
  )
}

function EnergyMetric({ label, value, note }: { label: string; value: ReactNode; note: string }) {
  return <article className="analytics-energy-metric"><span>{label}</span><strong>{value}</strong><small>{note}</small></article>
}

const attainmentOrder: Record<NutrientType, number> = {
  CALORIES: 0,
  PROTEIN: 1,
  CARBOHYDRATE: 2,
  FAT: 3,
  FIBER: 4,
  WATER: 5,
}

function AttainmentRow({ item }: { item: GoalAttainment }) {
  const percentage = item.attainedPercentage ?? 0
  const unconfiguredMessage = item.nutrient === 'CALORIES'
    ? 'Classificação não configurada no período'
    : 'Sem meta vigente no período'
  return (
    <li className={!item.configured ? 'unconfigured' : ''}>
      <div><strong>{nutrientLabels[item.nutrient]}</strong><span>{item.configured ? `${item.attainedDays} de ${item.eligibleDays} dias` : unconfiguredMessage}</span></div>
      <div className="attainment-value">{item.attainedPercentage == null ? '—' : `${formatNumber(item.attainedPercentage, 1)}%`}</div>
      <div
        aria-hidden={item.attainedPercentage == null ? 'true' : undefined}
        aria-label={item.attainedPercentage == null ? undefined : `${nutrientLabels[item.nutrient]}: meta atingida em ${formatNumber(item.attainedPercentage, 1)}% dos dias elegíveis`}
        aria-valuemax={item.attainedPercentage == null ? undefined : 100}
        aria-valuemin={item.attainedPercentage == null ? undefined : 0}
        aria-valuenow={item.attainedPercentage == null
          ? undefined
          : Math.min(100, Math.max(0, item.attainedPercentage))}
        className="attainment-track"
        role={item.attainedPercentage == null ? undefined : 'progressbar'}
      >
        <span aria-hidden="true" style={{ width: `${Math.min(100, Math.max(0, percentage))}%` }} />
      </div>
    </li>
  )
}

function MonthlyDashboard({ data }: { data: MonthlyAnalytics }) {
  const { locale } = useProfileTimeContext()
  const hasElapsedDays = data.elapsedCalendarDays > 0
  // Nenhuma das seis médias tem amostra: a tela não tem o que dizer sobre nutrição neste mês.
  const semNenhumaAmostra = [data.nutrition.caloriesKcal, data.nutrition.proteinG, data.nutrition.carbohydrateG, data.nutrition.fatG, data.nutrition.fiberG, data.nutrition.waterMl]
    .every((agregado) => agregado.sampleCount === 0)
  const orderedGoalAttainment = [...data.goalAttainment].sort(
    (first, second) => attainmentOrder[first.nutrient] - attainmentOrder[second.nutrient],
  )
  return (
    <>
      {!hasElapsedDays ? (
        <div className="analytics-context analytics-context-missing" role="note"><strong>Período futuro</strong><span>Não há dias decorridos para consolidar neste mês.</span></div>
      ) : (
        <section aria-label="Cobertura do diário" className="analytics-coverage surface-card">
          <div><span>Dias decorridos</span><strong>{data.elapsedCalendarDays}</strong></div>
          <div><span>Fechados</span><strong>{data.closedDays}</strong></div>
          <div><span>Em aberto</span><strong>{data.openDays}</strong></div>
          <div><span>Sem diário</span><strong>{data.missingDiaryDays}</strong></div>
        </section>
      )}

      <section aria-labelledby="monthly-nutrition-title" className="analytics-section">
        <div className="section-title-row"><div><p className="eyebrow">Nutrição</p><h2 id="monthly-nutrition-title">Médias dos dias elegíveis</h2></div></div>
        {semNenhumaAmostra ? (
          /* Seis cartões vazios eram 398px de rolagem para doze repetições de "Sem média" e
             "nenhum dia elegível" — a mesma ausência dita doze vezes, que faz o leitor procurar
             uma diferença de significado que não existe. Um bloco diz o mesmo e aponta a saída. */
          <div className="inline-empty-state">
            <p>Nenhum dia deste mês entrou nas médias.</p>
            <Link className="goal-setup-link" to="/diary">Registrar e fechar um dia <span aria-hidden="true">›</span></Link>
          </div>
        ) : (
          <div className="analytics-aggregate-grid">
            <AggregateCard aggregate={data.nutrition.caloriesKcal} label="Calorias" unit="kcal" />
            <AggregateCard aggregate={data.nutrition.proteinG} fractionDigits={1} label="Proteína" unit="g" />
            <AggregateCard aggregate={data.nutrition.carbohydrateG} fractionDigits={1} label="Carboidratos" unit="g" />
            <AggregateCard aggregate={data.nutrition.fatG} fractionDigits={1} label="Gorduras" unit="g" />
            <AggregateCard aggregate={data.nutrition.fiberG} fractionDigits={1} label="Fibras" unit="g" />
            <AggregateCard aggregate={data.nutrition.waterMl} fractionDigits={0} label="Água" unit="ml" />
          </div>
        )}
        {semNenhumaAmostra ? null : <p className="analytics-method-note" role="note">Cada média mostra seu próprio número de amostras. Diários abertos e valores ausentes não são transformados em zero.</p>}
      </section>

      <section aria-labelledby="monthly-energy-title" className="analytics-section analytics-energy-panel surface-card">
        <div className="section-title-row">
          <div><p className="eyebrow">Energia</p><h2 id="monthly-energy-title">Balanço dos dias calculáveis</h2></div>
          <span className="result-count">{data.energy.eligibleDays === 1 ? '1 dia elegível' : `${data.energy.eligibleDays} dias elegíveis`}</span>
        </div>
        <div className="analytics-energy-grid">
          <EnergyMetric label="Saldo acumulado" note="ingestão menos TDEE" value={data.energy.netBalanceKcal == null ? 'Indisponível' : formatSigned(data.energy.netBalanceKcal, 'kcal')} />
          <EnergyMetric label="Média diária" note="somente dias elegíveis" value={data.energy.averageBalanceKcal == null ? 'Indisponível' : formatSigned(data.energy.averageBalanceKcal, 'kcal')} />
          <EnergyMetric label="Déficit acumulado" note={`${data.energy.deficitDays} dia${data.energy.deficitDays === 1 ? '' : 's'}`} value={data.energy.deficitMagnitudeKcal == null ? 'Indisponível' : `${formatNumber(data.energy.deficitMagnitudeKcal)} kcal`} />
          <EnergyMetric label="Superávit acumulado" note={`${data.energy.surplusDays} dia${data.energy.surplusDays === 1 ? '' : 's'} · ${data.energy.neutralDays} neutro${data.energy.neutralDays === 1 ? '' : 's'}`} value={data.energy.surplusKcal == null ? 'Indisponível' : `${formatNumber(data.energy.surplusKcal)} kcal`} />
        </div>
        <div className="analytics-energy-missing">
          <span>{data.energy.missingTdeeDays} dia{data.energy.missingTdeeDays === 1 ? '' : 's'} sem TDEE</span>
          <span>{data.energy.missingNutritionDays} dia{data.energy.missingNutritionDays === 1 ? '' : 's'} sem nutrição calculável</span>
        </div>
        <div className="analytics-extremes-grid">
          <article><span>Maior déficit</span>{data.energy.largestDeficit ? <><strong>{formatSigned(data.energy.largestDeficit.balanceKcal, 'kcal')}</strong><small>{formatDate(data.energy.largestDeficit.date, locale)}</small></> : <strong className="analytics-missing">Sem dado</strong>}</article>
          <article><span>Maior superávit</span>{data.energy.largestSurplus ? <><strong>{formatSigned(data.energy.largestSurplus.balanceKcal, 'kcal')}</strong><small>{formatDate(data.energy.largestSurplus.date, locale)}</small></> : <strong className="analytics-missing">Sem dado</strong>}</article>
          <article><span>Maior consumo</span>{data.highestConsumption ? <><strong>{formatNumber(data.highestConsumption.caloriesKcal)} kcal</strong><small>{formatDate(data.highestConsumption.date, locale)}</small></> : <strong className="analytics-missing">Sem dado</strong>}</article>
          <article><span>Menor consumo</span>{data.lowestConsumption ? <><strong>{formatNumber(data.lowestConsumption.caloriesKcal)} kcal</strong><small>{formatDate(data.lowestConsumption.date, locale)}</small></> : <strong className="analytics-missing">Sem dado</strong>}</article>
        </div>
      </section>

      <div className="analytics-split-grid">
        <section aria-labelledby="attainment-title" className="analytics-section analytics-detail-card surface-card">
          <div><p className="eyebrow">Metas</p><h2 id="attainment-title">Atingimento explícito</h2></div>
          <ul className="attainment-list">{orderedGoalAttainment.map((item) => <AttainmentRow item={item} key={item.nutrient} />)}</ul>
          <p className="analytics-method-note">
            O denominador usa apenas diários fechados, com valor registrado e classificação vigente.
            Dias abertos ou sem valor ficam fora.
          </p>
        </section>

        <section aria-labelledby="monthly-activity-title" className="analytics-section analytics-detail-card surface-card">
          <div><p className="eyebrow">Atividade</p><h2 id="monthly-activity-title">Treinos no mês</h2></div>
          <div className="analytics-activity-total"><strong>{data.workouts.sessionCount}</strong><span>sessões em {data.workouts.trainingDays} dia{data.workouts.trainingDays === 1 ? '' : 's'}</span></div>
          <dl className="analytics-description-list">
            <div><dt>Frequência</dt><dd>{data.workouts.sessionsPerWeek == null ? 'Indisponível' : `${formatNumber(data.workouts.sessionsPerWeek, 1)}/semana`}</dd></div>
            <div><dt>Duração</dt><dd>{formatDuration(data.workouts.totalDurationMinutes)}</dd></div>
            <div><dt>Modalidades</dt><dd>{data.workouts.modalities.length > 0 ? data.workouts.modalities.map(formatWorkoutModality).join(', ') : 'Nenhuma registrada'}</dd></div>
          </dl>
          <Link className="text-button analytics-detail-link" to="/workouts">Abrir treinos</Link>
        </section>

        <section aria-labelledby="monthly-weight-title" className="analytics-section analytics-detail-card surface-card">
          <div><p className="eyebrow">Corpo</p><h2 id="monthly-weight-title">Peso no mês</h2></div>
          {data.weight.observationCount === 0 ? <p className="analytics-missing-block">Nenhuma pesagem no período.</p> : (
            <>
              <div className="analytics-activity-total"><strong>{data.weight.finalWeightKg == null ? '—' : `${formatNumber(data.weight.finalWeightKg, 2)} kg`}</strong><span>último de {data.weight.observationCount} registro{data.weight.observationCount === 1 ? '' : 's'}</span></div>
              <dl className="analytics-description-list">
                <div><dt>Mudança</dt><dd>{data.weight.changeKg == null ? 'Indisponível' : formatSigned(data.weight.changeKg, 'kg', 2)}</dd></div>
                <div><dt>Faixa observada</dt><dd>{data.weight.minimumWeightKg == null || data.weight.maximumWeightKg == null ? 'Indisponível' : `${formatNumber(data.weight.minimumWeightKg, 2)}–${formatNumber(data.weight.maximumWeightKg, 2)} kg`}</dd></div>
                <div><dt>Primeiro peso</dt><dd>{data.weight.initialWeightKg == null ? 'Indisponível' : `${formatNumber(data.weight.initialWeightKg, 2)} kg`}</dd></div>
              </dl>
            </>
          )}
          <Link className="text-button analytics-detail-link" to="/progress/weight">Abrir histórico</Link>
        </section>
      </div>
    </>
  )
}

export function MonthlyAnalyticsPage() {
  const { today, locale } = useProfileTimeContext()
  const [selectedMonth, setSelectedMonth] = useState<string>()
  const month = selectedMonth ?? today.slice(0, 7)
  const monthly = useQuery(monthlyAnalyticsQuery(month))
  const pending = monthly.isPending
  const error = monthly.error

  return (
    <main id="conteudo">
      <header className="page-heading analytics-page-heading">
        <div><p className="eyebrow">Consolidado</p><h1>{month ? formatMonth(month, locale) : 'Resumo mensal'}</h1><p className="heading-copy">Médias e totais calculados apenas com dados históricos elegíveis.</p></div>
        <label className="analytics-date-control"><span>Mês analisado</span><input max={today.slice(0, 7)} onChange={(event) => setSelectedMonth(event.target.value || undefined)} type="month" value={month} /></label>
      </header>
      <AnalyticsTabs />

      {pending ? (
        <div className="catalog-state" role="status"><span className="route-spinner" /><p>Consolidando o mês…</p></div>
      ) : error ? (
        <div className="catalog-state" role="alert"><p>{getErrorMessage(error)}</p><button className="secondary-button" onClick={() => void monthly.refetch()} type="button">Tentar novamente</button></div>
      ) : monthly.data ? <MonthlyDashboard data={monthly.data} /> : null}
    </main>
  )
}
