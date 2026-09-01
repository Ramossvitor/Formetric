VIEWPORT DE REFERÊNCIA 390x844. Gutter lateral 20px (era 18). `main { padding: 12px 20px calc(76px + env(safe-area-inset-bottom) + 40px) }` — folga real de 40px acima de uma nav agora OPACA de 76px, contra os 14px efetivos de hoje sob o FAB. Um scrim de 24px (gradiente --background -> transparent, pointer-events:none) fica colado acima da nav, para o conteúdo desaparecer por baixo em vez de ser guilhotinado.

[0-68] .mobile-header inalterado em conteúdo (Brand + avatar-link para /profile). Passa a `position: sticky; top: 0; z-index: 15; background: var(--background)`. Uma hairline `box-shadow: 0 1px 0 var(--border)` entra com `transition: box-shadow 180ms linear` quando um sentinela de 1px no topo do <main> sai da viewport (IntersectionObserver booleano, uma classe — NÃO um progresso interpolado). O avatar FICA: removê-lo é mudança de shell que atinge as 20 telas.

[80-160] PAGE-HEADING, ~80px. Grid [1fr | auto], align-items: end.
  Coluna 1: `<p class="eyebrow">Resumo diário</p>` 12px/700 uppercase 0.08em --text-soft, margin-bottom 6px, altura 16px. `<h1>` MANTIDO (App.test.tsx:135/:170/:289/:334 dependem dele), com font-size FIXO em 1.75rem (28px)/1.05/700/-0.02em no mobile — o clamp(2rem, 4vw, 2.75rem) sobrevive só em @media (min-width: 840px). Texto atual: 'Hoje' ou formatLongDate(date, locale). O `<p class="heading-copy">Dados registrados, cálculos do sistema e disponibilidade explícita.</p>` é REMOVIDO desta tela (copy de sistema em lugar de título; nenhum teste depende).
  Coluna 2: substitui `.analytics-date-control`. `<label>` com `<span class="visually-hidden">Data do resumo</span>` (preserva a associação para leitor de tela) contendo uma pílula: min-height 44px, padding 0 14px, radius 16px, border 1px --border, background --surface, com `<Icon name="calendar" size={16} />` + rótulo 13px/650 tabular ('Hoje' ou '30 ago'), e o `<input type="date" max={today}>` em `position:absolute; inset:0; opacity:0; width:100%; height:100%` para abrir o picker nativo. O rótulo visível 'Data do resumo' some da tela; o campo continua rotulado.

[176-216] LINHA DE STATUS ÚNICA, 40px, radius 12px, padding 0 14px, display flex, gap 10px, align-items center.
  Mantém `role="note"` e o mesmo `detail` de hoje, porque App.test.tsx:335 faz findByRole('note') esperando 'Registre ou confirme o diário'.
  Conteúdo: ponto de 8px (OPEN --orange, CLOSED --success, MISSING --text-soft) + `<strong>` com diaryStatusLabels[status] em 15px/650 --text + `<span>` com o detail em 15px --text-muted (line-clamp 1 em <=360px, 2 acima). Fundo transparente com border-left de 4px na cor do tom (mantém o vocabulário atual de .analytics-context-*).
  CORTE: o `.status-chip` duplicado dentro do `.section-heading` do nutrition-card (HomePage.tsx:148) deixa de ser renderizado. O mesmo fato aparecia duas vezes na mesma tela; devolve ~64px verticais.

[228-260] `<h2 id="resumo-nutricional">` SOBE para fora do card, como rótulo de seção: 13px/750 uppercase 0.06em --text-soft, altura 32px, margin-bottom 8px. O aria-labelledby do <section> continua apontando para o id, então a estrutura semântica não muda. O `<p class="eyebrow">Consumido</p>` é removido.

[268-...] CARD DE NUTRIÇÃO. A ESTRUTURA `.nutrition-card > .calorie-summary + .macro-summary` É PRESERVADA — isso é deliberado: o desktop (App.css:2884+) transforma o card em `grid-template-columns: minmax(300px,.9fr) minmax(340px,1.1fr)` apoiado exatamente nesses dois blocos, e matá-los obrigaria a reconstruir a Home >=840px. Radius 24px (era 22), border 1px --border, --shadow, overflow hidden. O `radial-gradient` do `.calorie-summary` FICA (é parte do que o dono aprovou; rejeito removê-lo junto com o resto).

  BLOCO A — .calorie-summary, padding 24px 20px 20px.
  A1. ANEL, 200x200 (era 164), stroke 16px, inner 168px (era 132), `margin: 8px auto 20px`. Mantém INTEGRALMENTE `role`, `aria-valuemin/max/now/valuetext`, a classe `.without-target` e o `style={{'--calorie-progress': …}}`.
    - Dentro: `<strong>` 44px/700 tabular-nums letter-spacing -0.03em line-height 1 (era 2rem/760); `<span>` 15px --text-muted margin-top 6px com o texto atual ('meta nominal X kcal' | 'meta não configurada').
    - calories == null: `<MissingValue>Sem registro</MissingValue>` em 20px/650 --text-muted (a regra `.analytics-missing { font-size: .8rem !important }` precisa virar 1.25rem neste contexto) e o anel fica `background: var(--border)` com `box-shadow: inset 0 0 0 1px var(--border-strong)` tracejado. NUNCA 0.
  A2. BLOCO DE FAIXA (novo, substitui o `.daily-goal-state` de calorias), margin-top 20px, envolvido no MESMO `role="group"` com o MESMO aria-label composto de hoje (`Classificação calórica {estágio}: {calorieClassification}`), para não perder nada de leitor de tela.
    - Linha 1, 17px/700, centralizada, tabular, cor por bandTone (POSITIVE --success, NEUTRAL --text, WARNING --orange). Derivação exata a partir de `calorieGoal.reference`:
        reference == null -> 'Sem faixa configurada' em 15px/600 --text-soft, e A2 para aqui (sem barra).
        calories == null -> 'Ainda não registradas' em 15px/600 --text-soft; barra renderizada apenas com trilho e ticks, sem fill.
        remainingToRange > 0 -> 'Faltam {formatGoalAmount(remainingToRange,'CALORIES')} para a faixa'
        remainingToRange === 0 -> 'Precisa ultrapassar {formatGoalAmount(minValue,'CALORIES')}'
        excessOverRange > 0 -> '{formatGoalAmount(excessOverRange,'CALORIES')} acima da faixa'
        excessOverRange === 0 -> 'No limite superior da faixa'
        ambos null com min ou max -> 'Dentro da faixa'
    - Linha 2, BARRA, margin-top 12px: height 10px, radius 999, background --border, position relative, overflow visible.
        escala: `upper = maxValue ?? minValue ?? calorieTargetKcal`; `scaleMax = Math.max(upper ?? 0, calories ?? 0) * 1.12`; `pct(x) = scaleMax > 0 ? clamp(0, 100, x / scaleMax * 100) : 0`.
        fill: `<span>` height 100%, radius inherit, width pct(calories)%, cor por bandTone (POSITIVE --accent-strong, NEUTRAL --blue, WARNING --orange).
        excedente: quando calories > maxValue, um segundo `<span>` absolute de `left: pct(maxValue)%` a `right: calc(100% - pct(calories)%)` em --orange.
        ticks: dois `<span aria-hidden>` absolute, width 2px, height 18px, top -4px, background --text-soft, radius 1px, `left: pct(minValue)%` e `left: pct(maxValue)%`, `transform: translateX(-1px)`. Só quando o respectivo valor existe. É o único elemento da tela que mostra que a meta é uma FAIXA.
    - Linha 3, margin-top 8px, 13px --text-soft, centralizada: `meta {formatGoalRange(reference,'CALORIES')}`.
  A3. SALDO ENERGÉTICO, margin-top 20px, min-height 56px, radius 16px, background --surface-subtle, border 1px --border, padding 0 14px, grid [36px | 1fr | auto], gap 12px, align-items center.
    - `.balance-icon` 36x36 (era 34), radius 12, --primary-soft/--success, Icon trend 18px.
    - Miolo: `<small>` 13px --text-soft ('Saldo previsto' | 'Saldo fechado'); `<strong>` 20px/700 tabular com formatSigned (era 0.82rem). balance == null: `<strong>` vira 15px/650 --text-soft com a mensagem atual.
    - `.estimate-label` 12px/700 uppercase, min-height 24px, padding 0 8px, radius 999, --surface: 'PROJEÇÃO' | 'CONFIRMADO' | 'PENDENTE'.
    - Se `energyBalanceAvailability === 'MISSING_TDEE'`: a linha inteira vira `<Link to="/settings/tdee">` (rota real, App.tsx:69), o chip vira 'CONFIGURAR' em --primary-soft/--primary e um chevron de 16px entra à direita.
  A4. `<p class="daily-tdee">TDEE vigente: …` MANTIDO NA ÍNTEGRA — App.test.tsx:336 faz getByText('TDEE vigente:'). Restyle: 13px --text-soft, centralizado, margin-top 12px, tabular.

  BLOCO B — .macro-summary, padding 20px, border-top 1px --border, background --surface-subtle.
  B1. Cabeçalho `.section-heading.compact`: o eyebrow 'Nutrientes' sai; `<h2>Classificação das metas</h2>` vira 17px/650; o `<Link class="text-button">Ver diário</Link>` fica com 15px/650 e min-height 44px.
  B2. `.macro-list`: `gap: 0`, `margin-top: 16px`. Cada `.macro-item` vira uma linha de ~70px com `padding: 14px 0` e `border-top: 1px solid var(--hairline)` (o primeiro sem borda). Substitui o `gap: 21px` atual.
    - Sub-linha 1 (`.macro-meta`, flex baseline, gap 12px): nome 15px/600 --text à esquerda; à direita `<strong>` 17px/700 tabular + ' g' 13px/600 --text-muted. `value == null` -> 'Não informado' em 15px/600 --text-soft (string atual mantida). A parte ` / meta …` sai da sub-linha 1 e vai para a sub-linha 3.
    - Sub-linha 2, BARRA, margin-top 8px: height 6px, radius 999, --border, mesma matemática de escala e mesmos ticks de 2px x 12px (top -3px) da A2, fill colorido por bandTone. Sem reference: `background: transparent; border: 1px dashed var(--border-strong)` e nenhum fill — barra vazia mente tanto quanto um zero.
    - Sub-linha 3 (`.daily-goal-state`), margin-top 6px, 13px/1.4 --text-soft: o MESMO conteúdo textual de hoje (`{state}{comparison ? ' · '+comparison : ''}` + `<strong>atingida|fora da meta</strong>` empurrado à direita em 13px --text-muted). O `role="group"` e o aria-label de MacroRow ficam idênticos. O `.goal-state-dot` de 8px é REMOVIDO: a cor da barra já é o tom, o ponto era ruído duplicado.
    - Altura total do bloco B2: ~284px, praticamente a mesma de hoje — a diferença é que tudo passa de 9,4-12px para 13-17px.

[após o card] SE `diaryStatus === 'MISSING'`: botão de largura total, 52px, radius 16, --primary-soft/--primary-strong, 15px/700, 'Começar o registro de hoje', `<Link to={'/diary?date='+data.date+'&action=quick'}>`, margin-top 16px.

[+24px] SEÇÃO PANORAMA. `.section-title-row`: o eyebrow 'Panorama' sai; `<h2 id="panorama">Demais registros do dia</h2>` vira 13px/750 uppercase 0.06em --text-soft, 32px de altura. O `<Link class="text-button desktop-only">Ver mês</Link>` some daqui (migra para o rodapé do grupo).

CARD-GRUPO (substitui `.overview-grid` de quatro `.metric-card` de min-height 134px, App.css:551 — 572px de rolagem para quatro fatos). Radius 20, border 1px --border, --shadow, overflow hidden, background --surface.
  Três linhas de 68px, `grid-template-columns: 36px 1fr auto 44px`, padding 0 16px, gap 12px, align-items center, separadas por `border-top: 1px solid var(--hairline)` com `margin-left: 64px` (a hairline começa depois do ícone — ritmo de lista agrupada).
  - Ícone 36x36 radius 12 com os MESMOS pares de cor de hoje: droplet --blue/--blue-soft, activity --orange/--orange-soft, scale --purple/--purple-soft.
  - Miolo (2 linhas): `.metric-label` 13px/650 --text-muted; `.metric-note` 13px --text-soft em UMA linha com `overflow:hidden; text-overflow:ellipsis; white-space:nowrap`.
  - Valor à direita: 17px/700 tabular. Ausência: 15px/600 --text-soft com as strings atuais ('Não registrada', 'Não registrado', 'Nenhum treino').
  - ÁGUA: o trailing de 44px é um `<button aria-label="Registrar 250 ml de água">` com o texto '+250' em 13px/700, radius 14, --blue-soft/--blue, que chama `useQuickWater(date).mutate(250)` — grava sem trocar de rota. O RESTO da linha continua sendo `<Link to={'/diary?date='+date+'&action=quick'}>`, preservando o caminho antigo. Enquanto `isPending`, o botão fica opacity .55 e cursor wait; ao sucesso, o valor '1,75 L' dispara um keyframe `scale(1 -> 1.06 -> 1)` de 260ms.
  - TREINO: linha inteira `<Link to="/workouts">`, trailing chevron 16px --text-soft em alvo de 44px.
  - PESO: linha inteira `<Link to="/progress/weight">`, idem.
  - RODAPÉ, 52px, border-top 1px --border, `grid-template-columns: 1fr 1px 1fr`: `<Link to="/analytics/monthly">Ver mês</Link>` e `<Link to="/analytics/charts">Gráficos</Link>`, 15px/650 --primary, centralizados, divisor 1px --border. Isso mata o `.analytics-links-card` de 134px que não carrega nenhum dado (HomePage.tsx:247-255) SEM encurtar o acesso a /analytics/charts.
  - Altura total: 68*3 + 52 = 256px, contra 572px.

ESTADOS DA TELA
  - Carregando: `.catalog-state` + `.route-spinner` atuais, inalterados. Nada de skeleton animado.
  - Erro: `.catalog-state` role=alert + 'Tentar novamente' atuais, com o botão a 52px.
  - Dia sem registro (MISSING): anel em 'Sem registro', barra sem fill, macros em 'Não informado' com barras tracejadas, saldo em 'Ainda indisponível' (ou link de TDEE), Panorama com os textos de ausência, mais o botão 'Começar o registro de hoje'. ZERO barras preenchidas e zero zeros na tela.
  - Dia parcial: comportamento descrito acima.
  - Dia fechado: idêntico, com o ponto da linha de status em --success e o chip de saldo em 'CONFIRMADO'.
  - Água pendente: só o botão '+250' muda de estado; a tela não entra em loading global.
  - Água com erro: uma `<p class="form-error" role="alert">` de 13px aparece imediatamente abaixo do card-grupo com getErrorMessage(error). A HomePage não tinha caminho de erro de mutation; este é o único que ela ganha.

TOQUE: nenhum alvo abaixo de 44px na tela. Setas, pílula de data, botão de água, chevrons, links de rodapé: 44px ou mais. `:active { transform: scale(.97) }` em todos.