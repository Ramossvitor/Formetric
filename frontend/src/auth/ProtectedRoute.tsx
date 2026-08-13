import { useQuery } from '@tanstack/react-query'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { getErrorMessage } from '../api/http'
import { sessionQuery } from './queries'

export function ProtectedRoute() {
  const location = useLocation()
  const session = useQuery(sessionQuery)

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

  if (!session.data) {
    return <Navigate replace state={{ from: `${location.pathname}${location.search}` }} to="/login" />
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
