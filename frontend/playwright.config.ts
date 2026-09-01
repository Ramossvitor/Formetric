import { defineConfig, devices } from '@playwright/test'

const runningInCi = Boolean(process.env.CI)

export default defineConfig({
  testDir: './e2e',
  outputDir: 'test-results',
  fullyParallel: false,
  forbidOnly: runningInCi,
  retries: runningInCi ? 2 : 0,
  workers: 1,
  timeout: 30_000,
  expect: {
    timeout: 8_000,
  },
  reporter: runningInCi
    ? [['line'], ['html', { open: 'never', outputFolder: 'playwright-report' }]]
    : [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:18080',
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium-mobile',
      use: {
        ...devices['Pixel 7'],
      },
    },
    // As guardas de layout repetem em duas larguras mais apertadas que os 412px do Pixel 7 — é
    // nelas que os defeitos desta reforma aparecem. Só elas: os testes de fluxo gravam dados e
    // repeti-los triplicaria o tempo do job sem testar nada de novo. 320px é o piso declarado no
    // `min-width` de index.css; 375px é o iPhone SE, que ainda é o aparelho mais estreito em uso.
    {
      name: 'largura-375',
      testMatch: /layout-guards\.spec\.ts/,
      use: { ...devices['Pixel 7'], viewport: { width: 375, height: 812 } },
    },
    {
      name: 'largura-320',
      testMatch: /layout-guards\.spec\.ts/,
      use: { ...devices['Pixel 7'], viewport: { width: 320, height: 568 } },
    },
  ],
})
