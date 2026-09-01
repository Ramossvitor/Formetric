import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { getErrorMessage, resetUnexpectedUnauthorized } from '../api/http'
import { login } from '../auth/api'
import { safePrivateDestination } from '../auth/navigation'
import { FullPageStatus } from '../auth/ProtectedRoute'
import { sessionQuery } from '../auth/queries'
import { loginSchema, type LoginFormValues } from '../auth/schemas'
import { Brand } from '../components/Brand'

interface LoginLocationState {
  from?: string
  invitationAccepted?: boolean
  sessionExpired?: boolean
}

export function LoginPage() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const location = useLocation()
  const locationState = (location.state ?? {}) as LoginLocationState
  const session = useQuery(sessionQuery)
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  })
  const loginMutation = useMutation({
    mutationFn: login,
    onSuccess: (authenticatedSession) => {
      resetUnexpectedUnauthorized()
      queryClient.clear()
      queryClient.setQueryData(sessionQuery.queryKey, authenticatedSession)
      navigate(safePrivateDestination(locationState.from), { replace: true })
    },
  })

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

  if (session.data) {
    return <Navigate replace to={safePrivateDestination(locationState.from)} />
  }

  return (
    <main className="auth-page" id="conteudo">
      <section className="auth-card" aria-labelledby="login-title">
        <Brand />
        <div className="auth-heading">
          <p className="eyebrow">Bem-vindo de volta</p>
          <h1 id="login-title">Acesse sua conta</h1>
          <p>Acompanhe sua nutrição, seus treinos e sua evolução em um só lugar.</p>
        </div>

        {locationState.invitationAccepted ? (
          <p className="form-success" role="status">
            Conta criada com sucesso. Entre com seu e-mail e sua senha.
          </p>
        ) : null}
        {locationState.sessionExpired ? (
          <p className="form-error" role="status">
            Sua sessão expirou. Entre novamente para continuar.
          </p>
        ) : null}

        <form
          className="auth-form"
          noValidate
          onSubmit={(event) => void handleSubmit((values) => loginMutation.mutate(values))(event)}
        >
          <div className="field-group">
            <label htmlFor="email">E-mail</label>
            <input
              {...register('email')}
              aria-describedby={errors.email ? 'email-error' : undefined}
              aria-invalid={Boolean(errors.email)}
              autoComplete="email"
              id="email"
              inputMode="email"
              placeholder="voce@exemplo.com"
              type="email"
            />
            {errors.email ? <span className="field-error" id="email-error">{errors.email.message}</span> : null}
          </div>

          <div className="field-group">
            <label htmlFor="password">Senha</label>
            <input
              {...register('password')}
              aria-describedby={errors.password ? 'password-error' : undefined}
              aria-invalid={Boolean(errors.password)}
              autoComplete="current-password"
              enterKeyHint="go"
              id="password"
              type="password"
            />
            {errors.password ? <span className="field-error" id="password-error">{errors.password.message}</span> : null}
          </div>

          {loginMutation.isError ? (
            <p className="form-error" role="alert">{getErrorMessage(loginMutation.error)}</p>
          ) : null}

          <button className="submit-button" disabled={loginMutation.isPending} type="submit">
            {loginMutation.isPending ? 'Entrando…' : 'Entrar'}
          </button>
        </form>

        <p className="auth-footnote">
          O acesso ao beta é feito por convite. Já recebeu um?{' '}
          <Link to="/accept-invite">Ativar conta</Link>
        </p>
      </section>
    </main>
  )
}
