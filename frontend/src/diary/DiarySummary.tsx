import { goalStates, number } from './format'
import type { DailyLog } from './api'

const nutrientLabels = {
  PROTEIN: 'Proteína',
  CARBOHYDRATE: 'Carboidratos',
  FAT: 'Gorduras',
  FIBER: 'Fibras',
  WATER: 'Água',
}

export function DiarySummary({ log }: { log: DailyLog }) {
  const energy = log.energyBalanceKcal
  const states = goalStates(log)

  return (
    <section aria-labelledby="diary-summary-title" className="diary-summary surface-card">
      <div className="diary-calories">
        <div>
          <p className="eyebrow">Consumido</p>
          <h2 id="diary-summary-title">{number(log.totals.kcal, 0)} <small>kcal</small></h2>
          {log.nutritionGoals ? <p>Meta planejada: {number(log.nutritionGoals.calorieTarget, 0)} kcal</p> : <p>Sem meta calórica vigente</p>}
        </div>
        <div className={energy == null ? 'energy-pill unavailable' : energy <= 0 ? 'energy-pill deficit' : 'energy-pill surplus'}>
          <span>{energy == null ? 'Saldo indisponível' : energy <= 0 ? 'Déficit' : 'Superávit'}</span>
          <strong>{energy == null ? 'Cadastre um TDEE para esta data' : `${energy > 0 ? '+' : ''}${number(energy, 0)} kcal`}</strong>
          {log.tdeeKcal != null ? <small>TDEE {number(log.tdeeKcal, 0)} kcal</small> : null}
        </div>
      </div>
      <dl className="diary-macro-grid">
        <div><dt>Proteína</dt><dd>{number(log.totals.proteinG)} g</dd></div>
        <div><dt>Carboidratos</dt><dd>{number(log.totals.carbohydrateG)} g</dd></div>
        <div><dt>Gorduras</dt><dd>{number(log.totals.fatG)} g</dd></div>
        <div><dt>Fibras</dt><dd>{number(log.totals.fiberG)} g</dd></div>
        <div><dt>Sódio</dt><dd>{log.totals.sodiumMg == null ? 'Incompleto' : `${number(log.totals.sodiumMg, 0)} mg`}</dd></div>
        <div><dt>Água</dt><dd>{number(log.waterTotalMl / 1000, 2)} L</dd></div>
      </dl>
      {states.length > 0 ? (
        <div className="goal-state-list" aria-label="Classificação das metas">
          {states.map(({ target, value, band }) => (
            <div className={`goal-state ${band?.tone.toLowerCase() ?? 'neutral'}`} key={target.nutrient}>
              <span>{nutrientLabels[target.nutrient]}</span>
              <strong>{number(target.nutrient === 'WATER' ? value / 1000 : value)} {target.nutrient === 'WATER' ? 'L' : 'g'}</strong>
              <small>{band?.label ?? 'Sem faixa correspondente'}</small>
            </div>
          ))}
        </div>
      ) : <p className="summary-footnote">Configure metas com faixas para classificar cada nutriente conforme seu próprio plano.</p>}
    </section>
  )
}
