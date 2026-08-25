import type { QueryClient } from '@tanstack/react-query'
import type { ProfileTimeContext } from '../time/api'
import { parseInstant } from '../time/instant'
import { parsePlainDate } from '../time/plainDate'
import { profileTimeContextQueryKey } from '../time/queries'

export const fixedProfileTimeContext: ProfileTimeContext = {
  serverNow: parseInstant('2026-08-12T11:10:00Z'),
  today: parsePlainDate('2026-08-12'),
  timeZone: 'America/Sao_Paulo',
  locale: 'pt-BR',
  nextDayAt: parseInstant('2026-08-13T03:00:00Z'),
}

export function seedProfileTimeContext(queryClient: QueryClient, value = fixedProfileTimeContext) {
  queryClient.setQueryData(profileTimeContextQueryKey, value)
}
