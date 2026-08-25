import { cloneElement, isValidElement, useEffect, useMemo, useRef, useState, type FormEvent, type ReactElement, type ReactNode } from 'react'
import { ApiError, getErrorMessage } from '../api/http'
import type {
  BodyEvaluationVersion,
  BodyEvaluationVersionInput,
  BodyProtocol,
  BodyResultMetric,
  BodySide,
  CircumferenceSite,
  EvaluationSource,
  FormulaSex,
  ReportedBodyResultInput,
  ReportedMethodType,
  SkinfoldSite,
} from './api'
import {
  ageOnDate,
  allCircumferences,
  allSkinfolds,
  circumferenceLabels,
  formatBodyDate,
  formatBodyNumber,
  formatResultValue,
  formulaSexLabels,
  protocolLabels,
  reportedMethodLabels,
  resultLabels,
  sideLabels,
  skinfoldLabels,
  sourceLabels,
} from './format'

interface ProfileSuggestion { birthDate: string | null; formulaSex: FormulaSex | null }
interface BodyEvaluationFormProps {
  initialVersion?: BodyEvaluationVersion
  profileSuggestion?: ProfileSuggestion
  defaultAssessmentDate: string
  pending: boolean
  error: unknown
  onCancel: () => void
  onSubmit: (input: BodyEvaluationVersionInput) => void
}
interface ReportedDraft { key: string; metric: BodyResultMetric; value: string; reportedLabel: string }
interface FormDraft {
  assessmentDate: string; title: string; source: EvaluationSource; assessorName: string; notes: string
  weightKg: string; heightCm: string; ageYears: string; formulaSex: '' | FormulaSex
  protocol: BodyProtocol; reportedMethodType: ReportedMethodType; reportedMethodLabel: string
  circumferences: Record<CircumferenceSite, string>
  skinfolds: Record<SkinfoldSite, { side: BodySide; value: string }>
  reportedResults: ReportedDraft[]
}

const steps = ['Dados gerais', 'Perimetrias', 'Dobras e resultados', 'Revisão'] as const
const reportableMetrics = Object.keys(resultLabels) as BodyResultMetric[]
const emptyCircumferences = () => Object.fromEntries(allCircumferences.map((site) => [site, ''])) as Record<CircumferenceSite, string>
const emptySkinfolds = () => Object.fromEntries(allSkinfolds.map((site) => [site, { side: 'RIGHT', value: '' }])) as Record<SkinfoldSite, { side: BodySide; value: string }>
const draftKey = () => crypto.randomUUID()

function initialDraft(defaultAssessmentDate: string, version?: BodyEvaluationVersion, profile?: ProfileSuggestion): FormDraft {
  const assessmentDate = version?.assessmentDate ?? defaultAssessmentDate
  const circumferences = emptyCircumferences(); const skinfolds = emptySkinfolds()
  for (const item of version?.circumferences ?? []) circumferences[item.site] = String(item.valueCm)
  for (const item of version?.skinfolds ?? []) skinfolds[item.site] = { side: item.side, value: String(item.valueMm) }
  const suggestedAge = profile?.birthDate ? ageOnDate(profile.birthDate, assessmentDate) : null
  return {
    assessmentDate,
    title: version?.title ?? '',
    source: version?.source ?? 'SELF',
    assessorName: version?.assessorName ?? '',
    notes: version?.notes ?? '',
    weightKg: version?.weightKg == null ? '' : String(version.weightKg),
    heightCm: version?.heightCm == null ? '' : String(version.heightCm),
    ageYears: version?.ageYears == null ? (suggestedAge == null ? '' : String(suggestedAge)) : String(version.ageYears),
    formulaSex: version?.formulaSex ?? profile?.formulaSex ?? '',
    protocol: version?.protocol ?? 'NONE',
    reportedMethodType: version?.reportedMethodType ?? 'UNSPECIFIED',
    reportedMethodLabel: version?.reportedMethodLabel ?? '',
    circumferences,
    skinfolds,
    reportedResults: (version?.results.filter((item) => item.provenance === 'REPORTED') ?? []).map((item) => ({ key: draftKey(), metric: item.metric, value: String(item.value), reportedLabel: item.reportedLabel ?? '' })),
  }
}

function rangeError(value: string, label: string, min: number, max: number, required = false) {
  if (!value.trim()) return required ? `${label} é obrigatório.` : null
  const parsed = Number(value)
  return !Number.isFinite(parsed) || parsed < min || parsed > max ? `${label} deve estar entre ${min} e ${max}.` : null
}

export function BodyEvaluationForm({ initialVersion, profileSuggestion, defaultAssessmentDate, pending, error, onCancel, onSubmit }: BodyEvaluationFormProps) {
  const [draft, setDraft] = useState(() => initialDraft(defaultAssessmentDate, initialVersion, profileSuggestion))
  const [step, setStep] = useState(0); const [errors, setErrors] = useState<Record<string, string>>({}); const [reviewed, setReviewed] = useState(false)
  const headingRef = useRef<HTMLHeadingElement>(null); const firstStepRender = useRef(true)
  useEffect(() => { if (firstStepRender.current) { firstStepRender.current = false; return }; headingRef.current?.focus() }, [step])

  const input = useMemo<BodyEvaluationVersionInput>(() => ({
    assessmentDate: draft.assessmentDate,
    title: draft.title.trim(),
    source: draft.source,
    assessorName: draft.assessorName.trim() || null,
    notes: draft.notes.trim() || null,
    weightKg: draft.weightKg.trim() ? Number(draft.weightKg) : null,
    heightCm: draft.heightCm.trim() ? Number(draft.heightCm) : null,
    ageYears: draft.ageYears.trim() ? Number(draft.ageYears) : null,
    formulaSex: draft.formulaSex || null,
    protocol: draft.protocol,
    reportedMethodType: draft.reportedMethodType,
    reportedMethodLabel: draft.reportedMethodLabel.trim() || null,
    circumferences: allCircumferences.flatMap((site) => draft.circumferences[site].trim() ? [{ site, valueCm: Number(draft.circumferences[site]) }] : []),
    skinfolds: allSkinfolds.flatMap((site) => draft.skinfolds[site].value.trim() ? [{ site, side: draft.skinfolds[site].side, valueMm: Number(draft.skinfolds[site].value) }] : []),
    reportedResults: draft.reportedResults.flatMap<ReportedBodyResultInput>((item) => item.value.trim() ? [{ metric: item.metric, value: Number(item.value), reportedLabel: item.reportedLabel.trim() || null }] : []),
  }), [draft])

  function validate(currentStep: number) {
    const next: Record<string, string> = {}
    if (currentStep === 0) {
      if (!draft.assessmentDate) next.assessmentDate = 'Data da avaliação é obrigatória.'
      if (!draft.title.trim()) next.title = 'Título é obrigatório.'
      for (const [field, label, min, max] of [['weightKg', 'Peso', 0.1, 1000], ['heightCm', 'Altura', 30, 300], ['ageYears', 'Idade', 0, 130]] as const) {
        const message = rangeError(draft[field], label, min, max, false); if (message) next[field] = message
      }
      if (draft.ageYears.trim() && !Number.isInteger(Number(draft.ageYears))) next.ageYears = 'Idade deve ser um número inteiro.'
    }
    if (currentStep === 1) for (const site of allCircumferences) { const message = rangeError(draft.circumferences[site], circumferenceLabels[site], 0.1, 1000); if (message) next[`circumference.${site}`] = message }
    if (currentStep === 2) {
      if (draft.protocol === 'JACKSON_POLLOCK_7_SIRI_1961' && !draft.ageYears.trim()) next.ageYears = 'Idade é obrigatória para Jackson & Pollock 7.'
      if (draft.protocol === 'JACKSON_POLLOCK_7_SIRI_1961' && !draft.formulaSex) next.formulaSex = 'Sexo de fórmula é obrigatório para Jackson & Pollock 7.'
      for (const site of allSkinfolds) { const message = rangeError(draft.skinfolds[site].value, skinfoldLabels[site], 0.1, 200, draft.protocol === 'JACKSON_POLLOCK_7_SIRI_1961'); if (message) next[`skinfold.${site}`] = message }
      const reportedMetricCounts = new Map<BodyResultMetric, number>()
      draft.reportedResults.forEach((item) => reportedMetricCounts.set(item.metric, (reportedMetricCounts.get(item.metric) ?? 0) + 1))
      draft.reportedResults.forEach((item, index) => {
        const maximum = item.metric.endsWith('_PERCENT') ? 100 : 10000
        const message = rangeError(item.value, 'Valor informado', 0, maximum, true)
        if (message) next[`reported.${index}`] = message
        else if ((reportedMetricCounts.get(item.metric) ?? 0) > 1) next[`reported.${index}`] = 'Uma mesma métrica informada não pode se repetir.'
      })
      if (draft.reportedMethodType === 'OTHER' && !draft.reportedMethodLabel.trim()) next.reportedMethodLabel = 'Descreva o método informado.'
    }
    if (currentStep === 3 && !reviewed) next.reviewed = 'Confirme a revisão antes de salvar.'
    setErrors(next); return Object.keys(next).length === 0
  }
  function goNext() { if (validate(step)) setStep((current) => Math.min(3, current + 1)) }
  function submit(event: FormEvent) { event.preventDefault(); if (step < 3) return goNext(); if (validate(3)) onSubmit(input) }
  function mutateDraft(updater: (current: FormDraft) => FormDraft) {
    setDraft(updater)
    setReviewed(false)
  }
  function update<K extends keyof FormDraft>(key: K, value: FormDraft[K]) { mutateDraft((current) => ({ ...current, [key]: value })); setErrors((current) => { const next = { ...current }; delete next[key]; return next }) }
  function clearFieldError(key: string) { setErrors((current) => { if (!(key in current)) return current; const next = { ...current }; delete next[key]; return next }) }

  return <form className="body-evaluation-form" noValidate onSubmit={submit}>
    <ol aria-label="Etapas da avaliação" className="body-stepper">{steps.map((label, index) => <li aria-current={index === step ? 'step' : undefined} className={index === step ? 'active' : index < step ? 'complete' : ''} key={label}><button disabled={index > step || pending} onClick={() => setStep(index)} type="button"><span>{index + 1}</span><small>{label}</small></button></li>)}</ol>
    <section aria-labelledby={`body-step-${step}`} className="body-form-step surface-card">
      <div className="body-step-heading"><p className="eyebrow">Etapa {step + 1} de 4</p><h2 id={`body-step-${step}`} ref={headingRef} tabIndex={-1}>{steps[step]}</h2></div>
      {step === 0 ? <>
        {!initialVersion && (profileSuggestion?.birthDate || profileSuggestion?.formulaSex) ? <p className="body-info-note" role="note"><strong>Sugestão do perfil.</strong> Revise idade e sexo de fórmula: somente sua confirmação nesta tela será salva no snapshot.</p> : null}
        <div className="body-field-grid">
          <Field id="assessment-title" label="Título" error={errors.title}><input aria-invalid={!!errors.title} id="assessment-title" onChange={(e) => update('title', e.target.value)} placeholder="Ex.: Avaliação de agosto" value={draft.title} /></Field>
          <Field id="assessment-date" label="Data da avaliação" error={errors.assessmentDate}><input aria-invalid={!!errors.assessmentDate} id="assessment-date" onChange={(e) => { const date = e.target.value; update('assessmentDate', date); if (!initialVersion && profileSuggestion?.birthDate) { const age = ageOnDate(profileSuggestion.birthDate, date); if (age != null) update('ageYears', String(age)) } }} type="date" value={draft.assessmentDate} /></Field>
          <Field id="assessment-source" label="Origem"><select id="assessment-source" onChange={(e) => update('source', e.target.value as EvaluationSource)} value={draft.source}>{Object.entries(sourceLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
          <Field id="assessment-assessor" label="Profissional ou origem" error={errors.assessorName}><input aria-invalid={!!errors.assessorName} id="assessment-assessor" onChange={(e) => update('assessorName', e.target.value)} placeholder="Opcional" value={draft.assessorName} /></Field>
          <Field id="assessment-weight" label="Peso (kg, opcional)" error={errors.weightKg}><input aria-invalid={!!errors.weightKg} id="assessment-weight" inputMode="decimal" onChange={(e) => update('weightKg', e.target.value)} step="0.01" type="number" value={draft.weightKg} /></Field>
          <Field id="assessment-height" label="Altura (cm, opcional)" error={errors.heightCm}><input aria-invalid={!!errors.heightCm} id="assessment-height" inputMode="decimal" onChange={(e) => update('heightCm', e.target.value)} step="0.1" type="number" value={draft.heightCm} /></Field>
          <Field id="assessment-age" label="Idade confirmada na data (opcional)" error={errors.ageYears}><input aria-invalid={!!errors.ageYears} id="assessment-age" inputMode="numeric" onChange={(e) => update('ageYears', e.target.value)} type="number" value={draft.ageYears} /></Field>
          <Field id="assessment-sex" label="Sexo usado na fórmula (opcional)" error={errors.formulaSex}><select aria-invalid={!!errors.formulaSex} id="assessment-sex" onChange={(e) => update('formulaSex', e.target.value as '' | FormulaSex)} value={draft.formulaSex}><option value="">Não informado</option>{Object.entries(formulaSexLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
        </div>
      </> : null}
      {step === 1 ? <><p className="body-step-copy">Preencha somente medidas realizadas. Campo vazio significa <strong>não informado</strong>, nunca zero.</p><div className="body-field-grid body-measure-grid">{allCircumferences.map((site) => <Field id={`circ-${site}`} key={site} label={`${circumferenceLabels[site]} (cm)`} error={errors[`circumference.${site}`]}><input aria-invalid={!!errors[`circumference.${site}`]} id={`circ-${site}`} inputMode="decimal" onChange={(e) => { const value = e.target.value; mutateDraft((current) => ({ ...current, circumferences: { ...current.circumferences, [site]: value } })); clearFieldError(`circumference.${site}`) }} step="0.1" type="number" value={draft.circumferences[site]} /></Field>)}</div></> : null}
      {step === 2 ? <div className="body-results-form">
        <fieldset className="body-form-group"><legend>Cálculo do sistema</legend><Field id="assessment-protocol" label="Protocolo"><select id="assessment-protocol" onChange={(e) => update('protocol', e.target.value as BodyProtocol)} value={draft.protocol}>{Object.entries(protocolLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field><p className="body-step-copy">Jackson & Pollock 7 + Siri é uma estimativa e exige os sete locais. O sistema identifica revisão e fórmula usadas.</p>{errors.ageYears || errors.formulaSex ? <div className="body-protocol-error" role="alert"><span>{[errors.ageYears, errors.formulaSex].filter(Boolean).join(' ')}</span><button className="text-button" onClick={() => setStep(0)} type="button">Revisar dados gerais</button></div> : null}<div className="body-field-grid body-measure-grid">{allSkinfolds.map((site) => <div className="skinfold-field" key={site}><Field id={`skin-${site}`} label={`${skinfoldLabels[site]} (mm)${draft.protocol !== 'NONE' ? ' *' : ''}`} error={errors[`skinfold.${site}`]}><input aria-invalid={!!errors[`skinfold.${site}`]} id={`skin-${site}`} inputMode="decimal" onChange={(e) => { const value = e.target.value; mutateDraft((current) => ({ ...current, skinfolds: { ...current.skinfolds, [site]: { ...current.skinfolds[site], value } } })); clearFieldError(`skinfold.${site}`) }} step="0.1" type="number" value={draft.skinfolds[site].value} /></Field><label className="compact-select">Lado<select aria-label={`Lado da dobra ${skinfoldLabels[site]}`} onChange={(e) => { const side = e.target.value as BodySide; mutateDraft((current) => ({ ...current, skinfolds: { ...current.skinfolds, [site]: { ...current.skinfolds[site], side } } })) }} value={draft.skinfolds[site].side}><option value="RIGHT">Direito</option><option value="LEFT">Esquerdo</option><option value="UNSPECIFIED">Não informado</option></select></label></div>)}</div></fieldset>
        <fieldset className="body-form-group reported-group"><legend>Resultados do laudo profissional</legend><p className="body-info-note"><strong>Valores informados.</strong> Permanecem marcados como REPORTED e separados dos cálculos do sistema.</p><div className="body-field-grid"><Field id="reported-method" label="Método do laudo"><select id="reported-method" onChange={(e) => update('reportedMethodType', e.target.value as ReportedMethodType)} value={draft.reportedMethodType}>{Object.entries(reportedMethodLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field><Field id="reported-method-label" label="Descrição do método" error={errors.reportedMethodLabel}><input aria-invalid={!!errors.reportedMethodLabel} id="reported-method-label" onChange={(e) => update('reportedMethodLabel', e.target.value)} placeholder="Ex.: InBody 770" value={draft.reportedMethodLabel} /></Field></div>
          <div className="reported-result-list">{draft.reportedResults.map((item, index) => <div className="reported-result-row" key={item.key}><label>Métrica<select aria-label={`Métrica informada ${index + 1}`} onChange={(e) => mutateDraft((current) => ({ ...current, reportedResults: current.reportedResults.map((candidate) => candidate.key === item.key ? { ...candidate, metric: e.target.value as BodyResultMetric } : candidate) }))} value={item.metric}>{reportableMetrics.map((metric) => <option key={metric} value={metric}>{resultLabels[metric]}</option>)}</select></label><label>Valor<input aria-describedby={errors[`reported.${index}`] ? `reported-${index}-error` : undefined} aria-invalid={!!errors[`reported.${index}`]} aria-label={`Valor informado ${index + 1}`} inputMode="decimal" onChange={(e) => mutateDraft((current) => ({ ...current, reportedResults: current.reportedResults.map((candidate) => candidate.key === item.key ? { ...candidate, value: e.target.value } : candidate) }))} step="0.01" type="number" value={item.value} /></label><label>Rótulo original<input aria-label={`Rótulo informado ${index + 1}`} onChange={(e) => mutateDraft((current) => ({ ...current, reportedResults: current.reportedResults.map((candidate) => candidate.key === item.key ? { ...candidate, reportedLabel: e.target.value } : candidate) }))} placeholder="Opcional" value={item.reportedLabel} /></label><button aria-label={`Remover resultado ${index + 1}`} className="icon-button danger-icon" onClick={() => mutateDraft((current) => ({ ...current, reportedResults: current.reportedResults.filter((candidate) => candidate.key !== item.key) }))} type="button">×</button>{errors[`reported.${index}`] ? <span className="field-error" id={`reported-${index}-error`}>{errors[`reported.${index}`]}</span> : null}</div>)}</div>
          <button className="secondary-button add-result-button" onClick={() => mutateDraft((current) => ({ ...current, reportedResults: [...current.reportedResults, { key: draftKey(), metric: 'BODY_FAT_PERCENT', value: '', reportedLabel: '' }] }))} type="button">+ Adicionar resultado do laudo</button>
          <Field id="assessment-notes" label="Observações"><textarea id="assessment-notes" maxLength={2000} onChange={(e) => update('notes', e.target.value)} rows={4} value={draft.notes} /></Field>
        </fieldset>
      </div> : null}
      {step === 3 ? <div className="body-review"><p className="body-info-note"><strong>Revise o snapshot completo.</strong> Uma correção futura criará nova versão sem apagar esta.</p><dl className="body-review-grid"><Review label="Título" value={draft.title || 'não informado'} /><Review label="Data" value={draft.assessmentDate ? formatBodyDate(draft.assessmentDate) : 'não informado'} /><Review label="Origem" value={sourceLabels[draft.source]} /><Review label="Profissional ou origem" value={draft.assessorName.trim() || 'não informado'} /><Review label="Peso" value={draft.weightKg ? `${draft.weightKg} kg` : 'não informado'} /><Review label="Altura" value={draft.heightCm ? `${draft.heightCm} cm` : 'não informado'} /><Review label="Idade" value={input.ageYears == null ? 'não informado' : `${input.ageYears} anos`} /><Review label="Sexo de fórmula" value={draft.formulaSex ? formulaSexLabels[draft.formulaSex] : 'não informado'} /><Review label="Protocolo" value={protocolLabels[draft.protocol]} /><Review label="Método do laudo" value={`${reportedMethodLabels[draft.reportedMethodType]}${draft.reportedMethodLabel.trim() ? ` · ${draft.reportedMethodLabel.trim()}` : ''}`} /><Review label="Observações" value={draft.notes.trim() || 'não informado'} /></dl><div className="body-review-details"><ReviewItems title="Perimetrias" empty="Nenhuma perimetria informada." items={input.circumferences.map((item) => `${circumferenceLabels[item.site]}: ${formatBodyNumber(item.valueCm)} cm`)} /><ReviewItems title="Dobras cutâneas" empty="Nenhuma dobra informada." items={input.skinfolds.map((item) => `${skinfoldLabels[item.site]} (${sideLabels[item.side]}): ${formatBodyNumber(item.valueMm)} mm`)} /><ReviewItems title="Resultados do laudo" empty="Nenhum resultado informado pelo laudo." items={input.reportedResults.map((item) => `${item.reportedLabel ? `${item.reportedLabel} · ` : ''}${resultLabels[item.metric]}: ${formatResultValue(item.value, item.metric)}`)} /></div><p className="fat-free-explanation"><strong>Massa livre de gordura (estimada)</strong> inclui água, ossos, órgãos e músculos; não deve ser interpretada automaticamente como massa muscular.</p><label className="body-review-check"><input aria-describedby={errors.reviewed ? 'body-review-error' : undefined} aria-invalid={!!errors.reviewed} checked={reviewed} onChange={(e) => { setReviewed(e.target.checked); setErrors((current) => { const next = { ...current }; delete next.reviewed; return next }) }} type="checkbox" /><span>Revisei e confirmo todos os dados acima.</span></label>{errors.reviewed ? <p className="field-error" id="body-review-error" role="alert">{errors.reviewed}</p> : null}</div> : null}
    </section>
    {error instanceof ApiError && error.problem?.fieldErrors?.length ? <ul className="form-error body-server-errors" role="alert">{error.problem.fieldErrors.map((item) => <li key={`${item.field}-${item.message}`}>{item.field}: {item.message}</li>)}</ul> : error ? <p className="form-error" role="alert">{getErrorMessage(error)}</p> : null}
    <div className="body-form-actions"><button className="text-button" disabled={pending} onClick={step === 0 ? onCancel : () => setStep((current) => current - 1)} type="button">{step === 0 ? 'Cancelar' : 'Voltar'}</button>{step < 3 ? <button className="submit-button" disabled={pending} onClick={goNext} type="button">Continuar</button> : <button className="submit-button" disabled={pending} type="submit">{pending ? 'Salvando…' : initialVersion ? 'Salvar como nova versão' : 'Salvar avaliação'}</button>}</div>
  </form>
}

function Field({ id, label, error, children }: { id: string; label: string; error?: string; children: ReactNode }) {
  const control = isValidElement(children)
    ? cloneElement(children as ReactElement<{ 'aria-describedby'?: string }>, { 'aria-describedby': error ? `${id}-error` : undefined })
    : children
  return <div className="field-group"><label htmlFor={id}>{label}</label>{control}{error ? <span className="field-error" id={`${id}-error`}>{error}</span> : null}</div>
}
function Review({ label, value }: { label: string; value: string }) { return <div><dt>{label}</dt><dd>{value}</dd></div> }
function ReviewItems({ title, empty, items }: { title: string; empty: string; items: string[] }) { return <section><h3>{title}</h3>{items.length ? <ul>{items.map((item) => <li key={item}>{item}</li>)}</ul> : <p>{empty}</p>}</section> }
