import { ApiError, apiRequest, clearCsrfToken } from '../api/http'

export type UserRole = 'OWNER' | 'USER'

export interface SessionUser {
  id: string
  email: string
  displayName: string
  role: UserRole
}

export interface AuthSession {
  authenticated: true
  user: SessionUser
}

export interface LoginInput {
  email: string
  password: string
}

export interface AcceptInviteInput {
  token: string
  displayName: string
  password: string
}

export interface CreateInviteInput {
  email: string
  role: UserRole
  expiresInHours: number
}

export interface CreatedInvite {
  id: string
  email: string
  role: UserRole
  expiresAt: string
  token: string
}

export interface UserProfile extends SessionUser {
  locale: string
  timeZone: string
  unitSystem: 'METRIC' | 'IMPERIAL'
  birthDate: string | null
  formulaSex: 'MALE' | 'FEMALE' | null
}

export type UpdateProfileInput = Pick<
  UserProfile,
  'displayName' | 'locale' | 'timeZone' | 'unitSystem' | 'birthDate' | 'formulaSex'
>

export async function getSession(): Promise<AuthSession | null> {
  try {
    return await apiRequest<AuthSession>('/api/v1/auth/session')
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      return null
    }

    throw error
  }
}

export async function login(input: LoginInput): Promise<AuthSession> {
  const session = await apiRequest<AuthSession>('/api/v1/auth/login', {
    method: 'POST',
    body: input,
    csrf: true,
  })
  clearCsrfToken()
  return session
}

export async function logout(): Promise<void> {
  await apiRequest<void>('/api/v1/auth/logout', {
    method: 'POST',
    csrf: true,
  })
  clearCsrfToken()
}

export async function acceptInvite(input: AcceptInviteInput): Promise<AuthSession> {
  const session = await apiRequest<AuthSession>('/api/v1/invites/accept', {
    method: 'POST',
    body: input,
    csrf: true,
  })
  clearCsrfToken()
  return session
}

export function createInvite(input: CreateInviteInput): Promise<CreatedInvite> {
  return apiRequest<CreatedInvite>('/api/v1/invites', {
    method: 'POST',
    body: input,
    csrf: true,
  })
}

export function getProfile(): Promise<UserProfile> {
  return apiRequest<UserProfile>('/api/v1/profile')
}

export function updateProfile(input: UpdateProfileInput): Promise<UserProfile> {
  return apiRequest<UserProfile>('/api/v1/profile', {
    method: 'PATCH',
    body: input,
    csrf: true,
  })
}
