import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router-dom'
import { ApiError, getErrorMessage } from '../api/http'
import { getProfile, updateProfile } from '../auth/api'
import { FullPageStatus } from '../auth/ProtectedRoute'
import { sessionQuery, useLogout } from '../auth/queries'
import { profileSchema, type ProfileFormValues } from '../auth/schemas'

const profileQueryKey = ['profile'] as const

export function ProfilePage() {
  const queryClient = useQueryClient()
  const profile = useQuery({ queryKey: profileQueryKey, queryFn: getProfile })
  const logout = useLogout()
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isDirty },
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      displayName: '',
      locale: 'pt-BR',
      timeZone: 'America/Sao_Paulo',
      unitSystem: 'METRIC',
      birthDate: '',
      formulaSex: '',
    },
  })

  useEffect(() => {
    if (!profile.data) return

    reset({
      displayName: profile.data.displayName,
      locale: profile.data.locale,
      timeZone: profile.data.timeZone,
      unitSystem: profile.data.unitSystem,
      birthDate: profile.data.birthDate ?? '',
      formulaSex: profile.data.formulaSex ?? '',
    })
  }, [profile.data, reset])

  const updateMutation = useMutation({
    mutationFn: (values: ProfileFormValues) =>
      updateProfile({
        ...values,
        birthDate: values.birthDate || null,
        formulaSex: values.formulaSex || null,
      }),
    onSuccess: (updatedProfile) => {
      queryClient.setQueryData(profileQueryKey, updatedProfile)
      queryClient.setQueryData(sessionQuery.queryKey, (currentSession) =>
        currentSession
          ? { ...currentSession, user: { ...currentSession.user, displayName: updatedProfile.displayName } }
          : currentSession,
      )
      reset({
        displayName: updatedProfile.displayName,
        locale: updatedProfile.locale,
        timeZone: updatedProfile.timeZone,
        unitSystem: updatedProfile.unitSystem,
        birthDate: updatedProfile.birthDate ?? '',
        formulaSex: updatedProfile.formulaSex ?? '',
      })
    },
    onError: (error) => {
      if (!(error instanceof ApiError)) return

      for (const fieldError of error.problem?.fieldErrors ?? []) {
        if (fieldError.field in profileSchema.shape) {
          setError(fieldError.field as keyof ProfileFormValues, { message: fieldError.message })
        }
      }
    },
  })

  if (profile.isPending) {
    return <FullPageStatus message="Carregando seu perfil…" />
  }

  if (profile.isError) {
    return (
      <FullPageStatus
        actionLabel="Tentar novamente"
        message={getErrorMessage(profile.error)}
        onAction={() => void profile.refetch()}
        tone="error"
      />
    )
  }

  return (
    <main id="conteudo">
      <header className="page-heading profile-heading">
        <div>
          <p className="eyebrow">Sua conta</p>
          <h1>Perfil</h1>
          <p className="heading-copy">Preferências usadas nos registros e cálculos.</p>
        </div>
      </header>

      <section className="profile-card surface-card" aria-labelledby="profile-data-title">
        <div className="section-heading profile-section-heading">
          <div>
            <p className="eyebrow">Informações pessoais</p>
            <h2 id="profile-data-title">Dados do perfil</h2>
          </div>
          <span className="status-chip">{profile.data.role}</span>
        </div>

        <form
          className="profile-form"
          noValidate
          onSubmit={(event) => void handleSubmit((values) => updateMutation.mutate(values))(event)}
        >
          <div className="field-group full-field">
            <label htmlFor="profile-email">E-mail</label>
            <input disabled id="profile-email" type="email" value={profile.data.email} />
            <span className="field-hint">O e-mail não pode ser alterado nesta versão.</span>
          </div>

          <div className="field-group full-field">
            <label htmlFor="profile-name">Nome</label>
            <input
              {...register('displayName')}
              aria-invalid={Boolean(errors.displayName)}
              id="profile-name"
              type="text"
            />
            {errors.displayName ? <span className="field-error">{errors.displayName.message}</span> : null}
          </div>

          <div className="field-group">
            <label htmlFor="profile-locale">Idioma</label>
            <input {...register('locale')} aria-invalid={Boolean(errors.locale)} id="profile-locale" type="text" />
            {errors.locale ? <span className="field-error">{errors.locale.message}</span> : null}
          </div>

          <div className="field-group">
            <label htmlFor="profile-time-zone">Fuso horário</label>
            <input
              {...register('timeZone')}
              aria-invalid={Boolean(errors.timeZone)}
              id="profile-time-zone"
              type="text"
            />
            {errors.timeZone ? <span className="field-error">{errors.timeZone.message}</span> : null}
          </div>

          <div className="field-group">
            <label htmlFor="profile-unit-system">Sistema de unidades</label>
            <select {...register('unitSystem')} id="profile-unit-system">
              <option value="METRIC">Métrico (kg, cm, ml)</option>
              <option value="IMPERIAL">Imperial (lb, in, fl oz)</option>
            </select>
          </div>

          <div className="field-group">
            <label htmlFor="profile-birth-date">Data de nascimento</label>
            <input {...register('birthDate')} id="profile-birth-date" type="date" />
          </div>

          <div className="field-group full-field">
            <label htmlFor="profile-formula-sex">Sexo usado em fórmulas corporais</label>
            <select {...register('formulaSex')} id="profile-formula-sex">
              <option value="">Não informado</option>
              <option value="MALE">Masculino</option>
              <option value="FEMALE">Feminino</option>
            </select>
            <span className="field-hint">Usado apenas quando uma fórmula exigir esse dado.</span>
          </div>

          {updateMutation.isError &&
          (!(updateMutation.error instanceof ApiError) ||
            !updateMutation.error.problem?.fieldErrors?.length) ? (
            <p className="form-error full-field" role="alert">{getErrorMessage(updateMutation.error)}</p>
          ) : null}
          {updateMutation.isSuccess ? (
            <p className="form-success full-field" role="status">Perfil atualizado.</p>
          ) : null}

          <div className="profile-actions full-field">
            <button className="submit-button" disabled={!isDirty || updateMutation.isPending} type="submit">
              {updateMutation.isPending ? 'Salvando…' : 'Salvar alterações'}
            </button>
            <button
              className="secondary-button logout-button"
              disabled={logout.isPending}
              onClick={() => logout.mutate()}
              type="button"
            >
              {logout.isPending ? 'Saindo…' : 'Sair da conta'}
            </button>
          </div>
          {logout.isError ? <p className="form-error full-field" role="alert">{getErrorMessage(logout.error)}</p> : null}
        </form>
      </section>

      <section className="profile-card settings-card surface-card" aria-labelledby="planning-settings-title">
        <div className="section-heading profile-section-heading">
          <div>
            <p className="eyebrow">Planejamento</p>
            <h2 id="planning-settings-title">Metas e energia</h2>
          </div>
        </div>
        <nav aria-label="Configurações de planejamento" className="settings-link-list">
          <Link className="settings-link" to="/settings/nutrition-goals">
            <span>
              <strong>Metas nutricionais</strong>
              <small>Calorias, macros, fibras, água e faixas históricas.</small>
            </span>
            <span aria-hidden="true">›</span>
          </Link>
          <Link className="settings-link" to="/settings/tdee">
            <span>
              <strong>TDEE</strong>
              <small>Gasto energético estimado e vigência de cada valor.</small>
            </span>
            <span aria-hidden="true">›</span>
          </Link>
        </nav>
      </section>

      <section className="profile-card settings-card surface-card" aria-labelledby="catalog-settings-title">
        <div className="section-heading profile-section-heading">
          <div>
            <p className="eyebrow">Biblioteca</p>
            <h2 id="catalog-settings-title">Alimentos e receitas</h2>
          </div>
        </div>
        <nav aria-label="Biblioteca de alimentos" className="settings-link-list">
          <Link className="settings-link" to="/foods">
            <span><strong>Alimentos</strong><small>Dados nutricionais, favoritos, porções e versões.</small></span>
            <span aria-hidden="true">›</span>
          </Link>
          <Link className="settings-link" to="/recipes">
            <span><strong>Receitas</strong><small>Ingredientes e cálculos por rendimento e porção.</small></span>
            <span aria-hidden="true">›</span>
          </Link>
        </nav>
      </section>
    </main>
  )
}
