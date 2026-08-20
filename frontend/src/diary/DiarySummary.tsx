import { formatGoalAmount, formatGoalComparison, formatGoalRange, number } from './format'
import type { DailyGoalProgress, DailyLog } from './api'
import type { Nutrient } from '../planning/api'

const nutrientLabels: Record<Nutrient, string> = {
  CALORIES: 'Calorias',
  PROTEIN: 'Proteína',
  CARBOHYDRATE: 'Carboidratos',
  FAT: 'Gorduras',
  FIBER: 'Fibras',
  WATER: 'Água',
}

const nutrientOrder: Record<Nutrient, number> = {
  CALORIES: 0,
  PROTEIN: 1,
  CARBOHYDRATE: 2,
  FAT: 3,
  FIBER: 4,
  WATER: 5,
}

function GoalState({ progress, final }: { progress: DailyGoalProgress; final: boolean }) {
  const comparison = formatGoalComparison(progress.reference, progress.nutrient)
  const state = progress.value == null
    ? 'Ainda não registrado'
    : progress.bandLabel ?? 'Sem faixa correspondente'
  const details = [
    state,
    comparison,
    progress.attained == null ? null : progress.attained ? 'meta atingida' : 'fora da meta',
  ].filter((item): item is string => item != null)

  return (
    <div
      aria-label={`${nutrientLabels[progress.nutrient]}: classificação ${final ? 'definitiva' : 'parcial'}, ${details.join(', ')}`}
      className={`goal-state ${progress.bandTone?.toLowerCase() ?? 'neutral'}`}
      role="group"
    >
      <span>{nutrientLabels[progress.nutrient]}</span>
      <strong>
        {progress.value == null ? 'Não informado' : formatGoalAmount(progress.value, progress.nutrient)}
        {progress.reference ? ` / meta ${formatGoalRange(progress.reference, progress.nutrient)}` : ''}
      </strong>
      <small>{details.join(' · ')}</small>
    </div>
  )
}

function latestClosureConfirmsFasting(log: DailyLog) {
  const latestClosure = [...log.stateEvents].reverse().find((event) => event.type === 'CLOSED')
  return log.status === 'CLOSED' && latestClosure?.fastingConfirmed === true
}

export function DiarySummary({ log }: { log: DailyLog }) {
  const energy = log.energyBalanceKcal
  const progress = [...log.goalProgress].sort(
    (first, second) => nutrientOrder[first.nutrient] - nutrientOrder[second.nutrient],
  )
  const hasCalorieClassification = progress.some((item) => item.nutrient === 'CALORIES')
  const nutritionRecorded = progress.some((item) => item.nutrient !== 'WATER' && item.value != null)
    || log.meals.some((meal) => meal.items.length > 0)
    || latestClosureConfirmsFasting(log)
  const final = log.status === 'CLOSED'
  const nutritionAmount = (value: number, unit: string) => nutritionRecorded
    ? `${number(value)} ${unit}`
    : 'Não informado'
  const unavailableBalanceMessage = log.tdeeKcal == null
    ? 'Cadastre um TDEE para esta data'
    : 'Registre alimentos ou confirme o jejum para calcular o saldo'

  return (
    <section aria-labelledby="diary-summary-title" className="diary-summary surface-card">
      <div className="diary-calories">
        <div>
          <p className="eyebrow">Consumido</p>
          <h2 id="diary-summary-title">
            {nutritionRecorded ? <>{number(log.totals.kcal, 0)} <small>kcal</small></> : 'Não informado'}
          </h2>
          {log.nutritionGoals ? (
            <p>
              {log.nutritionGoals.calorieTarget == null
                ? 'Meta nominal não configurada neste período'
                : `Meta nominal: ${number(log.nutritionGoals.calorieTarget, 0)} kcal`}
            </p>
          ) : <p>Sem meta calórica vigente</p>}
        </div>
        <div className={energy == null ? 'energy-pill unavailable' : energy <= 0 ? 'energy-pill deficit' : 'energy-pill surplus'}>
          <span>{energy == null ? 'Saldo indisponível' : energy <= 0 ? 'Déficit' : 'Superávit'}</span>
          <strong>{energy == null ? unavailableBalanceMessage : `${energy > 0 ? '+' : ''}${number(energy, 0)} kcal`}</strong>
          {log.tdeeKcal != null ? <small>TDEE {number(log.tdeeKcal, 0)} kcal</small> : null}
        </div>
      </div>
      <dl className="diary-macro-grid">
        <div><dt>Proteína</dt><dd>{nutritionAmount(log.totals.proteinG, 'g')}</dd></div>
        <div><dt>Carboidratos</dt><dd>{nutritionAmount(log.totals.carbohydrateG, 'g')}</dd></div>
        <div><dt>Gorduras</dt><dd>{nutritionAmount(log.totals.fatG, 'g')}</dd></div>
        <div><dt>Fibras</dt><dd>{nutritionAmount(log.totals.fiberG, 'g')}</dd></div>
        <div>
          <dt>Sódio</dt>
          <dd>
            {!nutritionRecorded
              ? 'Não informado'
              : log.totals.sodiumMg == null
                ? 'Incompleto'
                : `${number(log.totals.sodiumMg, 0)} mg`}
          </dd>
        </div>
        <div><dt>Água</dt><dd>{number(log.waterTotalMl / 1000, 2)} L</dd></div>
      </dl>
      {progress.length > 0 || (log.nutritionGoals && !hasCalorieClassification) ? (
        <div className="goal-state-list" aria-label="Classificação das metas">
          {log.nutritionGoals && !hasCalorieClassification ? (
            <div
              aria-label="Calorias: classificação não configurada neste período"
              className="goal-state neutral"
              role="group"
            >
              <span>Calorias</span>
              <strong>{nutritionRecorded ? `${number(log.totals.kcal, 0)} kcal` : 'Não informado'}</strong>
              <small>Classificação não configurada neste período legado</small>
            </div>
          ) : null}
          {progress.map((item) => <GoalState final={final} key={item.nutrient} progress={item} />)}
        </div>
      ) : <p className="summary-footnote">Configure metas com faixas para classificar cada nutriente conforme seu próprio plano.</p>}
      <p className="summary-footnote" role="note">
        {final
          ? 'As classificações são definitivas para este fechamento.'
          : 'As classificações são parciais enquanto o diário estiver aberto.'}{' '}
        A meta alimentar é independente do saldo energético calculado com o TDEE.
      </p>
    </section>
  )
}
