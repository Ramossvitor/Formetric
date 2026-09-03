import { useIsFetching, useQuery } from '@tanstack/react-query'
import { useEffect, useState, type ReactNode } from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { getErrorMessage } from '../api/http'
import { sessionQuery, useLogout } from '../auth/queries'
import { Brand } from '../components/Brand'
import { ErrorBoundary } from '../components/ErrorBoundary'
import { useModalBehavior } from '../components/useModalBehavior'
import { Icon } from '../components/Icon'
import { InstallPrompt } from '../pwa/InstallPrompt'
import { UpdatePrompt } from '../pwa/UpdatePrompt'
import { useConnectionStatus } from './useConnectionStatus'
import { isDeepRoute, NAVIGATION, slotFor } from './navigation'
import { useKeyboardInset } from './useKeyboardInset'

// Quatro destinos e um botão de adicionar. "Evolução" e "Mais" são portas, não telas finais.
// Qual deles fica aceso é decisão de `./navigation`, e as duas barras — a de baixo no celular e a
// lateral no desktop — consomem a mesma lista, para que as duas plataformas tenham uma árvore só.

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')
}

function QuickAddSheet({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  const panelRef = useModalBehavior({ onClose })

  return (
    <div className="shell-dialog-backdrop" onMouseDown={(event) => {
      if (event.currentTarget === event.target) onClose()
    }}>
      <section aria-labelledby="quick-add-title" aria-modal="true" className="quick-add-menu surface-card" ref={panelRef} role="dialog" tabIndex={-1}>
        {children}
      </section>
    </div>
  )
}

export function AuthenticatedLayout() {
  const [quickAddOpen, setQuickAddOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  const online = useConnectionStatus()
  // Telas fora dos quatro destinos da barra são "profundas": num app instalado não há botão voltar
  // do navegador, e sair de /foods/:id dependia do gesto do sistema, que no iOS praticamente não
  // existe em modo standalone.
  const deep = isDeepRoute(location.pathname)
  const slot = slotFor(location.pathname)
  // O react-router guarda a posição de cada entrada em `history.state.idx`, e 0 é a primeira do
  // app: aí voltar sairia dele, e o caminho certo é subir para a tela inicial. `location.key` não
  // serve para isso porque um `replace` — os atalhos do ícone instalado e a troca de data fazem um —
  // troca a chave da primeira entrada sem criar uma segunda, e o botão voltava para o nada.
  const historyIndex = (window.history.state as { idx?: number } | null)?.idx ?? 0
  const canGoBack = historyIndex > 0
  // Com o conteúdo anterior preservado durante a troca de data ou de busca, é esta barra que diz
  // que algo está a caminho. Um lugar só, para nenhuma tela precisar montar o próprio indicador.
  const updating = useIsFetching() > 0
  useKeyboardInset()

  // Trocar de tela sem voltar ao topo deixava o usuário no meio de uma página nova, na altura em
  // que a anterior estava — o efeito é mais confuso quanto mais longa era a tela de origem, e o
  // diário é a mais longa do app.
  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [location.pathname])
  const { data: session } = useQuery(sessionQuery)
  const logout = useLogout()
  const user = session?.user

  return (
    <div className="app-shell">
      <a className="skip-link" href="#conteudo">
        Pular para o conteúdo
      </a>

      <aside className="sidebar">
        <Brand />
        {/* `Link`, não `NavLink`: o item aceso é decidido por `slotFor`, e o `aria-current` tem
            de vir da mesma decisão. O `NavLink` calcula o dele por casamento de caminho próprio,
            e em /workouts ou /foods anunciava "nenhum" enquanto o slot estava aceso. */}
        <nav aria-label="Navegação principal" className="sidebar-nav">
          {NAVIGATION.map((item) => (
            <Link
              aria-current={slot === item.to ? 'page' : undefined}
              className={slot === item.to ? 'nav-link active' : 'nav-link'}
              key={item.to}
              to={item.to}
            >
              <Icon name={item.icon} />
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>

        <Link className="primary-action" to="/foods/new">
          <Icon name="plus" />
          Novo alimento
        </Link>

        <div className="sidebar-profile">
          <span className="avatar" aria-hidden="true">{initials(user?.displayName ?? '')}</span>
          <span>
            <strong>{user?.displayName}</strong>
            <small>{user?.email}</small>
          </span>
          <button
            aria-label="Sair da conta"
            className="icon-button"
            disabled={logout.isPending}
            onClick={() => logout.mutate()}
            type="button"
          >
            <Icon name="logout" size={18} />
          </button>
        </div>
        {logout.isError ? <p className="sidebar-error" role="alert">{getErrorMessage(logout.error)}</p> : null}
      </aside>

      <div className="page">
        {updating ? <span aria-hidden="true" className="updating-bar" /> : null}

        {/* Os avisos de PWA são acessórios e vivem no shell, fora da barreira que protege as
            telas. Isolá-los garante que uma falha neles — uma API do navegador ausente, por
            exemplo — não apague o aplicativo inteiro por causa de um convite de instalação. */}
        <ErrorBoundary scope="nos avisos do aplicativo">
          <UpdatePrompt />
          <InstallPrompt />
        </ErrorBoundary>

        {online ? null : (
          <p className="offline-banner" role="status">
            <Icon name="sparkle" size={16} />
            Sem conexão. O que você registrar agora pode não ser salvo.
          </p>
        )}

        <header className="mobile-header">
          {deep ? (
            <button
              aria-label="Voltar"
              className="icon-button header-back"
              onClick={() => (canGoBack ? navigate(-1) : navigate('/'))}
              type="button"
            >
              <Icon name="chevron" size={20} />
            </button>
          ) : <Brand />}
          <Link className="avatar avatar-link" to="/profile" aria-label="Abrir perfil">
            {initials(user?.displayName ?? '')}
          </Link>
        </header>

        {/* A barreira fica DENTRO do layout: uma tela que quebra não pode levar junto a navegação
            inferior e o cabeçalho, que são o caminho de saída. A chave de reinício é o caminho da
            rota, então navegar limpa o erro. */}
        <ErrorBoundary resetKey={location.pathname} scope="esta tela"><Outlet /></ErrorBoundary>

        <nav aria-label="Navegação principal" className="bottom-nav">
          {NAVIGATION.slice(0, 2).map((item) => (
            <Link
              aria-current={slot === item.to ? 'page' : undefined}
              className={slot === item.to ? 'bottom-nav-item active' : 'bottom-nav-item'}
              key={item.to}
              to={item.to}
            >
              <Icon name={item.icon} />
              <span>{item.label}</span>
            </Link>
          ))}
          <button aria-expanded={quickAddOpen} aria-label="Abrir cadastro rápido" className="quick-add" onClick={() => setQuickAddOpen(true)} type="button">
            <span><Icon name="plus" size={26} /></span>
            <small>Adicionar</small>
          </button>
          {NAVIGATION.slice(2).map((item) => (
            <Link
              aria-current={slot === item.to ? 'page' : undefined}
              className={slot === item.to ? 'bottom-nav-item active' : 'bottom-nav-item'}
              key={item.to}
              to={item.to}
            >
              <Icon name={item.icon} />
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>

        {quickAddOpen ? (
          <QuickAddSheet onClose={() => setQuickAddOpen(false)}>
              <div className="dialog-heading">
                <div><p className="eyebrow">Cadastro rápido</p><h2 id="quick-add-title">O que deseja registrar?</h2></div>
                <button aria-label="Fechar" className="icon-button dialog-close" onClick={() => setQuickAddOpen(false)} type="button">×</button>
              </div>
              <div className="shell-quick-actions">
                <Link onClick={() => setQuickAddOpen(false)} to="/?action=quick"><Icon name="food" /><span><strong>Alimentação ou água</strong><small>Abrir cadastro do diário</small></span></Link>
                <Link onClick={() => setQuickAddOpen(false)} to="/workouts?action=new"><Icon name="activity" /><span><strong>Treino</strong><small>Registrar uma sessão</small></span></Link>
                <Link onClick={() => setQuickAddOpen(false)} to="/progress/weight?action=new"><Icon name="scale" /><span><strong>Peso</strong><small>Adicionar a pesagem do dia</small></span></Link>
                <Link onClick={() => setQuickAddOpen(false)} to="/progress/evaluations/new"><Icon name="trend" /><span><strong>Avaliação corporal</strong><small>Criar um snapshot de medidas</small></span></Link>
              </div>
          </QuickAddSheet>
        ) : null}
      </div>
    </div>
  )
}
