import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useReducer, useRef } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { clearCsrfToken, getErrorMessage } from '../api/http'
import { ProfileTimeContextProvider } from '../time/ProfileTimeContext'
import { sessionQuery } from './queries'

export function ProtectedRoute() {
  const location = useLocation()
  const queryClient = useQueryClient()
  const session = useQuery(sessionQuery)
  const trustedUserId = useRef<string | null | undefined>(undefined)
  const [, finishIdentityTransition] = useReducer((value: number) => value + 1, 0)
  const sessionSettled = !session.isPending && !session.isError
  const currentUserId = session.data?.user.id ?? null

  if (sessionSettled && trustedUserId.current === undefined) {
    trustedUserId.current = currentUserId
  }

  const identityChanged = sessionSettled
    && trustedUserId.current !== undefined
    && trustedUserId.current !== currentUserId

  useEffect(() => {
    if (!identityChanged) return

    const freshSession = session.data ?? null
    trustedUserId.current = currentUserId
    clearCsrfToken()
    queryClient.clear()
    queryClient.setQueryData(sessionQuery.queryKey, freshSession)
    finishIdentityTransition()
  }, [currentUserId, identityChanged, queryClient, session.data])

  if (session.isPending) {
    return <FullPageStatus message="Verificando sua sessão…" />
  }

  if (session.isError) {
    return (
      <FullPageStatus
        actionLabel="Tentar novamente"
        message={getErrorMessage(session.error)}
        onAction={() => void session.refetch()}
        tone="error"
      />
    )
  }

  if (session.isFetching || identityChanged) {
    return <FullPageStatus message={identityChanged ? 'Protegendo a troca de conta…' : 'Atualizando sua sessão…'} />
  }

  if (!session.data) {
    return <Navigate replace state={{ from: `${location.pathname}${location.search}` }} to="/login" />
  }

  return <ProfileTimeContextProvider><Outlet /></ProfileTimeContextProvider>
}

export function OwnerRoute() {
  const session = useQuery(sessionQuery)

  if (session.isPending) {
    return <FullPageStatus message="Verificando suas permissões…" />
  }

  if (session.isError) {
    return (
      <FullPageStatus
        actionLabel="Tentar novamente"
        message={getErrorMessage(session.error)}
        onAction={() => void session.refetch()}
        tone="error"
      />
    )
  }

  if (session.data?.user.role !== 'OWNER') {
    return <Navigate replace to="/profile" />
  }

  return <Outlet />
}

interface FullPageStatusProps {
  message: string
  actionLabel?: string
  onAction?: () => void
  tone?: 'status' | 'error'
}

export function FullPageStatus({
  message,
  actionLabel,
  onAction,
  tone = 'status',
}: FullPageStatusProps) {
  return (
    <div className="route-status" role={tone === 'error' ? 'alert' : 'status'}>
      <span className="route-spinner" aria-hidden="true" />
      <p>{message}</p>
      {actionLabel && onAction ? (
        <button className="secondary-button" onClick={onAction} type="button">
          {actionLabel}
        </button>
      ) : null}
    </div>
  )
}
