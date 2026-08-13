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

export function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message
  }

  return 'Não foi possível conectar ao Formetric. Tente novamente.'
}
