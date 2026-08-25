import { useId } from 'react'
import type { AnalyticsSeries } from './api'
import { useProfileTimeContext } from '../time/ProfileTimeContext'
import { availabilityLabels, formatDate, formatNumber, metricLabels } from './format'

const WIDTH = 800
const HEIGHT = 300
const PADDING_X = 54
const PADDING_TOP = 28
const PADDING_BOTTOM = 44

interface PlotPoint {
  x: number
  y: number
  date: string
  value: number
}

function segmentPaths(points: Array<PlotPoint | null>) {
  const segments: PlotPoint[][] = []
  let current: PlotPoint[] = []

  for (const point of points) {
    if (point) {
      current.push(point)
    } else if (current.length > 0) {
      segments.push(current)
      current = []
    }
  }
  if (current.length > 0) segments.push(current)
  return segments
}

export function TimeSeriesChart({ series }: { series: AnalyticsSeries }) {
  const { locale } = useProfileTimeContext()
  const accessibleId = useId()
  const values = series.points
    .filter((point) => point.availability === 'AVAILABLE' && point.value != null)
    .map((point) => point.value!)

  if (values.length === 0) {
    return (
      <div className="analytics-chart-empty">
        <strong>Nenhum ponto disponível</strong>
        <span>O período contém somente lacunas ou registros ainda inelegíveis.</span>
      </div>
    )
  }

  const rawMinimum = Math.min(...values)
  const rawMaximum = Math.max(...values)
  const valuePadding = rawMinimum === rawMaximum ? Math.max(Math.abs(rawMinimum) * 0.08, 1) : (rawMaximum - rawMinimum) * 0.08
  const minimum = rawMinimum - valuePadding
  const maximum = rawMaximum + valuePadding
  const plotHeight = HEIGHT - PADDING_TOP - PADDING_BOTTOM
  const plotWidth = WIDTH - PADDING_X * 2
  const denominator = Math.max(1, series.points.length - 1)
  const points: Array<PlotPoint | null> = series.points.map((point, index) => {
    if (point.availability !== 'AVAILABLE' || point.value == null) return null
    return {
      date: point.date,
      value: point.value,
      x: PADDING_X + (index / denominator) * plotWidth,
      y: PADDING_TOP + ((maximum - point.value) / (maximum - minimum)) * plotHeight,
    }
  })
  const segments = segmentPaths(points)
  const zeroY = minimum <= 0 && maximum >= 0
    ? PADDING_TOP + ((maximum - 0) / (maximum - minimum)) * plotHeight
    : null
  const middleIndex = Math.floor((series.points.length - 1) / 2)
  const dateTicks = [series.points[0], series.points[middleIndex], series.points.at(-1)]
    .filter((point, index, all) => point && all.findIndex((candidate) => candidate?.date === point.date) === index)

  return (
    <figure className="analytics-chart-figure">
      <svg aria-labelledby={`${accessibleId}-title ${accessibleId}-description`} preserveAspectRatio="xMidYMid meet" role="img" viewBox={`0 0 ${WIDTH} ${HEIGHT}`}>
        <title id={`${accessibleId}-title`}>{metricLabels[series.metric]} por dia</title>
        <desc id={`${accessibleId}-description`}>De {formatDate(series.from, locale)} a {formatDate(series.to, locale)}, com {values.length} de {series.points.length} pontos disponíveis. Lacunas interrompem a linha e não são interpoladas.</desc>
        <g className="chart-grid">
          {[0, 0.5, 1].map((ratio) => {
            const y = PADDING_TOP + ratio * plotHeight
            const value = maximum - ratio * (maximum - minimum)
            return <g key={ratio}><line x1={PADDING_X} x2={WIDTH - PADDING_X} y1={y} y2={y} /><text x={PADDING_X - 9} y={y + 4}>{formatNumber(value, series.metric === 'WEIGHT' ? 1 : 0)}</text></g>
          })}
        </g>
        {zeroY != null ? <line className="chart-zero-line" x1={PADDING_X} x2={WIDTH - PADDING_X} y1={zeroY} y2={zeroY} /> : null}
        <g className={`chart-series chart-series-${series.metric.toLowerCase().replace('_', '-')}`}>
          {segments.filter((segment) => segment.length > 1).map((segment) => (
            <polyline key={`${segment[0]!.date}-${segment.at(-1)!.date}`} points={segment.map((point) => `${point.x},${point.y}`).join(' ')} />
          ))}
          {points.map((point) => point ? <circle cx={point.x} cy={point.y} key={point.date} r={series.points.length > 100 ? 2 : 3.5}><title>{`${formatDate(point.date, locale)}: ${formatNumber(point.value, series.metric === 'WEIGHT' ? 2 : 1)} ${series.unit}`}</title></circle> : null)}
        </g>
        <g className="chart-date-ticks">
          {dateTicks.map((point) => {
            const index = series.points.findIndex((candidate) => candidate.date === point!.date)
            const x = PADDING_X + (index / denominator) * plotWidth
            return <text key={point!.date} textAnchor={index === 0 ? 'start' : index === series.points.length - 1 ? 'end' : 'middle'} x={x} y={HEIGHT - 12}>{formatDate(point!.date, locale)}</text>
          })}
        </g>
      </svg>
      <figcaption>Lacunas interrompem a linha; nenhum valor ausente é interpolado. Unidade: {series.unit}.</figcaption>
    </figure>
  )
}

export function AvailabilitySummary({ series }: { series: AnalyticsSeries }) {
  const counts = series.points.reduce<Partial<Record<string, number>>>((result, point) => {
    result[point.availability] = (result[point.availability] ?? 0) + 1
    return result
  }, {})

  return (
    <ul aria-label="Disponibilidade dos pontos" className="analytics-availability-list">
      {Object.entries(counts).map(([availability, count]) => (
        <li key={availability}><span className={`availability-dot availability-${availability.toLowerCase()}`} />{availabilityLabels[availability as keyof typeof availabilityLabels]}<strong>{count}</strong></li>
      ))}
    </ul>
  )
}
