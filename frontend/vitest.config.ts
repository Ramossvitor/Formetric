import { configDefaults, defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    exclude: [...configDefaults.exclude, 'e2e/**'],
    globals: true,
    setupFiles: './src/test/setup.ts',
    // Os testes exercitam o app inteiro em jsdom, e a suíte roda vários arquivos em paralelo.
    // A margem existe para contenção de CPU em runner compartilhado, não para acomodar teste
    // lento: o custo por teste é mantido baixo em src/test/user.ts.
    testTimeout: 15000,
  },
})
