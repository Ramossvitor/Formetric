import { expect, test } from '@playwright/test'

// A camada de PWA quebra em silêncio. Se o manifesto voltar a exigir autenticação, ou o service
// worker passar a ser servido de cache, nada na interface muda: o app simplesmente deixa de ser
// instalável, ou fica preso numa versão antiga sem ninguém entender por quê. São três verificações
// baratas contra três falhas invisíveis.

test('serve os arquivos de PWA sem sessão e sem cache', async ({ page }) => {
  // Deliberadamente SEM login: o navegador busca estes arquivos antes de existir sessão, e o
  // registro do service worker acontece sem credenciais.
  const manifest = await page.request.get('/manifest.webmanifest')
  await expect(manifest).toBeOK()
  // O tipo é exigido pela especificação, e validadores de instalabilidade recusam sem ele — o que
  // apareceria como "o app não é instalável", sem indicar o motivo.
  expect(manifest.headers()['content-type']).toContain('application/manifest+json')
  expect(manifest.headers()['cache-control']).toContain('no-cache')

  const body = await manifest.json() as { id: string; start_url: string; icons: Array<{ purpose?: string }> }
  // `id` fixo: mudá-lo depois de alguém instalar cria um SEGUNDO app em vez de atualizar o
  // primeiro, e o antigo fica órfão na tela de início.
  expect(body.id).toBe('/')
  expect(body.start_url).toBe('/')
  // Sem ícone com máscara, o Android recorta o ícone comum e o anel da marca fica cortado.
  expect(body.icons.some((icon) => icon.purpose === 'maskable')).toBe(true)

  const worker = await page.request.get('/sw.js')
  await expect(worker).toBeOK()
  // O nome do worker é fixo e é ele quem decide qual versão o usuário recebe: servido de cache, um
  // worker antigo continuaria entregando a versão anterior depois do deploy.
  expect(worker.headers()['cache-control']).toContain('no-cache')

  const icon = await page.request.get('/icons/icon-192.png')
  await expect(icon).toBeOK()
})

test('não deixa o service worker responder por chamadas de API', async ({ page }) => {
  // O fallback de navegação devolve o index.html para rotas desconhecidas, que é o que faz o
  // recarregamento funcionar em qualquer rota do app. Se ele alcançasse `/api`, uma chamada falha
  // receberia HTML e o `response.json()` quebraria com erro de sintaxe em vez do erro de rede real.
  const apiResponse = await page.request.get('/api/v1/auth/session')
  expect(apiResponse.headers()['content-type'] ?? '').not.toContain('text/html')
})
