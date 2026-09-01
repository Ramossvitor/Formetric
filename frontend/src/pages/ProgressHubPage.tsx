import { Link } from 'react-router-dom'
import { Icon, type IconName } from '../components/Icon'

/**
 * Porta única para tudo que é acompanhamento ao longo do tempo.
 *
 * A barra inferior tem cinco posições e o app tem dez destinos. Peso, treinos, avaliações e
 * análises não cabiam nela e viviam espalhados: treinos só era alcançável pelo cadastro rápido, e
 * as análises, por um cartão no fim da tela Hoje. Agrupá-los sob "Evolução" — que já era um dos
 * cinco slots, apontando direto para avaliações — dá a cada um uma porta previsível sem gastar
 * outro slot.
 */
const destinations: Array<{ icon: IconName; label: string; note: string; to: string }> = [
  { icon: 'scale', label: 'Peso', note: 'Pesagens, médias móveis e tendência', to: '/progress/weight' },
  { icon: 'activity', label: 'Treinos', note: 'Sessões registradas e volume por período', to: '/workouts' },
  { icon: 'trend', label: 'Avaliações corporais', note: 'Medidas, dobras e comparações entre datas', to: '/progress/evaluations' },
  { icon: 'calendar', label: 'Resumo mensal', note: 'Consolidado do mês e dias elegíveis', to: '/analytics/monthly' },
  { icon: 'sparkle', label: 'Gráficos', note: 'Séries históricas por métrica', to: '/analytics/charts' },
]

export function ProgressHubPage() {
  return (
    <main id="conteudo">
      <header className="page-heading">
        <div>
          <p className="eyebrow">Acompanhamento</p>
          <h1>Evolução</h1>
          <p className="heading-copy">O que muda ao longo do tempo, reunido num lugar só.</p>
        </div>
      </header>

      <nav aria-label="Acompanhamento" className="hub-list surface-card">
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
    </main>
  )
}
