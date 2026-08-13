import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { subscribeToUnexpectedUnauthorized } from '../api/http'
import { safePrivateDestination } from './navigation'

export function UnexpectedUnauthorizedBoundary({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const location = useLocation()
  const locationRef = useRef(location)
  locationRef.current = location

  useEffect(() => subscribeToUnexpectedUnauthorized(() => {
    const current = locationRef.current
    const from = safePrivateDestination(`${current.pathname}${current.search}`)

    // Clearing the entire client prevents data from the expired account from
    // surviving into an eventual login by a different account.
    queryClient.clear()
    navigate('/login', {
      replace: true,
      state: { from, sessionExpired: true },
    })
  }), [navigate, queryClient])

  return children
}
