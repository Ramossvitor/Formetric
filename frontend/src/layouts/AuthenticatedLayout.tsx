import { useQuery } from '@tanstack/react-query'
import { Link, NavLink, Outlet } from 'react-router-dom'
import { getErrorMessage } from '../api/http'
import { sessionQuery, useLogout } from '../auth/queries'
import { Brand } from '../components/Brand'
import { Icon, type IconName } from '../components/Icon'

const navigation: Array<{ label: string; icon: IconName; to: string }> = [
  { label: 'Hoje', icon: 'home', to: '/' },
  { label: 'Diário', icon: 'book', to: '/diary' },
  { label: 'Evolução', icon: 'trend', to: '/progress' },
  { label: 'Perfil', icon: 'settings', to: '/profile' },
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
        </nav>

        <button className="primary-action" type="button">
          <Icon name="plus" />
          Novo registro
        </button>

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
          <button aria-label="Abrir cadastro rápido" className="quick-add" type="button">
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
      </div>
    </div>
  )
}
