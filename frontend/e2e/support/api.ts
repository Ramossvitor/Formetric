import { expect, type Page } from '@playwright/test'

// Escrita autenticada pela API, do jeito que o app faz: busca o token CSRF, manda no cabeçalho que
// o próprio servidor nomeou, e usa o cookie de sessão que já está no contexto da página.

interface CsrfResponse {
  token: string
  headerName: string
}

async function withCsrf<T>(page: Page, method: 'POST' | 'PUT', path: string, data: unknown): Promise<T> {
  const csrfResponse = await page.request.get('/api/v1/auth/csrf')
  await expect(csrfResponse).toBeOK()
  const csrf = await csrfResponse.json() as CsrfResponse
  const response = await page.request.fetch(path, {
    method,
    data,
    headers: { [csrf.headerName]: csrf.token },
  })
  await expect(response).toBeOK()
  return response.json() as Promise<T>
}

export function postWithCsrf<T>(page: Page, path: string, data: unknown): Promise<T> {
  return withCsrf<T>(page, 'POST', path, data)
}

export function putWithCsrf<T>(page: Page, path: string, data: unknown): Promise<T> {
  return withCsrf<T>(page, 'PUT', path, data)
}
