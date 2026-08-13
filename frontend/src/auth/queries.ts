import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { getSession, logout } from './api'

export const sessionQuery = queryOptions({
  queryKey: ['auth', 'session'],
  queryFn: getSession,
  staleTime: 5 * 60 * 1000,
  retry: false,
})

export function useLogout() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  return useMutation({
    mutationFn: logout,
    onSuccess: () => {
      // Query and mutation caches may contain another account's private data.
      // Clear them before representing the browser as an anonymous session.
      queryClient.clear()
      queryClient.setQueryData(sessionQuery.queryKey, null)
      navigate('/login', { replace: true })
    },
  })
}
