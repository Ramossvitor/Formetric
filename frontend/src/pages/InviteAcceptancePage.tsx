import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useLayoutEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { getErrorMessage } from '../api/http'
import { acceptInvite } from '../auth/api'
import { sessionQuery } from '../auth/queries'
import { inviteSchema, type InviteFormValues } from '../auth/schemas'
import { Brand } from '../components/Brand'

export function InviteAcceptancePage() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const location = useLocation()
  const [{ token, cleanLocation, shouldReplace }] = useState(() => {
    const fragment = new URLSearchParams(location.hash.startsWith('#') ? location.hash.slice(1) : location.hash)
    const query = new URLSearchParams(location.search)
    const hadLegacyQueryToken = query.has('token')
    query.delete('token')
    const cleanSearch = query.toString()

    return {
      token: fragment.get('token')?.trim() ?? '',
      cleanLocation: {
        pathname: location.pathname,
        search: cleanSearch ? `?${cleanSearch}` : '',
        hash: '',
      },
      shouldReplace: Boolean(location.hash) || hadLegacyQueryToken,
    }
  })

  useLayoutEffect(() => {
    if (shouldReplace) navigate(cleanLocation, { replace: true })
  }, [cleanLocation, navigate, shouldReplace])
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<InviteFormValues>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { displayName: '', password: '', passwordConfirmation: '' },
  })
  const invitationMutation = useMutation({
    mutationFn: acceptInvite,
    onSuccess: (session) => {
      queryClient.clear()
      queryClient.setQueryData(sessionQuery.queryKey, session)
      navigate('/', { replace: true })
    },
  })

  if (!token) {
    return (
      <main className="auth-page" id="conteudo">
        <section className="auth-card compact-card" aria-labelledby="invalid-invite-title">
          <Brand />
          <div className="auth-heading">
            <p className="eyebrow">Convite</p>
            <h1 id="invalid-invite-title">Link incompleto</h1>
            <p>Abra o link completo recebido no convite para ativar sua conta.</p>
          </div>
          <Link className="secondary-link" to="/login">Voltar ao login</Link>
        </section>
      </main>
    )
  }

  return (
    <main className="auth-page" id="conteudo">
      <section className="auth-card" aria-labelledby="invite-title">
        <Brand />
        <div className="auth-heading">
          <p className="eyebrow">Seu espaço pessoal</p>
          <h1 id="invite-title">Ative sua conta</h1>
          <p>Escolha como quer ser chamado e crie uma senha segura.</p>
        </div>

        <form
          className="auth-form"
          noValidate
          onSubmit={(event) =>
            void handleSubmit(({ displayName, password }) =>
              invitationMutation.mutate({ token, displayName, password }),
            )(event)
          }
        >
          <div className="field-group">
            <label htmlFor="displayName">Nome</label>
            <input
              {...register('displayName')}
              aria-describedby={errors.displayName ? 'display-name-error' : undefined}
              aria-invalid={Boolean(errors.displayName)}
              autoComplete="name"
              id="displayName"
              type="text"
            />
            {errors.displayName ? (
              <span className="field-error" id="display-name-error">{errors.displayName.message}</span>
            ) : null}
          </div>

          <div className="field-group">
            <label htmlFor="new-password">Senha</label>
            <input
              {...register('password')}
              aria-describedby={errors.password ? 'new-password-error' : 'password-hint'}
              aria-invalid={Boolean(errors.password)}
              autoComplete="new-password"
              id="new-password"
              type="password"
            />
            <span className="field-hint" id="password-hint">Use entre 12 e 128 caracteres.</span>
            {errors.password ? <span className="field-error" id="new-password-error">{errors.password.message}</span> : null}
          </div>

          <div className="field-group">
            <label htmlFor="password-confirmation">Confirmar senha</label>
            <input
              {...register('passwordConfirmation')}
              aria-describedby={errors.passwordConfirmation ? 'password-confirmation-error' : undefined}
              aria-invalid={Boolean(errors.passwordConfirmation)}
              autoComplete="new-password"
              id="password-confirmation"
              type="password"
            />
            {errors.passwordConfirmation ? (
              <span className="field-error" id="password-confirmation-error">
                {errors.passwordConfirmation.message}
              </span>
            ) : null}
          </div>

          {invitationMutation.isError ? (
            <p className="form-error" role="alert">{getErrorMessage(invitationMutation.error)}</p>
          ) : null}

          <button className="submit-button" disabled={invitationMutation.isPending} type="submit">
            {invitationMutation.isPending ? 'Criando conta…' : 'Criar conta'}
          </button>
        </form>

        <p className="auth-footnote">Já ativou sua conta? <Link to="/login">Entrar</Link></p>
      </section>
    </main>
  )
}
