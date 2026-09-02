import { useState } from 'react'
import type { Meal } from './api'

export function MealEditor({ meal, pending, onCancel, onSubmit }: {
  meal?: Meal
  pending: boolean
  onCancel: () => void
  onSubmit: (input: { name: string; mealTime: string | null }) => void
}) {
  const [name, setName] = useState(meal?.name ?? '')
  const [mealTime, setMealTime] = useState(meal?.mealTime?.slice(0, 5) ?? '')
  const valid = name.trim().length > 0

  return (
    <form className="dialog-form" onSubmit={(event) => { event.preventDefault(); if (valid) onSubmit({ name: name.trim(), mealTime: mealTime ? `${mealTime}:00` : null }) }}>
      <div className="field-group">
        <label htmlFor="meal-name">Nome da refeição</label>
        <input id="meal-name" maxLength={80} onChange={(event) => setName(event.target.value)} placeholder="Almoço" value={name} />
      </div>
      <div className="field-group">
        <label htmlFor="meal-time">Horário <span className="optional-label">opcional</span></label>
        <input id="meal-time" onChange={(event) => setMealTime(event.target.value)} type="time" value={mealTime} />
      </div>
      <div className="dialog-actions">
        <button className="secondary-button" onClick={onCancel} type="button">Cancelar</button>
        <button className="submit-button" disabled={!valid || pending} type="submit">{pending ? 'Salvando…' : meal ? 'Salvar refeição' : 'Adicionar refeição'}</button>
      </div>
    </form>
  )
}
