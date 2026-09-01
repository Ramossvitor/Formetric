import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { setupUser } from '../test/user'
import { MemoryRouter } from 'react-router-dom'
import App from '../App'
import { seedProfileTimeContext } from '../test/profileTimeContext'
import { clearCsrfToken } from '../api/http'
import type { BodyEvaluationComparison, BodyEvaluationDetail, BodyEvaluationPage, BodyEvaluationVersion, BodyResult } from './api'
import { allSkinfolds, skinfoldLabels } from './format'

const session = { authenticated: true, user: { id: 'user-1', email: 'vitor@example.com', displayName: 'Vitor Ramos', role: 'USER' } }
const reportedBodyFat: BodyResult = { id: 'result-reported-bf', metric: 'BODY_FAT_PERCENT', value: 16.39, provenance: 'REPORTED', methodCode: 'BIOIMPEDANCE', methodRevision: 1, reportedLabel: 'Gordura do laudo', basisResultId: null }
const calculatedBodyFat: BodyResult = { id: 'result-calculated-bf', metric: 'BODY_FAT_PERCENT', value: 15.8, provenance: 'SYSTEM_CALCULATED', methodCode: 'JACKSON_POLLOCK_7_SIRI_1961', methodRevision: 1, reportedLabel: null, basisResultId: null }
const derivedFatMass: BodyResult = { id: 'result-derived-fat', metric: 'FAT_MASS_KG', value: 14.23, provenance: 'SYSTEM_DERIVED_FROM_REPORTED', methodCode: 'DERIVED_FROM_BODY_FAT_PERCENT', methodRevision: 1, reportedLabel: null, basisResultId: reportedBodyFat.id }
const derivedFfm: BodyResult = { id: 'result-derived-ffm', metric: 'FAT_FREE_MASS_KG', value: 75.57, provenance: 'SYSTEM_DERIVED_FROM_REPORTED', methodCode: 'DERIVED_FROM_BODY_FAT_PERCENT', methodRevision: 1, reportedLabel: null, basisResultId: reportedBodyFat.id }

const version: BodyEvaluationVersion = {
  id: 'version-2', versionNumber: 2, assessmentDate: '2026-08-12', title: 'Avaliação de agosto', source: 'PROFESSIONAL', assessorName: 'Dra. Ana', notes: 'Revisada com o laudo.', weightKg: 89.8, heightCm: 180, ageYears: 35, formulaSex: 'MALE', protocol: 'JACKSON_POLLOCK_7_SIRI_1961', protocolRevision: 1, reportedMethodType: 'BIOIMPEDANCE', reportedMethodLabel: 'InBody 770',
  circumferences: [{ site: 'WAIST', valueCm: 81 }, { site: 'ABDOMEN', valueCm: 86 }, { site: 'LEFT_ARM', valueCm: 39 }],
  skinfolds: allSkinfolds.map((site, index) => ({ site, side: 'RIGHT' as const, valueMm: 8 + index })),
  results: [reportedBodyFat, calculatedBodyFat, derivedFatMass, derivedFfm],
  warnings: [{ code: 'MALE_SUM_OUTSIDE_REFERENCE_RANGE', message: 'A soma está fora da faixa mais estudada; o resultado foi extrapolado.' }], createdAt: '2026-08-12T13:00:00Z',
}

const oldVersion: BodyEvaluationVersion = { ...version, id: 'version-1', versionNumber: 1, assessmentDate: '2026-07-10', title: 'Avaliação de julho', weightKg: 92.1, warnings: [], createdAt: '2026-07-10T12:00:00Z' }

function detail(overrides: Partial<BodyEvaluationDetail> = {}): BodyEvaluationDetail {
  return { id: 'evaluation-1', archived: false, currentVersion: version, versions: [version, oldVersion], createdAt: '2026-07-10T12:00:00Z', updatedAt: '2026-08-12T13:00:00Z', identityVersion: 3, ...overrides }
}
function page(content = [detail()]): BodyEvaluationPage {
  return { content, page: 0, size: 20, totalElements: content.length, totalPages: 1 }
}
function jsonResponse(body: unknown, init: ResponseInit = {}) { return new Response(JSON.stringify(body), { status: 200, ...init, headers: { 'Content-Type': 'application/json', ...init.headers } }) }
function renderApp(route: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  seedProfileTimeContext(queryClient)
  const result = render(<QueryClientProvider client={queryClient}><MemoryRouter initialEntries={[route]}><App /></MemoryRouter></QueryClientProvider>)
  return { ...result, queryClient }
}
function requireBody(value: Record<string, unknown> | null) { if (!value) throw new Error('Corpo da requisição não capturado.'); return value }

beforeEach(() => { clearCsrfToken(); vi.restoreAllMocks(); vi.spyOn(crypto, 'randomUUID').mockReturnValue('11111111-1111-4111-8111-111111111111') })

describe('cadastro de avaliação corporal', () => {
  it('exige as sete dobras, revisa sugestões do perfil e envia somente dados confirmados', async () => {
    let posted: Record<string, unknown> | null = null
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const path = String(input)
      if (path === '/api/v1/auth/session') return jsonResponse(session)
      if (path === '/api/v1/profile') return jsonResponse({ ...session.user, locale: 'pt-BR', timeZone: 'America/Sao_Paulo', unitSystem: 'METRIC', birthDate: '1990-08-20', formulaSex: 'MALE' })
      if (path === '/api/v1/auth/csrf') return jsonResponse({ token: 'body-csrf', headerName: 'X-XSRF-TOKEN' })
      if (path === '/api/v1/body-evaluations' && init?.method === 'POST') { posted = JSON.parse(String(init.body)); return jsonResponse(detail(), { status: 201 }) }
      if (path === '/api/v1/body-evaluations/evaluation-1') return jsonResponse(detail())
      throw new Error(`Requisição não esperada: ${path}`)
    })
    const user = setupUser(); renderApp('/progress/evaluations/new')
    expect(await screen.findByRole('note')).toHaveTextContent('Sugestão do perfil')
    await user.type(screen.getByLabelText('Título'), 'Avaliação validada')
    expect(screen.getByLabelText('Data da avaliação')).toHaveValue('2026-08-12')
    fireEvent.change(screen.getByLabelText('Data da avaliação'), { target: { value: '2026-08-12' } })
    await user.type(screen.getByLabelText('Peso (kg, opcional)'), '89.8'); await user.type(screen.getByLabelText('Altura (cm, opcional)'), '180')
    expect(screen.getByLabelText('Idade confirmada na data (opcional)')).toHaveValue(35)
    expect(screen.getByLabelText('Sexo usado na fórmula (opcional)')).toHaveValue('MALE')
    await user.click(screen.getByRole('button', { name: 'Continuar' }))
    expect(screen.getByRole('heading', { name: 'Perimetrias' })).toHaveFocus()
    await user.type(screen.getByLabelText('Cintura (cm)'), '81')
    await user.click(screen.getByRole('button', { name: 'Continuar' }))
    await user.selectOptions(screen.getByLabelText('Protocolo'), 'JACKSON_POLLOCK_7_SIRI_1961')
    await user.click(screen.getByRole('button', { name: 'Continuar' }))
    expect(screen.getAllByText(/é obrigatório\./)).toHaveLength(7)
    for (const site of allSkinfolds) await user.type(screen.getByLabelText(`${skinfoldLabels[site]} (mm) *`), '10')
    await user.selectOptions(screen.getByLabelText('Método do laudo'), 'BIOIMPEDANCE')
    await user.type(screen.getByLabelText('Descrição do método'), 'InBody 770')
    await user.click(screen.getByRole('button', { name: /Adicionar resultado do laudo/ }))
    await user.type(screen.getByLabelText('Valor informado 1'), '15.59')
    await user.type(screen.getByLabelText('Rótulo informado 1'), 'Percentual do relatório')
    await user.click(screen.getByRole('button', { name: 'Continuar' }))
    expect(screen.getByRole('heading', { name: 'Revisão' })).toHaveFocus()
    expect(screen.getByText('Cintura: 81 cm')).toBeInTheDocument()
    expect(screen.getByText('Peitoral (direito): 10 mm')).toBeInTheDocument()
    expect(screen.getByText('Percentual do relatório · Gordura corporal: 15,59%')).toBeInTheDocument()
    expect(screen.getByText('Bioimpedância · InBody 770')).toBeInTheDocument()
    expect(screen.getByText('Massa livre de gordura (estimada)', { selector: 'strong' }).parentElement).toHaveTextContent('não deve ser interpretada automaticamente como massa muscular')
    expect(posted).toBeNull()
    await user.click(screen.getByRole('checkbox', { name: /Revisei e confirmo/ }))
    await user.click(screen.getByRole('button', { name: 'Salvar avaliação' }))
    await waitFor(() => expect(posted).not.toBeNull())
    const postedBody = requireBody(posted)
    expect(postedBody).toEqual(expect.objectContaining({ title: 'Avaliação validada', assessmentDate: '2026-08-12', ageYears: 35, formulaSex: 'MALE', protocol: 'JACKSON_POLLOCK_7_SIRI_1961', reportedMethodType: 'BIOIMPEDANCE', reportedMethodLabel: 'InBody 770' }))
    expect(postedBody.skinfolds).toHaveLength(7)
    expect(postedBody.circumferences).toEqual([{ site: 'WAIST', valueCm: 81 }])
    expect(postedBody.reportedResults).toEqual([{ metric: 'BODY_FAT_PERCENT', value: 15.59, reportedLabel: 'Percentual do relatório' }])
    expect(JSON.stringify(postedBody)).not.toMatch(/provenance|SYSTEM_CALCULATED|basisResultId/)
  }, 10_000)

  it('preserva snapshots ausentes como null e só exige idade e sexo ao ativar JP7', async () => {
    let posted: Record<string, unknown> | null = null
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const path = String(input)
      if (path === '/api/v1/auth/session') return jsonResponse(session)
      if (path === '/api/v1/profile') return jsonResponse({ ...session.user, locale: 'pt-BR', timeZone: 'America/Sao_Paulo', unitSystem: 'METRIC', birthDate: null, formulaSex: null })
      if (path === '/api/v1/auth/csrf') return jsonResponse({ token: 'body-csrf', headerName: 'X-XSRF-TOKEN' })
      if (path === '/api/v1/body-evaluations' && init?.method === 'POST') { posted = JSON.parse(String(init.body)); return jsonResponse(detail(), { status: 201 }) }
      if (path === '/api/v1/body-evaluations/evaluation-1') return jsonResponse(detail())
      throw new Error(`Requisição não esperada: ${path}`)
    })
    const user = setupUser(); renderApp('/progress/evaluations/new')
    await user.type(await screen.findByLabelText('Título'), 'Avaliação parcial')
    await user.click(screen.getByRole('button', { name: 'Continuar' }))
    await user.click(screen.getByRole('button', { name: 'Continuar' }))
    await user.click(screen.getByRole('button', { name: 'Continuar' }))
    await user.click(screen.getByRole('checkbox', { name: /Revisei e confirmo/ }))
    await user.click(screen.getByRole('button', { name: 'Salvar avaliação' }))
    await waitFor(() => expect(posted).not.toBeNull())
    expect(requireBody(posted)).toEqual(expect.objectContaining({ weightKg: null, heightCm: null, ageYears: null, formulaSex: null, assessorName: null }))
  })

  it('explica os snapshots exigidos por JP7 e permite voltar aos dados gerais', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const path = String(input)
      if (path === '/api/v1/auth/session') return jsonResponse(session)
      if (path === '/api/v1/profile') return jsonResponse({ ...session.user, locale: 'pt-BR', timeZone: 'America/Sao_Paulo', unitSystem: 'METRIC', birthDate: null, formulaSex: null })
      throw new Error(`Requisição não esperada: ${path}`)
    })
    const user = setupUser(); renderApp('/progress/evaluations/new')
    await user.type(await screen.findByLabelText('Título'), 'JP7 incompleta')
    await user.click(screen.getByRole('button', { name: 'Continuar' }))
    await user.click(screen.getByRole('button', { name: 'Continuar' }))
    await user.selectOptions(screen.getByLabelText('Protocolo'), 'JACKSON_POLLOCK_7_SIRI_1961')
    await user.click(screen.getByRole('button', { name: 'Continuar' }))
    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('Idade é obrigatória')
    expect(alert).toHaveTextContent('Sexo de fórmula é obrigatório')
    await user.click(within(alert).getByRole('button', { name: 'Revisar dados gerais' }))
    expect(screen.getByRole('heading', { name: 'Dados gerais' })).toHaveFocus()
  })
})

describe('detalhe e versionamento', () => {
  it('separa laudo, cálculo e derivação, mostra avisos e cria correção com versão esperada', async () => {
    let versionBody: Record<string, unknown> | null = null
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const path = String(input)
      if (path === '/api/v1/auth/session') return jsonResponse(session)
      if (path === '/api/v1/auth/csrf') return jsonResponse({ token: 'body-csrf', headerName: 'X-XSRF-TOKEN' })
      if (path === '/api/v1/body-evaluations/evaluation-1' && !init?.method) return jsonResponse(detail())
      if (path === '/api/v1/body-evaluations/evaluation-1/versions' && init?.method === 'POST') { versionBody = JSON.parse(String(init.body)); return jsonResponse(detail(), { status: 201 }) }
      throw new Error(`Requisição não esperada: ${path}`)
    })
    const user = setupUser(); renderApp('/progress/evaluations/evaluation-1')
    expect((await screen.findAllByText('Informado no laudo')).length).toBeGreaterThan(0)
    expect(screen.getByText('Calculado pelo sistema')).toBeInTheDocument()
    expect(screen.getByText('Derivado de valor informado')).toBeInTheDocument()
    expect(screen.getByText('Gordura do laudo')).toBeInTheDocument()
    expect(screen.getByText('15,8%')).toBeInTheDocument()
    expect(screen.getByText(/resultado foi extrapolado/)).toBeInTheDocument()
    expect(screen.getByText(/não é sinônimo de massa muscular/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Criar nova versão' }))
    for (let index = 0; index < 3; index += 1) await user.click(screen.getByRole('button', { name: 'Continuar' }))
    await user.click(screen.getByRole('checkbox', { name: /Revisei e confirmo/ }))
    await user.click(screen.getByRole('button', { name: 'Salvar como nova versão' }))
    await waitFor(() => expect(versionBody).not.toBeNull())
    const savedVersionBody = requireBody(versionBody)
    expect(savedVersionBody).toEqual(expect.objectContaining({ expectedCurrentVersionNumber: 2, title: 'Avaliação de agosto' }))
    expect(savedVersionBody.reportedResults).toEqual([{ metric: 'BODY_FAT_PERCENT', value: 16.39, reportedLabel: 'Gordura do laudo' }])
  })

  it('mantém a versão esperada capturada ao abrir o editor mesmo após um refetch concorrente', async () => {
    let current = detail(); let versionBody: Record<string, unknown> | null = null
    let getCount = 0
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const path = String(input)
      if (path === '/api/v1/auth/session') return jsonResponse(session)
      if (path === '/api/v1/auth/csrf') return jsonResponse({ token: 'body-csrf', headerName: 'X-XSRF-TOKEN' })
      if (path === '/api/v1/body-evaluations/evaluation-1' && !init?.method) {
        getCount += 1
        return jsonResponse(current)
      }
      if (path === '/api/v1/body-evaluations/evaluation-1/versions' && init?.method === 'POST') {
        versionBody = JSON.parse(String(init.body)); return jsonResponse(current, { status: 201 })
      }
      throw new Error(`Requisição não esperada: ${path}`)
    })
    const user = setupUser(); const { queryClient } = renderApp('/progress/evaluations/evaluation-1')
    await user.click(await screen.findByRole('button', { name: 'Criar nova versão' }))
    current = detail({
      currentVersion: { ...version, id: 'version-3', versionNumber: 3, title: 'Alteração concorrente' },
      versions: [{ ...version, id: 'version-3', versionNumber: 3, title: 'Alteração concorrente' }, version, oldVersion],
    })
    await act(async () => { await queryClient.invalidateQueries({ queryKey: ['body', 'evaluations', 'detail', 'evaluation-1'] }) })
    await waitFor(() => expect(getCount).toBeGreaterThan(1))
    for (let index = 0; index < 3; index += 1) await user.click(screen.getByRole('button', { name: 'Continuar' }))
    await user.click(screen.getByRole('checkbox', { name: /Revisei e confirmo/ }))
    await user.click(screen.getByRole('button', { name: 'Salvar como nova versão' }))
    await waitFor(() => expect(versionBody).not.toBeNull())
    expect(requireBody(versionBody).expectedCurrentVersionNumber).toBe(2)
  })

  it('invalida a confirmação quando o snapshot muda e permite inspecionar uma versão histórica', async () => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined)
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const path = String(input)
      if (path === '/api/v1/auth/session') return jsonResponse(session)
      if (path === '/api/v1/body-evaluations/evaluation-1') return jsonResponse(detail())
      throw new Error(`Requisição não esperada: ${path}`)
    })
    const user = setupUser(); renderApp('/progress/evaluations/evaluation-1')
    await user.click(await screen.findByRole('button', { name: 'Criar nova versão' }))
    for (let index = 0; index < 3; index += 1) await user.click(screen.getByRole('button', { name: 'Continuar' }))
    const confirmation = screen.getByRole('checkbox', { name: /Revisei e confirmo/ })
    await user.click(confirmation)
    expect(confirmation).toBeChecked()
    await user.click(screen.getByRole('button', { name: /Dados gerais/ }))
    await user.clear(screen.getByLabelText('Título'))
    await user.type(screen.getByLabelText('Título'), 'Snapshot alterado')
    for (let index = 0; index < 3; index += 1) await user.click(screen.getByRole('button', { name: 'Continuar' }))
    expect(screen.getByRole('checkbox', { name: /Revisei e confirmo/ })).not.toBeChecked()
    await user.click(screen.getByRole('button', { name: 'Salvar como nova versão' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Confirme a revisão')
    await user.click(screen.getByRole('button', { name: /Dados gerais/ }))
    await user.click(screen.getByRole('button', { name: 'Cancelar' }))
    await user.click(screen.getByRole('button', { name: 'Ver versão 1' }))
    expect(screen.getByRole('heading', { name: 'Avaliação de julho', level: 1 })).toBeInTheDocument()
    expect(screen.getByText('92,1 kg')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ver versão atual' })).toBeInTheDocument()
  })

  it('confirma arquivamento e restaura com concorrência otimista e CSRF', async () => {
    let current = detail(); const writes: Array<{ method: string; body: unknown; csrf: string | null }> = []
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const path = String(input)
      if (path === '/api/v1/auth/session') return jsonResponse(session)
      if (path === '/api/v1/auth/csrf') return jsonResponse({ token: 'body-csrf', headerName: 'X-XSRF-TOKEN' })
      if (path === '/api/v1/body-evaluations/evaluation-1' && !init?.method) return jsonResponse(current)
      if (path === '/api/v1/body-evaluations/evaluation-1/archive' && (init?.method === 'POST' || init?.method === 'DELETE')) {
        writes.push({ method: init.method, body: JSON.parse(String(init.body)), csrf: new Headers(init.headers).get('X-XSRF-TOKEN') })
        current = detail({ archived: init.method === 'POST', identityVersion: current.identityVersion + 1 })
        return jsonResponse(current)
      }
      throw new Error(`Requisição não esperada: ${path}`)
    })
    const user = setupUser(); renderApp('/progress/evaluations/evaluation-1')
    await user.click(await screen.findByRole('button', { name: 'Arquivar' }))
    // Arquivar deixou de perguntar antes: a operação é reversível e o desfazer aparece depois, no
    // aviso. Cobrar confirmação E oferecer desfazer seria pedir dois toques pela mesma decisão.
    expect(await screen.findByText('Avaliação arquivada.')).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: 'Restaurar' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Restaurar' }))
    await waitFor(() => expect(writes).toHaveLength(2))
    expect(writes).toEqual([{ method: 'POST', body: { expectedIdentityVersion: 3 }, csrf: 'body-csrf' }, { method: 'DELETE', body: { expectedIdentityVersion: 4 }, csrf: 'body-csrf' }])
  })
})

describe('comparação e isolamento', () => {
  it('expõe mudança de método, ausências e gordura em pontos percentuais sem inferir zero', async () => {
    const followReported: BodyResult = { ...reportedBodyFat, id: 'follow-bf', value: 15.59, methodCode: 'DXA' }
    const comparison: BodyEvaluationComparison = {
      baseline: { evaluationId: 'evaluation-1', versionId: 'version-1', versionNumber: 1, assessmentDate: '2026-07-10', title: 'Julho', source: 'PROFESSIONAL', weightKg: 92.1, formulaSex: 'MALE', protocol: 'NONE', protocolRevision: null, reportedMethodType: 'BIOIMPEDANCE', reportedMethodLabel: 'InBody' },
      followUp: { evaluationId: 'evaluation-1', versionId: 'version-2', versionNumber: 2, assessmentDate: '2026-08-12', title: 'Agosto', source: 'PROFESSIONAL', weightKg: null, formulaSex: null, protocol: 'JACKSON_POLLOCK_7_SIRI_1961', protocolRevision: 1, reportedMethodType: 'DXA', reportedMethodLabel: 'Lunar' },
      daysBetween: 33,
      weightDeltaKg: null,
      resultDeltas: [
        { metric: 'BODY_FAT_PERCENT', provenance: 'REPORTED', baselineResult: reportedBodyFat, followUpResult: followReported, delta: -0.8, compatibility: 'METHOD_CHANGED' },
        { metric: 'FAT_FREE_MASS_KG', provenance: 'SYSTEM_DERIVED_FROM_REPORTED', baselineResult: derivedFfm, followUpResult: null, delta: null, compatibility: 'MISSING' },
      ],
      circumferenceDeltas: [{ site: 'WAIST', baselineValueCm: 82, followUpValueCm: null, deltaCm: null }],
      skinfoldDeltas: [{ site: 'ABDOMEN', side: 'RIGHT', baselineValueMm: 14, followUpValueMm: 12, deltaMm: -2 }],
      circumferenceSumDeltaCm: null, skinfoldSumDeltaMm: -2,
      warnings: [{ code: 'METHOD_CHANGED', message: 'O método informado mudou entre avaliações.' }],
    }
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const path = String(input)
      if (path === '/api/v1/auth/session') return jsonResponse(session)
      if (path.startsWith('/api/v1/body-evaluations?')) return jsonResponse(page())
      if (path === '/api/v1/body-evaluations/comparison?baselineVersionId=version-1&followUpVersionId=version-2') return jsonResponse(comparison)
      throw new Error(`Requisição não esperada: ${path}`)
    })
    renderApp('/progress/evaluations/compare?baselineVersionId=version-1&followUpVersionId=version-2')
    expect(await screen.findByText('−0,8 p.p.')).toBeInTheDocument()
    expect(screen.getAllByText('não informado').length).toBeGreaterThan(1)
    expect(screen.queryByText('null kg')).not.toBeInTheDocument()
    expect(screen.getByText('Mudança de gordura corporal exibida em pontos percentuais.')).toBeInTheDocument()
    expect(screen.getByText('Método alterado')).toBeInTheDocument()
    expect(screen.getAllByText('não informado').length).toBeGreaterThan(0)
    expect(screen.getByText(/nenhum zero foi inferido/)).toBeInTheDocument()
    expect(screen.getByText(/inclui água, ossos, órgãos e músculos/i)).toBeInTheDocument()
    expect(screen.getByText('O método informado mudou entre avaliações.')).toBeInTheDocument()
    expect(screen.getByText(/não possui um conjunto de perimetrias comparável/)).toBeInTheDocument()
  })

  it('mantém resposta tenant-safe como erro sem renderizar dados', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const path = String(input)
      if (path === '/api/v1/auth/session') return jsonResponse(session)
      if (path === '/api/v1/body-evaluations/foreign-id') return jsonResponse({ title: 'Avaliação não encontrada', detail: 'Avaliação não encontrada.', status: 404 }, { status: 404 })
      throw new Error(`Requisição não esperada: ${path}`)
    })
    renderApp('/progress/evaluations/foreign-id')
    expect(await screen.findByRole('alert')).toHaveTextContent('Avaliação não encontrada')
    expect(screen.queryByText('Dra. Ana')).not.toBeInTheDocument()
  })

  it('mantém o deep link comparável quando a versão histórica não está na primeira página', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const path = String(input)
      if (path === '/api/v1/auth/session') return jsonResponse(session)
      if (path.startsWith('/api/v1/body-evaluations?')) return jsonResponse(page())
      if (path === '/api/v1/body-evaluations/comparison?baselineVersionId=historical-version&followUpVersionId=version-2') return jsonResponse({
        baseline: { evaluationId: 'evaluation-1', versionId: 'historical-version', versionNumber: 1, assessmentDate: '2026-07-10', title: 'Histórica', source: 'SELF', weightKg: null, formulaSex: null, protocol: 'NONE', protocolRevision: null, reportedMethodType: 'UNSPECIFIED', reportedMethodLabel: null },
        followUp: { evaluationId: 'evaluation-1', versionId: 'version-2', versionNumber: 2, assessmentDate: '2026-08-12', title: 'Atual', source: 'SELF', weightKg: null, formulaSex: null, protocol: 'NONE', protocolRevision: null, reportedMethodType: 'UNSPECIFIED', reportedMethodLabel: null },
        daysBetween: 33, resultDeltas: [], circumferenceDeltas: [], skinfoldDeltas: [], circumferenceSumDeltaCm: null, skinfoldSumDeltaMm: null, warnings: [],
      })
      throw new Error(`Requisição não esperada: ${path}`)
    })
    renderApp('/progress/evaluations/compare?baselineVersionId=historical-version&followUpVersionId=version-2')
    expect(await screen.findByRole('heading', { name: 'Histórica' })).toBeInTheDocument()
    expect(screen.getAllByRole('option', { name: 'Versão selecionada no histórico' })).toHaveLength(2)
    expect(screen.getByText(/primeira página de avaliações atuais/)).toBeInTheDocument()
  })
})

describe('navegação de evolução', () => {
  it('expõe avaliação no cadastro rápido e carrega a lista arquivada', async () => {
    const archived = detail({ id: 'evaluation-archived', archived: true, currentVersion: { ...version, id: 'version-archived', title: 'Avaliação antiga' } })
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const path = String(input)
      if (path === '/api/v1/auth/session') return jsonResponse(session)
      if (path.startsWith('/api/v1/body-evaluations?') && path.includes('archiveStatus=ARCHIVED')) return jsonResponse(page([archived]))
      if (path.startsWith('/api/v1/body-evaluations?')) return jsonResponse(page())
      throw new Error(`Requisição não esperada: ${path}`)
    })
    const user = setupUser(); renderApp('/progress/evaluations')
    expect(await screen.findByRole('heading', { name: 'Avaliação de agosto' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Arquivadas' }))
    expect(await screen.findByRole('heading', { name: 'Avaliação antiga' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Abrir cadastro rápido' }))
    expect(within(screen.getByRole('dialog', { name: 'O que deseja registrar?' })).getByRole('link', { name: /Avaliação corporal/ })).toHaveAttribute('href', '/progress/evaluations/new')
  })
})
