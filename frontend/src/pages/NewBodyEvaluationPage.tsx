import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { getProfile } from '../auth/api'
import { BodyEvaluationForm } from '../body/BodyEvaluationForm'
import { createBodyEvaluation, type BodyEvaluationVersionInput } from '../body/api'
import { bodyEvaluationsQueryKey } from '../body/queries'

export function NewBodyEvaluationPage() {
  const navigate = useNavigate(); const queryClient = useQueryClient()
  const profile = useQuery({ queryKey: ['profile'], queryFn: getProfile, staleTime: 5 * 60 * 1000 })
  const create = useMutation({ mutationFn: (input: BodyEvaluationVersionInput) => createBodyEvaluation(input), onSuccess: async (detail) => { await queryClient.invalidateQueries({ queryKey: bodyEvaluationsQueryKey }); navigate(`/progress/evaluations/${detail.id}`, { replace: true }) } })
  return <main id="conteudo"><header className="page-heading body-heading"><div><p className="eyebrow"><Link to="/progress/evaluations">Avaliações</Link> / nova</p><h1>Nova avaliação corporal</h1><p className="heading-copy">Registre os dados e revise o snapshot antes de salvar.</p></div></header>{profile.isPending ? <div className="catalog-state" role="status"><span className="route-spinner" /><p>Preparando formulário…</p></div> : <><BodyEvaluationForm error={create.error} onCancel={() => navigate('/progress/evaluations')} onSubmit={(input) => create.mutate(input)} pending={create.isPending} profileSuggestion={profile.data ? { birthDate: profile.data.birthDate, formulaSex: profile.data.formulaSex, timeZone: profile.data.timeZone } : undefined} />{profile.isError ? <p className="body-profile-warning" role="note">Não foi possível carregar sugestões do perfil. Confirme data, idade e sexo de fórmula manualmente.</p> : null}</>}</main>
}
