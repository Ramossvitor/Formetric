import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { getDailyLog } from './api'
import { localIsoDate } from './format'

function previousDay(date: string) {
  const value = new Date(`${date}T12:00:00`)
  value.setDate(value.getDate() - 1)
  return localIsoDate(value)
}

export function CopyPanel({ canCopyDay, date, pending, onCancel, onCopyDay, onCopyMeal }: {
  canCopyDay: boolean
  date: string
  pending: boolean
  onCancel: () => void
  onCopyDay: (sourceDate: string) => void
  onCopyMeal: (sourceDate: string, mealId: string) => void
}) {
  const [sourceDate, setSourceDate] = useState(previousDay(date))
  const [sourceMealId, setSourceMealId] = useState('')
  const source = useQuery({
    queryKey: ['diary', 'copy-source', sourceDate],
    queryFn: () => getDailyLog(sourceDate),
  })

  return (
    <div className="dialog-form">
      <div className="field-group">
        <label htmlFor="copy-source-date">Data de origem</label>
        <input id="copy-source-date" max={localIsoDate()} onChange={(event) => { setSourceDate(event.target.value); setSourceMealId('') }} type="date" value={sourceDate} />
      </div>
      {source.isPending ? <p className="inline-hint">Carregando dia de origem…</p> : null}
      {source.isError ? <p className="form-error" role="alert">Não foi possível carregar o dia de origem.</p> : null}
      {source.data === null ? <p className="inline-empty-copy">Nenhum diário registrado nessa data.</p> : null}
      {source.data ? (
        <div className="field-group">
          <label htmlFor="copy-source-meal">Refeição para copiar</label>
          <select id="copy-source-meal" onChange={(event) => setSourceMealId(event.target.value)} value={sourceMealId}>
            <option value="">Selecione…</option>
            {source.data.meals.map((meal) => <option key={meal.id} value={meal.id}>{meal.name} · {meal.items.length} itens</option>)}
          </select>
          <span className="field-hint">A cópia preserva os snapshots nutricionais das versões originais.</span>
        </div>
      ) : null}
      <div className="copy-actions">
        <button className="secondary-button" disabled={!sourceMealId || pending} onClick={() => onCopyMeal(sourceDate, sourceMealId)} type="button">Copiar refeição</button>
        <button className="submit-button" disabled={!source.data || pending || !canCopyDay} onClick={() => onCopyDay(sourceDate)} type="button">Duplicar dia inteiro</button>
      </div>
      {!canCopyDay ? <p className="field-hint">Para duplicar o dia inteiro, o destino não pode ter refeições nem água. Ainda é possível copiar uma refeição.</p> : null}
      <button className="text-button" onClick={onCancel} type="button">Cancelar</button>
    </div>
  )
}
