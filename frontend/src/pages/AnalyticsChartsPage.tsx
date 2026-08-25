import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { getErrorMessage } from '../api/http'
import type { AnalyticsMetric } from '../analytics/api'
import { metricLabels } from '../analytics/format'
import { analyticsSeriesQuery } from '../analytics/queries'
import { AvailabilitySummary, TimeSeriesChart } from '../analytics/TimeSeriesChart'
import { subtractPlainDateDays } from '../time/plainDate'
import { useProfileTimeContext } from '../time/ProfileTimeContext'

const metrics: AnalyticsMetric[] = ['CALORIES', 'PROTEIN', 'CARBOHYDRATE', 'FAT', 'FIBER', 'WATER', 'ENERGY_BALANCE', 'WEIGHT']
const ranges = [7, 30, 90, 180, 365] as const

export function AnalyticsChartsPage() {
  const { today } = useProfileTimeContext()
  const [metric, setMetric] = useState<AnalyticsMetric>('CALORIES')
  const [rangeDays, setRangeDays] = useState<(typeof ranges)[number]>(30)
  const to = today
  const from = subtractPlainDateDays(to, rangeDays - 1)
  const series = useQuery(analyticsSeriesQuery(metric, from, to))
  const error = series.error
  const pending = series.isPending

  return (
    <main id="conteudo">
      <header className="page-heading analytics-page-heading">
        <div><p className="eyebrow">Séries temporais</p><h1>Gráficos</h1><p className="heading-copy">Valores diários com lacunas e estados de disponibilidade preservados.</p></div>
        <Link className="secondary-button" to="/analytics/monthly">Ver resumo mensal</Link>
      </header>
      <nav aria-label="Seções de análises" className="analytics-tabs">
        <Link to="/analytics/monthly">Resumo mensal</Link>
        <Link aria-current="page" className="active" to="/analytics/charts">Gráficos</Link>
      </nav>

      <section aria-label="Configurar gráfico" className="analytics-chart-controls surface-card">
        <label><span>Métrica</span><select onChange={(event) => setMetric(event.target.value as AnalyticsMetric)} value={metric}>{metrics.map((item) => <option key={item} value={item}>{metricLabels[item]}</option>)}</select></label>
        <fieldset><legend>Intervalo</legend><div className="analytics-range-buttons">{ranges.map((days) => <button aria-pressed={rangeDays === days} className={rangeDays === days ? 'active' : ''} key={days} onClick={() => setRangeDays(days)} type="button">{days} dias</button>)}</div></fieldset>
      </section>

      {pending ? (
        <div className="catalog-state" role="status"><span className="route-spinner" /><p>Preparando a série…</p></div>
      ) : error ? (
        <div className="catalog-state" role="alert"><p>{getErrorMessage(error)}</p><button className="secondary-button" onClick={() => void series.refetch()} type="button">Tentar novamente</button></div>
      ) : series.data ? (
        <section aria-labelledby="chart-title" className="analytics-chart-panel surface-card">
          <div className="section-title-row">
            <div><p className="eyebrow">{rangeDays} dias</p><h2 id="chart-title">{metricLabels[series.data.metric]}</h2></div>
            <span className="result-count">{series.data.from} → {series.data.to}</span>
          </div>
          <TimeSeriesChart series={series.data} />
          <AvailabilitySummary series={series.data} />
          <p className="analytics-method-note" role="note">Nutrição e saldo energético históricos usam somente diários fechados. O gasto informado em treinos não é somado ao saldo.</p>
        </section>
      ) : null}
    </main>
  )
}
