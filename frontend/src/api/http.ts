export interface FieldError {
  field: string
  message: string
}

export interface ProblemDetails {
  type?: string
  title?: string
  status?: number
  detail?: string
  instance?: string
  fieldErrors?: FieldError[]
}

export class ApiError extends Error {
  readonly status: number
  readonly problem?: ProblemDetails

  constructor(status: number, problem?: ProblemDetails) {
    super(problem?.detail ?? problem?.title ?? 'Não foi possível concluir a solicitação.')
    this.name = 'ApiError'
    this.status = status
    this.problem = problem
  }
}

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown
  csrf?: boolean
  retryCsrf?: boolean
}

interface CsrfToken {
  token: string
  headerName: string
}

let csrfToken: CsrfToken | null = null
let csrfRequest: Promise<CsrfToken> | null = null
let unauthorizedIncidentActive = false
const unauthorizedListeners = new Set<() => void>()

const locallyHandledUnauthorizedPaths = new Set([
  '/api/v1/auth/session',
  '/api/v1/auth/login',
  '/api/v1/invites/accept',
])

function pathnameOf(path: string) {
  try {
    return new URL(path, 'https://formetric.local').pathname
  } catch {
    return path.split(/[?#]/, 1)[0]
  }
}

function reportUnexpectedUnauthorized(path: string) {
  if (locallyHandledUnauthorizedPaths.has(pathnameOf(path))) return

  clearCsrfToken()
  if (unauthorizedIncidentActive || unauthorizedListeners.size === 0) return

  unauthorizedIncidentActive = true
  for (const listener of unauthorizedListeners) listener()
}

export function subscribeToUnexpectedUnauthorized(listener: () => void) {
  unauthorizedListeners.add(listener)
  return () => {
    unauthorizedListeners.delete(listener)
  }
}

/** Starts a fresh authenticated lifecycle after login or invitation acceptance. */
export function resetUnexpectedUnauthorized() {
  unauthorizedIncidentActive = false
}

async function parseProblem(response: Response): Promise<ProblemDetails | undefined> {
  const contentType = response.headers.get('content-type') ?? ''

  if (!contentType.includes('json')) {
    return undefined
  }

  try {
    return (await response.json()) as ProblemDetails
  } catch {
    return undefined
  }
}

async function requestCsrfToken(): Promise<CsrfToken> {
  const response = await fetch('/api/v1/auth/csrf', {
    credentials: 'include',
    headers: { Accept: 'application/json' },
  })

  if (!response.ok) {
    if (response.status === 401) reportUnexpectedUnauthorized('/api/v1/auth/csrf')
    throw new ApiError(response.status, await parseProblem(response))
  }

  return (await response.json()) as CsrfToken
}

async function getCsrfToken(): Promise<CsrfToken> {
  if (csrfToken) {
    return csrfToken
  }

  csrfRequest ??= requestCsrfToken()

  try {
    csrfToken = await csrfRequest
    return csrfToken
  } finally {
    csrfRequest = null
  }
}

export function clearCsrfToken() {
  csrfToken = null
  csrfRequest = null
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, csrf = false, retryCsrf = true, headers: customHeaders, ...init } = options
  const headers = new Headers(customHeaders)
  headers.set('Accept', 'application/json')

  if (body !== undefined) {
    headers.set('Content-Type', 'application/json')
  }

  if (csrf) {
    const currentCsrfToken = await getCsrfToken()
    headers.set(currentCsrfToken.headerName, currentCsrfToken.token)
  }

  const response = await fetch(path, {
    ...init,
    body: body === undefined ? undefined : JSON.stringify(body),
    credentials: 'include',
    headers,
  })

  if (!response.ok) {
    if (response.status === 401) reportUnexpectedUnauthorized(path)
    if (csrf && retryCsrf && response.status === 403) {
      clearCsrfToken()
      return apiRequest<T>(path, { ...options, retryCsrf: false })
    }

    throw new ApiError(response.status, await parseProblem(response))
  }

  if (response.status === 204) {
    return undefined as T
  }

  return (await response.json()) as T
}

/**
 * Frases para quando a resposta não traz um `detail` próprio.
 *
 * Os domínios do backend descrevem os próprios erros em português, e essas mensagens sempre têm
 * precedência — são elas que explicam o que de fato aconteceu. O que falta cobrir é a resposta que
 * o servidor de aplicação monta sozinho, antes de qualquer código do produto rodar: corpo malformado,
 * método não suportado, falha não tratada. Nesses casos o título vem do framework, em inglês, e
 * chegava assim à tela.
 */
const statusFallbacks: Array<[predicate: (status: number) => boolean, message: string]> = [
  [(status) => status === 400, 'O servidor não entendeu a solicitação. Atualize o aplicativo e tente de novo.'],
  [(status) => status === 401, 'Sua sessão expirou. Entre novamente para continuar.'],
  [(status) => status === 403, 'Você não tem permissão para esta ação.'],
  [(status) => status === 404, 'Este registro não existe mais.'],
  [(status) => status === 409, 'Alguém alterou este registro antes de você. Recarregue e tente de novo.'],
  [(status) => status === 429, 'Muitas tentativas seguidas. Espere um instante e tente de novo.'],
  [(status) => status >= 500, 'O servidor não conseguiu responder agora. Tente novamente em instantes.'],
]

export function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    // `about:blank` é o tipo que o framework usa quando monta a resposta sozinho — e aí o `detail`
    // vem em inglês. Os domínios do produto declaram o próprio tipo (ou nenhum) e descrevem o erro
    // em português; só esses passam direto.
    const frameworkProblem = error.problem?.type === 'about:blank'
    if (error.problem?.detail && !frameworkProblem) return error.problem.detail
    const fallback = statusFallbacks.find(([matches]) => matches(error.status))
    if (fallback) return fallback[1]
    return error.message
  }

  // `fetch` só rejeita quando a requisição não chegou a ter resposta: sem rede, DNS, CORS.
  return 'Não foi possível conectar ao Formetric. Verifique sua conexão e tente novamente.'
}
