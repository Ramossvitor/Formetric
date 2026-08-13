import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet } from 'react-router-dom'
import { getErrorMessage } from '../api/http'
import { sessionQuery, useLogout } from '../auth/queries'
import { Brand } from '../components/Brand'
import { Icon, type IconName } from '../components/Icon'

const navigation: Array<{ label: string; icon: IconName; to: string }> = [
  { label: 'Hoje', icon: 'home', to: '/' },
  { label: 'Diário', icon: 'book', to: '/diary' },
  { label: 'Evolução', icon: 'trend', to: '/progress/evaluations' },
  { label: 'Perfil', icon: 'settings', to: '/profile' },
]

const catalogNavigation: Array<{ label: string; icon: IconName; to: string }> = [
  { label: 'Alimentos', icon: 'food', to: '/foods' },
  { label: 'Receitas', icon: 'recipe', to: '/recipes' },
]

const trackingNavigation: Array<{ label: string; icon: IconName; to: string }> = [
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

export function AuthenticatedLayout() {
  const [quickAddOpen, setQuickAddOpen] = useState(false)
  const { data: session } = useQuery(sessionQuery)
  const logout = useLogout()
  const user = session?.user

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setQuickAddOpen(false)
    }

    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [])

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
        <header className="mobile-header">
          <Brand />
          <Link className="avatar avatar-link" to="/profile" aria-label="Abrir perfil">
            {initials(user?.displayName ?? '')}
          </Link>
        </header>

        <Outlet />

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
          <div className="shell-dialog-backdrop" onMouseDown={(event) => {
            if (event.currentTarget === event.target) setQuickAddOpen(false)
          }}>
            <section aria-labelledby="quick-add-title" aria-modal="true" className="quick-add-menu surface-card" role="dialog">
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
            </section>
          </div>
        ) : null}
      </div>
    </div>
  )
}
