import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getErrorMessage } from '../api/http'
import { BodyEvaluationForm } from '../body/BodyEvaluationForm'
import {
  archiveBodyEvaluation,
  createBodyEvaluationVersion,
  restoreBodyEvaluation,
  type BodyEvaluationVersion,
  type BodyEvaluationVersionInput,
  type BodyResult,
  type ResultProvenance,
} from '../body/api'
import {
  circumferenceLabels,
  formatBodyDate,
  formatBodyNumber,
  formatResultValue,
  formulaSexLabels,
  protocolLabels,
  provenanceLabels,
  reportedMethodLabels,
  resultLabels,
  sideLabels,
  skinfoldLabels,
  sourceLabels,
} from '../body/format'
import { bodyEvaluationQuery, bodyEvaluationsQueryKey } from '../body/queries'
import { useProfileTimeContext } from '../time/ProfileTimeContext'

const provenanceOrder: ResultProvenance[] = ['REPORTED', 'SYSTEM_CALCULATED', 'SYSTEM_DERIVED_FROM_REPORTED']

function comparisonHref(first: BodyEvaluationVersion, second: BodyEvaluationVersion) {
  const [baseline, followUp] = [first, second].sort((left, right) => left.assessmentDate.localeCompare(right.assessmentDate)
    || left.versionNumber - right.versionNumber
    || left.id.localeCompare(right.id))
  return `/progress/evaluations/compare?baselineVersionId=${baseline!.id}&followUpVersionId=${followUp!.id}`
}

function ResultSection({ provenance, results }: { provenance: ResultProvenance; results: BodyResult[] }) {
  if (!results.length) return <section className={`body-result-section provenance-${provenance.toLowerCase()}`}><div className="body-result-title"><h3>{provenanceLabels[provenance]}</h3><span>{provenance}</span></div><p className="body-inline-missing">Nenhum resultado nesta origem.</p></section>
  return <section className={`body-result-section provenance-${provenance.toLowerCase()}`}><div className="body-result-title"><h3>{provenanceLabels[provenance]}</h3><span>{provenance}</span></div><dl className="body-result-grid">{results.map((result) => <div key={result.id}><dt>{result.reportedLabel || resultLabels[result.metric]}</dt><dd>{formatResultValue(result.value, result.metric)}</dd><small>{resultLabels[result.metric]} · método {result.methodCode} r{result.methodRevision}</small>{result.basisResultId ? <small>Derivado de resultado rastreável</small> : null}</div>)}</dl></section>
}

function VersionSnapshot({ version }: { version: BodyEvaluationVersion }) {
  return <div className="body-detail-grid">
    <section className="body-detail-card surface-card" aria-labelledby="snapshot-title"><div className="section-heading"><div><p className="eyebrow">Snapshot confirmado</p><h2 id="snapshot-title">Dados gerais</h2></div><span className="status-chip">v{version.versionNumber}</span></div><dl className="body-key-values"><div><dt>Data</dt><dd>{formatBodyDate(version.assessmentDate)}</dd></div><div><dt>Peso</dt><dd>{version.weightKg == null ? 'não informado' : `${formatBodyNumber(version.weightKg)} kg`}</dd></div><div><dt>Altura</dt><dd>{version.heightCm == null ? 'não informado' : `${formatBodyNumber(version.heightCm)} cm`}</dd></div><div><dt>Idade</dt><dd>{version.ageYears == null ? 'não informado' : `${version.ageYears} anos`}</dd></div><div><dt>Sexo de fórmula</dt><dd>{version.formulaSex == null ? 'não informado' : formulaSexLabels[version.formulaSex]}</dd></div><div><dt>Origem</dt><dd>{sourceLabels[version.source]}</dd></div><div><dt>Avaliador</dt><dd>{version.assessorName || 'não informado'}</dd></div><div><dt>Protocolo</dt><dd>{protocolLabels[version.protocol]}{version.protocolRevision == null ? '' : ` · revisão ${version.protocolRevision}`}</dd></div><div><dt>Método do laudo</dt><dd>{reportedMethodLabels[version.reportedMethodType]}{version.reportedMethodLabel ? ` · ${version.reportedMethodLabel}` : ''}</dd></div></dl>{version.notes ? <p className="detail-notes">{version.notes}</p> : null}</section>
    {version.warnings.length ? <section aria-labelledby="formula-warnings" className="body-warning-card surface-card"><div><p className="eyebrow">Limites da estimativa</p><h2 id="formula-warnings">Avisos da fórmula</h2></div><ul>{version.warnings.map((warning) => <li key={`${warning.code}-${warning.message}`}><strong>{warning.code}</strong><span>{warning.message}</span></li>)}</ul><p>Resultados extrapolados são estimativas matemáticas, não diagnóstico ou promessa clínica.</p></section> : null}
    <section className="body-detail-card body-results-card surface-card" aria-labelledby="composition-title"><div className="section-heading"><div><p className="eyebrow">Proveniência preservada</p><h2 id="composition-title">Resultados de composição</h2></div></div><p className="body-step-copy">Laudo profissional, cálculo e derivações ficam separados. Nenhum cálculo sobrescreve um valor informado.</p>{provenanceOrder.map((provenance) => <ResultSection key={provenance} provenance={provenance} results={version.results.filter((result) => result.provenance === provenance)} />)}<p className="fat-free-explanation"><strong>Massa livre de gordura (estimada)</strong> inclui água, ossos, órgãos e músculos; não é sinônimo de massa muscular.</p></section>
    <section className="body-detail-card surface-card" aria-labelledby="circumferences-title"><div className="section-heading"><div><p className="eyebrow">Perimetrias</p><h2 id="circumferences-title">Medidas corporais</h2></div><span className="history-count">{version.circumferences.length}</span></div>{version.circumferences.length ? <dl className="body-measure-list">{version.circumferences.map((item) => <div key={item.site}><dt>{circumferenceLabels[item.site]}</dt><dd>{formatBodyNumber(item.valueCm)} cm</dd></div>)}</dl> : <p className="body-inline-missing">não informado</p>}</section>
    <section className="body-detail-card surface-card" aria-labelledby="skinfolds-title"><div className="section-heading"><div><p className="eyebrow">Dobras cutâneas</p><h2 id="skinfolds-title">Pontos medidos</h2></div><span className="history-count">{version.skinfolds.length}</span></div>{version.skinfolds.length ? <dl className="body-measure-list">{version.skinfolds.map((item) => <div key={`${item.site}-${item.side}`}><dt>{skinfoldLabels[item.site]} <small>({sideLabels[item.side]})</small></dt><dd>{formatBodyNumber(item.valueMm)} mm</dd></div>)}</dl> : <p className="body-inline-missing">não informado</p>}</section>
  </div>
}

export function BodyEvaluationDetailPage() {
  const { today } = useProfileTimeContext(); const { id = '' } = useParams(); const [editingVersion, setEditingVersion] = useState<BodyEvaluationVersion | null>(null); const [viewingVersionId, setViewingVersionId] = useState<string | null>(null); const queryClient = useQueryClient(); const evaluation = useQuery(bodyEvaluationQuery(id))
  useEffect(() => { setEditingVersion(null); setViewingVersionId(null) }, [id])
  const createVersion = useMutation({ mutationFn: ({ input, expectedVersion }: { input: BodyEvaluationVersionInput; expectedVersion: number }) => createBodyEvaluationVersion(id, { ...input, expectedCurrentVersionNumber: expectedVersion }), onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: bodyEvaluationsQueryKey }); setEditingVersion(null) } })
  const archive = useMutation({ mutationFn: (restore: boolean) => restore ? restoreBodyEvaluation(id, evaluation.data!.identityVersion) : archiveBodyEvaluation(id, evaluation.data!.identityVersion), onSuccess: async () => { setEditingVersion(null); await queryClient.invalidateQueries({ queryKey: bodyEvaluationsQueryKey }) } })
  if (evaluation.isPending) return <main id="conteudo"><div className="catalog-state" role="status"><span className="route-spinner" /><p>Carregando avaliação…</p></div></main>
  if (evaluation.isError) return <main id="conteudo"><div className="catalog-state" role="alert"><p>{getErrorMessage(evaluation.error)}</p><button className="secondary-button" onClick={() => void evaluation.refetch()} type="button">Tentar novamente</button></div></main>
  const detail = evaluation.data; const current = detail.currentVersion
  const displayed = detail.versions.find((version) => version.id === viewingVersionId) ?? current
  const viewingHistorical = displayed.id !== current.id
  return <main id="conteudo">
    <header className="page-heading body-heading"><div><p className="eyebrow"><Link to="/progress/evaluations">Avaliações</Link> / {formatBodyDate(displayed.assessmentDate)}</p><h1>{displayed.title}</h1><p className="heading-copy">{sourceLabels[displayed.source]} · versão {displayed.versionNumber}{viewingHistorical ? ' · snapshot histórico' : ''}</p></div><div className="heading-actions">{viewingHistorical ? <button className="secondary-button" onClick={() => setViewingVersionId(null)} type="button">Ver versão atual</button> : null}{!detail.archived && !viewingHistorical ? <button className="submit-button" disabled={archive.isPending} onClick={() => { createVersion.reset(); setEditingVersion(current) }} type="button">Criar nova versão</button> : null}<button className={detail.archived ? 'secondary-button' : 'text-button danger-action'} disabled={archive.isPending || createVersion.isPending || Boolean(editingVersion)} onClick={() => { if (!detail.archived && !window.confirm(`Arquivar “${current.title}”? O histórico será preservado e poderá ser restaurado.`)) return; archive.mutate(detail.archived) }} type="button">{archive.isPending ? 'Salvando…' : detail.archived ? 'Restaurar' : 'Arquivar'}</button></div></header>
    {createVersion.isError || archive.isError ? <p className="form-error" role="alert">{getErrorMessage(createVersion.error ?? archive.error)}</p> : null}
    {editingVersion ? <section className="body-version-editor"><div className="version-warning"><strong>Correção como nova versão</strong><span>A versão {editingVersion.versionNumber} permanecerá imutável no histórico.</span></div><BodyEvaluationForm defaultAssessmentDate={today} error={createVersion.error} initialVersion={editingVersion} onCancel={() => { createVersion.reset(); setEditingVersion(null) }} onSubmit={(input) => createVersion.mutate({ input, expectedVersion: editingVersion.versionNumber })} pending={createVersion.isPending} /></section> : <>
      <VersionSnapshot version={displayed} />
      <section className="body-history surface-card" aria-labelledby="body-history-title"><div className="section-heading"><div><p className="eyebrow">Rastreabilidade</p><h2 id="body-history-title">Histórico de versões</h2></div><span className="history-count">{detail.versions.length}</span></div><ol>{detail.versions.map((version, index) => <li key={version.id}><span className="version-number">v{version.versionNumber}</span><span><strong>{version.title}</strong><small>{formatBodyDate(version.assessmentDate)} · {protocolLabels[version.protocol]}</small></span><time dateTime={version.createdAt}>{new Date(version.createdAt).toLocaleDateString('pt-BR')}</time>{version.id === displayed.id ? <span className="status-chip">Em exibição</span> : <button aria-label={`Ver versão ${version.versionNumber}`} className="text-button" onClick={() => { setViewingVersionId(version.id); window.scrollTo({ top: 0, behavior: 'smooth' }) }} type="button">Ver versão</button>}{index > 0 ? <Link aria-label={`Comparar versão ${version.versionNumber} com a atual`} to={comparisonHref(version, current)}>Comparar</Link> : null}</li>)}</ol></section>
    </>}
  </main>
}
