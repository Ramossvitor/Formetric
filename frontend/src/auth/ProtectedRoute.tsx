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

  if (!session.data) {
    return <Navigate replace state={{ from: `${location.pathname}${location.search}` }} to="/login" />
  }

  // Enquanto a sessão é revalidada, os dados da conta atual saem de vista: se o cookie tiver
  // passado a outra conta, quem está olhando a tela não pode ver o que era da anterior. A barreira
  // é a mesma de antes; o que mudou é ela não DESMONTAR mais a aplicação.
  //
  // Desmontar custava caro num app instalado, onde `refetchOnWindowFocus: 'always'` dispara a cada
  // volta para o app: diálogo aberto, rascunho de formulário e posição de rolagem eram destruídos
  // várias vezes por sessão, porque todo o estado de React abaixo daqui morria junto. Mantendo a
  // árvore montada sob `visibility: hidden` — que também a tira da árvore de acessibilidade — mais
  // `inert`, que bloqueia foco e ponteiro, a proteção continua valendo e o trabalho do usuário
  // sobrevive.
  const shielded = session.isFetching || identityChanged

  return (
    <>
      {shielded ? (
        <FullPageStatus
          message={identityChanged ? 'Protegendo a troca de conta…' : 'Atualizando sua sessão…'}
          overlay
        />
      ) : null}
      <div
        className="identity-shield"
        inert={shielded}
        // O ocultamento fica aqui, e não numa classe de CSS, porque é uma garantia de segurança:
        // ligada à condição que a produz, não pode ser desfeita por alguém editando uma folha de
        // estilo sem perceber o que ela sustentava — e continua verificável em teste.
        style={shielded ? { visibility: 'hidden' } : undefined}
      >
        <ProfileTimeContextProvider><Outlet /></ProfileTimeContextProvider>
      </div>
    </>
  )
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
  /** Cobre a aplicação em vez de substituí-la, para o estado por baixo sobreviver à espera. */
  overlay?: boolean
}

export function FullPageStatus({
  message,
  actionLabel,
  onAction,
  tone = 'status',
  overlay = false,
}: FullPageStatusProps) {
  return (
    <div className={overlay ? 'route-status route-status-overlay' : 'route-status'} role={tone === 'error' ? 'alert' : 'status'}>
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
