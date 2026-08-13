import { ApiError, apiRequest } from '../api/http'

export type WorkoutModality =
  | 'STRENGTH'
  | 'RUNNING'
  | 'WALKING'
  | 'SOCCER'
  | 'BEACH_TENNIS'
  | 'CYCLING'
  | 'OTHER'

export interface Workout {
  id: string
  date: string
  modality: WorkoutModality
  customModality: string | null
  title: string
  muscleGroups: string[]
  startTime: string | null
  durationMinutes: number
  estimatedKcal: number | null
  notes: string | null
  createdAt: string
  updatedAt: string
  version: number
}

export interface WorkoutInput {
  date: string
  modality: WorkoutModality
  customModality: string | null
  title: string
  muscleGroups: string[]
  startTime: string | null
  durationMinutes: number
  estimatedKcal: number | null
  notes: string | null
}

export interface WeightLog {
  date: string
  weightKg: number
  measuredAt: string
  condition: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
  version: number
}

export interface WeightLogInput {
  weightKg: number
  measuredAt: string
  condition: string | null
  notes: string | null
  version?: number
}

export interface MovingAverage {
  valueKg: number
  sampleCount: number
}

export interface WeightTrend {
  kgPerWeek: number
  sampleCount: number
  from: string
  to: string
}

export interface WeightOverview {
  entries: WeightLog[]
  currentWeightKg: number | null
  minimumWeightKg: number | null
  maximumWeightKg: number | null
  changeKg: number | null
  movingAverage7: MovingAverage | null
  movingAverage14: MovingAverage | null
  trend: WeightTrend | null
}

function intervalQuery(from: string, to: string) {
  return new URLSearchParams({ from, to }).toString()
}

export function listWorkouts(from: string, to: string): Promise<Workout[]> {
  return apiRequest<Workout[]>(`/api/v1/workouts?${intervalQuery(from, to)}`)
}

export function getWorkout(id: string): Promise<Workout> {
  return apiRequest<Workout>(`/api/v1/workouts/${id}`)
}

export function createWorkout(input: WorkoutInput, requestId: string): Promise<Workout> {
  return apiRequest<Workout>('/api/v1/workouts', {
    method: 'POST',
    body: { ...input, requestId },
    csrf: true,
  })
}

export function updateWorkout(workout: Workout, input: WorkoutInput): Promise<Workout> {
  return apiRequest<Workout>(`/api/v1/workouts/${workout.id}`, {
    method: 'PUT',
    body: { ...input, version: workout.version },
    csrf: true,
  })
}

export function deleteWorkout(id: string): Promise<void> {
  return apiRequest<void>(`/api/v1/workouts/${id}`, { method: 'DELETE', csrf: true })
}

export function listWeightLogs(from: string, to: string): Promise<WeightLog[]> {
  return apiRequest<WeightLog[]>(`/api/v1/weight-logs?${intervalQuery(from, to)}`)
}

export async function getWeightLog(date: string): Promise<WeightLog | null> {
  try {
    return await apiRequest<WeightLog>(`/api/v1/weight-logs/${date}`)
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null
    throw error
  }
}

export function getWeightOverview(from: string, to: string): Promise<WeightOverview> {
  return apiRequest<WeightOverview>(`/api/v1/weight-logs/overview?${intervalQuery(from, to)}`)
}

export function upsertWeightLog(date: string, input: WeightLogInput): Promise<WeightLog> {
  return apiRequest<WeightLog>(`/api/v1/weight-logs/${date}`, {
    method: 'PUT',
    body: input,
    csrf: true,
  })
}

export function deleteWeightLog(date: string): Promise<void> {
  return apiRequest<void>(`/api/v1/weight-logs/${date}`, { method: 'DELETE', csrf: true })
}
