import { useIsFetching, useQuery } from '@tanstack/react-query'
import { useEffect, useState, type ReactNode } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { getErrorMessage } from '../api/http'
import { sessionQuery, useLogout } from '../auth/queries'
import { Brand } from '../components/Brand'
import { ErrorBoundary } from '../components/ErrorBoundary'
import { useModalBehavior } from '../components/useModalBehavior'
import { Icon, type IconName } from '../components/Icon'
import { useConnectionStatus } from './useConnectionStatus'
import { useKeyboardInset } from './useKeyboardInset'

// Quatro destinos e um botão de adicionar, para dez telas. "Evolução" e "Mais" são portas, não
// telas finais: cada uma reúne o que não cabia na barra, e nenhum destino do app fica sem caminho
// previsível — treinos, por exemplo, só era alcançável pelo cadastro rápido.
const navigation: Array<{ label: string; icon: IconName; to: string }> = [
  { label: 'Hoje', icon: 'home', to: '/' },
  { label: 'Diário', icon: 'book', to: '/diary' },
  { label: 'Evolução', icon: 'trend', to: '/progress' },
  { label: 'Mais', icon: 'settings', to: '/more' },
]

const catalogNavigation: Array<{ label: string; icon: IconName; to: string }> = [
  { label: 'Alimentos', icon: 'food', to: '/foods' },
  { label: 'Receitas', icon: 'recipe', to: '/recipes' },
]

const trackingNavigation: Array<{ label: string; icon: IconName; to: string }> = [
  { label: 'Análises', icon: 'trend', to: '/analytics/monthly' },
  { label: 'Peso', icon: 'scale', to: '/progress/weight' },
  { label: 'Treinos', icon: 'activity', to: '/workouts' },
]

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
  const deep = !navigation.some((item) => item.to === location.pathname)
  // `location.key` é 'default' na primeira entrada do histórico: aí voltar sairia do app, e o
  // caminho certo é subir para a tela inicial.
  const canGoBack = location.key !== 'default'
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
        <nav aria-label="Navegação principal" className="sidebar-nav">
          {navigation.map((item) => (
            <NavLink
              className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
              end={item.to === '/'}
              key={item.to}
              to={item.to}
            >
              <Icon name={item.icon} />
              <span>{item.label}</span>
            </NavLink>
          ))}
          <span className="nav-section-label">Acompanhamento</span>
          {trackingNavigation.map((item) => (
            <NavLink
              className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
              key={item.to}
              to={item.to}
            >
              <Icon name={item.icon} />
              <span>{item.label}</span>
            </NavLink>
          ))}
          <span className="nav-section-label">Biblioteca</span>
          {catalogNavigation.map((item) => (
            <NavLink
              className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
              key={item.to}
              to={item.to}
            >
              <Icon name={item.icon} />
              <span>{item.label}</span>
            </NavLink>
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
          {navigation.slice(0, 2).map((item) => (
            <NavLink
              className={({ isActive }) => (isActive ? 'bottom-nav-item active' : 'bottom-nav-item')}
              end={item.to === '/'}
              key={item.to}
              to={item.to}
            >
              <Icon name={item.icon} />
              <span>{item.label}</span>
            </NavLink>
          ))}
          <button aria-expanded={quickAddOpen} aria-label="Abrir cadastro rápido" className="quick-add" onClick={() => setQuickAddOpen(true)} type="button">
            <span><Icon name="plus" size={26} /></span>
            <small>Adicionar</small>
          </button>
          {navigation.slice(2).map((item) => (
            <NavLink
              className={({ isActive }) => (isActive ? 'bottom-nav-item active' : 'bottom-nav-item')}
              key={item.to}
              to={item.to}
            >
              <Icon name={item.icon} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        {quickAddOpen ? (
          <QuickAddSheet onClose={() => setQuickAddOpen(false)}>
              <div className="dialog-heading">
                <div><p className="eyebrow">Cadastro rápido</p><h2 id="quick-add-title">O que deseja registrar?</h2></div>
                <button aria-label="Fechar" className="icon-button dialog-close" onClick={() => setQuickAddOpen(false)} type="button">×</button>
              </div>
              <div className="shell-quick-actions">
                <Link onClick={() => setQuickAddOpen(false)} to="/diary?action=quick"><Icon name="food" /><span><strong>Alimentação ou água</strong><small>Abrir cadastro do diário</small></span></Link>
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
