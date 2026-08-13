import { useQuery } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router-dom'
import { getErrorMessage } from '../api/http'
import type { BodyResult, BodyResultDelta, ResultCompatibility } from '../body/api'
import {
  compatibilityLabels,
  circumferenceLabels,
  formatBodyDate,
  formatBodyNumber,
  formatDelta,
  formatResultValue,
  protocolLabels,
  provenanceLabels,
  resultLabels,
  sideLabels,
  skinfoldLabels,
} from '../body/format'
import { bodyEvaluationComparisonQuery, bodyEvaluationsQuery } from '../body/queries'

const dateAtOffset = (years: number) => { const date = new Date(); date.setFullYear(date.getFullYear() + years); return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 10) }

function ResultValue({ result }: { result: BodyResult | null }) {
  if (!result) return <span className="comparison-missing">não informado</span>
  return <span className="comparison-result-value"><strong>{formatResultValue(result.value, result.metric)}</strong><small>{provenanceLabels[result.provenance]} · {result.methodCode} r{result.methodRevision}</small></span>
}

function deltaSuffix(delta: BodyResultDelta) {
  if (delta.metric === 'BODY_FAT_PERCENT' || delta.metric === 'FAT_FREE_MASS_PERCENT') return ' p.p.'
  if (delta.metric.endsWith('_KG')) return ' kg'
  if (delta.metric.endsWith('_CM')) return ' cm'
  if (delta.metric.endsWith('_MM')) return ' mm'
  return ''
}

function compatibilityCopy(value: ResultCompatibility) {
  if (value === 'METHOD_CHANGED') return 'Métodos diferentes podem limitar a leitura deste delta.'
  if (value === 'MISSING') return 'Um dos pontos não possui este resultado; nenhum zero foi inferido.'
  return 'Método e proveniência compatíveis.'
}

function resultDeltaLabel(delta: BodyResultDelta) {
  if (delta.delta != null) return formatDelta(delta.delta, deltaSuffix(delta))
  if (delta.compatibility !== 'MISSING' && delta.baselineResult && delta.followUpResult) return 'não comparável'
  return 'não informado'
}

export function BodyEvaluationComparisonPage() {
  const [params, setParams] = useSearchParams(); const baselineId = params.get('baselineVersionId') ?? ''; const followUpId = params.get('followUpVersionId') ?? ''
  const choices = useQuery(bodyEvaluationsQuery(dateAtOffset(-5), dateAtOffset(0), 0, 'ACTIVE'))
  const comparison = useQuery(bodyEvaluationComparisonQuery(baselineId, followUpId))
  function setVersion(key: 'baselineVersionId' | 'followUpVersionId', value: string) { const next = new URLSearchParams(params); if (value) next.set(key, value); else next.delete(key); setParams(next, { replace: true }) }
  const versions = choices.data?.content.map((item) => item.currentVersion) ?? []
  const selectedVersions = [...new Set([baselineId, followUpId].filter((id) => id && !versions.some((version) => version.id === id)))]
  return <main id="conteudo">
    <header className="page-heading body-heading"><div><p className="eyebrow"><Link to="/progress/evaluations">Avaliações</Link> / comparação</p><h1>Comparar avaliações</h1><p className="heading-copy">Deltas determinísticos, com método e dados ausentes explicitados.</p></div></header>
    <section aria-label="Selecionar avaliações" className="comparison-picker surface-card"><label>Ponto inicial<select aria-describedby="comparison-picker-help" disabled={choices.isPending || choices.isError} onChange={(e) => setVersion('baselineVersionId', e.target.value)} value={baselineId}><option value="">Selecione</option>{selectedVersions.map((id) => <option key={`base-selected-${id}`} value={id}>Versão selecionada no histórico</option>)}{versions.map((version) => <option key={`base-${version.id}`} value={version.id}>{formatBodyDate(version.assessmentDate)} · {version.title} · v{version.versionNumber}</option>)}</select></label><span aria-hidden="true">→</span><label>Ponto final<select aria-describedby="comparison-picker-help" disabled={choices.isPending || choices.isError} onChange={(e) => setVersion('followUpVersionId', e.target.value)} value={followUpId}><option value="">Selecione</option>{selectedVersions.map((id) => <option key={`follow-selected-${id}`} value={id}>Versão selecionada no histórico</option>)}{versions.map((version) => <option key={`follow-${version.id}`} value={version.id}>{formatBodyDate(version.assessmentDate)} · {version.title} · v{version.versionNumber}</option>)}</select></label><p className="comparison-picker-help" id="comparison-picker-help">A seleção rápida mostra a primeira página de avaliações atuais. Para comparar versões históricas, use o link no detalhe de uma avaliação.</p></section>
    {choices.isError ? <div className="catalog-state compact-state" role="alert"><p>{getErrorMessage(choices.error)}</p><button className="secondary-button" onClick={() => void choices.refetch()} type="button">Recarregar opções</button></div> : null}
    {!baselineId || !followUpId ? <section className="empty-state body-empty surface-card"><h2>Escolha duas versões</h2><p>Você pode comparar avaliações diferentes ou duas versões da mesma avaliação.</p></section> : comparison.isPending ? <div className="catalog-state" role="status"><span className="route-spinner" /><p>Calculando comparação…</p></div> : comparison.isError ? <div className="catalog-state" role="alert"><p>{getErrorMessage(comparison.error)}</p><button className="secondary-button" onClick={() => void comparison.refetch()} type="button">Tentar novamente</button></div> : comparison.data ? <>
      <section aria-label="Pontos comparados" className="comparison-points"><article className="surface-card"><span>Inicial</span><h2>{comparison.data.baseline.title}</h2><time>{formatBodyDate(comparison.data.baseline.assessmentDate)}</time><strong>{comparison.data.baseline.weightKg == null ? 'não informado' : `${formatBodyNumber(comparison.data.baseline.weightKg)} kg`}</strong><small>{protocolLabels[comparison.data.baseline.protocol]}</small></article><div className="days-between"><strong>{comparison.data.daysBetween}</strong><span>dias</span></div><article className="surface-card"><span>Final</span><h2>{comparison.data.followUp.title}</h2><time>{formatBodyDate(comparison.data.followUp.assessmentDate)}</time><strong>{comparison.data.followUp.weightKg == null ? 'não informado' : `${formatBodyNumber(comparison.data.followUp.weightKg)} kg`}</strong><small>{protocolLabels[comparison.data.followUp.protocol]}</small></article></section>
      <p className="comparison-weight-delta"><span>Mudança de peso</span><strong>{formatDelta(comparison.data.weightDeltaKg, ' kg')}</strong></p>
      {comparison.data.warnings.length ? <section aria-labelledby="comparison-warnings" className="comparison-warnings surface-card"><h2 id="comparison-warnings">Cuidados nesta comparação</h2><ul>{comparison.data.warnings.map((warning) => <li key={`${warning.code}-${warning.message}`}><strong>{warning.code}</strong><span>{warning.message}</span></li>)}</ul><p>Extrapolações são estimativas matemáticas e não representam promessa ou avaliação clínica.</p></section> : null}
      <section aria-labelledby="composition-comparison" className="comparison-section"><div className="section-title-row"><div><p className="eyebrow">Composição corporal</p><h2 id="composition-comparison">Resultados e métodos</h2></div></div><div className="comparison-result-list">{comparison.data.resultDeltas.map((delta) => <article className={`comparison-result-card surface-card compatibility-${delta.compatibility.toLowerCase()}`} key={`${delta.metric}-${delta.provenance}`}><header><div><h3>{resultLabels[delta.metric]}</h3><span>{provenanceLabels[delta.provenance]}</span></div><span className="compatibility-chip">{compatibilityLabels[delta.compatibility]}</span></header><div className="comparison-values"><div><small>Inicial</small><ResultValue result={delta.baselineResult} /></div><strong aria-label="Mudança">{resultDeltaLabel(delta)}</strong><div><small>Final</small><ResultValue result={delta.followUpResult} /></div></div><p>{compatibilityCopy(delta.compatibility)}</p>{delta.metric === 'BODY_FAT_PERCENT' ? <small className="percentage-point-note">Mudança de gordura corporal exibida em pontos percentuais.</small> : null}{delta.metric === 'FAT_FREE_MASS_KG' ? <small className="fat-free-explanation">Inclui água, ossos, órgãos e músculos; não equivale a massa muscular.</small> : null}</article>)}</div></section>
      <section aria-labelledby="measure-comparison" className="comparison-section"><div className="section-title-row"><div><p className="eyebrow">Perimetrias</p><h2 id="measure-comparison">Mudanças nas medidas</h2></div><span className="comparison-total">Soma: {formatDelta(comparison.data.circumferenceSumDeltaCm, ' cm')}</span></div><div className="site-delta-grid">{comparison.data.circumferenceDeltas.map((delta) => <article className="surface-card" key={delta.site}><h3>{circumferenceLabels[delta.site]}</h3><span>{delta.baselineValueCm == null ? 'não informado' : `${formatBodyNumber(delta.baselineValueCm)} cm`} → {delta.followUpValueCm == null ? 'não informado' : `${formatBodyNumber(delta.followUpValueCm)} cm`}</span><strong>{formatDelta(delta.deltaCm, ' cm')}</strong></article>)}</div>{comparison.data.circumferenceSumDeltaCm == null ? <p className="comparison-missing-note">A soma não possui um conjunto de perimetrias comparável entre os dois snapshots.</p> : null}</section>
      <section aria-labelledby="skinfold-comparison" className="comparison-section"><div className="section-title-row"><div><p className="eyebrow">Dobras cutâneas</p><h2 id="skinfold-comparison">Mudanças por local</h2></div><span className="comparison-total">Soma: {formatDelta(comparison.data.skinfoldSumDeltaMm, ' mm')}</span></div><div className="site-delta-grid">{comparison.data.skinfoldDeltas.map((delta) => <article className="surface-card" key={`${delta.site}-${delta.side}`}><h3>{skinfoldLabels[delta.site]} <small>({sideLabels[delta.side]})</small></h3><span>{delta.baselineValueMm == null ? 'não informado' : `${formatBodyNumber(delta.baselineValueMm)} mm`} → {delta.followUpValueMm == null ? 'não informado' : `${formatBodyNumber(delta.followUpValueMm)} mm`}</span><strong>{formatDelta(delta.deltaMm, ' mm')}</strong></article>)}</div>{comparison.data.skinfoldSumDeltaMm == null ? <p className="comparison-missing-note">A soma não possui as sete dobras completas e comparáveis nos mesmos locais e lados.</p> : null}</section>
    </> : null}
  </main>
}
