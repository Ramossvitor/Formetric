import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { getErrorMessage } from '../api/http'
import { invalidateAnalytics } from '../analytics/queries'
import { qualityLabels, unitLabels } from '../catalog/format'
import {
  addMealItem,
  addWater,
  closeDailyLog,
  copyDay,
  copyMeal,
  createMeal,
  deleteMeal,
  deleteMealItem,
  deleteWater,
  reopenDailyLog,
  updateMeal,
  updateMealItem,
  type DailyLog,
  type Meal,
  type MealItem,
  type MealItemInput,
} from '../diary/api'
import { CopyPanel } from '../diary/CopyPanel'
import { DiaryDialog } from '../diary/DiaryDialog'
import { DiarySummary } from '../diary/DiarySummary'
import { displayDate, localIsoDate, number, requiresFastingConfirmation } from '../diary/format'
import { ItemEditor } from '../diary/ItemEditor'
import { MealEditor } from '../diary/MealEditor'
import { dailyLogQuery } from '../diary/queries'

type Editor =
  | { type: 'quick' }
  | { type: 'meal'; meal?: Meal }
  | { type: 'item'; mealId: string; item?: MealItem }
  | { type: 'copy' }
  | { type: 'close' }
  | null

function shiftedDate(date: string, days: number) {
  const value = new Date(`${date}T12:00:00`)
  value.setDate(value.getDate() + days)
  return localIsoDate(value)
}

function formatTime(value: string | null) {
  return value ? value.slice(0, 5) : null
}

function statusLabel(status: DailyLog['status']) {
  return status === 'OPEN' ? 'Dia aberto' : 'Dia fechado'
}

export function DiaryPage() {
  const today = localIsoDate()
  const [searchParams, setSearchParams] = useSearchParams()
  const requestedDate = searchParams.get('date')
  const date = requestedDate && /^\d{4}-\d{2}-\d{2}$/.test(requestedDate) ? requestedDate : today
  const [editor, setEditor] = useState<Editor>(null)
  const [fastingConfirmed, setFastingConfirmed] = useState(false)
  const queryClient = useQueryClient()
  const query = useQuery(dailyLogQuery(date))
  const queryKey = useMemo(() => dailyLogQuery(date).queryKey, [date])

  useEffect(() => {
    if (searchParams.get('action') !== 'quick') return
    setEditor({ type: 'quick' })
    const next = new URLSearchParams(searchParams)
    next.delete('action')
    setSearchParams(next, { replace: true })
  }, [searchParams, setSearchParams])

  function commit(log: DailyLog) {
    queryClient.setQueryData(queryKey, log)
    void invalidateAnalytics(queryClient)
  }

  const addMeal = useMutation({
    mutationFn: (input: { name: string; mealTime: string | null }) => createMeal(date, input),
    onSuccess: (log) => { commit(log); setEditor(null) },
  })
  const editMeal = useMutation({
    mutationFn: ({ meal, input }: { meal: Meal; input: { name: string; mealTime: string | null } }) => updateMeal(date, meal.id, { ...input, position: meal.position }),
    onSuccess: (log) => { commit(log); setEditor(null) },
  })
  const removeMeal = useMutation({ mutationFn: (mealId: string) => deleteMeal(date, mealId), onSuccess: commit })
  const addItem = useMutation({
    mutationFn: ({ mealId, input }: { mealId: string; input: MealItemInput }) => addMealItem(date, mealId, input),
    onSuccess: (log) => { commit(log); setEditor(null) },
  })
  const editItem = useMutation({
    mutationFn: ({ mealId, itemId, input }: { mealId: string; itemId: string; input: MealItemInput }) => updateMealItem(date, mealId, itemId, input),
    onSuccess: (log) => { commit(log); setEditor(null) },
  })
  const removeItem = useMutation({
    mutationFn: ({ mealId, itemId }: { mealId: string; itemId: string }) => deleteMealItem(date, mealId, itemId),
    onSuccess: commit,
  })
  const water = useMutation({ mutationFn: (volume: number) => addWater(date, volume), onSuccess: (log) => { commit(log); if (editor?.type === 'quick') setEditor(null) } })
  const removeWater = useMutation({ mutationFn: (id: string) => deleteWater(date, id), onSuccess: commit })
  const close = useMutation({
    mutationFn: () => closeDailyLog(date, requiresFastingConfirmation(query.data ?? null) ? fastingConfirmed : false),
    onSuccess: (log) => { commit(log); setEditor(null); setFastingConfirmed(false) },
  })
  const reopen = useMutation({ mutationFn: () => reopenDailyLog(date), onSuccess: commit })
  const copyMealMutation = useMutation({
    mutationFn: ({ sourceDate, sourceMealId }: { sourceDate: string; sourceMealId: string }) => copyMeal(date, sourceDate, sourceMealId),
    onSuccess: (log) => { commit(log); setEditor(null) },
  })
  const copyDayMutation = useMutation({
    mutationFn: (sourceDate: string) => copyDay(date, sourceDate),
    onSuccess: (log) => { commit(log); setEditor(null) },
  })

  const mutations = [addMeal, editMeal, removeMeal, addItem, editItem, removeItem, water, removeWater, close, reopen, copyMealMutation, copyDayMutation]
  const mutationError = mutations.find((mutation) => mutation.isError)?.error

  function selectDate(nextDate: string) {
    const params = new URLSearchParams()
    if (nextDate !== today) params.set('date', nextDate)
    setEditor(null)
    setSearchParams(params)
  }

  if (query.isPending) {
    return <div className="catalog-state" role="status"><span className="route-spinner" /><p>Carregando diário…</p></div>
  }

  if (query.isError) {
    return <div className="catalog-state" role="alert"><p>{getErrorMessage(query.error)}</p><button className="secondary-button" onClick={() => void query.refetch()} type="button">Tentar novamente</button></div>
  }

  const log = query.data
  const open = !log || log.status === 'OPEN'

  return (
    <main id="conteudo">
      <header className="page-heading diary-heading">
        <div>
          <p className="eyebrow">Registro diário</p>
          <h1>{date === today ? 'Hoje' : 'Diário'}</h1>
          <p className="heading-copy date-copy">{displayDate(date)}</p>
        </div>
        <div className="date-navigation">
          <button aria-label="Dia anterior" className="icon-button" onClick={() => selectDate(shiftedDate(date, -1))} type="button">‹</button>
          <label htmlFor="diary-date"><span className="visually-hidden">Selecionar data</span><input id="diary-date" onChange={(event) => selectDate(event.target.value)} type="date" value={date} /></label>
          <button aria-label="Próximo dia" className="icon-button" onClick={() => selectDate(shiftedDate(date, 1))} type="button">›</button>
          {date !== today ? <button className="text-button" onClick={() => selectDate(today)} type="button">Ir para hoje</button> : null}
        </div>
      </header>

      <div className="diary-status-row">
        <span className={open ? 'diary-status open' : 'diary-status closed'}>{log ? statusLabel(log.status) : 'Sem registro'}</span>
        {log?.closedAt ? <span>Fechado em {new Date(log.closedAt).toLocaleString('pt-BR')}</span> : <span>Alterações são salvas imediatamente</span>}
      </div>

      {mutationError ? <p className="form-error catalog-feedback" role="alert">{getErrorMessage(mutationError)}</p> : null}

      {!log ? (
        <section className="empty-state diary-empty surface-card">
          <span aria-hidden="true">＋</span>
          <h2>Nenhum registro neste dia</h2>
          <p>O diário será criado ao adicionar a primeira refeição, água, copiar registros ou confirmar um dia de jejum.</p>
          <div className="empty-actions">
            <button className="submit-button" onClick={() => setEditor({ type: 'meal' })} type="button">Adicionar refeição</button>
            <button className="secondary-button" disabled={water.isPending} onClick={() => water.mutate(250)} type="button">+250 ml de água</button>
            <button className="secondary-button" onClick={() => setEditor({ type: 'copy' })} type="button">Copiar outro dia</button>
          </div>
        </section>
      ) : (
        <>
          <DiarySummary log={log} />

          {!open ? (
            <div className="closed-notice" role="note"><strong>Histórico confirmado</strong><span>As mutações estão bloqueadas. Os valores abaixo são snapshots preservados; reabra o dia para alterar.</span></div>
          ) : null}

          <section aria-labelledby="meals-title" className="diary-section">
            <div className="section-title-row diary-section-heading">
              <div><p className="eyebrow">Alimentação</p><h2 id="meals-title">Refeições</h2></div>
              {open ? <button className="compact-button" onClick={() => setEditor({ type: 'meal' })} type="button">+ Refeição</button> : null}
            </div>
            {log.meals.length === 0 ? <div className="inline-empty-state"><p>Nenhuma refeição.</p><span>Adicione uma refeição para começar o registro alimentar.</span></div> : (
              <div className="meal-list">
                {log.meals.map((meal) => (
                  <article className="meal-card surface-card" key={meal.id}>
                    <header className="meal-heading">
                      <div><span>{formatTime(meal.mealTime) ?? `Refeição ${meal.position + 1}`}</span><h3>{meal.name}</h3></div>
                      <div className="meal-total"><strong>{number(meal.totals.kcal, 0)} kcal</strong><small>{number(meal.totals.proteinG)} g proteína</small></div>
                      {open ? <div className="meal-actions"><button aria-label={`Editar ${meal.name}`} className="icon-button" onClick={() => setEditor({ type: 'meal', meal })} type="button">✎</button><button aria-label={`Duplicar ${meal.name}`} className="icon-button" disabled={copyMealMutation.isPending} onClick={() => copyMealMutation.mutate({ sourceDate: date, sourceMealId: meal.id })} type="button">⧉</button><button aria-label={`Excluir ${meal.name}`} className="icon-button danger-icon" disabled={removeMeal.isPending} onClick={() => removeMeal.mutate(meal.id)} type="button">×</button></div> : null}
                    </header>
                    {meal.items.length === 0 ? <p className="meal-empty">Nenhum item nesta refeição.</p> : (
                      <ul className="meal-item-list">
                        {meal.items.map((item) => (
                          <li key={item.id}>
                            <div className="item-primary"><strong>{item.name}</strong><span>{number(item.quantity)} {unitLabels[item.unit]} · {item.itemType === 'RECIPE' ? 'receita' : 'alimento'} · v. preservada</span></div>
                            <div className="item-nutrition"><strong>{number(item.kcal, 0)} kcal</strong><span>P {number(item.proteinG)} · C {number(item.carbohydrateG)} · G {number(item.fatG)}</span></div>
                            <div className="item-quality"><span className={`quality-chip ${item.dataQuality.toLowerCase()}`}>{qualityLabels[item.dataQuality]}</span>{item.uncertaintyKcal != null ? <small>± {number(item.uncertaintyKcal, 0)} kcal</small> : null}</div>
                            {open ? <div className="item-actions"><button aria-label={`Editar ${item.name}`} className="icon-button" onClick={() => setEditor({ type: 'item', mealId: meal.id, item })} type="button">✎</button><button aria-label={`Excluir ${item.name}`} className="icon-button danger-icon" disabled={removeItem.isPending} onClick={() => removeItem.mutate({ mealId: meal.id, itemId: item.id })} type="button">×</button></div> : null}
                          </li>
                        ))}
                      </ul>
                    )}
                    {open ? <button className="add-item-button" onClick={() => setEditor({ type: 'item', mealId: meal.id })} type="button">+ Adicionar alimento ou receita</button> : null}
                  </article>
                ))}
              </div>
            )}
          </section>

          <section aria-labelledby="water-title" className="diary-section water-section surface-card">
            <div className="section-title-row diary-section-heading"><div><p className="eyebrow">Hidratação</p><h2 id="water-title">Água · {number(log.waterTotalMl / 1000, 2)} L</h2></div></div>
            {open ? <div className="water-buttons">{[250, 500, 750, 1000].map((volume) => <button disabled={water.isPending} key={volume} onClick={() => water.mutate(volume)} type="button">+{volume === 1000 ? '1 L' : `${volume} ml`}</button>)}</div> : null}
            {log.waterLogs.length > 0 ? <ol className="water-history">{log.waterLogs.map((entry) => <li key={entry.id}><time dateTime={entry.loggedAt}>{new Date(entry.loggedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</time><strong>{number(entry.volumeMl, 0)} ml</strong>{open ? <button aria-label={`Excluir água de ${number(entry.volumeMl, 0)} ml`} className="icon-button danger-icon" disabled={removeWater.isPending} onClick={() => removeWater.mutate(entry.id)} type="button">×</button> : null}</li>)}</ol> : <p className="inline-hint">Nenhum registro de água.</p>}
          </section>
        </>
      )}

      <section className="diary-day-actions surface-card" aria-label="Ações do diário">
        <div><strong>{open ? 'Quando terminar o dia' : 'Diário confirmado'}</strong><span>{open ? 'Feche para incluir este dia em análises históricas confirmadas.' : 'Reabra somente se precisar corrigir algum registro.'}</span></div>
        <div>
          {open ? <><button className="secondary-button" onClick={() => setEditor({ type: 'copy' })} type="button">Copiar registros</button><button className="submit-button" onClick={() => setEditor({ type: 'close' })} type="button">Fechar dia</button></> : <button className="secondary-button" disabled={reopen.isPending} onClick={() => reopen.mutate()} type="button">{reopen.isPending ? 'Reabrindo…' : 'Reabrir dia'}</button>}
        </div>
      </section>

      {editor?.type === 'meal' ? <DiaryDialog onClose={() => setEditor(null)} title={editor.meal ? 'Editar refeição' : 'Nova refeição'}><MealEditor meal={editor.meal} onCancel={() => setEditor(null)} onSubmit={(input) => editor.meal ? editMeal.mutate({ meal: editor.meal, input }) : addMeal.mutate(input)} pending={addMeal.isPending || editMeal.isPending} /></DiaryDialog> : null}
      {editor?.type === 'item' ? <DiaryDialog onClose={() => setEditor(null)} title={editor.item ? 'Editar item' : 'Adicionar ao diário'}><ItemEditor item={editor.item} onCancel={() => setEditor(null)} onSubmit={(input) => editor.item ? editItem.mutate({ mealId: editor.mealId, itemId: editor.item.id, input }) : addItem.mutate({ mealId: editor.mealId, input })} pending={addItem.isPending || editItem.isPending} /></DiaryDialog> : null}
      {editor?.type === 'copy' ? <DiaryDialog onClose={() => setEditor(null)} title="Copiar registros"><CopyPanel canCopyDay={!log || (log.meals.length === 0 && log.waterLogs.length === 0)} date={date} onCancel={() => setEditor(null)} onCopyDay={(sourceDate) => copyDayMutation.mutate(sourceDate)} onCopyMeal={(sourceDate, sourceMealId) => copyMealMutation.mutate({ sourceDate, sourceMealId })} pending={copyDayMutation.isPending || copyMealMutation.isPending} /></DiaryDialog> : null}
      {editor?.type === 'close' ? <DiaryDialog onClose={() => setEditor(null)} title="Fechar diário"><div className="dialog-form"><p className="close-copy">Depois de fechado, o dia fica somente para leitura e poderá participar dos consolidados. É possível reabrir para corrigir.</p>{requiresFastingConfirmation(log) ? <label className="fasting-confirmation"><input checked={fastingConfirmed} onChange={(event) => setFastingConfirmed(event.target.checked)} type="checkbox" /><span><strong>Confirmo que este foi um dia de jejum</strong><small>Um dia sem itens alimentares nem água só pode ser fechado com confirmação explícita. Uma refeição vazia não conta como acompanhamento.</small></span></label> : null}<div className="dialog-actions"><button className="secondary-button" onClick={() => setEditor(null)} type="button">Cancelar</button><button className="submit-button" disabled={close.isPending || (requiresFastingConfirmation(log) && !fastingConfirmed)} onClick={() => close.mutate()} type="button">{close.isPending ? 'Fechando…' : 'Confirmar fechamento'}</button></div></div></DiaryDialog> : null}
      {editor?.type === 'quick' && open ? <DiaryDialog onClose={() => setEditor(null)} title="Cadastro rápido"><div className="quick-action-grid"><button onClick={() => setEditor({ type: 'meal' })} type="button"><strong>Refeição</strong><span>Criar novo agrupamento</span></button>{log?.meals.map((meal) => <button key={meal.id} onClick={() => setEditor({ type: 'item', mealId: meal.id })} type="button"><strong>Item em {meal.name}</strong><span>Alimento ou receita</span></button>)}<button disabled={water.isPending} onClick={() => water.mutate(250)} type="button"><strong>+250 ml</strong><span>Registrar água agora</span></button><button onClick={() => setEditor({ type: 'copy' })} type="button"><strong>Copiar</strong><span>Refeição ou dia anterior</span></button></div></DiaryDialog> : null}
    </main>
  )
}
