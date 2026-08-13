import type { ReactNode } from 'react'
import './App.css'

type IconName =
  | 'activity'
  | 'book'
  | 'calendar'
  | 'chevron'
  | 'droplet'
  | 'home'
  | 'plus'
  | 'scale'
  | 'settings'
  | 'sparkle'
  | 'trend'

const iconPaths: Record<IconName, ReactNode> = {
  activity: <path d="M4 13h3l2-7 4 13 2-6h5" />,
  book: <path d="M5 4h10a3 3 0 0 1 3 3v13H7a3 3 0 0 1-3-3V5a1 1 0 0 1 1-1Zm2 0v16" />,
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="3" />
      <path d="M8 3v4m8-4v4M3 10h18" />
    </>
  ),
  chevron: <path d="m9 18 6-6-6-6" />,
  droplet: <path d="M12 3s6 6.1 6 11a6 6 0 0 1-12 0c0-4.9 6-11 6-11Z" />,
  home: (
    <>
      <path d="m3 11 9-8 9 8" />
      <path d="M5 10v10h14V10M9 20v-6h6v6" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  scale: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="4" />
      <path d="M8 10a4.3 4.3 0 0 1 8 0l-4 2-4-2Z" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19 13.5v-3l-2-.7a7 7 0 0 0-.8-1.8l.9-1.9L15 4l-1.9.9a7 7 0 0 0-2.2 0L9 4 6.9 6.1 7.8 8A7 7 0 0 0 7 9.8l-2 .7v3l2 .7a7 7 0 0 0 .8 1.8l-.9 1.9L9 20l1.9-.9a7 7 0 0 0 2.2 0l1.9.9 2.1-2.1-.9-1.9a7 7 0 0 0 .8-1.8l2-.7Z" />
    </>
  ),
  sparkle: <path d="m12 3 1.2 4.2L17 9l-3.8 1.8L12 15l-1.2-4.2L7 9l3.8-1.8L12 3Zm6 11 .7 2.3L21 17l-2.3.7L18 20l-.7-2.3L15 17l2.3-.7L18 14ZM5 13l.8 2.2L8 16l-2.2.8L5 19l-.8-2.2L2 16l2.2-.8L5 13Z" />,
  trend: <path d="m4 17 5-5 4 4 7-9m-5 0h5v5" />,
}

function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  return (
    <svg
      aria-hidden="true"
      className="icon"
      fill="none"
      height={size}
      viewBox="0 0 24 24"
      width={size}
    >
      <g stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8">
        {iconPaths[name]}
      </g>
    </svg>
  )
}

const navigation = [
  { label: 'Hoje', icon: 'home' as const, active: true },
  { label: 'Diário', icon: 'book' as const },
  { label: 'Evolução', icon: 'trend' as const },
  { label: 'Perfil', icon: 'settings' as const },
]

const macros = [
  { label: 'Proteína', value: '162', target: '175 g', progress: 93, tone: 'green' },
  { label: 'Carboidratos', value: '178', target: '210 g', progress: 85, tone: 'blue' },
  { label: 'Gorduras', value: '58', target: '65 g', progress: 89, tone: 'orange' },
  { label: 'Fibras', value: '24', target: '30 g', progress: 80, tone: 'purple' },
]

function Brand() {
  return (
    <a className="brand" href="#conteudo" aria-label="Formetric — início">
      <span className="brand-mark" aria-hidden="true">
        <span />
      </span>
      <span>Formetric</span>
    </a>
  )
}

function App() {
  return (
    <div className="app-shell">
      <a className="skip-link" href="#conteudo">
        Pular para o conteúdo
      </a>

      <aside className="sidebar">
        <Brand />
        <nav aria-label="Navegação principal" className="sidebar-nav">
          {navigation.map((item) => (
            <a
              aria-current={item.active ? 'page' : undefined}
              className={item.active ? 'nav-link active' : 'nav-link'}
              href={item.active ? '#conteudo' : `#${item.label.toLowerCase()}`}
              key={item.label}
            >
              <Icon name={item.icon} />
              <span>{item.label}</span>
            </a>
          ))}
        </nav>

        <button className="primary-action" type="button">
          <Icon name="plus" />
          Novo registro
        </button>

        <div className="sidebar-profile">
          <span className="avatar" aria-hidden="true">FR</span>
          <span>
            <strong>Conta de demonstração</strong>
            <small>Prévia local</small>
          </span>
          <Icon name="chevron" size={18} />
        </div>
      </aside>

      <div className="page">
        <header className="mobile-header">
          <Brand />
          <span className="avatar" aria-label="Conta de demonstração">FR</span>
        </header>

        <main id="conteudo">
          <header className="page-heading">
            <div>
              <p className="eyebrow">Resumo diário</p>
              <h1>Hoje</h1>
              <p className="heading-copy">Uma visão clara do seu progresso.</p>
            </div>
            <button className="date-button" type="button">
              <Icon name="calendar" />
              Selecionar data
              <Icon name="chevron" size={16} />
            </button>
          </header>

          <div className="demo-notice" role="note">
            <span className="notice-icon"><Icon name="sparkle" size={16} /></span>
            <span><strong>Prévia da interface.</strong> Todos os valores abaixo são ilustrativos.</span>
          </div>

          <section aria-labelledby="resumo-nutricional" className="nutrition-card surface-card">
            <div className="calorie-summary">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">Consumido</p>
                  <h2 id="resumo-nutricional">Nutrição de hoje</h2>
                </div>
                <span className="status-chip">No ritmo</span>
              </div>

              <div
                aria-label="1.850 de 2.500 quilocalorias consumidas"
                aria-valuemax={2500}
                aria-valuemin={0}
                aria-valuenow={1850}
                className="calorie-progress"
                role="progressbar"
              >
                <div className="calorie-progress-inner">
                  <strong>1.850</strong>
                  <span>de 2.500 kcal</span>
                </div>
              </div>

              <div className="energy-balance">
                <span className="balance-icon"><Icon name="trend" size={18} /></span>
                <span>
                  <small>Saldo previsto</small>
                  <strong>−1.150 kcal</strong>
                </span>
                <span className="estimate-label">estimativa</span>
              </div>
            </div>

            <div className="macro-summary">
              <div className="section-heading compact">
                <div>
                  <p className="eyebrow">Macronutrientes</p>
                  <h2>Metas do dia</h2>
                </div>
                <button className="text-button" type="button">Ver diário</button>
              </div>

              <div className="macro-list">
                {macros.map((macro) => (
                  <div className="macro-item" key={macro.label}>
                    <div className="macro-meta">
                      <span>{macro.label}</span>
                      <span><strong>{macro.value}</strong> / {macro.target}</span>
                    </div>
                    <div
                      aria-label={`${macro.label}: ${macro.progress}% da meta`}
                      aria-valuemax={100}
                      aria-valuemin={0}
                      aria-valuenow={macro.progress}
                      className="linear-progress"
                      role="progressbar"
                    >
                      <span className={`progress-fill ${macro.tone}`} style={{ width: `${macro.progress}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section aria-labelledby="panorama" className="overview-section">
            <div className="section-title-row">
              <div>
                <p className="eyebrow">Panorama</p>
                <h2 id="panorama">O restante do seu dia</h2>
              </div>
              <button className="text-button desktop-only" type="button">Ver detalhes</button>
            </div>

            <div className="overview-grid">
              <article className="metric-card water-card">
                <div className="metric-icon blue"><Icon name="droplet" /></div>
                <div className="metric-copy">
                  <span className="metric-label">Água</span>
                  <strong>3,3 <small>/ 4,4 L</small></strong>
                  <span className="metric-note">Faltam 1,1 L para a meta</span>
                </div>
                <button aria-label="Adicionar água" className="card-action" type="button"><Icon name="plus" size={18} /></button>
                <div aria-hidden="true" className="water-progress"><span /></div>
              </article>

              <article className="metric-card">
                <div className="metric-icon orange"><Icon name="activity" /></div>
                <div className="metric-copy">
                  <span className="metric-label">Treino</span>
                  <strong className="metric-title">Peito + Bíceps</strong>
                  <span className="metric-note">1h10 · concluído</span>
                </div>
                <span className="complete-mark" aria-label="Concluído">✓</span>
              </article>

              <article className="metric-card">
                <div className="metric-icon purple"><Icon name="scale" /></div>
                <div className="metric-copy">
                  <span className="metric-label">Peso</span>
                  <strong>89,8 <small>kg</small></strong>
                  <span className="metric-note positive">↓ 0,4 kg nos últimos 7 dias</span>
                </div>
                <button aria-label="Ver evolução do peso" className="card-action ghost" type="button"><Icon name="chevron" size={18} /></button>
              </article>

              <article className="metric-card cycle-card">
                <div className="metric-copy cycle-copy">
                  <span className="metric-label">Ciclo atual</span>
                  <strong>28 de 35 dias</strong>
                  <span className="metric-note">91,5 kg → 89,8 kg</span>
                </div>
                <div className="cycle-progress" role="progressbar" aria-label="Ciclo atual: 28 de 35 dias" aria-valuemin={0} aria-valuemax={35} aria-valuenow={28}>
                  <span />
                </div>
                <span className="cycle-percent">80%</span>
              </article>
            </div>
          </section>

          <p className="preview-footnote">Esta tela é uma demonstração visual; nenhum dado foi registrado ou calculado.</p>
        </main>

        <nav aria-label="Navegação principal" className="bottom-nav">
          <a aria-current="page" className="bottom-nav-item active" href="#conteudo">
            <Icon name="home" />
            <span>Hoje</span>
          </a>
          <a className="bottom-nav-item" href="#diário">
            <Icon name="book" />
            <span>Diário</span>
          </a>
          <button aria-label="Abrir cadastro rápido" className="quick-add" type="button">
            <span><Icon name="plus" size={26} /></span>
            <small>Adicionar</small>
          </button>
          <a className="bottom-nav-item" href="#evolução">
            <Icon name="trend" />
            <span>Evolução</span>
          </a>
          <a className="bottom-nav-item" href="#perfil">
            <Icon name="settings" />
            <span>Perfil</span>
          </a>
        </nav>
      </div>
    </div>
  )
}

export default App
