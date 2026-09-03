import { useQuery } from '@tanstack/react-query'
import { type CSSProperties, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { getErrorMessage } from '../api/http'
import type {
  DailyAnalytics,
  GoalProgress,
  GoalTone,
  MacroNutrientType,
} from '../analytics/api'
import { diaryStatusLabels, formatDuration, formatLongDate, formatNumber, formatSigned, formatWorkoutModality, nutrientLabels, pluralize } from '../analytics/format'
import { goalBandGeometry } from '../analytics/goalBand'
import { dailyAnalyticsQuery } from '../analytics/queries'
import { Icon } from '../components/Icon'
import { formatGoalComparison, formatGoalRange } from '../diary/format'
import { useQuickWater } from '../diary/useQuickWater'
import { useProfileTimeContext } from '../time/ProfileTimeContext'
import { isPlainDate } from '../time/plainDate'

const macroDefinitions: Array<{
  nutrient: MacroNutrientType
  key: 'proteinG' | 'carbohydrateG' | 'fatG' | 'fiberG'
}> = [
  { nutrient: 'PROTEIN', key: 'proteinG' },
  { nutrient: 'CARBOHYDRATE', key: 'carbohydrateG' },
  { nutrient: 'FAT', key: 'fatG' },
  { nutrient: 'FIBER', key: 'fiberG' },
]

const goalToneClasses: Record<GoalTone, string> = {
  POSITIVE: 'attained',
  NEUTRAL: 'blue',
  WARNING: 'not-attained',
}

function goalToneClass(goal: GoalProgress | undefined) {
  return goal?.bandTone ? goalToneClasses[goal.bandTone] : 'blue'
}

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

/**
 * A mesma frase de ausência, agora levando a quem sabe resolvê-la.
 *
 * Numa conta recém-criada esta tela mostra dez negações seguidas — sem meta, sem TDEE, sem
 * registro — e nenhuma delas dizia onde configurar nada. Era a primeira coisa que um piloto de dez
 * pessoas encontrava, e o caminho para sair dali passava por adivinhar que a resposta estava no
 * Perfil.
 */
function MissingWithFix({ children, to }: { children: ReactNode; to: string }) {
  return <Link className="analytics-missing analytics-missing-link" to={to}>{children}<Icon name="chevron" size={14} /></Link>
}

/**
 * A meta desenhada como faixa, que é como o backend a modela.
 *
 * `minValue`, `maxValue`, `remainingToRange` e `excessOverRange` chegam prontos do servidor e
 * terminavam espremidos numa frase de 11px sob o anel. O anel continua respondendo "quanto já
 * comi"; esta barra responde "quanto ainda cabe", que é a pergunta que decide o próximo prato.
 */
function GoalBand({ goal, tone, value }: { goal: GoalProgress; tone: string; value: number | null }) {
  const geometry = goal.reference ? goalBandGeometry(goal.reference, value) : null
  if (!geometry) return null

  return (
    <div className={`goal-band ${tone}`}>
      <span aria-hidden="true" className="goal-band-track">
        <span className="goal-band-fill" style={{ width: `${geometry.valuePercent}%` }} />
        {geometry.excessStartPercent != null ? (
          <span
            className="goal-band-excess"
            style={{ left: `${geometry.excessStartPercent}%`, right: `${100 - geometry.valuePercent}%` }}
          />
        ) : null}
        {geometry.minPercent != null ? <span className="goal-band-tick" style={{ left: `${geometry.minPercent}%` }} /> : null}
        {geometry.maxPercent != null ? <span className="goal-band-tick" style={{ left: `${geometry.maxPercent}%` }} /> : null}
      </span>
    </div>
  )
}

function MacroRow({ data, goal, nutrient, nutritionKey }: {
  data: DailyAnalytics
  goal: GoalProgress | undefined
  nutrient: MacroNutrientType
  nutritionKey: 'proteinG' | 'carbohydrateG' | 'fatG' | 'fiberG'
}) {
  const value = data.nutrition[nutritionKey]
  const state = !goal
    ? 'Sem meta configurada'
    : value == null
      ? 'Ainda não registrado'
      : goal.bandLabel ?? 'Fora das faixas configuradas'
  const comparison = value == null ? null : formatGoalComparison(goal?.reference ?? null, nutrient)

  return (
    <div className="macro-item">
      <div className="macro-meta">
        <span>{nutrientLabels[nutrient]}</span>
        <span>{value == null ? 'Não informado' : <><strong>{formatNumber(value, 1)}</strong> g</>}{goal?.reference ? ` / meta ${formatGoalRange(goal.reference, nutrient)}` : ''}</span>
      </div>
      <div
        aria-label={`${nutrientLabels[nutrient]}: ${state}${comparison ? `, ${comparison}` : ''}`}
        className="daily-goal-state"
        role="group"
      >
        <span aria-hidden="true" className={`goal-state-dot ${goalToneClass(goal)}`} />
        <span>{state}{comparison ? ` · ${comparison}` : ''}</span>
        {goal?.attained != null ? <strong>{goal.attained ? 'atingida' : 'fora da meta'}</strong> : null}
      </div>
    </div>
  )
}

/**
 * Água, treino, peso e análises numa lista agrupada.
 *
 * Eram quatro cartões independentes de 134px empilhados: 572px de rolagem para quatro fatos, com
 * três quartos daquilo sendo margem e moldura. Como linhas de uma lista só, ocupam 256px, ficam
 * comparáveis entre si e cada uma continua com o próprio alvo de toque.
 */
function DayOverview({ data, onQuickWater, quickWaterPending }: {
  data: DailyAnalytics
  onQuickWater: () => void
  quickWaterPending: boolean
}) {
  const waterLiters = data.nutrition.waterMl == null ? null : data.nutrition.waterMl / 1000
  const waterGoal = data.goalProgress.find((goal) => goal.nutrient === 'WATER')
  const waterState = !waterGoal
    ? 'Meta não configurada'
    : data.nutrition.waterMl == null
      ? 'Ainda não registrada'
      : waterGoal.bandLabel ?? 'Fora das faixas configuradas'
  const waterNote = [
    waterState,
    waterGoal?.reference ? `meta ${formatGoalRange(waterGoal.reference, 'WATER')}` : null,
    data.nutrition.waterMl == null ? null : formatGoalComparison(waterGoal?.reference ?? null, 'WATER'),
  ].filter((item): item is string => item != null).join(' · ')
  const workoutNote = data.workouts.sessionCount === 0
    ? 'Nenhuma sessão registrada'
    : `${formatDuration(data.workouts.totalDurationMinutes)} · ${pluralize(data.workouts.sessionCount, 'sessão', 'sessões')}`
  const workoutValue = data.workouts.sessionCount === 0
    ? 'Nenhum treino'
    : data.workouts.modalities.length > 0
      ? data.workouts.modalities.map(formatWorkoutModality).join(' · ')
      : pluralize(data.workouts.sessionCount, 'sessão', 'sessões')

  return (
    <div className="day-overview surface-card">
      <div className="day-overview-row">
        <span className="metric-icon blue"><Icon name="droplet" /></span>
        <span className="metric-copy">
          <span className="metric-label">Água</span>
          <span className="metric-note">{waterNote}</span>
        </span>
        {waterLiters == null
          ? <MissingValue>Não registrada</MissingValue>
          : <strong>{formatNumber(waterLiters, 2)} <small>L</small></strong>}
        {/* Registrar água a partir daqui evita o caminho que existia: abrir o diário, abrir o
            cadastro rápido, tocar em +250. O rótulo diz o volume porque um "+" sozinho obriga a
            abrir algo para descobrir quanto se está registrando. */}
        <button
          aria-label="Registrar 250 ml de água"
          className="day-overview-water"
          disabled={quickWaterPending}
          onClick={onQuickWater}
          type="button"
        >
          +250
        </button>
      </div>

      <Link className="day-overview-row" to="/workouts">
        <span className="metric-icon orange"><Icon name="activity" /></span>
        <span className="metric-copy">
          <span className="metric-label">Treino</span>
          <span className="metric-note">{workoutNote}</span>
        </span>
        <strong className="metric-title">{workoutValue}</strong>
        <span aria-hidden="true" className="day-overview-chevron"><Icon name="chevron" size={16} /></span>
      </Link>

      <Link className="day-overview-row" to="/progress/weight">
        <span className="metric-icon purple"><Icon name="scale" /></span>
        <span className="metric-copy">
          <span className="metric-label">Peso</span>
          <span className="metric-note">{data.weightKg == null ? "Sem pesagem" : "Pesagem oficial"}</span>
        </span>
        {data.weightKg == null
          ? <MissingValue>Não registrado</MissingValue>
          : <strong>{formatNumber(data.weightKg, 2)} <small>kg</small></strong>}
        <span aria-hidden="true" className="day-overview-chevron"><Icon name="chevron" size={16} /></span>
      </Link>

      <div className="day-overview-footer">
        <Link to="/analytics/monthly">Ver mês</Link>
        <Link to="/analytics/charts">Gráficos</Link>
      </div>
    </div>
  )
}

function DailyDashboard({ data, onQuickWater, quickWaterPending }: {
  data: DailyAnalytics
  onQuickWater: () => void
  quickWaterPending: boolean
}) {
  const calories = data.nutrition.caloriesKcal
  const caloriePercent = calories != null && data.calorieTargetKcal != null && data.calorieTargetKcal > 0
    ? Math.min(100, Math.max(0, (calories / data.calorieTargetKcal) * 100))
    : 0
  const calorieGoal = data.goalProgress.find((goal) => goal.nutrient === 'CALORIES')
  const calorieComparison = calories == null
    ? null
    : formatGoalComparison(calorieGoal?.reference ?? null, 'CALORIES')
  const calorieState = !calorieGoal
    ? 'Classificação não configurada'
    : calories == null
      ? 'Ainda não registradas'
      : calorieGoal.bandLabel ?? 'Fora das faixas configuradas'
  const calorieReference = calorieGoal?.reference
    ? `meta ${formatGoalRange(calorieGoal.reference, 'CALORIES')}`
    : null
  const calorieClassificationStage = data.diaryStatus === 'OPEN'
    ? 'Parcial'
    : data.diaryStatus === 'CLOSED'
      ? 'Definitiva'
      : 'Indisponível'
  const calorieClassification = [calorieState, calorieReference, calorieComparison]
    .filter((item): item is string => item != null)
    .join(' · ')
  const hasCalorieProgress = calories != null
    && data.calorieTargetKcal != null
    && data.calorieTargetKcal > 0
  const balance = data.energyBalanceKcal ?? data.projectedEnergyBalanceKcal
  const projected = data.projectedEnergyBalanceKcal != null

  return (
    <>
      <DailyStatus data={data} />

      <section aria-labelledby="resumo-nutricional" className="nutrition-card surface-card">
        <div className="calorie-summary">
          <div className="section-heading">
            <div><p className="eyebrow">Consumido</p><h2 id="resumo-nutricional">Nutrição do dia</h2></div>
          </div>

          <div
            aria-label="Consumo calórico em relação à meta nominal"
            aria-valuemax={hasCalorieProgress ? data.calorieTargetKcal! : undefined}
            aria-valuemin={hasCalorieProgress ? 0 : undefined}
            aria-valuenow={hasCalorieProgress ? Math.min(calories!, data.calorieTargetKcal!) : undefined}
            aria-valuetext={hasCalorieProgress ? `${formatNumber(calories)} kcal consumidas de uma meta nominal de ${formatNumber(data.calorieTargetKcal!)} kcal` : undefined}
            className={`calorie-progress ${data.calorieTargetKcal == null ? 'without-target' : ''}`}
            role={hasCalorieProgress ? 'progressbar' : 'group'}
            style={{ '--calorie-progress': `${caloriePercent}%` } as CSSProperties}
          >
            <div className="calorie-progress-inner">
              {calories == null ? <MissingValue>Sem registro</MissingValue> : <strong>{formatNumber(calories)}</strong>}
              <span>{data.calorieTargetKcal == null ? 'meta não configurada' : `meta nominal ${formatNumber(data.calorieTargetKcal)} kcal`}</span>
            </div>
          </div>

          <div
            aria-label={`Classificação calórica ${calorieClassificationStage.toLowerCase()}: ${calorieClassification}`}
            className="daily-goal-state"
            role="group"
          >
            <span aria-hidden="true" className={`goal-state-dot ${goalToneClass(calorieGoal)}`} />
            <span>{calorieClassificationStage}: {calorieClassification}</span>
            {calorieGoal?.attained != null ? (
              <strong>{calorieGoal.attained ? 'atingida' : 'fora da meta'}</strong>
            ) : null}
          </div>

          {calorieGoal ? <GoalBand goal={calorieGoal} tone={goalToneClass(calorieGoal)} value={calories} /> : null}

          <div className="energy-balance">
            <span className="balance-icon"><Icon name="trend" size={18} /></span>
            <span>
              <small>{projected ? 'Saldo previsto' : 'Saldo fechado'}</small>
              {balance == null
                ? data.energyBalanceAvailability === 'MISSING_TDEE'
                  ? <MissingWithFix to="/settings/tdee">Configure o TDEE</MissingWithFix>
                  : <MissingValue>Ainda indisponível</MissingValue>
                : <strong>{formatSigned(balance, 'kcal')}</strong>}
            </span>
            <span className="estimate-label">{projected ? 'projeção' : data.historicalEligible ? 'confirmado' : 'pendente'}</span>
          </div>
          <p className="daily-tdee">TDEE vigente: {data.tdeeKcal == null ? <Link to="/settings/tdee"><strong>não configurado</strong></Link> : <strong>{formatNumber(data.tdeeKcal)} kcal</strong>}</p>
        </div>

        <div className="macro-summary">
          <div className="section-heading compact">
            <div><h2>Classificação das metas</h2></div>
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
              />
            ))}
          </div>
          {data.goalProgress.length === 0 ? (
            <Link className="goal-setup-link" to="/settings/nutrition-goals">
              Definir metas para classificar o dia
              <Icon name="chevron" size={16} />
            </Link>
          ) : null}
        </div>
      </section>

      {data.diaryStatus === 'MISSING' ? (
        <Link className="start-day-action" to={`/diary?date=${data.date}&action=quick`}>
          <Icon name="plus" size={18} />
          Começar o registro deste dia
        </Link>
      ) : null}

      <section aria-labelledby="panorama" className="overview-section">
        <div className="section-title-row">
          <div><h2 id="panorama">Demais registros do dia</h2></div>
        </div>
        <DayOverview data={data} onQuickWater={onQuickWater} quickWaterPending={quickWaterPending} />
      </section>
    </>
  )
}

export function HomePage() {
  const { today, locale } = useProfileTimeContext()
  // A data vive na URL, e não em estado local, pelo mesmo motivo que no diário: recarregar a página
  // mantinha "Hoje" no título e o dado de outro dia embaixo, e o botão voltar do aparelho saía do
  // app em vez de desfazer a troca de data. `replace` porque percorrer uma semana não deveria
  // encher o histórico com sete paradas.
  const [searchParams, setSearchParams] = useSearchParams()
  const requestedDate = searchParams.get('date')
  const date = requestedDate && isPlainDate(requestedDate) ? requestedDate : today
  const daily = useQuery(dailyAnalyticsQuery(date))
  const quickWater = useQuickWater(date)
  const pending = daily.isPending
  const error = daily.error

  function selectDate(nextDate: string) {
    const params = new URLSearchParams(searchParams)
    if (!nextDate || nextDate === today) params.delete('date')
    else params.set('date', nextDate)
    setSearchParams(params, { replace: true })
  }

  return (
    <main id="conteudo">
      <header className="page-heading analytics-page-heading">
        <div>
          <p className="eyebrow">Resumo diário</p>
          <h1>{date === today ? 'Hoje' : formatLongDate(date, locale)}</h1>
        </div>
        <div className="analytics-date-group">
          <label className="analytics-date-control">
            <span>Data do resumo</span>
            <input max={today} onChange={(event) => selectDate(event.target.value)} type="date" value={date} />
          </label>
          {date === today ? null : (
            <button className="text-button" onClick={() => selectDate(today)} type="button">Voltar para hoje</button>
          )}
        </div>
      </header>

      {pending ? (
        <div className="catalog-state" role="status"><span className="route-spinner" /><p>Calculando o resumo diário…</p></div>
      ) : error ? (
        <div className="catalog-state" role="alert"><p>{getErrorMessage(error)}</p><button className="secondary-button" onClick={() => void daily.refetch()} type="button">Tentar novamente</button></div>
      ) : daily.data ? (
        <>
          {quickWater.isError ? <p className="form-error catalog-feedback" role="alert">{getErrorMessage(quickWater.error)}</p> : null}
          <DailyDashboard
            data={daily.data}
            onQuickWater={() => quickWater.mutate(250)}
            quickWaterPending={quickWater.isPending}
          />
        </>
      ) : null}
    </main>
  )
}
