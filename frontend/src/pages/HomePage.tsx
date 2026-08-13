import { Icon } from '../components/Icon'

const macros = [
  { label: 'Proteína', value: '162', target: '175 g', progress: 93, tone: 'green' },
  { label: 'Carboidratos', value: '178', target: '210 g', progress: 85, tone: 'blue' },
  { label: 'Gorduras', value: '58', target: '65 g', progress: 89, tone: 'orange' },
  { label: 'Fibras', value: '24', target: '30 g', progress: 80, tone: 'purple' },
]

export function HomePage() {
  return (
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
            <button aria-label="Adicionar água" className="card-action" type="button">
              <Icon name="plus" size={18} />
            </button>
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
            <button aria-label="Ver evolução do peso" className="card-action ghost" type="button">
              <Icon name="chevron" size={18} />
            </button>
          </article>

          <article className="metric-card cycle-card">
            <div className="metric-copy cycle-copy">
              <span className="metric-label">Ciclo atual</span>
              <strong>28 de 35 dias</strong>
              <span className="metric-note">91,5 kg → 89,8 kg</span>
            </div>
            <div
              aria-label="Ciclo atual: 28 de 35 dias"
              aria-valuemax={35}
              aria-valuemin={0}
              aria-valuenow={28}
              className="cycle-progress"
              role="progressbar"
            >
              <span />
            </div>
            <span className="cycle-percent">80%</span>
          </article>
        </div>
      </section>

      <p className="preview-footnote">
        Esta tela é uma demonstração visual; nenhum dado foi registrado ou calculado.
      </p>
    </main>
  )
}
