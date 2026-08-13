import type { AnalyticsAvailability, AnalyticsMetric, DiaryAnalyticsStatus, NutrientType } from './api'
import type { WorkoutModality } from '../activity/api'
import { modalityLabels } from '../activity/format'

const numberFormatters = new Map<number, Intl.NumberFormat>()

export const metricLabels: Record<AnalyticsMetric, string> = {
  CALORIES: 'Calorias',
  PROTEIN: 'Proteína',
  CARBOHYDRATE: 'Carboidratos',
  FAT: 'Gorduras',
  FIBER: 'Fibras',
  WATER: 'Água',
  ENERGY_BALANCE: 'Saldo energético',
  WEIGHT: 'Peso',
}

export const nutrientLabels: Record<NutrientType, string> = {
  PROTEIN: 'Proteína',
  CARBOHYDRATE: 'Carboidratos',
  FAT: 'Gorduras',
  FIBER: 'Fibras',
  WATER: 'Água',
}

export const availabilityLabels: Record<AnalyticsAvailability, string> = {
  AVAILABLE: 'Disponível',
  MISSING_LOG: 'Diário não registrado',
  OPEN_LOG: 'Diário ainda aberto',
  MISSING_VALUE: 'Valor não informado',
  MISSING_TDEE: 'TDEE não configurado',
}

export const diaryStatusLabels: Record<DiaryAnalyticsStatus, string> = {
  MISSING: 'Sem diário',
  OPEN: 'Em andamento',
  CLOSED: 'Fechado',
}

export function formatNumber(value: number, maximumFractionDigits = 0) {
  let formatter = numberFormatters.get(maximumFractionDigits)
  if (!formatter) {
    formatter = new Intl.NumberFormat('pt-BR', { maximumFractionDigits })
    numberFormatters.set(maximumFractionDigits, formatter)
  }
  return formatter.format(value)
}

export function formatSigned(value: number, unit: string, fractionDigits = 0) {
  const prefix = value > 0 ? '+' : value < 0 ? '−' : ''
  return `${prefix}${formatNumber(Math.abs(value), fractionDigits)} ${unit}`
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' })
    .format(new Date(`${value}T12:00:00`))
    .replace('.', '')
}

export function formatLongDate(value: string) {
  return new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })
    .format(new Date(`${value}T12:00:00`))
}

export function formatMonth(value: string) {
  const [year, month] = value.split('-').map(Number)
  const label = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' })
    .format(new Date(year!, month! - 1, 1))
  return label.charAt(0).toUpperCase() + label.slice(1)
}

export function formatDuration(totalMinutes: number) {
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours === 0) return `${minutes} min`
  if (minutes === 0) return `${hours}h`
  return `${hours}h${String(minutes).padStart(2, '0')}`
}

export function formatWorkoutModality(value: string) {
  return Object.prototype.hasOwnProperty.call(modalityLabels, value)
    ? modalityLabels[value as WorkoutModality]
    : value
}
