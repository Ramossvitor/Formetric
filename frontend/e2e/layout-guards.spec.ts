import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, type Page, test } from '@playwright/test'
import { postWithCsrf, putWithCsrf } from './support/api'

// O que jsdom não consegue ver. A suíte de componentes busca por texto e papel, e não calcula uma
// única caixa; a catraca de tools/css-contract.ts lê o CSS como texto e não resolve herança. Só
// aqui, com layout de verdade em larguras de verdade, dá para afirmar que nenhum campo ficou
// abaixo de 16px depois da cascata, que nenhuma tela rola de lado e que nenhum alvo é pequeno
// demais para o polegar.
//
// Roda nos três projetos de largura declarados em playwright.config.ts. A largura importa: os
// defeitos que motivaram esta reforma aparecem em 320px e somem em 412px.

const ownerEmail = process.env.E2E_ADMIN_EMAIL ?? 'owner.e2e@example.test'
const ownerPassword = process.env.E2E_ADMIN_PASSWORD ?? 'Formetric-E2E-password-2026'

const BASELINE_PATH = join(dirname(fileURLToPath(import.meta.url)), 'layout-guards.baseline.json')

/** Uma rota por padrão de layout, não uma por arquivo: telas gêmeas não pagam o próprio custo. */
const ROUTES = [
  '/',
  '/diary',
  '/foods',
  '/foods/new',
  '/recipes/new',
  '/workouts',
  '/progress/weight',
  '/progress/evaluations/new',
  '/analytics/monthly',
  '/analytics/charts',
  '/settings/nutrition-goals',
  '/profile',
]

const MIN_CONTROL_FONT_PX = 16
const MIN_TAP_PX = 44
/**
 * Meio pixel de folga na medição do alvo.
 *
 * `getBoundingClientRect` devolve frações, e um elemento declarado com `min-height: 44px` pode
 * medir 43,99px conforme a largura da tela e o arredondamento do layout. Sem a folga, todo alvo
 * exatamente no piso vira cara ou coroa — a guarda falharia em rotas diferentes a cada execução,
 * sem nada de errado no CSS, que é o comportamento mais rápido de ensinar alguém a ignorar. Meio
 * pixel não é diferença de acessibilidade nenhuma. */
const TAP_TOLERANCE_PX = 0.5

interface Measurement {
  /** Descritores dos elementos que ultrapassam a largura da tela. Vazio é a única resposta aceita. */
  overflowing: string[]
  controlsUnderFontFloor: string[]
  targetsUnderTapFloor: string[]
}

const updating = Boolean(process.env.UPDATE_LAYOUT_BASELINE)

/**
 * Pasta para capturas de tela, quando `CAPTURE_SCREENSHOTS` aponta uma. Serve para comparar antes e
 * depois de uma onda: `CAPTURE_SCREENSHOTS=screenshots/antes npm run test:e2e -- layout-guards`,
 * aplicar a onda, capturar em `screenshots/depois`, e olhar as duas pastas lado a lado.
 * `screenshots/` é ignorada pelo git.
 *
 * Deliberadamente NÃO é `toHaveScreenshot()` com imagens versionadas: a renderização de fonte muda
 * entre o Windows de quem desenvolve e o Linux do CI, e a comparação pixel a pixel falharia por
 * antialiasing em vez de por layout — o tipo de teste que se aprende a ignorar. A conferência aqui
 * é humana; o que é automático são as três medições acima.
 */
const screenshotDir = process.env.CAPTURE_SCREENSHOTS
const baseline: Record<string, string[]> = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'))
const collected: Record<string, string[]> = {}

// Cada rota se mede sozinha e nenhuma depende do resultado da anterior, então uma falha não pode
// impedir as outras de rodarem: numa reforma de layout, o valor está em ver o mapa inteiro do
// estrago de uma vez, não a primeira tela que quebrou.
test.describe.configure({ mode: 'default' })

async function signIn(page: Page) {
  // O convite de instalação aparece quando o navegador dispara `beforeinstallprompt`, e o momento
  // disso não é determinístico: agora que o app é um PWA válido, o Chromium o dispara em algum
  // ponto da navegação e a faixa entrava ou não na medição, produzindo falhas em rotas diferentes a
  // cada execução. Marcá-lo como dispensado antes de carregar a página mede o app, e não o convite.
  await page.addInitScript(() => {
    window.localStorage.setItem('formetric:install-prompt-dismissed', 'true')
  })
  await page.goto('/login')
  await page.getByLabel('E-mail').fill(ownerEmail)
  await page.getByLabel('Senha').fill(ownerPassword)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page).toHaveURL(/\/$/)
}

/**
 * Garante que nenhuma das rotas medidas esteja vazia.
 *
 * Sem isso a linha de base descreveria estados vazios numa execução e listas povoadas na seguinte,
 * conforme os testes de fluxo tivessem rodado antes ou não — e um descritor que aparece por causa
 * de um registro criado por outro arquivo é indistinguível de uma regressão de verdade. Semeando
 * aqui, dado extra deixado por qualquer outro teste só acrescenta INSTÂNCIAS dos mesmos
 * componentes, nunca descritores novos.
 *
 * É idempotente por natureza: rodar de novo cria um segundo alimento e uma segunda refeição, o que
 * não muda descritor nenhum.
 */
async function seedEveryListedRoute(page: Page, today: string) {
  const food = await postWithCsrf<{ currentVersion: { id: string } }>(page, '/api/v1/foods', {
    origin: 'USER',
    name: `Guarda de layout ${today}`,
    brand: 'Formetric',
    notes: null,
    referenceQuantity: 100,
    referenceUnit: 'G',
    quality: 'ESTIMATED',
    kcalUncertainty: 30,
    caloriesKcal: 210,
    proteinG: 12,
    carbohydrateG: 28,
    fatG: 6,
    fiberG: 4,
    sodiumMg: 180,
    servings: [],
  })

  // Uma refeição com item e água povoa o diário e, por tabela, o resumo da tela Hoje.
  const log = await postWithCsrf<{ meals: Array<{ id: string }> }>(page, `/api/v1/daily-logs/${today}/meals`, {
    name: 'Almoço',
    mealTime: '12:30',
    position: null,
    requestId: crypto.randomUUID(),
  })
  const meal = log.meals.at(-1)!
  await postWithCsrf(page, `/api/v1/daily-logs/${today}/meals/${meal.id}/items`, {
    itemType: 'FOOD',
    versionId: food.currentVersion.id,
    quantity: 150,
    unit: 'G',
    servingOptionId: null,
    position: null,
    dataQuality: null,
    uncertaintyKcal: null,
    requestId: crypto.randomUUID(),
  })
  await postWithCsrf(page, `/api/v1/daily-logs/${today}/water`, { volumeMl: 500, requestId: crypto.randomUUID() })

  // Pesagem é a única semente com chave única por data: existe no máximo uma por dia, e sobrescrever
  // exige a `version` da atual. Como o beforeAll roda uma vez por projeto de largura, a segunda
  // execução encontraria a pesagem da primeira — então só cria se ainda não houver.
  const existingWeight = await page.request.get(`/api/v1/weight-logs/${today}`)
  if (existingWeight.status() === 404) {
    await putWithCsrf(page, `/api/v1/weight-logs/${today}`, {
      weightKg: 80.4,
      measuredAt: '07:30',
      condition: 'Em jejum',
      notes: 'Semeado pelas guardas de layout.',
    })
  }

  await postWithCsrf(page, '/api/v1/workouts', {
    date: today,
    modality: 'STRENGTH',
    customModality: null,
    title: 'Treino de guarda',
    muscleGroups: ['Peito', 'Tríceps'],
    startTime: '18:00',
    durationMinutes: 55,
    estimatedKcal: 320,
    notes: null,
    requestId: crypto.randomUUID(),
  })
}

/**
 * Espera o conteúdo, não a rede.
 *
 * Cobre as duas formas de espera do app: o spinner e o esqueleto. Esperar só pelo spinner tornou-se
 * insuficiente quando os carregamentos passaram a mostrar esqueletos — a espera virava vazia, e a
 * página podia ser medida no meio do carregamento, o que produzia uma falha a cada tantas execuções
 * sem nada de errado no layout.
 */
async function settle(page: Page) {
  await expect(page.getByRole('main')).toBeVisible()
  await expect
    .poll(() => page.locator('.route-spinner, [aria-busy="true"]').count(), { timeout: 15_000 })
    .toBe(0)
}

function measure(page: Page, floors: { font: number; tap: number }): Promise<Measurement> {
  return page.evaluate(({ font, tap }) => {
    // Identidade estável de um elemento, insensível a quantos deles existem: uma lista com 3 ou
    // com 90 alimentos produz o mesmo `.meal-actions button.icon-button`. É o que permite a linha
    // de base não depender de quantos registros os outros testes deixaram no banco.
    //
    // O ancestral com classe entra no descritor porque metade dos controles do app não tem classe
    // própria — sem ele, todo campo de texto do produto viraria o mesmo `input` e um campo novo
    // fora do padrão passaria despercebido numa rota que já tivesse um.
    const own = (element: Element) => {
      const classes = Array.from(element.classList).sort().join('.')
      return `${element.tagName.toLowerCase()}${classes ? `.${classes}` : ''}`
    }
    const describe = (element: Element) => {
      let ancestor = element.parentElement
      for (let hops = 0; hops < 3 && ancestor; hops += 1) {
        if (ancestor.classList.length > 0) return `${own(ancestor)} ${own(element)}`
        ancestor = ancestor.parentElement
      }
      return own(element)
    }
    const distinct = (values: string[]) => Array.from(new Set(values)).sort()
    const visible = (element: HTMLElement) => element.offsetParent !== null

    const limit = document.documentElement.clientWidth
    const overflowing = document.documentElement.scrollWidth <= limit + 1
      ? []
      : distinct(
        Array.from(document.querySelectorAll('body *'))
          .filter((element) => element.getBoundingClientRect().right > limit + 1)
          .map(describe),
      ).slice(0, 10)

    const controlsUnderFontFloor = distinct(
      Array.from(document.querySelectorAll<HTMLInputElement>('input, select, textarea'))
        .filter((element) => visible(element) && element.type !== 'hidden')
        .filter((element) => Number.parseFloat(getComputedStyle(element).fontSize) < font)
        .map(describe),
    )

    const interactive = 'button, a[href], [role="button"], input[type="checkbox"], input[type="radio"]'
    const targetsUnderTapFloor = distinct(
      Array.from(document.querySelectorAll<HTMLElement>(interactive))
        .filter(visible)
        // Link dentro de texto corrido é isento: a WCAG abre exceção justamente porque engordar uma
        // palavra no meio de um parágrafo estragaria o parágrafo. O teste é o `display` calculado,
        // não a tag — um `<a>` que virou bloco ou flex é botão e continua sendo cobrado.
        .filter((element) => getComputedStyle(element).display !== 'inline')
        .filter((element) => {
          // Numa caixa de seleção, o alvo é o RÓTULO — quem toca acerta a palavra, não o quadrado
          // de 15px. Medir o input puniria o desenho correto e forçaria uma caixa deformada.
          const target = element instanceof HTMLInputElement ? element.closest('label') ?? element : element
          const box = target.getBoundingClientRect()
          // Caixa zerada é elemento ainda não pintado ou fora de tela, não alvo pequeno.
          return box.width > 0 && box.height > 0 && (box.width < tap || box.height < tap)
        })
        .map(describe),
    )

    return { overflowing, controlsUnderFontFloor, targetsUnderTapFloor }
  }, floors)
}

/**
 * Catraca com a mesma filosofia da de CSS, e uma diferença deliberada: uma entrada obsoleta aqui
 * não falha, só é anotada no relatório. Um descritor pode sumir porque a correção foi feita ou
 * porque a rota calhou de estar sem dados nesta execução, e não há como separar os dois casos sem
 * semear o banco inteiro. Quem garante o encolhimento é a catraca estática, que não depende de
 * dado nenhum; esta aqui garante que nada novo entre.
 */
function assertRatchet(key: string, offenders: string[]) {
  collected[key] = offenders
  if (updating) return

  const known = new Set(baseline[key] ?? [])
  expect(offenders.filter((offender) => !known.has(offender)), `${key}: violação nova`).toEqual([])

  const stale = (baseline[key] ?? []).filter((offender) => !offenders.includes(offender))
  if (stale.length > 0) {
    test.info().annotations.push({
      type: 'catraca-frouxa',
      description: `${key}: ${stale.length} já corrigida(s); rodar UPDATE_LAYOUT_BASELINE=1 para apertar — ${stale.join(', ')}`,
    })
  }
}

test.beforeAll(async ({ browser }) => {
  const page = await browser.newPage()
  await signIn(page)
  // A data vem do servidor, não do relógio do runner: é o fuso do perfil que decide qual dia o app
  // considera "hoje", e semear o dia errado deixaria o diário e a tela Hoje vazios.
  const { today } = await page.request.get('/api/v1/profile/time-context').then((response) => response.json()) as { today: string }
  await seedEveryListedRoute(page, today)
  await page.close()
})

for (const route of ROUTES) {
  test(`layout de ${route}`, async ({ page }, testInfo) => {
    const scope = `${testInfo.project.name}|${route}`

    await signIn(page)
    await page.goto(route)
    await settle(page)

    if (screenshotDir) {
      const name = route === '/' ? 'home' : route.replaceAll('/', '-').replace(/^-/, '')
      await page.screenshot({ fullPage: true, path: join(screenshotDir, testInfo.project.name, `${name}.png`) })
    }

    const { overflowing, controlsUnderFontFloor, targetsUnderTapFloor } = await measure(page, {
      font: MIN_CONTROL_FONT_PX,
      tap: MIN_TAP_PX - TAP_TOLERANCE_PX,
    })

    // Rolagem horizontal é a única verificação sem linha de base: uma tela que rola de lado no
    // celular é sempre defeito. Nomear quem ultrapassa a borda é o que transforma a falha em
    // conserto, em vez de mandar alguém caçar o culpado no DevTools.
    expect(overflowing, `${scope}: conteúdo ultrapassa a largura da tela`).toEqual([])

    assertRatchet(`${scope}|campo-abaixo-de-16px`, controlsUnderFontFloor)
    assertRatchet(`${scope}|alvo-abaixo-de-44px`, targetsUnderTapFloor)
  })
}

test.afterAll(() => {
  if (!updating) return
  // Só as chaves medidas nesta execução são reescritas, para apertar um projeto de largura sem
  // apagar o que os outros dois mediram.
  const merged = { ...baseline, ...collected }
  const ordered = Object.fromEntries(Object.keys(merged).sort().map((key) => [key, merged[key]]))
  writeFileSync(BASELINE_PATH, `${JSON.stringify(ordered, null, 2)}\n`)
})
