import { useState, type FormEvent } from 'react'
import { getErrorMessage } from '../api/http'
import type { Workout, WorkoutInput, WorkoutModality } from './api'
import { localIsoDate, modalityLabels } from './format'

interface WorkoutFormProps {
  workout?: Workout
  error: unknown
  pending: boolean
  onCancel: () => void
  onSubmit: (input: WorkoutInput) => void
}

const modalities = Object.keys(modalityLabels) as WorkoutModality[]

export function WorkoutForm({ workout, error, pending, onCancel, onSubmit }: WorkoutFormProps) {
  const [date, setDate] = useState(workout?.date ?? localIsoDate())
  const [modality, setModality] = useState<WorkoutModality>(workout?.modality ?? 'STRENGTH')
  const [customModality, setCustomModality] = useState(workout?.customModality ?? '')
  const [title, setTitle] = useState(workout?.title ?? '')
  const [muscleGroups, setMuscleGroups] = useState(workout?.muscleGroups.join(', ') ?? '')
  const [startTime, setStartTime] = useState(workout?.startTime?.slice(0, 5) ?? '')
  const [durationMinutes, setDurationMinutes] = useState(String(workout?.durationMinutes ?? 60))
  const [estimatedKcal, setEstimatedKcal] = useState(workout?.estimatedKcal == null ? '' : String(workout.estimatedKcal))
  const [notes, setNotes] = useState(workout?.notes ?? '')
  const [validationError, setValidationError] = useState<string | null>(null)
  const [muscleGroupsError, setMuscleGroupsError] = useState<string | null>(null)

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const duration = Number(durationMinutes)
    const kcal = estimatedKcal === '' ? null : Number(estimatedKcal)
    const groups = muscleGroups.split(',').map((group) => group.trim()).filter(Boolean)

    if (!date || !title.trim()) {
      setValidationError('Informe a data e o título do treino.')
      return
    }
    if (!Number.isInteger(duration) || duration < 1) {
      setValidationError('A duração deve ser informada em minutos inteiros.')
      return
    }
    if (modality === 'OTHER' && !customModality.trim()) {
      setValidationError('Descreva a modalidade selecionada como outra.')
      return
    }
    if (modality === 'STRENGTH' && groups.length === 0) {
      setValidationError(null)
      setMuscleGroupsError('Informe ao menos um grupo muscular para musculação.')
      return
    }
    if (groups.length > 20 || groups.some((group) => group.length > 50)) {
      setValidationError(null)
      setMuscleGroupsError('Use no máximo 20 grupos, com até 50 caracteres cada.')
      return
    }
    if (kcal != null && (!Number.isInteger(kcal) || kcal < 0)) {
      setValidationError('O gasto estimado deve ser um número inteiro positivo.')
      return
    }

    setValidationError(null)
    setMuscleGroupsError(null)
    onSubmit({
      date,
      modality,
      customModality: modality === 'OTHER' ? customModality.trim() : null,
      title: title.trim(),
      muscleGroups: groups,
      startTime: startTime || null,
      durationMinutes: duration,
      estimatedKcal: kcal,
      notes: notes.trim() || null,
    })
  }

  return (
    <form className="activity-form" noValidate onSubmit={submit}>
      <div className="activity-form-grid">
        <div className="field-group">
          <label htmlFor="workout-date">Data</label>
          <input id="workout-date" onChange={(event) => setDate(event.target.value)} required type="date" value={date} />
        </div>
        <div className="field-group">
          <label htmlFor="workout-modality">Modalidade</label>
          <select id="workout-modality" onChange={(event) => { setModality(event.target.value as WorkoutModality); setMuscleGroupsError(null) }} value={modality}>
            {modalities.map((item) => <option key={item} value={item}>{modalityLabels[item]}</option>)}
          </select>
        </div>
        {modality === 'OTHER' ? (
          <div className="field-group activity-full-field">
            <label htmlFor="workout-custom-modality">Qual modalidade?</label>
            <input id="workout-custom-modality" maxLength={80} onChange={(event) => setCustomModality(event.target.value)} required value={customModality} />
          </div>
        ) : null}
        <div className="field-group activity-full-field">
          <label htmlFor="workout-title">Título</label>
          <input id="workout-title" maxLength={120} onChange={(event) => setTitle(event.target.value)} placeholder="Ex.: Peito + bíceps" required value={title} />
        </div>
        <div className="field-group activity-full-field">
          <label htmlFor="workout-muscles">Grupos musculares</label>
          <input aria-describedby={muscleGroupsError ? 'workout-muscles-error' : 'workout-muscles-hint'} aria-invalid={Boolean(muscleGroupsError)} id="workout-muscles" maxLength={1019} onChange={(event) => { setMuscleGroups(event.target.value); setMuscleGroupsError(null) }} placeholder="Peito, bíceps, core" value={muscleGroups} />
          <span className="field-hint" id="workout-muscles-hint">Separe por vírgulas. Obrigatório para musculação; até 20 grupos.</span>
          {muscleGroupsError ? <span className="field-error" id="workout-muscles-error">{muscleGroupsError}</span> : null}
        </div>
        <div className="field-group">
          <label htmlFor="workout-time">Horário</label>
          <input id="workout-time" onChange={(event) => setStartTime(event.target.value)} type="time" value={startTime} />
          <span className="field-hint">Opcional.</span>
        </div>
        <div className="field-group">
          <label htmlFor="workout-duration">Duração</label>
          <div className="number-with-unit">
            <input id="workout-duration" min="1" onChange={(event) => setDurationMinutes(event.target.value)} required step="1" type="number" value={durationMinutes} />
            <span>min</span>
          </div>
        </div>
        <div className="field-group activity-full-field">
          <label htmlFor="workout-kcal">Gasto calórico estimado</label>
          <div className="number-with-unit">
            <input id="workout-kcal" min="0" onChange={(event) => setEstimatedKcal(event.target.value)} placeholder="Não informado" step="1" type="number" value={estimatedKcal} />
            <span>kcal</span>
          </div>
          <span className="field-hint">Opcional e apenas informativo. Não será somado nem descontado automaticamente do balanço energético.</span>
        </div>
        <div className="field-group activity-full-field">
          <label htmlFor="workout-notes">Observações</label>
          <textarea id="workout-notes" maxLength={2000} onChange={(event) => setNotes(event.target.value)} rows={3} value={notes} />
        </div>
      </div>

      {validationError ? <p className="form-error" role="alert">{validationError}</p> : null}
      {error ? <p className="form-error" role="alert">{getErrorMessage(error)}</p> : null}

      <div className="dialog-actions">
        <button className="secondary-button" disabled={pending} onClick={onCancel} type="button">Cancelar</button>
        <button className="submit-button" disabled={pending} type="submit">{pending ? 'Salvando…' : workout ? 'Salvar alterações' : 'Registrar treino'}</button>
      </div>
    </form>
  )
}
