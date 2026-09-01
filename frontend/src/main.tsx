import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { ErrorBoundary } from './components/ErrorBoundary'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      // Sem tempo de frescor, toda remontagem de componente refazia a requisição — e no celular
      // trocar de aba da navegação inferior remonta a tela inteira. Trinta segundos cobrem o
      // vaivém entre telas sem nunca esconder uma alteração que o próprio usuário acabou de fazer,
      // porque as mutações escrevem no cache ou o invalidam explicitamente.
      staleTime: 30_000,
      gcTime: 10 * 60 * 1000,
      // O padrão são três tentativas com espera crescente: uma falha real levava cerca de sete
      // segundos para virar mensagem na tela, tempo em que o app parece travado.
      retry: 1,
    },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        {/* Último recurso: pega o que escapar das barreiras internas, inclusive o que acontece
            acima do layout — o provedor de data e fuso, por exemplo. */}
        <ErrorBoundary scope="no aplicativo"><App /></ErrorBoundary>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
)
