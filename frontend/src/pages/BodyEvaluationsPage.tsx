import { useQuery } from '@tanstack/react-query'
import { useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getErrorMessage } from '../api/http'
import type { BodyEvaluationSummary } from '../body/api'
import { formatBodyDate, formatBodyNumber, protocolLabels, provenanceLabels, sourceLabels } from '../body/format'
import { bodyEvaluationsQuery } from '../body/queries'
import { Icon } from '../components/Icon'
import { useProfileTimeContext } from '../time/ProfileTimeContext'
import { subtractPlainDateYears } from '../time/plainDate'

interface Range { from: string; to: string }

function EvaluationCard({ evaluation, locale, selected, onSelect }: { evaluation: BodyEvaluationSummary; locale: string; selected: boolean; onSelect: () => void }) {
  const version = evaluation.currentVersion
  const bodyFatResults = version.results.filter((result) => result.metric === 'BODY_FAT_PERCENT')
  return <article className="body-evaluation-card surface-card">
    <label className="comparison-select"><input aria-label={`Selecionar ${version.title} para comparação`} checked={selected} onChange={onSelect} type="checkbox" /><span>Comparar</span></label>
    <Link aria-label={`Abrir ${version.title}`} className="body-evaluation-main" to={`/progress/evaluations/${evaluation.id}`}>
      <time dateTime={version.assessmentDate}><strong>{formatBodyDate(version.assessmentDate, locale)}</strong><small>v{version.versionNumber}</small></time>
      <div><span className="body-source-chip">{sourceLabels[version.source]}</span><h2>{version.title}</h2><p>{version.weightKg == null ? 'Peso não informado' : `${formatBodyNumber(version.weightKg)} kg`} · {protocolLabels[version.protocol]}</p></div>
      <span aria-hidden="true" className="body-card-chevron">›</span>
    </Link>
    {bodyFatResults.length ? <ul aria-label="Resultados de gordura corporal" className="body-card-results">{bodyFatResults.map((result) => <li className={`provenance-${result.provenance.toLowerCase()}`} key={result.id}><strong>{formatBodyNumber(result.value)}%</strong><span>{provenanceLabels[result.provenance]}</span></li>)}</ul> : <p className="body-card-missing">Gordura corporal: não informado</p>}
  </article>
}

export function BodyEvaluationsPage() {
  const { locale, today } = useProfileTimeContext()
  const initial = useMemo<Range>(() => ({ from: subtractPlainDateYears(today, 5), to: today }), [today])
  const [range, setRange] = useState(initial); const [draftRange, setDraftRange] = useState(initial)
  const [archived, setArchived] = useState(false); const [pageNumber, setPageNumber] = useState(0); const [selected, setSelected] = useState<string[]>([]); const [rangeError, setRangeError] = useState<string | null>(null)
  const navigate = useNavigate(); const query = useQuery(bodyEvaluationsQuery(range.from, range.to, pageNumber, archived ? 'ARCHIVED' : 'ACTIVE'))
  const visible = query.data?.content ?? []
  function applyRange(event: FormEvent) { event.preventDefault(); if (!draftRange.from || !draftRange.to || draftRange.from > draftRange.to) return setRangeError('Escolha um intervalo válido.'); setRangeError(null); setSelected([]); setPageNumber(0); setRange(draftRange) }
  function select(id: string) { setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : current.length < 2 ? [...current, id] : [current[1], id]) }
  function compare() {
    if (selected.length !== 2) return
    const versions = selected.flatMap((id) => {
      const version = query.data?.content.find((item) => item.id === id)?.currentVersion
      return version ? [version] : []
    }).sort((first, second) => first.assessmentDate.localeCompare(second.assessmentDate)
      || first.versionNumber - second.versionNumber
      || first.id.localeCompare(second.id))
    if (versions.length === 2) navigate(`/progress/evaluations/compare?baselineVersionId=${versions[0]!.id}&followUpVersionId=${versions[1]!.id}`)
  }
  return <main id="conteudo">
    <header className="page-heading body-heading"><div><p className="eyebrow">Evolução corporal</p><h1>Avaliações</h1><p className="heading-copy">Snapshots versionados de medidas, composição e protocolos.</p></div><div className="heading-actions"><Link className="secondary-button" to="/progress/weight"><Icon name="scale" size={18} /> Peso</Link><Link className="submit-button" to="/progress/evaluations/new"><Icon name="plus" size={18} /> Nova avaliação</Link></div></header>
    <form aria-label="Filtrar avaliações" className="body-filter surface-card" onSubmit={applyRange}><div className="field-group"><label htmlFor="body-from">De</label><input id="body-from" onChange={(e) => setDraftRange((current) => ({ ...current, from: e.target.value }))} type="date" value={draftRange.from} /></div><div className="field-group"><label htmlFor="body-to">Até</label><input id="body-to" onChange={(e) => setDraftRange((current) => ({ ...current, to: e.target.value }))} type="date" value={draftRange.to} /></div><button className="secondary-button" type="submit">Aplicar período</button><div aria-label="Status das avaliações" className="catalog-status-filter" role="group"><button aria-pressed={!archived} className={!archived ? 'filter-chip active' : 'filter-chip'} onClick={() => { setArchived(false); setPageNumber(0); setSelected([]) }} type="button">Atuais</button><button aria-pressed={archived} className={archived ? 'filter-chip active' : 'filter-chip'} onClick={() => { setArchived(true); setPageNumber(0); setSelected([]) }} type="button">Arquivadas</button></div>{rangeError ? <p className="form-error body-filter-error" role="alert">{rangeError}</p> : null}</form>
    {selected.length ? <div aria-live="polite" className="compare-toolbar surface-card"><span>{selected.length}/2 avaliações selecionadas</span><button className="submit-button" disabled={selected.length !== 2} onClick={compare} type="button">Comparar selecionadas</button><button className="text-button" onClick={() => setSelected([])} type="button">Limpar</button></div> : null}
    {query.isPending ? <div className="catalog-state" role="status"><span className="route-spinner" /><p>Carregando avaliações…</p></div> : query.isError ? <div className="catalog-state" role="alert"><p>{getErrorMessage(query.error)}</p><button className="secondary-button" onClick={() => void query.refetch()} type="button">Tentar novamente</button></div> : visible.length === 0 ? <section className="empty-state body-empty surface-card"><span aria-hidden="true"><Icon name="trend" size={28} /></span><h2>{archived ? 'Nenhuma avaliação arquivada' : 'Nenhuma avaliação neste período'}</h2><p>{archived ? 'Avaliações arquivadas poderão ser restauradas aqui.' : 'Crie um primeiro snapshot corporal para iniciar comparações.'}</p>{!archived ? <Link className="submit-button" to="/progress/evaluations/new">Nova avaliação</Link> : null}</section> : <section aria-label="Avaliações corporais" className="body-evaluation-list">{visible.map((item) => <EvaluationCard evaluation={item} key={item.id} locale={locale} onSelect={() => select(item.id)} selected={selected.includes(item.id)} />)}</section>}
    {query.data && query.data.totalPages > 1 ? <nav aria-label="Paginação das avaliações" className="pagination"><button className="secondary-button" disabled={pageNumber === 0} onClick={() => { setSelected([]); setPageNumber((current) => current - 1) }} type="button">Anterior</button><span>Página {pageNumber + 1} de {query.data.totalPages}</span><button className="secondary-button" disabled={pageNumber + 1 >= query.data.totalPages} onClick={() => { setSelected([]); setPageNumber((current) => current + 1) }} type="button">Próxima</button></nav> : null}
  </main>
}
