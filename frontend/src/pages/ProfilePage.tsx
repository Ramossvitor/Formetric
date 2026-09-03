import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { ApiError, getErrorMessage } from '../api/http'
import { invalidateAnalytics } from '../analytics/queries'
import { getProfile, updateProfile, type UserProfile } from '../auth/api'
import { FullPageStatus } from '../auth/ProtectedRoute'
import { sessionQuery, useLogout } from '../auth/queries'
import {
  profileSchema,
  selectableLocales,
  selectableTimeZones,
  selectableUnitSystem,
  type ProfileFormValues,
} from '../auth/schemas'
import { profileTimeContextQueryKey } from '../time/queries'

const profileQueryKey = ['profile'] as const

const localeLabels: Record<(typeof selectableLocales)[number], string> = {
  'pt-BR': 'Português (Brasil)',
}

const timeZoneLabels: Record<(typeof selectableTimeZones)[number], string> = {
  'America/Sao_Paulo': 'Brasília (UTC−3)',
  'America/Bahia': 'Bahia (UTC−3)',
  'America/Belem': 'Belém (UTC−3)',
  'America/Fortaleza': 'Fortaleza (UTC−3)',
  'America/Recife': 'Recife (UTC−3)',
  'America/Noronha': 'Fernando de Noronha (UTC−2)',
  'America/Cuiaba': 'Cuiabá (UTC−4)',
  'America/Manaus': 'Manaus (UTC−4)',
  'America/Rio_Branco': 'Rio Branco (UTC−5)',
}

function isListed(list: readonly string[], value: string) {
  return list.includes(value)
}

// Perfis anteriores aceitavam idioma e fuso como texto livre, então o valor gravado pode não estar
// na lista. Ele entra no formulário como está — exibido como opção desabilitada — e só sai quando o
// usuário escolhe um da lista, o mesmo tratamento que o sistema imperial já recebe.
function storedFormValues(profile: UserProfile): ProfileFormValues {
  return {
    displayName: profile.displayName,
    locale: profile.locale as ProfileFormValues['locale'],
    timeZone: profile.timeZone as ProfileFormValues['timeZone'],
    unitSystem: profile.unitSystem,
    birthDate: profile.birthDate ?? '',
    formulaSex: profile.formulaSex ?? '',
  }
}

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
      unitSystem: selectableUnitSystem,
      birthDate: '',
      formulaSex: '',
    },
  })

  useEffect(() => {
    if (!profile.data) return

    reset(storedFormValues(profile.data))
  }, [profile.data, reset])

  const updateMutation = useMutation({
    mutationFn: (values: ProfileFormValues) =>
      updateProfile({
        ...values,
        birthDate: values.birthDate || null,
        formulaSex: values.formulaSex || null,
      }),
    onSuccess: async (updatedProfile) => {
      const temporalPreferencesChanged =
        profile.data?.timeZone !== updatedProfile.timeZone || profile.data?.locale !== updatedProfile.locale
      queryClient.setQueryData(profileQueryKey, updatedProfile)
      queryClient.setQueryData(sessionQuery.queryKey, (currentSession) =>
        currentSession
          ? { ...currentSession, user: { ...currentSession.user, displayName: updatedProfile.displayName } }
          : currentSession,
      )
      reset(storedFormValues(updatedProfile))
      if (temporalPreferencesChanged) {
        await queryClient.invalidateQueries({ queryKey: profileTimeContextQueryKey, refetchType: 'active' })
      }
      void invalidateAnalytics(queryClient)
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
              autoCapitalize="words"
              autoComplete="name"
              id="profile-name"
              type="text"
            />
            {errors.displayName ? <span className="field-error">{errors.displayName.message}</span> : null}
          </div>

          <div className="field-group">
            <label htmlFor="profile-locale">Idioma</label>
            <select {...register('locale')} aria-invalid={Boolean(errors.locale)} id="profile-locale">
              {isListed(selectableLocales, profile.data.locale) ? null : (
                <option disabled value={profile.data.locale}>{profile.data.locale} (valor atual; escolha um da lista)</option>
              )}
              {selectableLocales.map((locale) => <option key={locale} value={locale}>{localeLabels[locale]}</option>)}
            </select>
            {errors.locale ? <span className="field-error">{errors.locale.message}</span> : null}
          </div>

          <div className="field-group">
            <label htmlFor="profile-time-zone">Fuso horário</label>
            <select {...register('timeZone')} aria-invalid={Boolean(errors.timeZone)} id="profile-time-zone">
              {isListed(selectableTimeZones, profile.data.timeZone) ? null : (
                <option disabled value={profile.data.timeZone}>{profile.data.timeZone} (valor atual; escolha um da lista)</option>
              )}
              {selectableTimeZones.map((timeZone) => <option key={timeZone} value={timeZone}>{timeZoneLabels[timeZone]}</option>)}
            </select>
            {errors.timeZone ? <span className="field-error">{errors.timeZone.message}</span> : null}
          </div>

          <div className="field-group">
            <label htmlFor="profile-unit-system">Sistema de unidades</label>
            <select {...register('unitSystem')} id="profile-unit-system">
              {profile.data.unitSystem === 'IMPERIAL' ? (
                <option disabled value="IMPERIAL">Imperial (configuração atual; ainda não suportado)</option>
              ) : null}
              <option value={selectableUnitSystem}>Métrico (kg, cm, ml)</option>
            </select>
            <span className="field-hint">
              {profile.data.unitSystem === 'IMPERIAL'
                ? 'Imperial em breve. O perfil continuará marcado como imperial até você escolher Métrico e salvar; a interface atual usa kg, cm e ml.'
                : 'Imperial em breve. Nesta versão, a interface usa kg, cm e ml.'}
            </span>
          </div>

          <div className="field-group">
            <label htmlFor="profile-birth-date">Data de nascimento</label>
            <input {...register('birthDate')} autoComplete="bday" id="profile-birth-date" type="date" />
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
    </main>
  )
}
