import { formatPlainDate } from '../time/plainDate'
import type { WorkoutModality } from './api'

export const modalityLabels: Record<WorkoutModality, string> = {
  STRENGTH: 'Musculação',
  RUNNING: 'Corrida',
  WALKING: 'Caminhada',
  SOCCER: 'Futebol',
  BEACH_TENNIS: 'Beach tennis',
  CYCLING: 'Bicicleta',
  OTHER: 'Outra modalidade',
}

export function formatDate(value: string, locale = 'pt-BR') {
  return formatPlainDate(value, locale, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export function formatNumber(value: number, maximumFractionDigits = 1) {
  return value.toLocaleString('pt-BR', { maximumFractionDigits })
}

export function formatSignedWeight(value: number) {
  const sign = value > 0 ? '+' : value < 0 ? '−' : ''
  return `${sign}${formatNumber(Math.abs(value), 2)} kg`
}

export function formatDuration(minutes: number) {
  const hours = Math.floor(minutes / 60)
  const remainder = minutes % 60
  if (hours === 0) return `${remainder} min`
  if (remainder === 0) return `${hours}h`
  return `${hours}h${String(remainder).padStart(2, '0')}`
}
