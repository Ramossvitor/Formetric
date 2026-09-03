import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { getErrorMessage } from '../api/http'
import { sessionQuery, useLogout } from '../auth/queries'
import { Icon, type IconName } from '../components/Icon'

interface Destination {
  icon: IconName
  label: string
  note: string
  to: string
}

/**
 * O que não cabe nos quatro slots da barra: biblioteca, planejamento, conta.
 *
 * Antes esses destinos moravam dentro da tela de Perfil, abaixo do formulário de dados pessoais —
 * quem procurava "Alimentos" tinha de saber que a resposta estava sob uma tela chamada Perfil, e
 * rolar por ela. Separar o MENU do formulário deixa cada um com um propósito só.
 */
const library: Destination[] = [
  { icon: 'food', label: 'Alimentos', note: 'Seu catálogo, marcas e porções', to: '/foods' },
  { icon: 'recipe', label: 'Receitas', note: 'Preparos com cálculo por porção', to: '/recipes' },
]

const planning: Destination[] = [
  { icon: 'sparkle', label: 'Metas nutricionais', note: 'Faixas por nutriente e classificação do dia', to: '/settings/nutrition-goals' },
  { icon: 'trend', label: 'TDEE', note: 'Gasto energético que calcula o saldo', to: '/settings/tdee' },
]

function DestinationList({ destinations, label }: { destinations: Destination[]; label: string }) {
  return (
    <nav aria-label={label} className="hub-list surface-card">
      {destinations.map((destination) => (
        <Link className="hub-item" key={destination.to} to={destination.to}>
          <span className="hub-icon"><Icon name={destination.icon} /></span>
          <span className="hub-copy">
            <strong>{destination.label}</strong>
            <small>{destination.note}</small>
          </span>
          <span aria-hidden="true" className="hub-chevron"><Icon name="chevron" size={16} /></span>
        </Link>
      ))}
    </nav>
  )
}

export function MorePage() {
  const { data: session } = useQuery(sessionQuery)
  const logout = useLogout()
  const isOwner = session?.user.role === 'OWNER'

  const account: Destination[] = [
    { icon: 'settings', label: 'Perfil', note: 'Nome, idioma, fuso e unidades', to: '/profile' },
    ...(isOwner ? [{ icon: 'plus' as IconName, label: 'Convites', note: 'Quem pode criar conta no Formetric', to: '/settings/invitations' }] : []),
  ]

  return (
    <main id="conteudo">
      <header className="page-heading">
        <div>
          <p className="eyebrow">Menu</p>
          <h1>Mais</h1>
        </div>
      </header>

      <h2 className="hub-section-title">Biblioteca</h2>
      <DestinationList destinations={library} label="Biblioteca" />

      <h2 className="hub-section-title">Planejamento</h2>
      <DestinationList destinations={planning} label="Planejamento" />

      <h2 className="hub-section-title">Conta</h2>
      <DestinationList destinations={account} label="Conta" />

      <button className="secondary-button logout-action" disabled={logout.isPending} onClick={() => logout.mutate()} type="button">
        <Icon name="logout" size={18} />
        {logout.isPending ? 'Saindo…' : 'Sair da conta'}
      </button>
      {logout.isError ? <p className="form-error" role="alert">{getErrorMessage(logout.error)}</p> : null}
    </main>
  )
}
