import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react'
import { getErrorMessage } from '../api/http'
import type { ProfileTimeContext as ProfileTimeContextValue } from './api'
import { createMonotonicInstantClock, differenceInMilliseconds, type Instant } from './instant'
import { profileTimeContextQuery, profileTimeContextQueryKey } from './queries'

export interface ActiveProfileTimeContext extends ProfileTimeContextValue {
  currentInstant: () => Instant
}

const ProfileTimeContext = createContext<ActiveProfileTimeContext | null>(null)

export function nextDayDelayMilliseconds(context: ProfileTimeContextValue, currentInstant = context.serverNow) {
  return Math.max(0, differenceInMilliseconds(context.nextDayAt, currentInstant))
}

export function ProfileTimeContextProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const query = useQuery(profileTimeContextQuery)
  const value = useMemo<ActiveProfileTimeContext | null>(() => {
    if (!query.data) return null
    return { ...query.data, currentInstant: createMonotonicInstantClock(query.data.serverNow) }
  }, [query.data])

  useEffect(() => {
    if (!value) return

    const timer = window.setTimeout(() => {
      void queryClient.invalidateQueries({ queryKey: profileTimeContextQueryKey, refetchType: 'active' })
    }, nextDayDelayMilliseconds(value, value.currentInstant()))

    return () => window.clearTimeout(timer)
  }, [queryClient, value])

  if (query.isPending) {
    return <TimeContextStatus message="Sincronizando data e fuso do perfilâ€¦" />
  }

  if (query.isError) {
    return (
      <TimeContextStatus
        actionLabel="Tentar novamente"
        message={getErrorMessage(query.error)}
        onAction={() => void query.refetch()}
        tone="error"
      />
    )
  }

  return <ProfileTimeContext.Provider value={value}>{children}</ProfileTimeContext.Provider>
}

export function useProfileTimeContext() {
  const value = useContext(ProfileTimeContext)
  if (!value) throw new Error('useProfileTimeContext must be used inside ProfileTimeContextProvider')
  return value
}

function TimeContextStatus({
  message,
  actionLabel,
  onAction,
  tone = 'status',
}: {
  message: string
  actionLabel?: string
  onAction?: () => void
  tone?: 'status' | 'error'
}) {
  return (
    <div className="route-status" role={tone === 'error' ? 'alert' : 'status'}>
      <span aria-hidden="true" className="route-spinner" />
      <p>{message}</p>
      {actionLabel && onAction ? (
        <button className="secondary-button" onClick={onAction} type="button">{actionLabel}</button>
      ) : null}
    </div>
  )
}
