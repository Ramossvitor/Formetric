import type {
  BodyProtocol,
  BodyResultMetric,
  BodySide,
  CircumferenceSite,
  EvaluationSource,
  FormulaSex,
  ReportedMethodType,
  ResultCompatibility,
  ResultProvenance,
  SkinfoldSite,
} from './api'
import { formatPlainDate, wholeYearsBetweenPlainDates } from '../time/plainDate'

export const protocolLabels: Record<BodyProtocol, string> = {
  NONE: 'Sem protocolo calculado',
  JACKSON_POLLOCK_7_SIRI_1961: 'Jackson & Pollock 7 + Siri (1961)',
}
export const formulaSexLabels: Record<FormulaSex, string> = { MALE: 'Masculino', FEMALE: 'Feminino' }
export const sourceLabels: Record<EvaluationSource, string> = {
  SELF: 'Autoavaliação', PROFESSIONAL: 'Avaliação profissional', IMPORT_CONFIRMED: 'Importação revisada',
}
export const reportedMethodLabels: Record<ReportedMethodType, string> = {
  UNSPECIFIED: 'Não informado', SKINFOLD: 'Dobras cutâneas', BIOIMPEDANCE: 'Bioimpedância', DXA: 'DXA', OTHER: 'Outro',
}
export const circumferenceLabels: Record<CircumferenceSite, string> = {
  NECK: 'Pescoço', SHOULDERS: 'Ombros', CHEST: 'Tórax', ABDOMEN: 'Abdômen', WAIST: 'Cintura', HIP: 'Quadril', LEFT_ARM: 'Braço esquerdo', RIGHT_ARM: 'Braço direito', LEFT_THIGH: 'Coxa esquerda', RIGHT_THIGH: 'Coxa direita', LEFT_CALF: 'Panturrilha esquerda', RIGHT_CALF: 'Panturrilha direita',
}
export const skinfoldLabels: Record<SkinfoldSite, string> = {
  TRICEPS: 'Tricipital', SUBSCAPULAR: 'Subescapular', SUPRAILIAC: 'Supra-ilíaca', CHEST: 'Peitoral', MIDAXILLARY: 'Axilar média', ABDOMEN: 'Abdominal', THIGH: 'Coxa',
}
export const sideLabels: Record<BodySide, string> = { UNSPECIFIED: 'lado não informado', LEFT: 'esquerdo', RIGHT: 'direito' }
export const resultLabels: Record<BodyResultMetric, string> = {
  BMI: 'IMC', WAIST_HIP_RATIO: 'Relação cintura–quadril', CIRCUMFERENCE_SUM_CM: 'Soma de perimetrias', SKINFOLD_SUM_MM: 'Soma de dobras', BODY_DENSITY_G_PER_ML: 'Densidade corporal', BODY_FAT_PERCENT: 'Gordura corporal', FAT_FREE_MASS_PERCENT: 'Percentual de massa livre de gordura', FAT_MASS_KG: 'Massa gorda', FAT_FREE_MASS_KG: 'Massa livre de gordura (estimada)', LEAN_BODY_MASS_KG: 'Massa corporal magra informada', LEAN_SOFT_TISSUE_MASS_KG: 'Tecido mole magro informado', SKELETAL_MUSCLE_MASS_KG: 'Massa muscular esquelética informada', UNSPECIFIED_LEAN_MASS_KG: 'Massa magra não especificada no laudo',
}
export const provenanceLabels: Record<ResultProvenance, string> = {
  REPORTED: 'Informado no laudo', SYSTEM_CALCULATED: 'Calculado pelo sistema', SYSTEM_DERIVED_FROM_REPORTED: 'Derivado de valor informado',
}
export const compatibilityLabels: Record<ResultCompatibility, string> = {
  SAME_METHOD: 'Mesmo método', METHOD_CHANGED: 'Método alterado', MISSING: 'Dado ausente',
}
export const allCircumferences = Object.keys(circumferenceLabels) as CircumferenceSite[]
export const allSkinfolds = Object.keys(skinfoldLabels) as SkinfoldSite[]

export function formatBodyDate(value: string, locale = 'pt-BR') { return formatPlainDate(value, locale, { dateStyle: 'short' }) }
export function formatBodyNumber(value: number, digits = 2) { return value.toLocaleString('pt-BR', { maximumFractionDigits: digits }) }
export function resultUnit(metric: BodyResultMetric) {
  if (metric === 'BODY_FAT_PERCENT' || metric === 'FAT_FREE_MASS_PERCENT') return '%'
  if (['FAT_MASS_KG', 'FAT_FREE_MASS_KG', 'LEAN_BODY_MASS_KG', 'LEAN_SOFT_TISSUE_MASS_KG', 'SKELETAL_MUSCLE_MASS_KG', 'UNSPECIFIED_LEAN_MASS_KG'].includes(metric)) return ' kg'
  if (metric === 'CIRCUMFERENCE_SUM_CM') return ' cm'
  if (metric === 'SKINFOLD_SUM_MM') return ' mm'
  if (metric === 'BMI') return ' kg/m²'
  if (metric === 'BODY_DENSITY_G_PER_ML') return ' g/ml'
  return ''
}
export function formatResultValue(value: number, metric: BodyResultMetric) { return `${formatBodyNumber(value, metric === 'BODY_DENSITY_G_PER_ML' ? 4 : 2)}${resultUnit(metric)}` }
export function formatDelta(value: number | null, suffix: string) {
  if (value == null) return 'não informado'
  return `${value > 0 ? '+' : value < 0 ? '−' : ''}${formatBodyNumber(Math.abs(value), 2)}${suffix}`
}
export function ageOnDate(birthDate: string, assessmentDate: string): number | null {
  if (!birthDate || !assessmentDate) return null
  return wholeYearsBetweenPlainDates(birthDate, assessmentDate)
}
