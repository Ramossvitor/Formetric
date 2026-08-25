import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { ApiError, getErrorMessage } from '../api/http'
import { createInvite, type CreatedInvite } from '../auth/api'
import { createInviteSchema, type CreateInviteFormValues } from '../auth/schemas'
import { formatInstantDateTime } from '../time/instant'
import { useProfileTimeContext } from '../time/ProfileTimeContext'

const defaultInvite: CreateInviteFormValues = {
  email: '',
  role: 'USER',
  expiresInHours: 168,
}

interface InvitationResult extends Omit<CreatedInvite, 'token'> {
  acceptanceUrl: string
}

type CopyState = 'idle' | 'copying' | 'success' | 'error'

function acceptanceUrlFor(token: string) {
  const url = new URL('/accept-invite', window.location.origin)
  url.hash = new URLSearchParams({ token }).toString()
  return url.toString()
}

async function copyText(value: string, fallbackInput: HTMLInputElement | null) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value)
      return
    } catch {
      // A blocked Clipboard API can still use the browser's selection fallback.
    }
  }

  if (!fallbackInput || typeof document.execCommand !== 'function') {
    throw new Error('Copy unavailable')
  }

  fallbackInput.focus()
  fallbackInput.select()
  fallbackInput.setSelectionRange(0, fallbackInput.value.length)
  if (!document.execCommand('copy')) throw new Error('Copy unavailable')
}

export function InvitationsPage() {
  const { locale, timeZone } = useProfileTimeContext()
  const [result, setResult] = useState<InvitationResult | null>(null)
  const [copyState, setCopyState] = useState<CopyState>('idle')
  const resultHeadingRef = useRef<HTMLHeadingElement>(null)
  const linkInputRef = useRef<HTMLInputElement>(null)
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<CreateInviteFormValues>({
    resolver: zodResolver(createInviteSchema),
    defaultValues: defaultInvite,
  })

  const invitation = useMutation({
    mutationFn: createInvite,
    onMutate: () => {
      setResult(null)
      setCopyState('idle')
    },
    onSuccess: ({ token, ...createdInvite }) => {
      setResult({ ...createdInvite, acceptanceUrl: acceptanceUrlFor(token) })
      reset(defaultInvite)
    },
    onError: (error) => {
      if (!(error instanceof ApiError)) return

      for (const fieldError of error.problem?.fieldErrors ?? []) {
        if (fieldError.field in createInviteSchema.shape) {
          setError(fieldError.field as keyof CreateInviteFormValues, { message: fieldError.message })
        }
      }
    },
  })

  useEffect(() => {
    if (result) resultHeadingRef.current?.focus()
  }, [result])

  async function copyInvitation() {
    if (!result || copyState === 'copying') return

    setCopyState('copying')
    try {
      await copyText(result.acceptanceUrl, linkInputRef.current)
      setCopyState('success')
    } catch {
      setCopyState('error')
    }
  }

  const hasGeneralError = invitation.isError &&
    (!(invitation.error instanceof ApiError) || !invitation.error.problem?.fieldErrors?.length)

  return (
    <main id="conteudo">
      <header className="page-heading profile-heading">
        <div>
          <p className="eyebrow">Administração</p>
          <h1>Convites</h1>
          <p className="heading-copy">Crie acessos individuais e compartilhe o link por um canal privado.</p>
        </div>
      </header>

      <div className="invitation-layout">
        <section className="invitation-card surface-card" aria-labelledby="new-invitation-title">
          <div className="section-heading profile-section-heading">
            <div>
              <p className="eyebrow">Novo acesso</p>
              <h2 id="new-invitation-title">Convidar uma pessoa</h2>
            </div>
          </div>

          <form
            className="invitation-form"
            noValidate
            onSubmit={(event) => void handleSubmit((values) => invitation.mutate(values))(event)}
          >
            <div className="field-group full-field">
              <label htmlFor="invite-email">E-mail</label>
              <input
                {...register('email')}
                aria-describedby={errors.email ? 'invite-email-error' : 'invite-email-hint'}
                aria-invalid={Boolean(errors.email)}
                autoComplete="email"
                id="invite-email"
                maxLength={320}
                type="email"
              />
              <span className="field-hint" id="invite-email-hint">O convite só poderá criar uma conta para este e-mail.</span>
              {errors.email ? <span className="field-error" id="invite-email-error">{errors.email.message}</span> : null}
            </div>

            <div className="field-group">
              <label htmlFor="invite-role">Nível de acesso</label>
              <select
                {...register('role')}
                aria-describedby={errors.role ? 'invite-role-error' : 'invite-role-hint'}
                aria-invalid={Boolean(errors.role)}
                id="invite-role"
              >
                <option value="USER">Usuário</option>
                <option value="OWNER">Proprietário</option>
              </select>
              <span className="field-hint" id="invite-role-hint">Proprietários também podem criar novos convites.</span>
              {errors.role ? <span className="field-error" id="invite-role-error">{errors.role.message}</span> : null}
            </div>

            <div className="field-group">
              <label htmlFor="invite-expiry">Validade</label>
              <div className="number-with-unit">
                <input
                  {...register('expiresInHours', { valueAsNumber: true })}
                  aria-describedby={errors.expiresInHours ? 'invite-expiry-error' : 'invite-expiry-hint'}
                  aria-invalid={Boolean(errors.expiresInHours)}
                  id="invite-expiry"
                  inputMode="numeric"
                  max="720"
                  min="1"
                  step="1"
                  type="number"
                />
                <span>horas</span>
              </div>
              <span className="field-hint" id="invite-expiry-hint">Entre 1 hora e 30 dias.</span>
              {errors.expiresInHours ? <span className="field-error" id="invite-expiry-error">{errors.expiresInHours.message}</span> : null}
            </div>

            {hasGeneralError ? <p className="form-error full-field" role="alert">{getErrorMessage(invitation.error)}</p> : null}

            <button className="submit-button full-field" disabled={invitation.isPending} type="submit">
              {invitation.isPending ? 'Criando convite…' : 'Criar convite'}
            </button>
          </form>
        </section>

        {result ? (
          <section className="invitation-card invitation-result surface-card" aria-labelledby="invitation-result-title">
            <div className="section-heading profile-section-heading">
              <div>
                <p className="eyebrow">Pronto para compartilhar</p>
                <h2 id="invitation-result-title" ref={resultHeadingRef} tabIndex={-1}>Convite criado</h2>
              </div>
              <span className="status-chip">{result.role === 'OWNER' ? 'Proprietário' : 'Usuário'}</span>
            </div>

            <p className="form-success" role="status">Envie o link abaixo somente para {result.email}.</p>

            <div className="field-group invitation-link-field">
              <label htmlFor="invitation-link">Link de convite</label>
              <div className="invitation-link-row">
                <input
                  aria-describedby="invitation-link-hint"
                  id="invitation-link"
                  readOnly
                  ref={linkInputRef}
                  type="text"
                  value={result.acceptanceUrl}
                />
                <button
                  className="secondary-button"
                  disabled={copyState === 'copying'}
                  onClick={() => void copyInvitation()}
                  type="button"
                >
                  {copyState === 'copying' ? 'Copiando…' : copyState === 'success' ? 'Copiado' : 'Copiar link'}
                </button>
              </div>
              <span className="field-hint" id="invitation-link-hint">O token fica no fragmento do endereço e não é enviado em parâmetros de consulta.</span>
              <span aria-live="polite" className={copyState === 'error' ? 'field-error copy-status' : 'field-hint copy-status'}>
                {copyState === 'success' ? 'Link copiado para a área de transferência.' : null}
                {copyState === 'error' ? 'Não foi possível copiar automaticamente. Selecione o link e copie manualmente.' : null}
              </span>
            </div>

            <dl className="invitation-metadata">
              <div><dt>Expira em</dt><dd>{formatInstantDateTime(result.expiresAt, locale, timeZone)}</dd></div>
              <div><dt>Identificador</dt><dd>{result.id}</dd></div>
            </dl>
          </section>
        ) : null}
      </div>
    </main>
  )
}
