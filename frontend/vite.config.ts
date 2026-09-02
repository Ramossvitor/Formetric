import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // O registro é feito pelo código do app, e não por um script injetado no HTML: o aviso de
      // nova versão precisa ser um componente React em português, e não o recarregamento silencioso
      // que o modo automático faz.
      injectRegister: null,
      registerType: 'prompt',
      includeAssets: ['favicon.svg', 'icons/apple-touch-icon.png'],
      manifest: {
        // `id` fixo: é o que identifica o app para o sistema operacional. Mudá-lo depois de alguém
        // instalar cria um SEGUNDO app em vez de atualizar o primeiro.
        id: '/',
        name: 'Formetric',
        short_name: 'Formetric',
        description: 'Acompanhamento integrado de nutrição, treino e evolução corporal.',
        lang: 'pt-BR',
        dir: 'ltr',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        display_override: ['standalone', 'minimal-ui'],
        // Sem `orientation`: a partir de 840px o app tem uma barra lateral de verdade, e travar em
        // retrato mataria o uso em tablet — e o valor fica congelado até a reinstalação.
        categories: ['health', 'fitness', 'lifestyle'],
        // Iguais aos tokens de --background em src/index.css. Estavam divergentes no index.html
        // (#f4f6f2 e #0e1210), o que dava uma faixa de cor ligeiramente errada no topo da tela.
        theme_color: '#f3f5f1',
        background_color: '#f3f5f1',
        // Atalhos do ícone instalado. Ficam por último de propósito: um atalho é congelado no
        // sistema até a reinstalação, então os endereços que ele aponta viram contrato permanente.
        // `?action=quick` e `?action=new` continuam sendo lidos pelas telas e não mudam mais.
        shortcuts: [
          { name: 'Registrar refeição', short_name: 'Refeição', url: '/diary?action=quick' },
          { name: 'Registrar treino', short_name: 'Treino', url: '/workouts?action=new' },
          { name: 'Registrar peso', short_name: 'Peso', url: '/progress/weight?action=new' },
        ],
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          // Separado do comum: sistemas que aplicam máscara recortam até 20% de cada borda.
          { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Só a casca entra no precache: HTML, JS, CSS e ícones. Nada de `/api`.
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: '/index.html',
        // Sem isto, uma chamada de API que falhasse receberia o HTML do app como resposta, e o
        // `response.json()` quebraria com um erro de sintaxe em vez do erro de rede que era.
        navigateFallbackDenylist: [/^\/api\//, /^\/actuator\//, /^\/v3\//, /^\/swagger/],
        // Nenhuma rota de dados é cacheada. Num app de dieta multi-tenant, servir o registro de
        // ontem como se fosse o de hoje — ou o de outra conta depois de uma troca de sessão — é
        // pior do que não funcionar offline.
        runtimeCaching: [],
        cleanupOutdatedCaches: true,
      },
      devOptions: {
        // O service worker fica fora do `npm run dev`: nada mais confuso do que depurar uma
        // alteração que não aparece porque o worker antigo serviu a versão anterior.
        enabled: false,
      },
    }),
  ],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
})
