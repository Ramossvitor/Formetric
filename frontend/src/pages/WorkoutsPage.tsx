import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ActivityDialog } from '../activity/ActivityDialog'
import { createWorkout, deleteWorkout, updateWorkout, type Workout, type WorkoutInput } from '../activity/api'
import { dateDaysAgo, formatDate, formatDuration, formatNumber, localIsoDate, modalityLabels } from '../activity/format'
import { workoutsQuery, workoutsQueryKey } from '../activity/queries'
import { WorkoutForm } from '../activity/WorkoutForm'
import { getErrorMessage } from '../api/http'
import { Icon } from '../components/Icon'

interface DateRange {
  from: string
  to: string
}

type WorkoutEditor = { type: 'new'; requestId: string } | { type: 'edit'; workout: Workout } | null
type WorkoutSaveCommand =
  | { type: 'create'; requestId: string; input: WorkoutInput }
  | { type: 'update'; workout: Workout; input: WorkoutInput }

export function WorkoutsPage() {
  const today = localIsoDate()
  const initialRange = useMemo(() => ({ from: dateDaysAgo(30), to: today }), [today])
  const [range, setRange] = useState<DateRange>(initialRange)
  const [draftRange, setDraftRange] = useState<DateRange>(initialRange)
  const [rangeError, setRangeError] = useState<string | null>(null)
  const [editor, setEditor] = useState<WorkoutEditor>(null)
  const [searchParams, setSearchParams] = useSearchParams()
  const queryClient = useQueryClient()
  const query = useQuery(workoutsQuery(range.from, range.to))

  const save = useMutation({
    mutationFn: (command: WorkoutSaveCommand) => command.type === 'update'
      ? updateWorkout(command.workout, command.input)
      : createWorkout(command.input, command.requestId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: workoutsQueryKey })
      setEditor(null)
    },
  })
  const remove = useMutation({
    mutationFn: deleteWorkout,
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: workoutsQueryKey }),
  })

  useEffect(() => {
    if (searchParams.get('action') !== 'new') return
    const next = new URLSearchParams(searchParams)
    next.delete('action')
    setSearchParams(next, { replace: true })
    if (!save.isPending && !editor) setEditor({ type: 'new', requestId: crypto.randomUUID() })
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
    setEditor({ type: 'new', requestId: crypto.randomUUID() })
  }

  function openEdit(workout: Workout) {
    if (save.isPending || remove.isPending) return
    save.reset()
    setEditor({ type: 'edit', workout })
  }

  function requestDelete(workout: Workout) {
    if (window.confirm(`Excluir o treino "${workout.title}"? Esta ação não pode ser desfeita.`)) {
      remove.mutate(workout.id)
    }
  }

  const workouts = [...(query.data ?? [])].sort((first, second) => {
    const dateOrder = second.date.localeCompare(first.date)
    if (dateOrder !== 0) return dateOrder
    return (second.startTime ?? '').localeCompare(first.startTime ?? '')
  })
  const totalMinutes = workouts.reduce((total, workout) => total + workout.durationMinutes, 0)

  return (
    <main id="conteudo">
      <header className="page-heading activity-heading">
        <div>
          <p className="eyebrow">Atividade física</p>
          <h1>Treinos</h1>
          <p className="heading-copy">Registre sessões sem duplicar o gasto estimado no balanço energético.</p>
        </div>
        <div className="heading-actions">
          <Link className="secondary-button" to="/progress/weight"><Icon name="scale" size={18} /> Histórico de peso</Link>
          <button className="submit-button" disabled={save.isPending || remove.isPending} onClick={openNew} type="button"><Icon name="plus" size={18} /> Registrar treino</button>
        </div>
      </header>

      <form aria-label="Filtrar treinos" className="activity-filter surface-card" onSubmit={applyRange}>
        <div className="field-group">
          <label htmlFor="workouts-from">De</label>
          <input id="workouts-from" onChange={(event) => setDraftRange((current) => ({ ...current, from: event.target.value }))} type="date" value={draftRange.from} />
        </div>
        <div className="field-group">
          <label htmlFor="workouts-to">Até</label>
          <input id="workouts-to" onChange={(event) => setDraftRange((current) => ({ ...current, to: event.target.value }))} type="date" value={draftRange.to} />
        </div>
        <button className="secondary-button" type="submit">Aplicar período</button>
        {rangeError ? <p className="form-error activity-filter-error" role="alert">{rangeError}</p> : null}
      </form>

      {remove.isError ? <p className="form-error activity-feedback" role="alert">{getErrorMessage(remove.error)}</p> : null}

      {query.isPending ? (
        <div className="catalog-state" role="status"><span className="route-spinner" /><p>Carregando treinos…</p></div>
      ) : query.isError ? (
        <div className="catalog-state" role="alert"><p>{getErrorMessage(query.error)}</p><button className="secondary-button" onClick={() => void query.refetch()} type="button">Tentar novamente</button></div>
      ) : workouts.length === 0 ? (
        <section className="empty-state activity-empty surface-card">
          <span aria-hidden="true"><Icon name="activity" size={28} /></span>
          <h2>Nenhum treino neste período</h2>
          <p>Registre a primeira sessão ou ajuste as datas do filtro.</p>
          <button className="submit-button" disabled={save.isPending || remove.isPending} onClick={openNew} type="button">Registrar treino</button>
        </section>
      ) : (
        <>
          <section aria-label="Resumo dos treinos" className="activity-summary-grid">
            <article className="activity-summary-card surface-card"><span>Sessões</span><strong>{workouts.length}</strong><small>no período selecionado</small></article>
            <article className="activity-summary-card surface-card"><span>Tempo registrado</span><strong>{formatDuration(totalMinutes)}</strong><small>soma das durações</small></article>
          </section>

          <section aria-labelledby="workout-history-title" className="activity-history">
            <div className="section-title-row">
              <div><p className="eyebrow">Histórico</p><h2 id="workout-history-title">Sessões registradas</h2></div>
              <span className="result-count">{workouts.length} resultado{workouts.length === 1 ? '' : 's'}</span>
            </div>
            <ol className="workout-list">
              {workouts.map((workout) => (
                <li className="workout-card surface-card" key={workout.id}>
                  <div className="workout-date" aria-hidden="true">
                    <strong>{new Date(`${workout.date}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit' })}</strong>
                    <span>{new Date(`${workout.date}T12:00:00`).toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')}</span>
                  </div>
                  <div className="workout-main">
                    <div className="workout-title-row">
                      <div>
                        <span className="activity-chip">{workout.modality === 'OTHER' ? workout.customModality : modalityLabels[workout.modality]}</span>
                        <h3>{workout.title}</h3>
                      </div>
                      <div className="workout-actions">
                        <button aria-label={`Editar ${workout.title}`} className="icon-button" disabled={save.isPending || remove.isPending} onClick={() => openEdit(workout)} type="button">✎</button>
                        <button aria-label={`Excluir ${workout.title}`} className="icon-button danger-icon" disabled={save.isPending || remove.isPending} onClick={() => requestDelete(workout)} type="button">×</button>
                      </div>
                    </div>
                    <p className="workout-meta">
                      <time dateTime={workout.date}>{formatDate(workout.date)}</time>
                      <span>{workout.startTime ? workout.startTime.slice(0, 5) : 'Horário não informado'}</span>
                      <strong>{formatDuration(workout.durationMinutes)}</strong>
                    </p>
                    {workout.muscleGroups.length > 0 ? <ul aria-label="Grupos musculares" className="muscle-chip-list">{workout.muscleGroups.map((group) => <li key={group}>{group}</li>)}</ul> : null}
                    {workout.estimatedKcal != null ? <p className="estimated-workout-energy"><strong>{formatNumber(workout.estimatedKcal, 0)} kcal estimadas</strong><span>informativo; não altera o saldo</span></p> : null}
                    {workout.notes ? <p className="workout-notes">{workout.notes}</p> : null}
                  </div>
                </li>
              ))}
            </ol>
          </section>
        </>
      )}

      {editor ? (
        <ActivityDialog dismissible={!save.isPending} onClose={() => setEditor(null)} title={editor.type === 'edit' ? 'Editar treino' : 'Registrar treino'}>
          <WorkoutForm
            error={save.error}
            key={editor.type === 'edit' ? editor.workout.id : 'new-workout'}
            onCancel={() => setEditor(null)}
            onSubmit={(input) => save.mutate(editor.type === 'edit'
              ? { type: 'update', workout: editor.workout, input }
              : { type: 'create', requestId: editor.requestId, input })}
            pending={save.isPending}
            workout={editor.type === 'edit' ? editor.workout : undefined}
          />
        </ActivityDialog>
      ) : null}
    </main>
  )
}
