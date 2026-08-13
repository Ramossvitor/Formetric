import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ActivityDialog } from '../activity/ActivityDialog'
import { deleteWeightLog, upsertWeightLog, type WeightLog, type WeightLogInput } from '../activity/api'
import { dateDaysAgo, formatDate, formatNumber, formatSignedWeight, localIsoDate } from '../activity/format'
import { weightLogsQueryKey, weightOverviewQuery } from '../activity/queries'
import { WeightForm } from '../activity/WeightForm'
import { getErrorMessage } from '../api/http'
import { Icon } from '../components/Icon'

interface DateRange {
  from: string
  to: string
}

type WeightEditor = { type: 'new' } | { type: 'edit'; entry: WeightLog } | null

function WeightMetric({ label, value, note }: { label: string; value: ReactNode; note: string }) {
  return <article className="weight-metric surface-card"><span>{label}</span><strong>{value}</strong><small>{note}</small></article>
}

export function WeightProgressPage() {
  const today = localIsoDate()
  const initialRange = useMemo(() => ({ from: dateDaysAgo(180), to: today }), [today])
  const [range, setRange] = useState<DateRange>(initialRange)
  const [draftRange, setDraftRange] = useState<DateRange>(initialRange)
  const [rangeError, setRangeError] = useState<string | null>(null)
  const [editor, setEditor] = useState<WeightEditor>(null)
  const [searchParams, setSearchParams] = useSearchParams()
  const queryClient = useQueryClient()
  const query = useQuery(weightOverviewQuery(range.from, range.to))

  const save = useMutation({
    mutationFn: ({ date, input }: { date: string; input: WeightLogInput }) => upsertWeightLog(date, input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: weightLogsQueryKey })
      setEditor(null)
    },
  })
  const remove = useMutation({
    mutationFn: deleteWeightLog,
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: weightLogsQueryKey }),
  })

  useEffect(() => {
    if (searchParams.get('action') !== 'new') return
    const next = new URLSearchParams(searchParams)
    next.delete('action')
    setSearchParams(next, { replace: true })
    if (!save.isPending && !editor) setEditor({ type: 'new' })
  }, [editor, save.isPending, searchParams, setSearchParams])

  function applyRange(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!draftRange.from || !draftRange.to || draftRange.from > draftRange.to) {
      setRangeError('Escolha um intervalo válido.')
      return
    }
    setRangeError(null)
    setRange(draftRange)
  }

  function openNew() {
    if (save.isPending || remove.isPending) return
    save.reset()
    setEditor({ type: 'new' })
  }

  function openEdit(entry: WeightLog) {
    if (save.isPending || remove.isPending) return
    save.reset()
    setEditor({ type: 'edit', entry })
  }

  function requestDelete(entry: WeightLog) {
    if (window.confirm(`Excluir a pesagem de ${formatDate(entry.date)}? Esta ação não pode ser desfeita.`)) {
      remove.mutate(entry.date)
    }
  }

  const overview = query.data
  const entries = [...(overview?.entries ?? [])].sort((first, second) => second.date.localeCompare(first.date))

  return (
    <main id="conteudo">
      <header className="page-heading activity-heading">
        <div>
          <p className="eyebrow">Evolução corporal</p>
          <h1>Peso</h1>
          <p className="heading-copy">Acompanhe tendências sem tirar conclusões de uma pesagem isolada.</p>
        </div>
        <div className="heading-actions">
          <Link className="secondary-button" to="/workouts"><Icon name="activity" size={18} /> Ver treinos</Link>
          <button className="submit-button" disabled={save.isPending || remove.isPending} onClick={openNew} type="button"><Icon name="plus" size={18} /> Registrar peso</button>
        </div>
      </header>

      <form aria-label="Filtrar histórico de peso" className="activity-filter surface-card" onSubmit={applyRange}>
        <div className="field-group">
          <label htmlFor="weight-from">De</label>
          <input id="weight-from" onChange={(event) => setDraftRange((current) => ({ ...current, from: event.target.value }))} type="date" value={draftRange.from} />
        </div>
        <div className="field-group">
          <label htmlFor="weight-to">Até</label>
          <input id="weight-to" onChange={(event) => setDraftRange((current) => ({ ...current, to: event.target.value }))} type="date" value={draftRange.to} />
        </div>
        <button className="secondary-button" type="submit">Aplicar período</button>
        {rangeError ? <p className="form-error activity-filter-error" role="alert">{rangeError}</p> : null}
      </form>

      {remove.isError ? <p className="form-error activity-feedback" role="alert">{getErrorMessage(remove.error)}</p> : null}

      {query.isPending ? (
        <div className="catalog-state" role="status"><span className="route-spinner" /><p>Calculando histórico de peso…</p></div>
      ) : query.isError ? (
        <div className="catalog-state" role="alert"><p>{getErrorMessage(query.error)}</p><button className="secondary-button" onClick={() => void query.refetch()} type="button">Tentar novamente</button></div>
      ) : entries.length === 0 ? (
        <section className="empty-state activity-empty surface-card">
          <span aria-hidden="true"><Icon name="scale" size={28} /></span>
          <h2>Nenhuma pesagem neste período</h2>
          <p>Registre uma medição oficial por data para iniciar as médias e a tendência.</p>
          <button className="submit-button" disabled={save.isPending || remove.isPending} onClick={openNew} type="button">Registrar peso</button>
        </section>
      ) : overview ? (
        <>
          <section aria-label="Resumo do peso" className="weight-metric-grid">
            <WeightMetric label="Último peso no período" note={`medido em ${formatDate(entries[0].date)}`} value={`${formatNumber(overview.currentWeightKg!)} kg`} />
            <WeightMetric label="Mudança no período" note="primeira → última pesagem" value={overview.changeKg == null ? 'Dados insuficientes' : formatSignedWeight(overview.changeKg)} />
            <WeightMetric label="Menor peso" note="no intervalo selecionado" value={`${formatNumber(overview.minimumWeightKg!)} kg`} />
            <WeightMetric label="Maior peso" note="no intervalo selecionado" value={`${formatNumber(overview.maximumWeightKg!)} kg`} />
            <WeightMetric label="Média móvel de 7 dias" note={overview.movingAverage7 ? `${overview.movingAverage7.sampleCount} amostras na janela` : 'requer registros na janela'} value={overview.movingAverage7 ? `${formatNumber(overview.movingAverage7.valueKg, 2)} kg` : 'Dados insuficientes'} />
            <WeightMetric label="Média móvel de 14 dias" note={overview.movingAverage14 ? `${overview.movingAverage14.sampleCount} amostras na janela` : 'requer registros na janela'} value={overview.movingAverage14 ? `${formatNumber(overview.movingAverage14.valueKg, 2)} kg` : 'Dados insuficientes'} />
            <WeightMetric label="Tendência" note={overview.trend ? `${overview.trend.sampleCount} amostras · ${formatDate(overview.trend.from)} a ${formatDate(overview.trend.to)}` : 'requer ao menos 3 amostras recentes'} value={overview.trend ? `${formatSignedWeight(overview.trend.kgPerWeek)}/semana` : 'Dados insuficientes'} />
          </section>
          <p className="weight-method-note" role="note">Médias usam as observações existentes nas janelas civis de 7 e 14 dias relativas à pesagem mais recente. A tendência é uma regressão dos últimos 28 dias disponíveis e não uma previsão.</p>

          <section aria-labelledby="weight-history-title" className="activity-history">
            <div className="section-title-row">
              <div><p className="eyebrow">Histórico</p><h2 id="weight-history-title">Pesagens oficiais</h2></div>
              <span className="result-count">{entries.length} registro{entries.length === 1 ? '' : 's'}</span>
            </div>
            <ol className="weight-list">
              {entries.map((entry) => (
                <li className="weight-entry surface-card" key={entry.date}>
                  <time dateTime={entry.date}><strong>{formatDate(entry.date)}</strong><span>{entry.measuredAt.slice(0, 5)}</span></time>
                  <div className="weight-entry-value"><strong>{formatNumber(entry.weightKg, 2)} kg</strong>{entry.condition ? <span>{entry.condition}</span> : <span>Condição não informada</span>}</div>
                  {entry.notes ? <p>{entry.notes}</p> : null}
                  <div className="weight-entry-actions">
                    <button aria-label={`Editar pesagem de ${formatDate(entry.date)}`} className="icon-button" disabled={save.isPending || remove.isPending} onClick={() => openEdit(entry)} type="button">✎</button>
                    <button aria-label={`Excluir pesagem de ${formatDate(entry.date)}`} className="icon-button danger-icon" disabled={save.isPending || remove.isPending} onClick={() => requestDelete(entry)} type="button">×</button>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        </>
      ) : null}

      {editor ? (
        <ActivityDialog dismissible={!save.isPending} onClose={() => setEditor(null)} title={editor.type === 'edit' ? 'Editar pesagem' : 'Registrar peso'}>
          <WeightForm
            entries={entries}
            entry={editor.type === 'edit' ? editor.entry : undefined}
            error={save.error}
            key={editor.type === 'edit' ? editor.entry.date : 'new-weight'}
            onCancel={() => setEditor(null)}
            onSubmit={(date, input) => save.mutate({ date, input })}
            pending={save.isPending}
          />
        </ActivityDialog>
      ) : null}
    </main>
  )
}
