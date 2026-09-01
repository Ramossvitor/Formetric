import { expect, type Browser, type BrowserContext, type Page, test } from '@playwright/test'

const ownerEmail = process.env.E2E_ADMIN_EMAIL ?? 'owner.e2e@example.test'
const ownerPassword = process.env.E2E_ADMIN_PASSWORD ?? 'Formetric-E2E-password-2026'
const memberPassword = 'Formetric-Member-password-2026'
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:18080'

interface CsrfResponse {
  token: string
  headerName: string
}

interface CreatedInvite {
  token: string
}

function suffix(retry: number) {
  return `${Date.now()}-${retry}-${crypto.randomUUID().slice(0, 8)}`
}

async function completeLogin(page: Page) {
  await page.getByLabel('E-mail').fill(ownerEmail)
  await page.getByLabel('Senha').fill(ownerPassword)
  await page.getByRole('button', { name: 'Entrar' }).click()
}

async function login(page: Page) {
  await page.goto('/login')
  await expect(page.getByRole('heading', { name: 'Acesse sua conta' })).toBeVisible()
  await completeLogin(page)
  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByRole('main')).toBeVisible()
}

async function postWithCsrf<T>(page: Page, path: string, data: unknown): Promise<T> {
  const csrfResponse = await page.request.get('/api/v1/auth/csrf')
  await expect(csrfResponse).toBeOK()
  const csrf = await csrfResponse.json() as CsrfResponse
  const response = await page.request.post(path, {
    data,
    headers: { [csrf.headerName]: csrf.token },
  })
  await expect(response).toBeOK()
  return response.json() as Promise<T>
}

async function createInvite(page: Page, email: string) {
  return postWithCsrf<CreatedInvite>(page, '/api/v1/invites', {
    email,
    role: 'USER' as const,
    expiresInHours: 24,
  })
}

async function acceptInvite(browser: Browser, token: string, displayName: string) {
  const context = await browser.newContext({
    baseURL,
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
  })
  const page = await context.newPage()
  const requestedUrls: string[] = []
  page.on('request', (request) => requestedUrls.push(request.url()))

  await page.goto(`/accept-invite#token=${encodeURIComponent(token)}`)
  await expect(page).toHaveURL(/\/accept-invite$/)
  await expect(page.getByRole('heading', { name: 'Ative sua conta' })).toBeVisible()
  expect(requestedUrls.some((url) => url.includes(token))).toBe(false)

  await page.getByLabel('Nome').fill(displayName)
  await page.getByLabel('Senha', { exact: true }).fill(memberPassword)
  await page.getByLabel('Confirmar senha').fill(memberPassword)
  await page.getByRole('button', { name: 'Criar conta' }).click()

  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByRole('main')).toBeVisible()
  return { context, page }
}

async function createFoodThroughApi(page: Page, name: string) {
  return postWithCsrf<{ id: string }>(page, '/api/v1/foods', {
    origin: 'USER',
    name,
    brand: null,
    notes: null,
    referenceQuantity: 100,
    referenceUnit: 'G',
    quality: 'EXACT',
    kcalUncertainty: null,
    caloriesKcal: 200,
    proteinG: 20,
    carbohydrateG: 30,
    fatG: 4,
    fiberG: 8,
    sodiumMg: null,
    servings: [],
  })
}

async function closeContext(context: BrowserContext) {
  await context.close()
}

test('serves the packaged SPA and preserves a protected deep link through login', async ({ page }, testInfo) => {
  const date = `2025-01-${String(10 + testInfo.retry).padStart(2, '0')}`

  await page.goto(`/diary?date=${date}`)

  await expect(page).toHaveURL(/\/login$/)
  await expect(page.getByRole('heading', { name: 'Acesse sua conta' })).toBeVisible()

  await completeLogin(page)

  await expect(page).toHaveURL(new RegExp(`/diary\\?date=${date}$`))
  await expect(page.getByRole('heading', { name: 'Diário' })).toBeVisible()

  await page.reload()
  await expect(page.getByRole('heading', { name: 'Diário' })).toBeVisible()
})

test('persists a proportional food entry, water and daily closure through the integrated image', async ({ page }, testInfo) => {
  const testSuffix = suffix(testInfo.retry)
  const foodName = `Aveia E2E ${testSuffix}`
  const date = `2025-02-${String(10 + testInfo.retry).padStart(2, '0')}`

  await login(page)
  await page.goto('/foods/new')
  await expect(page.getByRole('heading', { name: 'Novo alimento' })).toBeVisible()

  await page.getByLabel('Nome', { exact: true }).fill(foodName)
  await page.getByRole('group', { name: 'Porção de referência' }).getByLabel('Quantidade').fill('100')
  const nutrition = page.getByRole('group', { name: 'Informação nutricional' })
  await nutrition.getByLabel('Calorias').fill('200')
  await nutrition.getByLabel('Proteínas').fill('20')
  await nutrition.getByLabel('Carboidratos').fill('30')
  await nutrition.getByLabel('Gorduras').fill('4')
  await nutrition.getByLabel('Fibras').fill('8')
  await page.getByRole('button', { name: 'Cadastrar alimento' }).click()

  await expect(page).toHaveURL(/\/foods\/[0-9a-f-]+$/)
  await expect(page.getByRole('heading', { name: foodName })).toBeVisible()

  await page.goto(`/diary?date=${date}`)
  await page.getByRole('button', { name: 'Adicionar refeição' }).click()
  const mealDialog = page.getByRole('dialog', { name: 'Nova refeição' })
  await mealDialog.getByLabel('Nome da refeição').fill('Almoço E2E')
  await mealDialog.getByRole('button', { name: 'Adicionar refeição' }).click()

  await expect(page.getByRole('heading', { name: 'Almoço E2E' })).toBeVisible()
  await page.getByRole('button', { name: 'Adicionar alimento ou receita' }).click()

  const itemDialog = page.getByRole('dialog', { name: 'Adicionar ao diário' })
  await itemDialog.getByLabel('Pesquisar catálogo').fill(foodName)
  // O catálogo é uma lista de escolha, não mais um `<select>` de até duzentas opções.
  const catalogChoice = itemDialog.getByRole('radio', { name: foodName })
  await expect(catalogChoice).toHaveCount(1)
  await catalogChoice.check()
  await itemDialog.getByLabel('Quantidade').fill('42')
  await itemDialog.getByRole('button', { name: 'Adicionar ao diário' }).click()

  await expect(page.getByText(foodName, { exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: '84 kcal' })).toBeVisible()

  await page.getByRole('button', { name: '+250 ml' }).click()
  await expect(page.getByRole('heading', { name: /Água · 0,25 L/ })).toBeVisible()

  await page.getByRole('button', { name: 'Fechar dia' }).click()
  await page.getByRole('dialog', { name: 'Fechar diário' }).getByRole('button', { name: 'Confirmar fechamento' }).click()
  await expect(page.getByText('Histórico confirmado')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Reabrir dia' })).toBeVisible()

  await page.reload()
  await expect(page.getByText(foodName, { exact: true })).toBeVisible()
  await expect(page.getByText('Histórico confirmado')).toBeVisible()
})

test('accepts an invitation without leaking its token and isolates the owner catalog', async ({ browser, page }, testInfo) => {
  const testSuffix = suffix(testInfo.retry)
  const ownerFoodName = `Alimento privado ${testSuffix}`
  const memberEmail = `member-${testSuffix}@example.test`

  await login(page)
  const ownerFood = await createFoodThroughApi(page, ownerFoodName)
  const invite = await createInvite(page, memberEmail)
  const member = await acceptInvite(browser, invite.token, `Membro ${testSuffix}`)

  try {
    const directLookup = await member.page.request.get(`/api/v1/foods/${ownerFood.id}`)
    expect(directLookup.status()).toBe(404)

    await member.page.goto('/foods')
    await expect(member.page.getByRole('heading', { name: 'Alimentos' })).toBeVisible()
    await member.page.getByRole('searchbox', { name: 'Pesquisar alimentos' }).fill(ownerFoodName)
    await expect(member.page.getByRole('heading', { name: 'Nenhum alimento encontrado' })).toBeVisible()
    await expect(member.page.getByText(ownerFoodName, { exact: true })).toHaveCount(0)
  } finally {
    await closeContext(member.context)
  }
})

test('connects weight, workout and body records to monthly and chart analytics', async ({ browser, page }, testInfo) => {
  test.slow()
  const testSuffix = suffix(testInfo.retry)
  const memberEmail = `tracking-${testSuffix}@example.test`
  const workoutTitle = `Treino E2E ${testSuffix}`
  const evaluationTitle = `Avaliação E2E ${testSuffix}`

  await login(page)
  const invite = await createInvite(page, memberEmail)
  const member = await acceptInvite(browser, invite.token, `Tracking ${testSuffix}`)

  try {
    const timeContextResponse = await member.page.request.get('/api/v1/profile/time-context')
    await expect(timeContextResponse).toBeOK()
    const { today } = await timeContextResponse.json() as { today: string }

    await member.page.goto('/progress/weight?action=new')
    const weightDialog = member.page.getByRole('dialog', { name: 'Registrar peso' })
    await expect(weightDialog).toBeVisible()
    await weightDialog.getByLabel('Data', { exact: true }).fill(today)
    const weightInput = weightDialog.getByLabel('Peso', { exact: true })
    await expect(weightInput).toBeEnabled()
    await weightInput.fill('89.8')
    await weightDialog.getByLabel('Condição da pesagem').fill('Em jejum E2E')
    await weightDialog.getByRole('button', { name: 'Registrar peso' }).click()
    await expect(weightDialog).toBeHidden()
    await expect(member.page.getByRole('region', { name: 'Resumo do peso' })).toContainText('89,8 kg')

    await member.page.goto('/workouts?action=new')
    const workoutDialog = member.page.getByRole('dialog', { name: 'Registrar treino' })
    await expect(workoutDialog).toBeVisible()
    await workoutDialog.getByLabel('Data', { exact: true }).fill(today)
    await workoutDialog.getByLabel('Título').fill(workoutTitle)
    await workoutDialog.getByLabel('Grupos musculares').fill('Peito, bíceps')
    await workoutDialog.getByLabel('Duração').fill('70')
    await workoutDialog.getByRole('button', { name: 'Registrar treino' }).click()
    await expect(workoutDialog).toBeHidden()
    await expect(member.page.getByRole('heading', { name: workoutTitle })).toBeVisible()

    await member.page.goto('/progress/evaluations/new')
    await expect(member.page.getByRole('heading', { name: 'Nova avaliação corporal' })).toBeVisible()
    await member.page.getByLabel('Título').fill(evaluationTitle)
    await member.page.getByLabel('Data da avaliação').fill(today)
    await member.page.getByLabel('Peso (kg, opcional)').fill('89.8')
    await member.page.getByRole('button', { name: 'Continuar' }).click()
    await expect(member.page.getByRole('heading', { name: 'Perimetrias' })).toBeVisible()
    await member.page.getByRole('button', { name: 'Continuar' }).click()
    await expect(member.page.getByRole('heading', { name: 'Dobras e resultados' })).toBeVisible()
    await member.page.getByRole('button', { name: 'Continuar' }).click()
    await expect(member.page.getByRole('heading', { name: 'Revisão' })).toBeVisible()
    await member.page.getByLabel('Revisei e confirmo todos os dados acima.').check()
    await member.page.getByRole('button', { name: 'Salvar avaliação' }).click()
    await expect(member.page).toHaveURL(/\/progress\/evaluations\/[0-9a-f-]+$/)
    await expect(member.page.getByRole('heading', { name: evaluationTitle })).toBeVisible()

    await member.page.goto('/analytics/monthly')
    const activity = member.page.getByRole('region', { name: 'Treinos no mês' })
    const weight = member.page.getByRole('region', { name: 'Peso no mês' })
    await expect(activity).toBeVisible()
    await expect(activity.locator('.analytics-activity-total strong')).toHaveText('1')
    await expect(weight.locator('.analytics-activity-total strong')).toContainText('89,8 kg')

    await member.page.goto('/analytics/charts')
    await member.page.getByLabel('Métrica').selectOption('WEIGHT')
    await expect(member.page.getByRole('img', { name: /Peso por dia/ })).toBeVisible()
  } finally {
    await closeContext(member.context)
  }
})
