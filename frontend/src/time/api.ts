import { apiRequest } from '../api/http'
import type { Instant } from './instant'
import type { PlainDate } from './plainDate'

export interface ProfileTimeContext {
  serverNow: Instant
  today: PlainDate
  timeZone: string
  locale: string
  nextDayAt: Instant
}

export function getProfileTimeContext(): Promise<ProfileTimeContext> {
  return apiRequest<ProfileTimeContext>('/api/v1/profile/time-context')
}
