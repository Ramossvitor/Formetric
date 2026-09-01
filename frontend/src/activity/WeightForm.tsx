import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { getErrorMessage } from '../api/http'
import { getWeightLog, type WeightLog, type WeightLogInput } from './api'

interface WeightFormProps {
  entry?: WeightLog
  entries: WeightLog[]
  defaultDate: string
  defaultMeasuredAt: string
  error: unknown
  pending: boolean
  onCancel: () => void
  onSubmit: (date: string, input: WeightLogInput) => void
}

interface FormState {
  date: string
  weightKg: string
  measuredAt: string
  condition: string
  notes: string
  existing?: WeightLog
}

function stateFromEntry(entry: WeightLog): FormState {
  return {
    date: entry.date,
    weightKg: String(entry.weightKg),
    measuredAt: entry.measuredAt.slice(0, 5),
    condition: entry.condition ?? '',
    notes: entry.notes ?? '',
    existing: entry,
  }
}

function emptyState(date: string, measuredAt: string): FormState {
  return { date, weightKg: '', measuredAt, condition: '', notes: '' }
}

export function WeightForm({ entry, entries, defaultDate, defaultMeasuredAt, error, pending, onCancel, onSubmit }: WeightFormProps) {
  const [form, setForm] = useState<FormState>(() => entry ? stateFromEntry(entry) : emptyState(defaultDate, defaultMeasuredAt))
  const [validationError, setValidationError] = useState<string | null>(null)
  const [lookupState, setLookupState] = useState<'idle' | 'loading' | 'error'>('idle')
  const lookupSequence = useRef(0)
  const initialized = useRef(false)

  const resolveDate = useCallback(async (date: string, measuredAt: string) => {
    const sequence = ++lookupSequence.current
    setValidationError(null)

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      setLookupState('idle')
      setForm(emptyState(date, measuredAt))
      return
    }

    const loadedEntry = entries.find((candidate) => candidate.date === date)
    if (loadedEntry) {
      setLookupState('idle')
      setForm(stateFromEntry(loadedEntry))
      return
    }

    setForm(emptyState(date, measuredAt))
    setLookupState('loading')
    try {
      const existing = await getWeightLog(date)
      if (sequence !== lookupSequence.current) return
      setForm(existing ? stateFromEntry(existing) : emptyState(date, measuredAt))
      setLookupState('idle')
    } catch {
      if (sequence !== lookupSequence.current) return
      setLookupState('error')
    }
  }, [entries])

  useEffect(() => {
    if (initialized.current || entry) return
    initialized.current = true
    void resolveDate(form.date, form.measuredAt)
  }, [entry, form.date, form.measuredAt, resolveDate])

  useEffect(() => () => {
    lookupSequence.current += 1
  }, [])

  function changeDate(date: string) {
    void resolveDate(date, form.measuredAt)
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (lookupState !== 'idle') {
      setValidationError('Aguarde a verificação da pesagem desta data.')
      return
    }
    const weight = Number(form.weightKg)
    if (!form.date || !form.measuredAt || !Number.isFinite(weight) || weight <= 0) {
      setValidationError('Informe data, horário e um peso válido.')
      return
    }

    setValidationError(null)
    onSubmit(form.date, {
      weightKg: weight,
      measuredAt: form.measuredAt,
      condition: form.condition.trim() || null,
      notes: form.notes.trim() || null,
      ...(form.existing ? { version: form.existing.version } : {}),
    })
  }

  const detailsDisabled = pending || lookupState !== 'idle'

  return (
    <form className="activity-form" noValidate onSubmit={submit}>
      <div className="activity-form-grid">
        <div className="field-group">
          <label htmlFor="weight-date">Data</label>
          <input disabled={Boolean(entry) || pending} id="weight-date" onChange={(event) => changeDate(event.target.value)} required type="date" value={form.date} />
          {lookupState === 'loading' ? <span className="field-hint" role="status">Verificando se já existe uma pesagem…</span> : null}
        </div>
        <div className="field-group">
          <label htmlFor="weight-time">Horário</label>
          <input disabled={detailsDisabled} id="weight-time" onChange={(event) => setForm((current) => ({ ...current, measuredAt: event.target.value }))} required type="time" value={form.measuredAt} />
        </div>
        <div className="field-group activity-full-field">
          <label htmlFor="weight-value">Peso</label>
          <div className="number-with-unit">
            <input autoFocus disabled={detailsDisabled} id="weight-value" min="1" onChange={(event) => setForm((current) => ({ ...current, weightKg: event.target.value }))} required step="0.01" inputMode="decimal" type="number" value={form.weightKg} />
            <span>kg</span>
          </div>
        </div>
        {form.existing && !entry ? (
          <p className="existing-entry-note activity-full-field" role="status">Já existe uma pesagem nesta data. Ao salvar, você editará o registro existente.</p>
        ) : null}
        {lookupState === 'error' ? (
          <div className="lookup-error activity-full-field" role="alert">
            <span>Não foi possível verificar esta data. Nenhuma alteração foi enviada.</span>
            <button className="secondary-button" onClick={() => void resolveDate(form.date, form.measuredAt)} type="button">Tentar novamente</button>
          </div>
        ) : null}
        <div className="field-group activity-full-field">
          <label htmlFor="weight-condition">Condição da pesagem</label>
          <input disabled={detailsDisabled} id="weight-condition" maxLength={120} onChange={(event) => setForm((current) => ({ ...current, condition: event.target.value }))} placeholder="Ex.: Em jejum" value={form.condition} />
          <span className="field-hint">Opcional.</span>
        </div>
        <div className="field-group activity-full-field">
          <label htmlFor="weight-notes">Observações</label>
          <textarea disabled={detailsDisabled} id="weight-notes" maxLength={2000} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} rows={3} value={form.notes} />
        </div>
      </div>

      {validationError ? <p className="form-error" role="alert">{validationError}</p> : null}
      {error ? <p className="form-error" role="alert">{getErrorMessage(error)}</p> : null}

      <div className="dialog-actions">
        <button className="secondary-button" disabled={pending} onClick={onCancel} type="button">Cancelar</button>
        <button className="submit-button" disabled={pending || lookupState !== 'idle'} type="submit">{pending ? 'Salvando…' : lookupState === 'loading' ? 'Verificando data…' : form.existing ? 'Salvar alterações' : 'Registrar peso'}</button>
      </div>
    </form>
  )
}
