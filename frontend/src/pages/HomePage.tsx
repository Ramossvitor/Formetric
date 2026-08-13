import { useQuery } from '@tanstack/react-query'
import { type CSSProperties, type ReactNode, useState } from 'react'
import { Link } from 'react-router-dom'
import { getErrorMessage } from '../api/http'
import type { DailyAnalytics, GoalProgress, NutrientType } from '../analytics/api'
import { diaryStatusLabels, formatDuration, formatLongDate, formatNumber, formatSigned, formatWorkoutModality, nutrientLabels } from '../analytics/format'
import { analyticsBoundsQuery, dailyAnalyticsQuery } from '../analytics/queries'
import { Icon } from '../components/Icon'

const macroDefinitions: Array<{
  nutrient: Exclude<NutrientType, 'WATER'>
  key: 'proteinG' | 'carbohydrateG' | 'fatG' | 'fiberG'
  tone: string
}> = [
  { nutrient: 'PROTEIN', key: 'proteinG', tone: 'green' },
  { nutrient: 'CARBOHYDRATE', key: 'carbohydrateG', tone: 'blue' },
  { nutrient: 'FAT', key: 'fatG', tone: 'orange' },
  { nutrient: 'FIBER', key: 'fiberG', tone: 'purple' },
]

function DailyStatus({ data }: { data: DailyAnalytics }) {
  const detail = data.diaryStatus === 'OPEN'
    ? 'Os valores são parciais e ainda não entram no histórico.'
    : data.diaryStatus === 'CLOSED'
      ? data.fastingConfirmed ? 'Jejum confirmado e elegível para o histórico.' : 'Valores confirmados no histórico.'
      : 'Registre ou confirme o diário para calcular o dia.'

  return (
    <div className={`analytics-context analytics-context-${data.diaryStatus.toLowerCase()}`} role="note">
      <strong>{diaryStatusLabels[data.diaryStatus]}</strong>
      <span>{detail}</span>
    </div>
  )
}

function MissingValue({ children }: { children: ReactNode }) {
  return <span className="analytics-missing">{children}</span>
}

function MacroRow({ data, goal, nutrient, nutritionKey, tone }: {
  data: DailyAnalytics
  goal: GoalProgress | undefined
  nutrient: Exclude<NutrientType, 'WATER'>
  nutritionKey: 'proteinG' | 'carbohydrateG' | 'fatG' | 'fiberG'
  tone: string
}) {
  const value = data.nutrition[nutritionKey]
  const state = goal?.bandLabel ?? (goal ? 'Fora das faixas configuradas' : 'Sem meta configurada')

  return (
    <div className="macro-item">
      <div className="macro-meta">
        <span>{nutrientLabels[nutrient]}</span>
        <span>{value == null ? 'Não informado' : <><strong>{formatNumber(value, 1)}</strong> g</>}</span>
      </div>
      <div className="daily-goal-state">
        <span aria-hidden="true" className={`goal-state-dot ${goal?.attained === true ? 'attained' : goal?.attained === false ? 'not-attained' : tone}`} />
        <span>{state}</span>
        {goal?.attained != null ? <strong>{goal.attained ? 'atingida' : 'fora da meta'}</strong> : null}
      </div>
    </div>
  )
}

function DailyDashboard({ data }: { data: DailyAnalytics }) {
  const calories = data.nutrition.caloriesKcal
  const caloriePercent = calories != null && data.calorieTargetKcal != null && data.calorieTargetKcal > 0
    ? Math.min(100, Math.max(0, (calories / data.calorieTargetKcal) * 100))
    : 0
  const waterGoal = data.goalProgress.find((goal) => goal.nutrient === 'WATER')
  const waterLiters = data.nutrition.waterMl == null ? null : data.nutrition.waterMl / 1000
  const balance = data.energyBalanceKcal ?? data.projectedEnergyBalanceKcal
  const projected = data.projectedEnergyBalanceKcal != null
  const workoutLabel = data.workouts.sessionCount === 0
    ? 'Nenhum treino'
    : data.workouts.modalities.length > 0
      ? data.workouts.modalities.map(formatWorkoutModality).join(' · ')
      : `${data.workouts.sessionCount} sessão${data.workouts.sessionCount === 1 ? '' : 'ões'}`

  return (
    <>
      <DailyStatus data={data} />

      <section aria-labelledby="resumo-nutricional" className="nutrition-card surface-card">
        <div className="calorie-summary">
          <div className="section-heading">
            <div><p className="eyebrow">Consumido</p><h2 id="resumo-nutricional">Nutrição do dia</h2></div>
            <span className={`status-chip daily-status-${data.diaryStatus.toLowerCase()}`}>{diaryStatusLabels[data.diaryStatus]}</span>
          </div>

          <div
            aria-label={calories == null ? 'Calorias não informadas' : `${formatNumber(calories)} quilocalorias consumidas`}
            aria-valuemax={data.calorieTargetKcal ?? undefined}
            aria-valuemin={0}
            aria-valuenow={calories ?? undefined}
            className={`calorie-progress ${data.calorieTargetKcal == null ? 'without-target' : ''}`}
            role={calories == null ? undefined : 'progressbar'}
            style={{ '--calorie-progress': `${caloriePercent}%` } as CSSProperties}
          >
            <div className="calorie-progress-inner">
              {calories == null ? <MissingValue>Sem registro</MissingValue> : <strong>{formatNumber(calories)}</strong>}
              <span>{data.calorieTargetKcal == null ? 'meta não configurada' : `de ${formatNumber(data.calorieTargetKcal)} kcal`}</span>
            </div>
          </div>

          <div className="energy-balance">
            <span className="balance-icon"><Icon name="trend" size={18} /></span>
            <span>
              <small>{projected ? 'Saldo previsto' : 'Saldo fechado'}</small>
              {balance == null
                ? <MissingValue>{data.energyBalanceAvailability === 'MISSING_TDEE' ? 'Configure o TDEE' : 'Ainda indisponível'}</MissingValue>
                : <strong>{formatSigned(balance, 'kcal')}</strong>}
            </span>
            <span className="estimate-label">{projected ? 'projeção' : data.historicalEligible ? 'confirmado' : 'pendente'}</span>
          </div>
          <p className="daily-tdee">TDEE vigente: {data.tdeeKcal == null ? <strong>não configurado</strong> : <strong>{formatNumber(data.tdeeKcal)} kcal</strong>}</p>
        </div>

        <div className="macro-summary">
          <div className="section-heading compact">
            <div><p className="eyebrow">Nutrientes</p><h2>Classificação das metas</h2></div>
            <Link className="text-button" to={`/diary?date=${data.date}`}>Ver diário</Link>
          </div>
          <div className="macro-list">
            {macroDefinitions.map((macro) => (
              <MacroRow
                data={data}
                goal={data.goalProgress.find((goal) => goal.nutrient === macro.nutrient)}
                key={macro.nutrient}
                nutrient={macro.nutrient}
                nutritionKey={macro.key}
                tone={macro.tone}
              />
            ))}
          </div>
        </div>
      </section>

      <section aria-labelledby="panorama" className="overview-section">
        <div className="section-title-row">
          <div><p className="eyebrow">Panorama</p><h2 id="panorama">Demais registros do dia</h2></div>
          <Link className="text-button desktop-only" to="/analytics/monthly">Ver mês</Link>
        </div>
        <div className="overview-grid">
          <article className="metric-card water-card">
            <div className="metric-icon blue"><Icon name="droplet" /></div>
            <div className="metric-copy">
              <span className="metric-label">Água</span>
              {waterLiters == null ? <MissingValue>Não registrada</MissingValue> : <strong>{formatNumber(waterLiters, 2)} <small>L</small></strong>}
              <span className="metric-note">{waterGoal?.bandLabel ?? 'Meta não configurada'}{waterGoal?.attained === true ? ' · atingida' : ''}</span>
            </div>
            <Link aria-label="Registrar água no diário" className="card-action" to={`/diary?date=${data.date}&action=quick`}><Icon name="plus" size={18} /></Link>
          </article>

          <article className="metric-card">
            <div className="metric-icon orange"><Icon name="activity" /></div>
            <div className="metric-copy">
              <span className="metric-label">Treino</span>
              <strong className="metric-title">{workoutLabel}</strong>
              <span className="metric-note">{data.workouts.sessionCount === 0 ? 'Nenhuma sessão registrada' : `${formatDuration(data.workouts.totalDurationMinutes)} · ${data.workouts.sessionCount} sessão${data.workouts.sessionCount === 1 ? '' : 'ões'}`}</span>
            </div>
            <Link aria-label="Abrir treinos" className="card-action ghost" to="/workouts"><Icon name="chevron" size={18} /></Link>
          </article>

          <article className="metric-card">
            <div className="metric-icon purple"><Icon name="scale" /></div>
            <div className="metric-copy">
              <span className="metric-label">Peso</span>
              {data.weightKg == null ? <MissingValue>Não registrado</MissingValue> : <strong>{formatNumber(data.weightKg, 2)} <small>kg</small></strong>}
              <span className="metric-note">Pesagem oficial nesta data</span>
            </div>
            <Link aria-label="Ver evolução do peso" className="card-action ghost" to="/progress/weight"><Icon name="chevron" size={18} /></Link>
          </article>

          <article className="metric-card analytics-links-card">
            <div className="metric-icon green"><Icon name="trend" /></div>
            <div className="metric-copy">
              <span className="metric-label">Análises</span>
              <strong className="metric-title">Entenda a evolução</strong>
              <span className="metric-note">Consolidados e séries históricas</span>
            </div>
            <div className="analytics-card-links"><Link to="/analytics/monthly">Mês</Link><Link to="/analytics/charts">Gráficos</Link></div>
          </article>
        </div>
      </section>
    </>
  )
}

export function HomePage() {
  const [selectedDate, setSelectedDate] = useState<string>()
  const bounds = useQuery(analyticsBoundsQuery)
  const date = selectedDate ?? bounds.data?.today
  const daily = useQuery(dailyAnalyticsQuery(date))
  const pending = bounds.isPending || (Boolean(date) && daily.isPending)
  const error = bounds.error ?? daily.error

  return (
    <main id="conteudo">
      <header className="page-heading analytics-page-heading">
        <div>
          <p className="eyebrow">Resumo diário</p>
          <h1>{date === bounds.data?.today ? 'Hoje' : date ? formatLongDate(date) : 'Hoje'}</h1>
          <p className="heading-copy">Dados registrados, cálculos do sistema e disponibilidade explícita.</p>
        </div>
        <label className="analytics-date-control">
          <span>Data do resumo</span>
          <input max={bounds.data?.today} onChange={(event) => setSelectedDate(event.target.value)} type="date" value={date ?? ''} />
        </label>
      </header>

      {pending ? (
        <div className="catalog-state" role="status"><span className="route-spinner" /><p>Calculando o resumo diário…</p></div>
      ) : error ? (
        <div className="catalog-state" role="alert"><p>{getErrorMessage(error)}</p><button className="secondary-button" onClick={() => { if (bounds.isError) void bounds.refetch(); else void daily.refetch() }} type="button">Tentar novamente</button></div>
      ) : daily.data ? <DailyDashboard data={daily.data} /> : null}
    </main>
  )
}
