import { apiRequest } from '../api/http'

export type FormulaSex = 'MALE' | 'FEMALE'
export type EvaluationSource = 'SELF' | 'PROFESSIONAL' | 'IMPORT_CONFIRMED'
export type BodyProtocol = 'NONE' | 'JACKSON_POLLOCK_7_SIRI_1961'
export type ReportedMethodType = 'UNSPECIFIED' | 'SKINFOLD' | 'BIOIMPEDANCE' | 'DXA' | 'OTHER'
export type ResultProvenance = 'REPORTED' | 'SYSTEM_CALCULATED' | 'SYSTEM_DERIVED_FROM_REPORTED'
export type ResultCompatibility = 'SAME_METHOD' | 'METHOD_CHANGED' | 'MISSING'
export type BodySide = 'UNSPECIFIED' | 'LEFT' | 'RIGHT'
export type BodyEvaluationArchiveStatus = 'ACTIVE' | 'ARCHIVED' | 'ALL'

export type CircumferenceSite =
  | 'NECK'
  | 'SHOULDERS'
  | 'CHEST'
  | 'ABDOMEN'
  | 'WAIST'
  | 'HIP'
  | 'LEFT_ARM'
  | 'RIGHT_ARM'
  | 'LEFT_THIGH'
  | 'RIGHT_THIGH'
  | 'LEFT_CALF'
  | 'RIGHT_CALF'

export type SkinfoldSite =
  | 'TRICEPS'
  | 'SUBSCAPULAR'
  | 'SUPRAILIAC'
  | 'CHEST'
  | 'MIDAXILLARY'
  | 'ABDOMEN'
  | 'THIGH'

export type BodyResultMetric =
  | 'BMI'
  | 'WAIST_HIP_RATIO'
  | 'CIRCUMFERENCE_SUM_CM'
  | 'SKINFOLD_SUM_MM'
  | 'BODY_DENSITY_G_PER_ML'
  | 'BODY_FAT_PERCENT'
  | 'FAT_MASS_KG'
  | 'FAT_FREE_MASS_PERCENT'
  | 'FAT_FREE_MASS_KG'
  | 'LEAN_BODY_MASS_KG'
  | 'LEAN_SOFT_TISSUE_MASS_KG'
  | 'SKELETAL_MUSCLE_MASS_KG'
  | 'UNSPECIFIED_LEAN_MASS_KG'

export interface CircumferenceValue {
  site: CircumferenceSite
  valueCm: number
}

export interface SkinfoldValue {
  site: SkinfoldSite
  side: BodySide
  valueMm: number
}

export interface ReportedBodyResultInput {
  metric: BodyResultMetric
  value: number
  reportedLabel: string | null
}

export interface BodyResult {
  id: string
  metric: BodyResultMetric
  value: number
  provenance: ResultProvenance
  methodCode: string
  methodRevision: number
  reportedLabel: string | null
  basisResultId: string | null
}

export interface BodyEvaluationVersionInput {
  assessmentDate: string
  title: string
  source: EvaluationSource
  assessorName: string | null
  notes: string | null
  weightKg: number | null
  heightCm: number | null
  ageYears: number | null
  formulaSex: FormulaSex | null
  protocol: BodyProtocol
  reportedMethodType: ReportedMethodType
  reportedMethodLabel: string | null
  circumferences: CircumferenceValue[]
  skinfolds: SkinfoldValue[]
  reportedResults: ReportedBodyResultInput[]
}

export interface CreateBodyEvaluationVersionRequest extends BodyEvaluationVersionInput {
  expectedCurrentVersionNumber: number
}

export interface EvaluationWarning {
  code: string
  message: string
}

export interface BodyEvaluationVersion extends Omit<BodyEvaluationVersionInput, 'reportedResults'> {
  id: string
  versionNumber: number
  protocolRevision: number | null
  results: BodyResult[]
  warnings: EvaluationWarning[]
  createdAt: string
}

export interface BodyEvaluationSummary {
  id: string
  archived: boolean
  currentVersion: BodyEvaluationVersion
  createdAt: string
  updatedAt: string
  identityVersion: number
}

export interface BodyEvaluationDetail extends BodyEvaluationSummary {
  versions: BodyEvaluationVersion[]
}

export interface BodyEvaluationPage {
  content: BodyEvaluationSummary[]
  page: number
  size: number
  totalElements: number
  totalPages: number
}

export interface BodyResultDelta {
  metric: BodyResultMetric
  provenance: ResultProvenance
  compatibility: ResultCompatibility
  baselineResult: BodyResult | null
  followUpResult: BodyResult | null
  delta: number | null
}

export interface CircumferenceDelta {
  site: CircumferenceSite
  baselineValueCm: number | null
  followUpValueCm: number | null
  deltaCm: number | null
}

export interface SkinfoldDelta {
  site: SkinfoldSite
  side: BodySide
  baselineValueMm: number | null
  followUpValueMm: number | null
  deltaMm: number | null
}

export interface BodyEvaluationComparisonPoint {
  evaluationId: string
  versionId: string
  versionNumber: number
  assessmentDate: string
  title: string
  source: EvaluationSource
  weightKg: number | null
  formulaSex: FormulaSex | null
  protocol: BodyProtocol
  protocolRevision: number | null
  reportedMethodType: ReportedMethodType
  reportedMethodLabel: string | null
}

export interface BodyEvaluationComparison {
  baseline: BodyEvaluationComparisonPoint
  followUp: BodyEvaluationComparisonPoint
  daysBetween: number
  weightDeltaKg: number | null
  resultDeltas: BodyResultDelta[]
  circumferenceDeltas: CircumferenceDelta[]
  skinfoldDeltas: SkinfoldDelta[]
  circumferenceSumDeltaCm: number | null
  skinfoldSumDeltaMm: number | null
  warnings: EvaluationWarning[]
}

export interface EvaluationListFilters {
  from: string
  to: string
  archiveStatus?: BodyEvaluationArchiveStatus
  page?: number
  size?: number
}

export function listBodyEvaluations(filters: EvaluationListFilters): Promise<BodyEvaluationPage> {
  const params = new URLSearchParams({
    page: String(filters.page ?? 0),
    size: String(filters.size ?? 20),
    archiveStatus: filters.archiveStatus ?? 'ACTIVE',
  })
  params.set('from', filters.from)
  params.set('to', filters.to)
  return apiRequest<BodyEvaluationPage>(`/api/v1/body-evaluations?${params.toString()}`)
}

export function getBodyEvaluation(id: string): Promise<BodyEvaluationDetail> {
  return apiRequest<BodyEvaluationDetail>(`/api/v1/body-evaluations/${encodeURIComponent(id)}`)
}

export function createBodyEvaluation(input: BodyEvaluationVersionInput): Promise<BodyEvaluationDetail> {
  return apiRequest<BodyEvaluationDetail>('/api/v1/body-evaluations', { method: 'POST', body: input, csrf: true })
}

export function createBodyEvaluationVersion(id: string, input: CreateBodyEvaluationVersionRequest): Promise<BodyEvaluationDetail> {
  return apiRequest<BodyEvaluationDetail>(`/api/v1/body-evaluations/${encodeURIComponent(id)}/versions`, {
    method: 'POST', body: input, csrf: true,
  })
}

export function archiveBodyEvaluation(id: string, expectedIdentityVersion: number): Promise<BodyEvaluationDetail> {
  return apiRequest<BodyEvaluationDetail>(`/api/v1/body-evaluations/${encodeURIComponent(id)}/archive`, {
    method: 'POST', body: { expectedIdentityVersion }, csrf: true,
  })
}

export function restoreBodyEvaluation(id: string, expectedIdentityVersion: number): Promise<BodyEvaluationDetail> {
  return apiRequest<BodyEvaluationDetail>(`/api/v1/body-evaluations/${encodeURIComponent(id)}/archive`, {
    method: 'DELETE', body: { expectedIdentityVersion }, csrf: true,
  })
}

export function compareBodyEvaluations(baselineVersionId: string, followUpVersionId: string): Promise<BodyEvaluationComparison> {
  const params = new URLSearchParams({ baselineVersionId, followUpVersionId })
  return apiRequest<BodyEvaluationComparison>(`/api/v1/body-evaluations/comparison?${params.toString()}`)
}
