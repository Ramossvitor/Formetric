# ONDAS

## Onda 1 — Zoom, respiro e legibilidade (risco baixo)
Objetivo: Matar as duas queixas literais do usuário (zoom preso e conteúdo espremido) com CSS de risco quase nulo, entregando resultado visível no piloto em um único deploy pequeno.
Depende de: nada

### Tokens de infraestrutura em index.css (adição pura, ninguém consome ainda além dos itens desta onda)
No `:root` de frontend/src/index.css, depois de `--shadow-floating` (linha 34), acrescentar:
```css
  --field-font: 1rem;            /* 16px: piso obrigatório, abaixo disso o iOS amplia ao focar */
  --safe-top: env(safe-area-inset-top, 0px);
  --safe-right: env(safe-area-inset-right, 0px);
  --safe-bottom: env(safe-area-inset-bottom, 0px);
  --safe-left: env(safe-area-inset-left, 0px);
  --keyboard-inset: 0px;
  --nav-height: calc(72px + var(--safe-bottom));   /* casa com .bottom-nav App.css:725 */
  --nav-clearance: calc(var(--nav-height) + 44px); /* nav + saliência do FAB + folga */
  --fill-h: 100svh;              /* containers de preenchimento: svh, nunca dvh */
  --sheet-h: 100dvh;             /* sheets roláveis: dvh */
  --z-raised: 1; --z-sticky: 10; --z-sidebar: 20; --z-sticky-actions: 30;
  --z-nav: 40; --z-overlay: 60; --z-toast: 80; --z-skip: 100;
```
O fallback `, 0px` dentro de `env()` é obrigatório: sem ele a declaração inteira é invalidada em navegador sem suporte. Migrar os 10 z-index literais do repo para os tokens: App.css:13 (.skip-link 100→--z-skip), :37 (.sidebar 10→--z-sidebar), :724 (.bottom-nav 20→--z-nav), :1787 (.sticky-form-actions 3→--z-sticky-actions), :2540 e :4337 (backdrops 60→--z-overlay), :4474 (.shell-dialog-backdrop 80→--z-overlay), :2989 (.compare-toolbar 5→--z-sticky), :3027 e :3230 (1→--z-raised).
Arquivos: frontend/src/index.css:11, frontend/src/App.css:13, frontend/src/App.css:37, frontend/src/App.css:724, frontend/src/App.css:1787, frontend/src/App.css:2540, frontend/src/App.css:2989, frontend/src/App.css:3027, frontend/src/App.css:3230, frontend/src/App.css:4337, frontend/src/App.css:4474

### 16px em TODO controle de formulário — a correção do zoom do iOS
Rede de segurança global, em frontend/src/index.css logo após `button { font: inherit }` (linha 63):
```css
input, select, textarea {
  font-family: inherit;
  font-size: max(16px, 1em);
  scroll-margin-block: 96px 140px;
}
```
Isso cobre campos sem regra de classe, mas NÃO vence as regras de classe existentes por especificidade — cada uma precisa ser tocada:
- App.css:899 `.field-group input/select/textarea` 0.9rem → `var(--field-font)` (cobre a maior parte do app)
- App.css:1476 `.search-field input` 0.88rem → `var(--field-font)`
- App.css:2053 `.date-navigation > label input` 0.75rem → `var(--field-font)` e `min-height: 44px`
- App.css:1152 `.invitation-link-row input` 0.76rem → `var(--field-font)` (mantém a stack mono; o campo passa a rolar horizontalmente, correto para copiar link)
- App.css:4643 `.analytics-date-control input` herda 0.75rem via `font: inherit` → acrescentar `font-size: var(--field-font)`; o rótulo `<span>` fica em 0.8rem
- App.css:4650/5097 `.analytics-chart-controls select` herda 0.72rem via `font: inherit` → acrescentar `font-size: var(--field-font)`; rótulo 0.8rem
- App.css:3363 `.compact-select select` (sem regra) → `font-family: inherit; font-size: var(--field-font); min-height: 48px`
- Regra nova para os selects órfãos: `.comparison-picker select, .reported-result-row select, .reported-result-row input { min-height: 46px; font-family: inherit; font-size: var(--field-font) }`
- App.css:3356 `.compact-select` label 0.6rem → 0.75rem; App.css:3384 `.reported-result-row` label 0.6rem → 0.75rem
NÃO usar `maximum-scale=1` nem `user-scalable=no` em index.html e NÃO condicionar os 16px a media query: nenhuma query separa com segurança iPad-com-teclado de desktop, e o ganho seria de 2-3px.
Arquivos: frontend/src/index.css:63, frontend/src/App.css:899, frontend/src/App.css:1152, frontend/src/App.css:1476, frontend/src/App.css:2053, frontend/src/App.css:3356, frontend/src/App.css:3363, frontend/src/App.css:3384, frontend/src/App.css:4643, frontend/src/App.css:5097

### Absorver o reflow dos campos maiores nas quatro telas afetadas
Sem isso, corrigir o zoom troca um bug por outro.
1) Diário: no bloco `@media (max-width: 559px)` de App.css:2698 acrescentar `.diary-heading { flex-direction: column; align-items: stretch; gap: 14px } .date-navigation { gap: 8px } .date-navigation > label { flex: 1 1 140px; min-width: 0 } .date-navigation > label input { width: 100% } .date-navigation .text-button { flex: 0 0 auto }`.
2) App.css:3350 `.skinfold-field` `minmax(0,1fr) 106px` → `minmax(0,1fr) 132px` (a 16px o texto do select "Lado" trunca).
3) App.css:3374 `.reported-result-row` `minmax(0,1.2fr) minmax(84px,0.5fr) auto` → `minmax(0,1.1fr) minmax(104px,0.5fr) auto`.
4) App.css:5092 `.analytics-chart-controls` label 0.72rem → 0.8rem (senão o rótulo fica menor que o controle e inverte a hierarquia).
Arquivos: frontend/src/App.css:2698, frontend/src/App.css:3350, frontend/src/App.css:3374, frontend/src/App.css:5092

### Corrigir os cinco minmax() que estouram a tela entre 560 e 640px
Todos foram calculados para desktop e ligam a 560px, onde só há ~443-470px úteis. Contas verificadas:
- App.css:2797 `.ingredient-row` soma 540-601px → mover a regra para `@media (min-width: 700px)`
- App.css:2793 `.serving-row` soma ~460-521px → mover para `@media (min-width: 620px)` ou baixar os três pisos de 100px para 92px
- App.css:2833 `.meal-item-list li` soma ~555px (e cresce ~22px com os alvos de 44px da onda 2) → mover para `@media (min-width: 700px)` e baixar o primeiro piso para `minmax(150px,1fr)`
- App.css:4587 `.weight-entry` soma 598-602px, o pior do repo → mover para `@media (min-width: 720px)`; abaixo disso vale o empilhamento base de App.css:4421
- App.css:3970 `.body-filter` e :4545 `.activity-filter` estouram marginalmente → `grid-template-columns: repeat(2, minmax(0,1fr))` com os botões em `grid-column: 1 / -1; display:flex; gap:8px`
Regra a adotar: nenhum minmax() com piso fixo entra em vigor num breakpoint cuja largura útil seja menor que a soma dos pisos + gaps.
Arquivos: frontend/src/App.css:2793, frontend/src/App.css:2797, frontend/src/App.css:2833, frontend/src/App.css:3970, frontend/src/App.css:4545, frontend/src/App.css:4587

### Desaninhar o padding no mobile — até 66px de cromo lateral por lado
Abaixo de 560px, containers intermediários deixam de ser caixas e viram separadores.
Em frontend/src/planning/NutritionGoals.css, bloco novo `@media (max-width: 559px)`:
```css
.nutrition-goal-editor { padding-inline: 0 }
.goal-target-editor { padding-inline: 0; border-inline: 0; border-radius: 0; background: transparent; border-top: 1px solid var(--border); padding-top: 20px }
.goal-target-editor > legend { padding-inline: 0 }
.goal-band-card { padding: 12px }
```
Resultado: de 66px para 32px por lado; a 390px o campo passa de 258px para 326px (+26%).
Em App.css, dentro do `@media (max-width: 559px)` de :3946: `.body-form-step { padding-inline: 16px } .body-form-group { padding-inline: 0; border-inline: 0; border-radius: 0; background: transparent } .reported-result-row { padding-inline: 12px }`.
Arquivos: frontend/src/planning/NutritionGoals.css:39, frontend/src/planning/NutritionGoals.css:64, frontend/src/planning/NutritionGoals.css:155, frontend/src/App.css:3946, frontend/src/App.css:3261

### Respiro vertical: viewport correto, safe-area e distância do FAB
1) Trocar os seis `100vh` por `var(--fill-h)` (100svh, NÃO dvh — containers de preenchimento com altura dinâmica refluem a cada pixel de animação da barra do Safari, que é justamente o pulo a evitar): index.css:53 `body`, App.css:2 `#root`, :6 `.app-shell`, :222 `.page`, :793 `.route-status`, :829 `.auth-page`.
2) Os quatro `max-height: calc(100vh - N)` de diálogo passam a `calc(var(--sheet-h) - 32px)` / `- 48px` (dvh aqui é correto: o sheet é rolável e absorve o reflow no scroll interno): App.css:2551, 2859, 4348, 4574.
3) Safe-area onde falta: App.css:2537 `.dialog-backdrop` e :4333 `.activity-dialog-backdrop` ganham `padding: 32px calc(12px + var(--safe-right)) 0 calc(12px + var(--safe-left))`; `.diary-dialog` (:2548) e `.activity-dialog` (:4345) ganham `padding: 20px 20px calc(20px + var(--safe-bottom))` — hoje Salvar/Cancelar param a 20px da borda física, em cima do indicador de home de 34px. É onde o "colado no fim" é literal.
4) App.css:9 `.skip-link` → `top: calc(12px + var(--safe-top)); left: calc(12px + var(--safe-left))`; App.css:229 `.mobile-header` → laterais `calc(18px + var(--safe-right/left))`; App.css:176 `.sidebar` → `padding-left: calc(22px + var(--safe-left))`; App.css:826 `.auth-page` e :791 `.route-status` → padding com insets nos quatro lados. Zero uso de inset-left/right no repo hoje: em iPhone deitado o conteúdo é cortado pela câmera.
5) Medido em iPhone 14 (safe-bottom 34px): nav ocupa 106px e o FAB pinta 26px acima (topo visual a 114px), enquanto `.sticky-form-actions` (App.css:1786) está em `calc(80px + safe)` = exatamente 114px — zero folga. Trocar por `bottom: calc(var(--nav-height) + 20px + var(--keyboard-inset))` e App.css:236 `main` padding-bottom por `var(--nav-clearance)`. Não mexer no bloco `@media (min-width: 840px)` de App.css:2884, que já redefine ambos e continua vencendo por ordem.
6) `overscroll-behavior: contain` em `.diary-dialog`, `.activity-dialog`, `.quick-add-menu` (zero usos no repo hoje) e `overscroll-behavior-y: contain` no body (index.css:51) para matar o pull-to-refresh que num SPA recarrega tudo.
Arquivos: frontend/src/index.css:51, frontend/src/index.css:53, frontend/src/App.css:2, frontend/src/App.css:6, frontend/src/App.css:9, frontend/src/App.css:222, frontend/src/App.css:229, frontend/src/App.css:236, frontend/src/App.css:793, frontend/src/App.css:829, frontend/src/App.css:1786, frontend/src/App.css:2537, frontend/src/App.css:2548, frontend/src/App.css:4333, frontend/src/App.css:4345

### Contraste: quatro trocas de hex que devolvem legibilidade ao tema claro
Medições reais (contraste calculado sobre as superfícies em que cada token é realmente usado):
Tema claro, index.css:16-17:
- `--text-muted: #68736d` (4,12:1 sobre --primary-soft, reprova) → `#5a645d` (6,15 surface / 5,60 background / 5,15 sobre primary-soft)
- `--text-soft: #8a948e` (3,13 / 2,96 / 2,85 — reprova até AA-large, e é a cor de ~40 rótulos de 9 a 11px) → `#6a726d` (4,95 / 4,68 / 4,51 — passa AA em todas as superfícies do app)
Tema escuro, index.css:95-96: `--text-soft: #7e8983` (4,45 sobre --surface-raised, reprova por 0,05) → `#98a29c` (6,13-7,18).
Atenção: `--text-soft` também pinta `.goal-state-dot`/`.availability-dot` (App.css:4746) e o border-left de `.analytics-context` (:4658) — se ficarem pesados, extrair `--dot-neutral` mantendo o cinza claro.
Corrigir também o único vazamento de cor literal no escuro: App.css:16 `.skip-link { color: #fff }` sobre `--primary-strong`, que no escuro é #d5ecc9 → contraste ~1,3:1. Dentro do `@media (prefers-color-scheme: dark)` de App.css:4068 acrescentar `.skip-link { color: #102017; background: var(--accent) }`.
Os demais pares já passam e não devem ser mexidos: `--text` 16,37:1, `--primary` 9,78:1, `--danger` sobre `--danger-soft` 4,93:1.
Arquivos: frontend/src/index.css:16, frontend/src/index.css:17, frontend/src/index.css:95, frontend/src/index.css:96, frontend/src/App.css:16, frontend/src/App.css:4068

### Guardas automatizados que travam estas correções (catraca)
1) Teste estático de CSS em vitest, lendo os arquivos como TEXTO (não depende de jsdom nem de layout — `test.css` não está configurado e o padrão do Vitest é false, então nenhuma folha é anexada nos testes e regressão de CSS é indetectável lá). Criar frontend/src/styles/css-contract.test.ts com 4 asserções sobre index.css, App.css e NutritionGoals.css: (a) nenhuma regra cujo seletor contenha input/select/textarea com font-size < 16px; (b) nenhum `\d+vh` fora de bloco de fallback; (c) `z-index:` sempre `var(--z-`; (d) contagem de literais de cor fora do :root do index.css não cresce. Cada teste começa com allowlist literal do estado atual, esvaziada conforme os itens acima entram.
2) Novo projeto Playwright SEM backend: frontend/playwright.ui.config.ts servindo `npm run preview` com `page.route('**/api/v1/**')` mockado a partir das fixtures que já existem em src/App.test.tsx:29-47 e src/test/profileTimeContext.ts. Viewports 320/390/412/430/600/1280 — o único projeto atual é Pixel 7 (412px), abaixo dos 560px em que os minmax estouram, ou seja, a suíte hoje é fisicamente incapaz de ver metade dos bugs relatados. Acrescentar `testIgnore: '**/guards/**'` a playwright.config.ts para o job container-e2e não mudar.
3) e2e/guards/layout.spec.ts nas 12 rotas: sem overflow horizontal (listando os elementos culpados), nenhum controle abaixo de 16px computados, alvo de toque >= 44px, gap >= 8px entre irmãos em .item-actions/.meal-actions/.workout-actions/.weight-entry-actions.
4) Stubs preventivos de `window.matchMedia`, `ResizeObserver` e `IntersectionObserver` em frontend/src/test/setup.ts (hoje tem uma linha só): jsdom não fornece nenhum dos três e, no momento em que um componente das ondas seguintes chamar matchMedia, os 13 testes que renderizam o App inteiro quebram de uma vez com TypeError.
O que NÃO é automatizável e exige olho num iPhone real: `env(safe-area-inset-*)` (Chromium sempre reporta 0px, inclusive na emulação Pixel 7) e o zoom do iOS em si (WebKit) — o que se prova é a causa, font-size < 16px.
Arquivos: frontend/src/styles/css-contract.test.ts, frontend/playwright.ui.config.ts, frontend/e2e/guards/layout.spec.ts, frontend/e2e/guards/fixtures.ts, frontend/src/test/setup.ts:1, frontend/playwright.config.ts:6, frontend/package.json:13

**Verificacao:** Guarda de 16px e de overflow verdes em 320/390/412/430/600px nas 12 rotas. Num iPhone real: focar o campo de quantidade do diário e o peso sem que a tela amplie; abrir o sheet do diário e confirmar que Salvar não encosta no indicador de home; abrir /settings/nutrition-goals a 390px e medir que o campo interno passou de ~258px para ~326px. `npm run check` verde.

---

## Onda 2 — Toque que responde e entrada de dados que não apaga (risco baixo)
Objetivo: Fazer o app devolver feedback ao dedo, tornar os alvos acionáveis com segurança e parar de descartar silenciosamente o que o usuário digita.
Depende de: Onda 1 (os alvos de 44px agravam os minmax; os tokens de safe-area/nav já precisam existir)

### Tokens de movimento e base tátil
No `:root` de index.css:
```css
  --dur-instant: 90ms; --dur-fast: 160ms; --dur-base: 220ms; --dur-slow: 320ms;
  --dur-sheet-in: 260ms; --dur-sheet-out: 190ms;
  --ease-standard: cubic-bezier(0.2, 0, 0, 1);
  --ease-decelerate: cubic-bezier(0.05, 0.7, 0.1, 1);
  --ease-accelerate: cubic-bezier(0.3, 0, 0.8, 0.15);
  --ease-spring: cubic-bezier(0.34, 1.28, 0.64, 1);
  --sheet-slide: 100%;
  --tap-min: 44px;
```
Substituir index.css:58-61 por:
```css
button, a, label, summary, [role='button'] {
  -webkit-tap-highlight-color: transparent;
  touch-action: manipulation;
}
```
`touch-action: manipulation` remove o atraso de ~300ms do double-tap-to-zoom nesses elementos — é o ganho de responsividade percebida mais barato do repo. Os `<label>` que embrulham controles (.fasting-confirmation, .body-review-check, .compact-select) hoje ficam de fora da regra e mostram o realce cinza do iOS enquanto os botões não mostram nada: dois comportamentos diferentes na mesma tela.
Reescrever index.css:79-86 (hoje só zera transition-duration, deixando o spinner infinito girando para quem pediu menos movimento):
```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-delay: 0ms !important; animation-duration: 1ms !important;
    animation-iteration-count: 1 !important; scroll-behavior: auto !important;
    transition-delay: 0ms !important; transition-duration: 1ms !important;
  }
  .route-spinner { animation: route-spinner 2400ms linear infinite !important; }
  :root { --sheet-slide: 0%; }
}
```
O spinner gira devagar em vez de congelar: é a única sinalização de progresso indeterminado do app e congelá-lo transformaria indicador em enfeite mudo.
Arquivos: frontend/src/index.css:11, frontend/src/index.css:58, frontend/src/index.css:79, frontend/src/App.css:811

### :active em todas as famílias de botão, usando a propriedade `scale` isolada
No fim de App.css, primeiro a transição compartilhada (inclui `transform` porque sobrescreve os shorthands de App.css:103 e :1065, senão o translateX do .nav-link:hover salta sem transição):
```css
.submit-button, .secondary-button, .secondary-link, .primary-action, .page-action, .text-button,
.filter-chip, .compact-button, .icon-button, .card-action, .favorite-button, .remove-row-button,
.add-item-button, .catalog-load-more, .quick-add > span, .bottom-nav-item, .nav-link,
.settings-link, .catalog-card-main, .recipe-card-main, .quick-action-grid button,
.water-buttons button, .shell-quick-actions a, .fasting-confirmation, .body-review-check, .compact-select {
  transition: scale var(--dur-fast) var(--ease-spring),
              transform var(--dur-fast) var(--ease-standard),
              background-color var(--dur-fast) var(--ease-standard),
              border-color var(--dur-fast) var(--ease-standard),
              color var(--dur-fast) var(--ease-standard),
              opacity var(--dur-fast) var(--ease-standard),
              filter var(--dur-fast) var(--ease-standard);
}
```
O truque do sistema: a transição BASE de `scale` usa `--ease-spring`; cada `:active` sobrescreve para `--dur-instant` + `--ease-standard`. Aperta = encolhe seco em 90ms; solta = volta em 160ms com overshoot mínimo. É o "pop" nativo do iOS, sem keyframe e sem estado no React.
Usar `scale:` e nunca `transform: scale()`: `.favorite-button` já tem `transform: translateY(-50%)` (App.css:1658) e `.quick-add > span` tem `transform: rotate(45deg)` (App.css:773) — um transform novo apagaria os dois.
Valores por família: primário sólido `scale: .97 + filter: brightness(.93)`; secundário/chips `scale: .97 + background color-mix(in srgb, var(--text) 6%, var(--surface-subtle))`; alvos pequenos (icon-button, card-action, remove-row, favorite) `scale: .86 + color-mix(var(--text) 9%, transparent)` (alvo pequeno precisa de escala maior para o encolhimento ser legível); `.text-button` só `opacity: .55` (escala em texto borra); `.bottom-nav-item` `scale: .93`; `.quick-add:active > span` `scale: .9`; superfícies grandes `.catalog-card-main/.recipe-card-main/.settings-link/.shell-quick-actions a` `scale: .985 + background var(--surface-subtle)` — mirar o `<a>` interno e NUNCA `.catalog-list-card`, porque `:active` propaga para ancestrais e o card inteiro encolheria ao tocar no botão de favorito, que é irmão dentro dele. Labels interativos sem escala (o texto quebra em várias linhas), só preenchimento.
Arquivos: frontend/src/App.css:103, frontend/src/App.css:1065, frontend/src/App.css:773, frontend/src/App.css:1658, frontend/src/App.css:5335

### Blindar os :hover e desfazer o falso favorito
Envolver os 7 blocos existentes em `@media (hover: hover) and (pointer: fine)`: App.css:106 `.nav-link:hover`, :168 `.icon-button:hover`, :1068 `.settings-link:hover`, :1425 `.catalog-heading .eyebrow a:hover`, :1560 `.catalog-list-card:hover, .recipe-card:hover`, :2684 `.quick-action-grid button:hover`. O `and (pointer: fine)` é necessário porque notebook com tela sensível reporta `hover: hover`.
Caso especial e bug real, App.css:1661-1665: `.favorite-button:hover` divide declaração com `.favorite-button.active`, então depois de tocar em qualquer card do catálogo o botão fica laranja com fundo laranja, visualmente idêntico a favoritado (a única diferença que sobra é o glifo ★/☆, pequeno demais). Separar:
```css
.favorite-button.active { color: var(--orange); background: var(--orange-soft); }
@media (hover: hover) and (pointer: fine) {
  .favorite-button:hover { color: var(--orange); background: color-mix(in srgb, var(--orange-soft) 50%, transparent); }
}
```
O hover fica deliberadamente mais fraco que `.active` para nunca colidir no mesmo pixel.
Arquivos: frontend/src/App.css:106, frontend/src/App.css:168, frontend/src/App.css:1068, frontend/src/App.css:1425, frontend/src/App.css:1560, frontend/src/App.css:1661, frontend/src/App.css:2684, frontend/src/pages/FoodsPage.tsx:105

### Alvos de 44px e separação das ações destrutivas
Sob `@media (pointer: coarse)` — nunca global, senão a sidebar do desktop engorda e as linhas densas de resultado quebram:
- App.css:155 `.icon-button` 34x34 → `min-width/min-height: var(--tap-min)` (é o botão mais reusado do app: editar, duplicar, excluir, sair, remover linha)
- App.css:1763 `.remove-row-button` 30x30 → 44px, com `inset: 6px 6px auto auto` e o `padding-right` de `.serving-row`/`.ingredient-row` (App.css:1757) de 45px para 58px
- App.css:1644 `.favorite-button` 38 → 44; :1481 `.filter-chip/.compact-button` 40 → 44; :1735, :1815, :2460, :2979, :3364, :4124, :4128 (42) → 44; :3008 (38) → 44; :4396 (36) → 44; :3029 `.comparison-select` (32) → 44 com `padding: 0 12px`
Onde 44px reais espremerem o layout, usar área de toque invisível: `position: relative` + `::after { content:''; position:absolute; inset:-6px }` mantém o desenho de 34px com alvo de 46px.
Separação de destrutivas (hoje a 2-4px de ações benignas, sem confirmação nem desfazer): gap de App.css:2431 `.item-actions` 3px → 10px, :2327 `.meal-actions` 4px → 10px, :4269 `.workout-actions/.weight-entry-actions` 2px → 10px. Acrescentar divisor explícito:
```css
.item-actions .danger-icon, .meal-actions .danger-icon, .workout-actions .danger-icon {
  margin-inline-start: 8px; padding-left: 8px;
  border-left: 1px solid var(--border); border-radius: 0 12px 12px 0;
}
```
(No `.weight-entry-actions`, que é column em App.css:4470, usar `margin-block-start` + `border-top`.) E `.icon-button.danger-icon:active { background: var(--danger-soft) }`.
Arquivos: frontend/src/App.css:155, frontend/src/App.css:1481, frontend/src/App.css:1644, frontend/src/App.css:1757, frontend/src/App.css:1763, frontend/src/App.css:2327, frontend/src/App.css:2431, frontend/src/App.css:3008, frontend/src/App.css:3029, frontend/src/App.css:4269, frontend/src/App.css:4396

### Separador decimal pt-BR: parar de apagar o que o usuário digita
O teclado decimal do iOS em pt-BR mostra vírgula. Em `type="number"` o navegador considera "72,5" inválido e devolve string vazia: nos campos com `valueAsNumber` do react-hook-form o valor vira NaN silencioso; nos campos com estado string (BodyEvaluationForm, ~30 campos) o caractere digitado simplesmente some da tela. São 27 inputs `type="number"` e só 9 têm inputMode.
Criar frontend/src/components/decimal.ts:
```ts
export function parseDecimal(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : Number.NaN
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null
  const parsed = Number(trimmed.replace(/\s/g, '').replace(/\.(?=\d{3}\b)/g, '').replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : Number.NaN
}
export const requiredDecimal = (v: unknown) => parseDecimal(v) ?? Number.NaN
export const decimalFieldProps = { type: 'text', inputMode: 'decimal', autoComplete: 'off', autoCorrect: 'off', spellCheck: false, enterKeyHint: 'next' } as const
export const integerFieldProps = { type: 'text', inputMode: 'numeric', pattern: '[0-9]*', autoComplete: 'off', enterKeyHint: 'done' } as const
```
Aplicar (ordem de frequência de uso): diary/ItemEditor.tsx:141 (#diary-item-quantity, o campo mais usado do app) e :149; activity/WeightForm.tsx:132 com o `Number()` de :97 virando `parseDecimal(...) ?? Number.NaN`; catalog/FoodForm.tsx:110/136/145/197/207 trocando `valueAsNumber: true` por `setValueAs: requiredDecimal` (e o helper `nullableNumber` de :52 por parseDecimal); RecipeForm.tsx:100/113/159/169; TdeeSettingsPage.tsx:151-157; NutritionGoalsPage.tsx:176-182; planning/NutrientBandEditor.tsx:118/212/245; body/BodyEvaluationForm.tsx:162/163/166/170/172 (~30 campos, a maior superfície) com os `Number(...)` de :86 e :102-111 trocados. Inteiros (duração, kcal estimadas, idade, incerteza, dias de validade) usam `integerFieldProps`.
Perder `type="number"` não perde validação: TODOS os formulários já usam `noValidate` (verificado em FoodForm:83, RecipeForm:83, WeightForm:116, WorkoutForm:79, BodyEvaluationForm:151, TdeeSettingsPage:112, NutritionGoalsPage:143), então min/step já eram decorativos. Bônus: some o bug de rolagem que altera o valor no desktop.
NÃO adotar máscara (react-number-format/imask): bugs de posição de cursor ao editar no meio do número, atrapalha colar valor de laudo e confunde leitor de tela.
Arquivos: frontend/src/components/decimal.ts, frontend/src/diary/ItemEditor.tsx:108, frontend/src/diary/ItemEditor.tsx:141, frontend/src/activity/WeightForm.tsx:97, frontend/src/catalog/FoodForm.tsx:52, frontend/src/catalog/RecipeForm.tsx:13, frontend/src/body/BodyEvaluationForm.tsx:86, frontend/src/body/BodyEvaluationForm.tsx:102, frontend/src/planning/NutrientBandEditor.tsx:212

### Teclado virtual, inputMode/enterKeyHint e autoFocus dentro de sheet
Não há uma linha de tratamento de teclado no repo. Criar frontend/src/components/useKeyboardInset.ts publicando `--keyboard-inset` a partir de `window.visualViewport` (única API que funciona no iOS 13+; `interactive-widget` não é implementado pelo Safari e `env(keyboard-inset-height)` é só Chromium):
```ts
const inset = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop)
document.documentElement.style.setProperty('--keyboard-inset', `${Math.round(inset)}px`)
document.documentElement.classList.toggle('keyboard-open', inset > 80)
```
com rAF para coalescer, listeners de `resize` e `scroll` do visualViewport, e early return quando `window.visualViewport` é undefined (jsdom). Chamar uma vez em App.tsx dentro de `App()` (não no AuthenticatedLayout: LoginPage e InviteAcceptancePage também têm formulários).
CSS: `html.keyboard-open .bottom-nav { display: none }` (devolve 106px de tela útil, é o que apps nativos fazem) e `html.keyboard-open .sticky-form-actions { bottom: calc(12px + var(--keyboard-inset)) }`.
Acrescentar `interactive-widget=resizes-content` ao viewport de index.html:6 (ganho grátis no Android).
Remover `autoFocus` de MealEditor.tsx:18 e WeightForm.tsx:130 — dentro de sheet ancorado embaixo o autoFocus abre o teclado antes de o usuário ver o formulário, rola o sheet sozinho e é o gatilho do zoom. Em FoodForm.tsx:91 e RecipeForm.tsx:91 (páginas inteiras) condicionar a `window.matchMedia('(pointer: fine)').matches`.
Atributos de teclado (zero ocorrências de enterKeyHint/autoCapitalize no repo): e-mail `autoCapitalize="none" autoCorrect="off" spellCheck={false}`; buscas `enterKeyHint="search"`; senha final `enterKeyHint="go"`; nomes `autoCapitalize="sentences"|"words"`; último campo de cada passo `enterKeyHint="done"`. Agrupar em frontend/src/components/fieldProps.ts para não repetir 12 atributos por campo.
Arquivos: frontend/src/components/useKeyboardInset.ts, frontend/src/components/fieldProps.ts, frontend/src/App.tsx:35, frontend/index.html:6, frontend/src/diary/MealEditor.tsx:18, frontend/src/activity/WeightForm.tsx:130, frontend/src/catalog/FoodForm.tsx:91, frontend/src/pages/LoginPage.tsx:94, frontend/src/pages/FoodsPage.tsx:42

### Foco visível em textarea e no heading do assistente corporal
App.css:900 zera `outline` para input, select E textarea, mas :910-914 restaura o anel só para input e select; index.css:71-77 também omite textarea. Resultado: os textareas de FoodForm:100, RecipeForm:96 e BodyEvaluationForm:174 não têm nenhum indicador de foco (falha WCAG 2.4.7 direta). Incluir `textarea` nas duas listas — e então a regra pontual de App.css:4364 vira redundante.
Reforçar o anel (hoje box-shadow de --accent a 22%, muito abaixo dos 3:1 de WCAG 2.4.11): `outline: 2px solid var(--accent-strong); outline-offset: 1px; box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 30%, transparent)`.
App.css:3270-3272 zera o outline de `.body-step-heading h2:focus` — exatamente o heading que BodyEvaluationForm.tsx:94 foca a cada passo, deixando o usuário de teclado perdido. Substituir por `outline: 3px solid color-mix(in srgb, var(--accent) 70%, transparent); outline-offset: 4px; border-radius: 6px`.
Arquivos: frontend/src/App.css:900, frontend/src/App.css:910, frontend/src/App.css:3270, frontend/src/App.css:4364, frontend/src/index.css:71

**Verificacao:** Guarda de alvo de toque e de gap entre destrutivas verdes nas 12 rotas. Num aparelho: tocar em qualquer botão e ver o encolhimento; tocar num card do catálogo e confirmar que a estrela volta ao cinza; digitar "72,5" no peso e no campo de quantidade do diário e salvar com sucesso; abrir um formulário longo com o teclado aberto e confirmar que a bottom-nav some e a barra de ações fica acima do teclado. `npm run check` verde (grepar por `toHaveValue(` antes: campos que viram string podem quebrar asserções numéricas).

---

## Onda 3 — Nenhum beco sem saída (risco baixo)
Objetivo: Impedir que o piloto abandone na primeira sessão e que o app morra em tela branca. É a onda de maior retorno por linha escrita para 10 usuários reais.
Depende de: nada (pode ir em paralelo com a Onda 2)

### Primeiros passos na tela Hoje: transformar as dez negações em links
Um usuário que acabou de aceitar o convite vê "Sem diário", "meta não configurada", "Indisponível: Classificação não configurada", "Sem meta configurada" ×4, "Configure o TDEE", "Não registrada", "Não registrado" — e não existe UM link de HomePage.tsx para /settings/nutrition-goals ou /settings/tdee.
Em frontend/src/pages/HomePage.tsx, antes de `<DailyDashboard>`, quando `data.tdeeKcal == null || data.goalProgress.length === 0`, renderizar `<section className="surface-card empty-state">` com título "Configure em 3 passos" e uma `<ol className="settings-link-list">` de três `.settings-link` (classes já existentes e usadas em ProfilePage.tsx:236-247) apontando para /settings/tdee, /settings/nutrition-goals e /foods/new, cada um com um `<small>` dizendo "Ainda não configurado" / "Pronto".
E tornar clicáveis as negações inline: HomePage.tsx:186 `<MissingValue>Configure o TDEE</MissingValue>` → `<Link className="text-button" to="/settings/tdee">`; idem :190.
Arquivos: frontend/src/pages/HomePage.tsx:186, frontend/src/pages/HomePage.tsx:190, frontend/src/pages/HomePage.tsx:262

### Fechar o beco sem saída do seletor de alimento
O caminho principal — Diário › Adicionar refeição › Adicionar alimento — abre um `<select>` que para um usuário novo contém apenas "Selecione…", sem texto e sem link. Em frontend/src/diary/ItemEditor.tsx, após a guarda de erro (linha 103):
```tsx
if (choices.length === 0 && !debouncedSearch) {
  return (
    <div className="inline-empty-state">
      <p>Sua biblioteca ainda está vazia.</p>
      <span>Cadastre um alimento para registrá-lo no diário. Ele fica salvo e você reusa nos próximos dias.</span>
      <Link className="submit-button" to="/foods/new">Cadastrar alimento</Link>
      <button className="text-button" onClick={onCancel} type="button">Cancelar</button>
    </div>
  )
}
```
(`.inline-empty-state` já existe em App.css e é usada em DiaryPage.tsx:222.) Quando há busca sem resultado, mensagem equivalente com o termo digitado.
Complemento de alto retorno para o piloto, no backend: semear 20-30 alimentos básicos brasileiros (arroz, feijão, ovo, frango, pão francês, banana, leite, whey) na aceitação do convite, com qualidade ESTIMATED. Sem isso, mesmo com o link acima o usuário precisa digitar sete campos nutricionais antes da primeira refeição.
Arquivos: frontend/src/diary/ItemEditor.tsx:102, frontend/src/diary/ItemEditor.tsx:126

### Error boundary e fechamento de locale/timeZone
Não existe nenhum componentDidCatch/getDerivedStateFromError no repositório, e simultaneamente `locale` e `timeZone` são `<input type="text">` validados só por comprimento (auth/schemas.ts:53-63) alimentando `new Intl.DateTimeFormat(locale, { timeZone })` em 14 lugares: digitar "portugues" no Perfil derruba o app em tela branca sem caminho de volta — nem para desfazer.
1) frontend/src/components/AppErrorBoundary.tsx (class, ~35 linhas) renderizando o layout `.route-status` já existente: "Algo deu errado nesta tela", "Nenhum registro salvo foi perdido.", botão "Tentar novamente" (reseta o estado), botão "Voltar para Hoje", `<details>` com `error.message` (nunca a stack). `componentDidUpdate` limpa o erro quando `resetKey` muda. No handler, se `/Loading chunk|dynamically imported module|Importing a module script failed/` casar, chamar `location.reload()` UMA vez com flag em sessionStorage (é o cenário garantido a cada deploy com aba aberta, por causa dos 8 chunks lazy de App.tsx:22-29).
2) Montar em dois níveis: main.tsx:17 envolvendo o QueryClientProvider, e AuthenticatedLayout.tsx:127 envolvendo o `<Outlet />` com `resetKey={location.pathname}` — assim o crash de uma página mantém sidebar e bottom-nav usáveis e navegar limpa o erro sozinho.
3) ProfilePage.tsx:146-158: trocar os dois inputs por `<select>` fechados (pt-BR; America/Sao_Paulo, Manaus, Bahia, Fortaleza, Belem, Cuiaba, Recife, Noronha, Rio_Branco) e fechar auth/schemas.ts:53-63 com `z.enum`. Espelhar o tratamento que ProfilePage já faz para unitSystem IMPERIAL (linhas 161-165): `<option disabled>` com o valor atual quando fora da lista, senão o `reset()` do useEffect grava valor inválido.
Arquivos: frontend/src/components/AppErrorBoundary.tsx, frontend/src/main.tsx:17, frontend/src/layouts/AuthenticatedLayout.tsx:127, frontend/src/pages/ProfilePage.tsx:146, frontend/src/auth/schemas.ts:53

### Parar de apagar o app inteiro a cada retorno de foco
`sessionQuery` usa `refetchOnWindowFocus: 'always'` (auth/queries.ts:11) e ProtectedRoute.tsx:51 troca a árvore inteira por spinner sempre que `isFetching`. Num PWA instalado, voltar do background é o gesto mais frequente que existe — e toda vez o diálogo aberto, o rascunho e o scroll são destruídos.
Preservar a proteção de identidade SEM desmontar, em ProtectedRoute.tsx:51-53:
```tsx
const revalidating = session.isFetching || identityChanged
return (
  <ProfileTimeContextProvider>
    {revalidating ? <FullPageStatus message={identityChanged ? 'Protegendo a troca de conta…' : 'Atualizando sua sessão…'} /> : null}
    <div className={revalidating ? 'identity-shielded' : undefined} inert={revalidating || undefined}>
      <Outlet />
    </div>
  </ProfileTimeContextProvider>
)
```
com `.identity-shielded { visibility: hidden }` em App.css junto de `.route-status` (:791). Nenhum pixel da conta A é pintado e o subtree sai do foco e da árvore de acessibilidade, mas o estado de formulário e o scroll sobrevivem. O `queryClient.clear()` de ProtectedRoute.tsx:31 na troca de identidade continua intacto.
Tratar também o beco offline: `if (session.isPending && session.fetchStatus === 'paused')` (React Query pausa a query com `navigator.onLine === false` e o app fica em "Verificando sua sessão…" para sempre) → `<FullPageStatus tone="error" message="Sem conexão. Reconecte para abrir o Formetric." actionLabel="Tentar novamente" onAction={session.refetch} />`. Aplicar o mesmo em OwnerRoute (linhas 62-80).
Ajustar auth/ProtectedRoute.test.tsx:94/:98: `queryByText(/Conta A/)).not.toBeInTheDocument()` vira `expect(getByText(/Conta A/)).not.toBeVisible()`, que é a propriedade real que importa.
Arquivos: frontend/src/auth/ProtectedRoute.tsx:36, frontend/src/auth/ProtectedRoute.tsx:51, frontend/src/auth/ProtectedRoute.test.tsx:93, frontend/src/auth/queries.ts:11, frontend/src/App.css:791

### 404 real, fallback de rota no backend e indicador de offline
1) `<Route path="*" element={<Navigate replace to="/" />} />` (App.tsx:76) engole qualquer erro de rota em silêncio. Criar frontend/src/pages/NotFoundPage.tsx (h1 "Página não encontrada", voltar via `navigate(-1)` quando `window.history.state?.idx > 0`, link "Ir para Hoje") dentro do layout autenticado, para nascer com bottom-nav.
2) backend SpaForwardController: hoje o @GetMapping é lista branca, então qualquer rota nova do cliente exige deploy de backend e uma URL desconhecida em cold load devolve a página de erro do Spring. Trocar por fallback que encaminha para /index.html quando o Accept contém `text/html` e o path não casa `/api/**`, `/actuator/**`, `/v3/api-docs/**`, `/swagger-ui/**` nem tem extensão de arquivo. Cobrir com teste de integração: `GET /api/v1/inexistente` com `Accept: application/json` continua 404 JSON.
3) Offline: hook `useOnline` com listeners `online`/`offline`, faixa fina em AuthenticatedLayout entre o `.mobile-header` (:125) e o `<Outlet />` (:127) com `role="status"`, fundo `--orange-soft` (não `--danger`, offline não é erro do usuário) e copy honesta — como não há cache persistido, NÃO dizer "mostrando dados salvos": "Sem conexão — seus registros não serão salvos até a rede voltar." E em api/http.ts, antes do fallback genérico: `if (navigator.onLine === false) return 'Você está sem conexão. O registro não foi enviado.'`.
Arquivos: frontend/src/pages/NotFoundPage.tsx, frontend/src/App.tsx:76, frontend/src/hooks/useOnline.ts, frontend/src/layouts/AuthenticatedLayout.tsx:125, frontend/src/api/http.ts:154, backend/src/main/java/dev/formetric/SpaForwardController.java:13

### Rolagem e foco na troca de rota, e bloqueio de data futura no diário
1) Não existe ScrollRestoration nem reset de foco: rolar até o fim do Diário e tocar em "Hoje" cai no meio da tela. Em AuthenticatedLayout, `useEffect` com dependência em `pathname` (e NÃO em `location`, para que trocar `?date=` no diário não role): `window.scrollTo({ top: 0, behavior: 'instant' })` — 'instant' explícito porque index.css:47 tem `scroll-behavior: smooth` e uma rolagem animada de 3000px na troca de rota é pior que nenhuma — mais `document.getElementById('conteudo')?.focus({ preventScroll: true })` com `tabindex="-1"`; todas as páginas já renderizam `<main id="conteudo">`. Acrescentar `main#conteudo:focus { outline: none }`.
2) Restauração ao voltar: `sessionStorage` sob `scroll:${location.key}`, restaurando só quando `useNavigationType() === 'POP'`. ~25 linhas, zero dependência.
3) DiaryPage.tsx:184-188 não limita datas futuras (a tela Hoje limita, HomePage.tsx:281): `disabled={date >= today}` no botão '›' e `max={today}` no input; em DiaryPage.tsx:62 tratar data futura da URL como hoje. Comparação lexicográfica é válida (PlainDate YYYY-MM-DD, mesma premissa de time/plainDate.ts:34). Acrescentar estilo `:disabled` a `.icon-button` (não existe hoje): `opacity: .4; cursor: default`.
Arquivos: frontend/src/layouts/AuthenticatedLayout.tsx:51, frontend/src/layouts/useScrollRestoration.ts, frontend/src/pages/DiaryPage.tsx:62, frontend/src/pages/DiaryPage.tsx:184, frontend/src/App.css:155

### Texto: plurais quebrados, jargão de engenharia e erros do backend em inglês
1) HomePage.tsx:138 e :232 renderizam literalmente "3 sessãoões" (confirmado no arquivo): trocar `${n} sessão${n === 1 ? '' : 'ões'}` por `${n} ${n === 1 ? 'sessão' : 'sessões'}`. CopyPanel.tsx:36 "1 itens". Extrair `plural(n, sing, plur)` em diary/format.ts e aplicar nos ~15 ternários de MonthlyAnalyticsPage, WeightProgressPage:155, WorkoutsPage:151, RecipesPage:81.
2) Jargão nas telas mais vistas: DiaryPage.tsx:214 "As mutações estão bloqueadas" → "Este dia já entrou no histórico e não pode mais ser alterado. Reabra se precisar corrigir algo."; HomePage.tsx:276 "Dados registrados, cálculos do sistema e disponibilidade explícita" → "O que você registrou hoje e como está em relação às suas metas."; ProfilePage.tsx:120 imprime o enum 'OWNER' → "Proprietário" (padrão já correto em InvitationsPage.tsx:195); BodyEvaluationDetailPage.tsx:43 imprime 'SYSTEM_DERIVED_FROM_REPORTED' ao lado do rótulo amigável → remover; InvitationsPage.tsx:220 "O token fica no fragmento do endereço…" → "Envie por um canal privado. Quem tiver o link pode criar a conta."; MonthlyAnalyticsPage "dias elegíveis" → "dias fechados"; DiaryPage.tsx:235 remover "· v. preservada".
3) api/http.ts:154-160 devolve `problem.detail` cru, e `spring.mvc.problemdetails.enabled: true` faz o Spring gerar detail/title em INGLÊS para exceções de framework ("Failed to read request", "Method Not Allowed"). Confiar no detail só quando `problem.type` começa com `https://formetric.dev/problems/`; caso contrário, mapa de fallback em pt-BR por status (400/403/404/409/429) e "Tivemos um problema no servidor. Tente novamente em instantes." para 5xx. No backend, um `@RestControllerAdvice` global com `@ExceptionHandler(Exception.class)` devolvendo ProblemDetail 500 em pt-BR com um código de correlação (8 chars do traceId) — assim o piloto reporta um código em vez de "deu erro".
Arquivos: frontend/src/pages/HomePage.tsx:138, frontend/src/pages/HomePage.tsx:232, frontend/src/pages/HomePage.tsx:276, frontend/src/diary/CopyPanel.tsx:36, frontend/src/pages/DiaryPage.tsx:214, frontend/src/pages/ProfilePage.tsx:120, frontend/src/pages/InvitationsPage.tsx:220, frontend/src/api/http.ts:154

**Verificacao:** Criar uma conta de convite nova e chegar de Hoje até uma refeição registrada sem sair da tela para descobrir o caminho. Forçar um throw dentro de uma rota e confirmar que sidebar/bottom-nav sobrevivem e que navegar limpa o erro. Trocar de app com um diálogo aberto e voltar: o diálogo continua aberto com o texto digitado. Abrir /rota-inexistente em cold load e receber o 404 do SPA, não do Spring. `npm test` verde após atualizar os getByText das strings alteradas.

---

## Onda 4 — Fluidez percebida: parar de piscar a tela (risco medio)
Objetivo: Eliminar a sensação de latência sem tocar em layout: cache com política, conteúdo que não desaparece na troca de contexto, skeletons e feedback imediato nas ações mais tocadas.
Depende de: Onda 3 (o error boundary precisa existir antes de mexer em cache e optimistic)

### Defaults do QueryClient e staleTime por domínio
main.tsx:8-14 só define `refetchOnWindowFocus: false`. Sem staleTime, voltar a uma data já vista refaz a requisição; sem retry configurado, um 400/403 tenta 3 vezes com backoff antes de virar mensagem (~7s de spinner para erro determinístico).
```ts
defaultOptions: {
  queries: {
    staleTime: 30_000, gcTime: 30 * 60_000,
    refetchOnWindowFocus: false, refetchOnReconnect: true,
    retry: (n, e) => (e instanceof ApiError && e.status >= 400 && e.status < 500 ? false : n < 2),
  },
  mutations: { retry: 0 },
}
```
Exceções por domínio no próprio queryOptions: catalog/queries.ts (12/21/30/37/45/52) `staleTime: 5*60_000, gcTime: 60*60_000` — o catálogo só muda por edição do próprio usuário e toda edição já invalida a chave; planning/queries.ts `10*60_000`; body/queries.ts `5*60_000`; activity/queries.ts `60_000`; diary/queries.ts:6 assina a frescura pela data (`date === today ? 15_000 : 10*60_000`, passando `today` do chamador DiaryPage.tsx:59); analytics idem (mês corrente 60s, meses passados 30min).
Armadilha a fechar de graça: ProfilePage.tsx:14 usa a chave `['profile']` e time/queries.ts:4 usa `['profile','time-context']` — um `invalidateQueries({queryKey:['profile']})` derrubaria o contexto de tempo junto. Renomear a do perfil para `['profile','details']`.
Arquivos: frontend/src/main.tsx:8, frontend/src/diary/queries.ts:6, frontend/src/catalog/queries.ts:11, frontend/src/analytics/queries.ts:11, frontend/src/pages/ProfilePage.tsx:14

### placeholderData: parar de apagar a tela ao trocar data, mês, período ou busca
Hoje toda troca de contexto passa por `isPending` e substitui a região por spinner: HomePage:284, DiaryPage:164, MonthlyAnalyticsPage:186, AnalyticsChartsPage:41, WeightProgressPage:128, WorkoutsPage:130, BodyEvaluationsPage:51 e — o mais visível — FoodsPage:64, onde cada termo debounced apaga a lista inteira.
Adicionar `placeholderData: keepPreviousData` em diary/queries.ts:7, analytics 12/20/28, activity 9/16, body:8, catalog 12/22/30/44. NÃO aplicar em queries de detalhe por id (foodQuery, recipeQuery, bodyEvaluationQuery): ali o conteúdo antigo seria de outro item.
Substituir o spinner por indicador sutil:
```css
.data-region { transition: opacity 180ms ease }
.data-region[data-refreshing='true'] { opacity: .55; pointer-events: none }
.refresh-bar { position: sticky; top: 0; z-index: var(--z-sticky); height: 2px; overflow: hidden; border-radius: 2px; background: var(--border) }
.refresh-bar::after { display: block; width: 40%; height: 100%; background: var(--accent-strong); content: ''; animation: refresh-sweep 900ms ease-in-out infinite }
```
PONTO CRÍTICO de segurança de dado: enquanto `isPlaceholderData` é true no diário, `log` ainda é o dia ANTERIOR mas `date` já é o novo — sem bloquear, o usuário pode excluir um item do dia errado. O `pointer-events: none` resolve, DESDE QUE o cabeçalho de navegação (DiaryPage.tsx:177-189) fique FORA do `.data-region`, mantendo as setas de data usáveis. Mesmo cuidado em WeightProgressPage:139 e WorkoutsPage:141. Em FoodsPage:68-75 o empty-state deve ser condicionado a `!foods.isPlaceholderData`, senão pisca o vazio da busca anterior.
Arquivos: frontend/src/diary/queries.ts:7, frontend/src/analytics/queries.ts:12, frontend/src/activity/queries.ts:9, frontend/src/catalog/queries.ts:12, frontend/src/pages/DiaryPage.tsx:164, frontend/src/pages/FoodsPage.tsx:64

### Skeletons com formas reais no lugar dos 17 spinners
Criar frontend/src/components/Skeleton.tsx (`Skeleton`, `SkeletonList` com `role="status"` + `aria-busy` + texto em `.visually-hidden`, classe que já existe em App.css:1405) e unificar CatalogState.tsx:3-19 e PlanningState.tsx:7-33, que são a mesma implementação com a única diferença de PlanningLoading envolver em `<main>`.
CSS com shimmer que só anima `translate` (fica no compositor, sem repaint — importa em Android médio):
```css
.skeleton { position: relative; overflow: hidden; border-radius: 10px; background: color-mix(in srgb, var(--text) 7%, var(--surface-subtle)) }
.skeleton::after { position: absolute; inset: 0; content: ''; translate: -100% 0; background: linear-gradient(90deg, transparent, color-mix(in srgb, var(--surface) 70%, transparent), transparent); animation: skeleton-sweep 1400ms var(--ease-standard) infinite }
@keyframes skeleton-sweep { to { translate: 100% 0 } }
```
Formas tiradas das dimensões reais do CSS: catálogo 8 cards de 72px, gap 9, radius 16 (App.css:1530-1564); Home = 56px + 300px radius 22 + 4 cards de 134px radius 17 (App.css:335, 546-560); Diário = 26px + 190px + 2 cards de 150px radius 18 (App.css:2281-2285) + 140px; Peso = 4×92px + 5×96px; Treinos = 2×86px + 4×124px; Análises = 76px + 6×94px + 2×240px.
Spinner permanece só onde não há forma previsível: chunk lazy (App.tsx:32/47/58), CatalogLoadMore, e o boot de sessão. Regra: skeleton na primeira carga sem dado anterior; `.is-stale`/`.data-region` no refetch com dado na tela; nunca os dois.
Arquivos: frontend/src/components/Skeleton.tsx, frontend/src/catalog/CatalogState.tsx:3, frontend/src/planning/PlanningState.tsx:7, frontend/src/pages/HomePage.tsx:285, frontend/src/pages/DiaryPage.tsx:165, frontend/src/pages/WorkoutsPage.tsx:131, frontend/src/App.css:5335

### Optimistic update nos dois controles mais tocados: água e favorito
1) Água (DiaryPage.tsx:252, quatro botões +250/+500/+750/+1L): hoje o toque não muda nada até o servidor responder e ainda desabilita todos os botões, então registrar 750ml em três toques rápidos é impossível. Antes, tornar `commit()` (DiaryPage.tsx:69) resistente a resposta fora de ordem: `setQueryData(key, cur => cur && cur.updatedAt > log.updatedAt ? cur : log)`. Depois, `onMutate` com `cancelQueries`, snapshot, `waterTotalMl + volume` e um entry com id `optimistic:${crypto.randomUUID()}`; `onError` restaura; o `onSuccess: commit` já existente sobrescreve com a verdade. Desabilitar o × do entry quando `id.startsWith('optimistic:')`. Remover `disabled={water.isPending}` de :252, :205 e :269.
2) Favorito (FoodsPage.tsx:21-24 e RecipesPage.tsx:21-24): hoje `disabled={mutation.isPending}` desabilita TODAS as estrelas da página, e o `onSuccess` invalida `['catalog','foods']` inteiro, refazendo todas as páginas infinitas já carregadas — com CATALOG_PAGE_SIZE = 100 (catalog/api.ts:168), favoritar um item pode custar várias requisições de 100 itens. Trocar por `onMutate` que faz `setQueriesData` sobre `[...foodsQueryKey,'infinite']` mapeando o item (e filtrando quando `favoritesOnly` está ligado e o item foi desfavoritado), `onError` restaurando o snapshot, e `onSettled: invalidateQueries({ queryKey: foodsQueryKey, refetchType: 'none' })` — marca stale sem refetch imediato. Remover os `disabled`.
3) Exclusão de item e refeição do diário (DiaryPage.tsx:229/:238): criar diary/optimistic.ts com `withoutMealItem`/`withoutMeal` subtraindo os totais — `MealItem` estende `DiaryTotals` (diary/api.ts:17), então a subtração é exata, não estimada. Deixar goalProgress e energyBalanceKcal intocados (o `commit()` os corrige ~200ms depois).
Arquivos: frontend/src/pages/DiaryPage.tsx:69, frontend/src/pages/DiaryPage.tsx:95, frontend/src/pages/DiaryPage.tsx:252, frontend/src/diary/optimistic.ts, frontend/src/pages/FoodsPage.tsx:21, frontend/src/pages/RecipesPage.tsx:21

### Boot mais curto: sessão em paralelo, prefetch e casca estática
1) Cascata de 3 round-trips sequenciais no boot (sessão → contexto de tempo → dado da página), cada um com tela cheia própria. Em ProtectedRoute, `useEffect(() => { void queryClient.prefetchQuery(profileTimeContextQuery) }, [queryClient])` para as duas primeiras saírem juntas. OBRIGATÓRIO junto: acrescentar `/api/v1/profile/time-context` a `locallyHandledUnauthorizedPaths` (api/http.ts:43-47), senão um deslogado chegando em `/` recebe 401 nessa query e é redirecionado com `state.sessionExpired` indevidamente.
2) Casca estática dentro de `#root` no index.html (hoje é `<div id="root"></div>` vazio, então o cold start é uma tela em branco de 1,5-3s em 4G): header de 68px + 4 blocos com as alturas reais (96/300/134/134) + barra inferior de `calc(72px + env(safe-area-inset-bottom))`, com `<style>` inline usando cores literais (#eef1ec claro, #19221d escuro) e `@media (prefers-color-scheme: dark)`. `createRoot` substitui o conteúdo ao montar — nenhuma limpeza manual. Sem texto na casca, só formas, para não duplicar por um frame.
3) Prefetch previsível, tudo com `onPointerDown` (no mobile não existe hover): setas de data do diário (dias vizinhos, com `setTimeout(500)` e guarda de `navigator.connection.saveData`/2g), cards do catálogo (`foodQuery(id)`), links de detalhe de avaliação, e o botão "+ Adicionar alimento ou receita" aquecendo `foodsQuery()`/`recipesQuery()` para o diálogo abrir preenchido em vez de com CatalogLoading interno.
Arquivos: frontend/index.html:15, frontend/src/auth/ProtectedRoute.tsx:25, frontend/src/api/http.ts:43, frontend/src/pages/DiaryPage.tsx:111, frontend/src/pages/FoodsPage.tsx:91, frontend/src/pages/DiaryPage.tsx:243

### Bundle: tirar zod e react-hook-form do caminho crítico de quem já está logado
O build atual custa ~164 KB gzip antes do primeiro pixel (index 124 KB + plainDate 26 KB pré-carregado + CSS 14 KB). App.tsx:6-19 mantém 12 rotas eager, e LoginPage é uma delas — como LoginPage usa zod + react-hook-form + @hookform/resolvers, essas três bibliotecas entram no caminho crítico de um usuário JÁ autenticado que nunca verá a tela de login.
Tornar lazy tudo menos HomePage, DiaryPage, layout e ProtectedRoute (as duas rotas que precisam ser instantâneas). Aquecer o chunk de LoginPage assim que `sessionQuery` resolver null.
Acrescentar `manualChunks` em vite.config.ts: `{ react: ['react','react-dom','react-dom/client'], query: ['@tanstack/react-query'], forms: ['react-hook-form','@hookform/resolvers','zod'] }` — vendor estável, para uma atualização do app não obrigar a rebaixar React de novo.
Exportar os importadores em App.tsx (`routeImports`) e aquecê-los onde o destino fica provável: ao abrir o sheet do quick-add (AuthenticatedLayout.tsx:141 → workouts, weight, newEvaluation) e em `requestIdleCallback` após montar (evaluations, foods), com fallback `setTimeout(2500)` para o Safari iOS antigo. Os chunks são pequenos (6-12 KB); o custo real é o RTT, e é ele que o aquecimento elimina.
Arquivos: frontend/src/App.tsx:6, frontend/src/App.tsx:22, frontend/vite.config.ts, frontend/src/layouts/AuthenticatedLayout.tsx:141

**Verificacao:** Com throttling Slow 4G no DevTools: trocar a data do diário sem que a lista desapareça; digitar na busca do catálogo sem esvaziar a tela; tocar 4× seguidas em +250ml e ver os quatro registros aparecerem imediatamente; favoritar um item sem que as demais estrelas fiquem desabilitadas; confirmar no painel Network que /api/v1/auth/session e /profile/time-context saem em paralelo e que o gzip do chunk index caiu. `npm run check` verde.

---

## Onda 5 — Sheet unificado e movimento (risco alto)
Objetivo: Substituir as três implementações de modal por um componente único sobre <dialog> nativo, com animação, trava de rolagem, foco e Escape corretos — e ligar o sistema de movimento onde ele informa.
Depende de: Ondas 1 e 2 (tokens de safe-area, viewport, movimento e :active)

### Componente BottomSheet sobre <dialog> nativo
DECISÃO: `<dialog>` nativo, não div com portal. Ele entrega de graça o que hoje custaria ~150 linhas — armadilha de foco, restauração de foco, Escape, `inert` no resto do documento, top layer (fim das disputas de z-index 60/80) e bloqueio de rolagem de fundo. jsdom 28.1 (o do repo, confirmado no package.json) implementa `showModal()`.
DECISÃO sobre a saída animada: `@starting-style` para a ENTRADA, mas NÃO `overlay`/`allow-discrete` para a saída — `overlay` ainda não é transicionável no WebKit e sem ele o `.close()` tira o elemento da top layer no mesmo frame, então a animação de saída não roda no iPhone, que é o alvo. Em vez disso: marcar `data-closing`, esperar `--dur-sheet-out` (190ms) num setTimeout e só então `.close()`.
frontend/src/components/BottomSheet.tsx com props `{ open, title, eyebrow?, dismissible = true, error?, onClose, children }`, mantendo o último `children` numa ref para ter o que mostrar durante os 190ms de saída, `if (!el.open) el.showModal()` como guarda (showModal lança se já aberto, e o StrictMode monta duas vezes em dev), `onCancel` com `preventDefault()` devolvendo o controle ao React, e clique no backdrop por `event.target === event.currentTarget` (funciona porque o `<dialog>` tem `padding: 0` e todo o conteúdo está em `.sheet-panel`). `useId()` para o `aria-labelledby` — hoje os ids 'diary-dialog-title' e 'activity-dialog-title' são fixos.
CSS único substituindo os dois blocos byte a byte idênticos (App.css:2537-2555 e 4333-4352): `dialog.sheet` com `max-height: calc(var(--sheet-h) - 32px)`, `translate` + `opacity` com `--ease-decelerate` na entrada e `--ease-accelerate` em 190ms na saída (sai mais rápido do que entra: é a regra que separa "fluido" de "lento"), `::backdrop` com fade, `.sheet-panel` com `overscroll-behavior: contain` e `padding-bottom: calc(20px + var(--safe-bottom))`, e `html:has(dialog.sheet[open]) { overflow: hidden }` como trava extra do rubber-band do iOS. A partir de 840px, centralizar (`align-items: center`, `max-width: 560px`, radius completo) — hoje os backdrops usam `align-items: end` sem media query, ou seja, já são bottom sheets num monitor de 27".
Arquivos: frontend/src/components/BottomSheet.tsx, frontend/src/App.css:2537, frontend/src/App.css:4333, frontend/src/App.css:4473

### Migrar os três modais e apagar os listeners globais
1) DiaryDialog.tsx (7 pontos de chamada) e ActivityDialog.tsx (8) viram cascas finas sobre BottomSheet no primeiro commit, preservando as assinaturas — os 15 call sites não mudam e o diff fica pequeno; remover as cascas em commit separado. Apagar o bloco de foco de ActivityDialog.tsx:17-30 (o `showModal()`/`close()` já faz).
2) AuthenticatedLayout.tsx:157-174: trocar o `<div className="shell-dialog-backdrop">` por `<BottomSheet>` e APAGAR o useEffect de :42-49, que hoje registra um keydown na window durante a vida inteira do app mesmo com o sheet fechado.
3) DiaryPage.tsx:265-269: unificar os cinco ternários num sheet só, já que só um editor abre por vez. ARMADILHA: `editor?.type === 'quick' && open` usa a variável `open` do diário (dia aberto) e colide com a prop `open` do sheet — renomear uma das duas (sugestão `dayOpen`) antes de migrar, senão o bug passa em silêncio.
Os testes que buscam `role="dialog"`, `getByRole('button', { name: 'Fechar' })` e `queryByRole('dialog')).not.toBeInTheDocument()` continuam passando (um `<dialog>` com showModal expõe role dialog); preservar o `aria-label="Fechar"` E o conteúdo `×` nos três lugares.
Arquivos: frontend/src/diary/DiaryDialog.tsx, frontend/src/activity/ActivityDialog.tsx:17, frontend/src/layouts/AuthenticatedLayout.tsx:42, frontend/src/layouts/AuthenticatedLayout.tsx:157, frontend/src/pages/DiaryPage.tsx:265, frontend/src/pages/WeightProgressPage.tsx:175, frontend/src/pages/WorkoutsPage.tsx:188

### Modal representado no URL: voltar fecha o sheet
Os três modais são useState puro (DiaryPage:63, WorkoutsPage:31, WeightProgressPage:36, AuthenticatedLayout:37), então com um sheet aberto o gesto/botão voltar sai da página inteira — o erro mais evidente de "isto é um site" num PWA instalado.
Criar frontend/src/components/useUrlDialog.ts: lê o param, `open(next)` faz push marcando `pushedRef`, `close()` faz `navigate(-1)` quando foi push nosso e `setParams(replace)` quando não foi (cobre o deep link digitado direto).
Aplicar: `?sheet=quick` no layout; `?editor=meal|item|copy|close|quick&meal=<id>&item=<id>` no diário (memoizar o editor derivado com useMemo sobre as strings dos params, senão a identidade muda a cada render e o reset de mutations de DiaryPage.tsx:115-141 reexecuta em loop); `?editor=new|<id>` em Workouts e Weight.
Corrigir de quebra os deep links `?action=` que apagam a própria entrada de histórico: DiaryPage.tsx:148-155, WorkoutsPage:58-64 e WeightProgressPage:61-66 fazem `setSearchParams(next, { replace: true })` removendo o parâmetro, então o sheet fica aberto com o URL já sem descrição do estado. Manter esses efeitos apenas como normalização (`action=quick` → `editor=quick`) — aí o replace passa a ser correto — e apontar os links de AuthenticatedLayout.tsx:167-170 e HomePage.tsx:224 direto para a forma nova.
Arquivos: frontend/src/components/useUrlDialog.ts, frontend/src/pages/DiaryPage.tsx:63, frontend/src/pages/DiaryPage.tsx:148, frontend/src/pages/WorkoutsPage.tsx:58, frontend/src/pages/WeightProgressPage.tsx:61, frontend/src/layouts/AuthenticatedLayout.tsx:167

### Toast próprio e exclusão com Desfazer no lugar do window.confirm
Não existe sistema de feedback: sucesso é `<p className="form-success">` que fica na tela para sempre (ProfilePage:199, NutritionGoalsPage:214, TdeeSettingsPage:169) e as destrutivas usam `window.confirm` nativo, que no iOS toma a tela inteira com o nome do domínio no topo — o instante em que o produto mais deixa de parecer app.
Construir, não instalar (sonner custa ~12 KB gzip e traz sistema de estilo próprio que briga com as ~330 classes flat): ToastProvider (~110 linhas TSX + ~35 CSS) montado em main.tsx entre QueryClientProvider e BrowserRouter, com `showToast(msg, { tone, durationMs, action })`, padrão 4000ms (mínimo 7000ms com ação), máximo 3 na pilha, timer pausado em `pointerenter`/`focusin` e em `visibilitychange` hidden (sem isso um PWA em segundo plano come a janela de Desfazer), `role={tone === 'error' ? 'alert' : 'status'}` por toast e NUNCA no contêiner (senão anuncia duas vezes). Posição: `bottom: calc(var(--nav-height) + 12px)`, `z-index: var(--z-toast)`.
Preservar as strings exatas ao migrar o sucesso inline ('Perfil atualizado.', 'Novo período de metas criado', 'Novo período de TDEE criado') — quatro testes usam `findByRole('status')` com esse texto e continuam passando se o toast tiver `role="status"`. Erro de validação continua inline: toast é o canal errado para isso.
Política de destrutivas: (a) DESFAZER, sem confirmação — excluir pesagem (o undo é o próprio upsert com os campos de WeightLogInput), excluir treino (recriar com novo requestId; o id muda, é aceitável), excluir item do diário e registro de água; (b) CONFIRMAÇÃO via ConfirmSheet sobre o BottomSheet — excluir refeição (carrega N itens), arquivar alimento/receita/avaliação (afeta itens já registrados no diário), sair da conta (descarta o cache inteiro).
QUEBRA CERTA e determinística: ActivityPages.test.tsx:228/258 e 377/394 e BodyEvaluationPages.test.tsx:230/245 fazem `vi.spyOn(window,'confirm')` + `toHaveBeenCalledOnce()`. Reescrever para: clicar em Excluir → `await findByRole('dialog', { name: /Excluir/ })` → clicar no botão de confirmação → esperar a lista vazia. O nome acessível do botão GATILHO não pode mudar.
Arquivos: frontend/src/components/ToastProvider.tsx, frontend/src/components/ConfirmSheet.tsx, frontend/src/main.tsx:18, frontend/src/pages/WeightProgressPage.tsx:90, frontend/src/pages/WorkoutsPage.tsx:88, frontend/src/pages/ProfilePage.tsx:199, frontend/src/activity/ActivityPages.test.tsx:228, frontend/src/body/BodyEvaluationPages.test.tsx:230

### Movimento onde ele informa (e a lista do que fica proibido)
1) Anel de calorias da Home: registrar a custom property no topo de App.css (`@property --calorie-progress { syntax: '<percentage>'; inherits: false; initial-value: 0% }`) e acrescentar `transition: --calorie-progress var(--dur-slow) var(--ease-decelerate)` — o TSX não muda, HomePage.tsx:159 já injeta o valor. Efeito: o anel preenche de 0% ao valor na primeira pintura e cresce suavemente a cada item adicionado, em vez de saltar. ANTES disso, resolver o órfão: App.css:392 tem 74% CHUMBADO no conic-gradient e a regra que traz `var(--calorie-progress)` está em App.css:4684, 4300 linhas abaixo, dentro do bloco de análises — fundir as duas em :385 e apagar :4684-4690, senão qualquer split de CSS quebra a Home.
2) Fade de rota: `<div className="route-view" key={location.pathname}>` envolvendo o `<Outlet />` com `animation: route-enter var(--dur-base) var(--ease-decelerate) both` (opacity 0 → 1, translate 8px → 0). Key no PATHNAME de propósito: trocar `?date=` no diário ou o mês em Análises não reanima nada.
3) Barra de atingimento (`.attainment-track span`) com `transition: width var(--dur-slow)`; entrada de item novo em `.water-history li` e `.meal-item-list li` com keyframe de 220ms (roda uma única vez na criação; itens com key estável não reiniciam).
4) Bottom-nav: ícone da aba ativa com `scale: 1.08` e um ponto de 4px em `::after` aparecendo com overshoot — a menor quantidade de movimento que comunica "você está aqui". Sem pílula deslizante (exigiria medição em JS e o FAB no meio quebra o ritmo das 5 colunas).
5) Trocar o FAB losango por círculo: remover `transform: rotate(45deg)` de App.css:773 e a contra-rotação de :777, `border-radius: 50%`, 52→56px, `margin-top: -22px`, e subir `.quick-add small` de 0.58rem (9,3px) para 0.68rem.
O QUE NÃO ANIMA, registrado no cabeçalho do bloco de movimento em App.css: números nutricionais não fazem count-up; troca de data/filtro não anima conteúdo (só `.data-region`); sem stagger em lista nenhuma; sem `@keyframes` disparado por classe de estado (rodaria para todos os elementos já naquele estado a cada montagem — a receita da poluição: estado usa transição, evento usa keyframe); nenhuma animação infinita além do spinner e do shimmer; TimeSeriesChart não anima traço; header/sidebar/bottom-nav não se movem ao rolar.
DECISÃO: NÃO usar a View Transition API. Verificado em node_modules: o `viewTransition` do react-router 7 só é lido dentro de `RouterProvider` e o app usa `<BrowserRouter>` declarativo (main.tsx:19); o React 19.2.8 instalado não exporta `ViewTransition`; e `document.startViewTransition` à mão captura o spinner do Suspense das 8 rotas lazy.
Arquivos: frontend/src/App.css:1, frontend/src/App.css:385, frontend/src/App.css:4684, frontend/src/App.css:773, frontend/src/App.css:736, frontend/src/layouts/AuthenticatedLayout.tsx:127, frontend/src/pages/HomePage.tsx:157

### Swipe horizontal entre dias no diário
Trocar de dia é a navegação mais repetida do diário e hoje exige acertar `.icon-button` de 34px. Criar frontend/src/components/useHorizontalSwipe.ts com pointer events (~35 linhas): guardar `{x,y,t}` no pointerdown e disparar no pointerup quando `Math.abs(dx) > 60 && Math.abs(dx) > 2 * Math.abs(dy) && performance.now() - t < 500`. Aplicar no `<main>` do diário chamando `selectDate(shiftedDate(date, dx < 0 ? 1 : -1))` — funções que já existem (DiaryPage.tsx:46 e :157) — respeitando o bloqueio de data futura da Onda 3. Guardas: ignorar quando `event.target.closest('input, select, textarea, [data-hscroll]')`; `touch-action: pan-y` no container.
NÃO implementar swipe-para-voltar (colide com o gesto de borda do sistema e exigiria transição interativa com rubber-banding, inviável sem lib de animação) nem swipe-para-excluir (gesto destrutivo é pior que botão pequeno enquanto o Desfazer não estiver em produção — e ele só chega nesta mesma onda).
Arquivos: frontend/src/components/useHorizontalSwipe.ts, frontend/src/pages/DiaryPage.tsx:157, frontend/src/pages/DiaryPage.tsx:176

**Verificacao:** Nos três sheets: Escape fecha, toque no backdrop fecha, botão × fecha, reabrir dentro dos 190ms não pisca, a página de trás não rola, o foco volta ao gatilho ao fechar. Com um sheet aberto, o botão voltar fecha o sheet em vez de sair da página. Excluir uma pesagem, tocar em Desfazer e ver a linha voltar. Com `prefers-reduced-motion: reduce` emulado, nada desaparece — só fica estático — e o spinner gira devagar. `npm test` verde após reescrever os 3 testes de window.confirm.

---

## Onda 6 — PWA instalável (risco medio)
Objetivo: Tornar o app instalável e abrir instantâneo, sem cachear nenhum dado de conta. Depende do shell já estar corrigido — instalar um app com zoom preso e conteúdo espremido só multiplica o problema.
Depende de: Ondas 1, 2 e 5 (o CSS de standalone e o modal no URL só fazem sentido com o shell pronto)

### Desbloquear os arquivos do PWA no Spring Security
BLOQUEADOR RAIZ, confirmado no arquivo: o `permitAll` de SecurityConfiguration.java:40-63 termina em `/favicon.svg` e tudo o mais cai em `.anyRequest().authenticated()`, então `/manifest.webmanifest`, `/sw.js`, `/workbox-*.js` e os PNGs responderiam 401 problem+json, o service worker jamais registraria e o Chrome nunca ofereceria instalação.
Acrescentar à lista: `"/manifest.webmanifest", "/sw.js", "/workbox-*.js", "/registerSW.js", "/icon-192.png", "/icon-512.png", "/icon-maskable-512.png", "/apple-touch-icon.png", "/.well-known/**"`. O `/.well-known/**` entra agora porque é onde vão morar `assetlinks.json` (TWA Android) e `apple-app-site-association` — deixar preparado custa uma string. Nada muda no SpaForwardController: nenhum desses caminhos casa com o @GetMapping. A CSP das linhas 90-94 já cobre tudo (`worker-src` e `manifest-src` caem no `default-src 'self'`).
Verificar deslogado: `curl -i https://<host>/manifest.webmanifest` e `/sw.js` devem dar 200, não application/problem+json.
Arquivos: backend/src/main/java/dev/formetric/identity/SecurityConfiguration.java:40

### Manifest escrito à mão, ícones e tags do index.html
frontend/public/manifest.webmanifest versionado à mão (não gerado pelo plugin, para ser revisável em git e o caminho no permitAll nunca mudar): `id: "/"`, `scope: "/"`, `start_url: "/"`, `display: "standalone"`, `display_override: ["standalone","minimal-ui"]`, `lang: "pt-BR"`, name "Formetric — nutrição, treino e evolução", short_name "Formetric", `background_color`/`theme_color` = `#f3f5f1` (valor real de `--background`, confirmado em index.css:11). NÃO declarar `orientation`: o app tem sidebar real a partir de 840px e travar em portrait mataria o uso em tablet. Quatro `shortcuts` usando deep links que JÁ existem e já foram testados (AuthenticatedLayout.tsx:167-170): registrar refeição, treino, peso e nova avaliação — custo zero.
Quatro PNGs gerados UMA vez a partir do favicon.svg com `npx -y --package=sharp node gerar-icones.mjs`, script descartado depois, zero dependência no repo: icon-192, icon-512 (a partir do SVG atual, que tem `rx=20`), icon-maskable-512 e apple-touch-icon 180 opaco sem cantos arredondados (a partir de uma variante full-bleed sem `rx`; a safe zone maskable está respeitada com folga — o anel tem raio externo 14,4 de 64 contra o limite de 25,6).
index.html: `<link rel="manifest">` (sem `crossorigin`, porque o manifest é permitAll), `<link rel="apple-touch-icon">`, `apple-mobile-web-app-capable`, `mobile-web-app-capable`, `apple-mobile-web-app-title="Formetric"` e `apple-mobile-web-app-status-bar-style="default"` — NÃO `black-translucent`, que força texto branco sempre e ficaria ilegível sobre o fundo claro. Corrigir os dois `theme-color` das linhas 10-12, hoje `#f4f6f2`/`#0e1210`, para os valores reais `#f3f5f1`/`#0d1210`: a barra de status hoje fica num tom levemente diferente do fundo, desalinhamento sutil que lê como amadorismo.
Arquivos: frontend/public/manifest.webmanifest, frontend/public/icon-192.png, frontend/public/apple-touch-icon.png, frontend/index.html:5, frontend/src/index.css:11

### vite-plugin-pwa com registro pelo bundle e cache só do shell
Única dependência nova de todo o roadmap, e é devDependency: escrever o SW à mão exigiria manter a lista de precache dos chunks hasheados do Vite (inclusive os 8 lazy de App.tsx:22-29) sincronizada a cada build — inviável.
```ts
VitePWA({
  registerType: 'prompt',
  injectRegister: null,  // 'auto'/'script' injetam <script> inline -> bloqueado por script-src 'self' (SecurityConfiguration.java:92)
  manifest: false,       // usamos o public/manifest.webmanifest versionado à mão
  includeAssets: ['favicon.svg','apple-touch-icon.png','icon-192.png','icon-512.png','icon-maskable-512.png','manifest.webmanifest'],
  workbox: {
    globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
    navigateFallback: '/index.html',
    navigateFallbackDenylist: [/^\/api\//, /^\/actuator\//, /^\/v3\/api-docs/, /^\/swagger-ui/, /^\/\.well-known\//],
    runtimeCaching: [],  // nada de /api no SW: Cache Storage é por ORIGEM, não por usuário
    cleanupOutdatedCaches: true,
    clientsClaim: false,
  },
  devOptions: { enabled: false },
})
```
Com `injectRegister: null` o registro vai por `virtual:pwa-register/react` importado do código, caindo no bundle hasheado em `/assets/**` que já é permitAll. Acrescentar `"vite-plugin-pwa/react"` ao array `types` de tsconfig.app.json:7 (não existe vite-env.d.ts no projeto).
Deixar comentário no vite.config.ts: se alguém trocar `injectRegister` para 'auto', a CSP bloqueia silenciosamente o registro e o PWA para de atualizar sem erro visível.
Bônus concreto do precache: some o `Failed to fetch dynamically imported module` que hoje quebra as 8 rotas lazy quando um deploy acontece com a aba aberta.
NADA de /api no SW é decisão consciente: numa app multi-tenant com convites, qualquer resposta cacheada sobreviveria ao logout e seria legível pela próxima conta no mesmo dispositivo — e dado nutricional velho servido como atual é o pior modo de falha possível num app de dieta.
Arquivos: frontend/vite.config.ts, frontend/tsconfig.app.json:7, frontend/package.json

### Prompt de atualização em PT-BR e Cache-Control no backend
1) `registerType: 'prompt'`, não autoUpdate: o app tem formulários longos (nova receita com linhas de ingrediente, avaliação corporal com ~40 campos) e recarregar por baixo do dedo é perda de dado. frontend/src/components/UpdatePrompt.tsx com `useRegisterSW`, banner reusando `.surface-card`/`.submit-button`/`.text-button`, montado no AuthenticatedLayout acima da bottom-nav (`inset: auto 12px calc(84px + var(--safe-bottom)) 12px`). No `onRegisteredSW`, checagem periódica: `setInterval(check, 60*60*1000)` + `visibilitychange`, só quando `document.visibilityState === 'visible'` — um PWA instalado pode ficar dias aberto sem cold start e nunca receber a versão nova. Esconder o banner quando houver mutação `isPending`.
2) Não existe nenhuma configuração de cache de recurso estático no backend, então o index.html sai sem Cache-Control e o browser cacheia por heurística sobre o Last-Modified da entrada do jar — pode atrasar horas a chegada da versão nova em quem ainda não tem SW. Nova `@Configuration` com `WebMvcConfigurer`: `/assets/**` (nomes com hash do Vite) com `CacheControl.maxAge(365 dias).cachePublic().immutable()`, e `/index.html`, `/sw.js`, `/manifest.webmanifest` com `noCache()`. Verificar com `curl -I`.
3) O Dockerfile já copia frontend/dist para src/main/resources/static e assa no jar, então cada revisão do Cloud Run serve o seu próprio sw.js com hashes novos — nenhuma mudança de pipeline é necessária.
Arquivos: frontend/src/components/UpdatePrompt.tsx, frontend/src/layouts/AuthenticatedLayout.tsx:175, backend/src/main/java/dev/formetric/web/StaticResourceCacheConfiguration.java, Dockerfile:27

### Ajustes de standalone, sessão persistente e prompt de instalação discreto
1) CSS de standalone no fim de App.css — o que denuncia um PWA como "site" são os gestos, não o layout:
```css
@media (display-mode: standalone) {
  body { overscroll-behavior-y: none; }
  .bottom-nav, .mobile-header, .sidebar, .quick-add { -webkit-touch-callout: none; user-select: none; }
}
```
Restringir o `user-select: none` à navegação — nunca ao conteúdo, ou o usuário perde copiar valores nutricionais.
2) Sessão: o cookie é de sessão de browser (SecurityConfiguration.java:136-145 nunca chama `setCookieMaxAge`, default -1) e o timeout de prod é 12h — o PWA instalado desloga sozinho todo dia, e um diário alimentar que pede senha diariamente não é usado. Acrescentar `serializer.setCookieMaxAge((int) Duration.ofDays(30).toSeconds())` e alinhar `spring.session.timeout` e `server.servlet.session.timeout` de 12h para 30d em application-prod.yml (o application.yml de dev já usa 30d). O AuthenticatedSessionRevalidationFilter continua revalidando a identidade a cada requisição, então sessão longa não vira sessão órfã. Verificar antes se algum teste de backend asserta 12h. É afrouxamento consciente — ver decisões pendentes.
3) Botão voltar contextual no `.mobile-header` (hoje só Brand + avatar em todas as 24 rotas): visível quando a rota não é uma das raízes da bottom-nav, alvo de 44px (o `.icon-button` de 34px precisa de override aqui), blindado com `if (window.history.length > 1) navigate(-1); else navigate(backTo)` — `/settings/*` são becos sem saída quando instalado, porque em standalone não há barra de navegador e o swipe de borda do iOS é inconsistente. Conferir se `chevron-left` está entre os 14 SVGs de components/Icon.tsx.
4) InstallPrompt discreto, nunca interruptivo: card permanente em ProfilePage no padrão `.profile-card.settings-card.surface-card` já usado nas linhas 221/240/265, com botão "Instalar o Formetric" quando há `beforeinstallprompt` diferido, e o texto "Toque em Compartilhar e escolha 'Adicionar à Tela de Início'" quando `ios && !standalone` (no iOS o evento não existe). Nada é renderizado quando `matchMedia('(display-mode: standalone)').matches`.
Arquivos: frontend/src/App.css:5335, backend/src/main/java/dev/formetric/identity/SecurityConfiguration.java:136, backend/src/main/resources/application-prod.yml:19, frontend/src/layouts/AuthenticatedLayout.tsx:120, frontend/src/components/InstallPrompt.tsx, frontend/src/pages/ProfilePage.tsx:221

**Verificacao:** Deslogado, `curl -i` em /manifest.webmanifest e /sw.js retorna 200. Lighthouse mobile marca o app como instalável. `npm run build` produz dist/sw.js + workbox-*.js e o dist/index.html NÃO ganhou script inline. Num Android: o Chrome oferece instalar, os 4 shortcuts funcionam, o ícone maskable não fica dentro de um círculo branco. Num iPhone: adicionar à tela de início, abrir sem barra do Safari, fechar o app e reabrir no dia seguinte ainda logado. Aba anônima deslogada abrindo /diary direto cai no /login, não em tela branca.

---

## Onda 7 — Escala tipográfica, tokens e organização do CSS (risco alto)
Objetivo: Atacar a raiz estrutural do "achatado" — 75% das fontes abaixo de 12,8px — e deixar o CSS com vocabulário. É a onda de maior superfície e menor urgência: só entra depois que o piloto já estiver estável.
Depende de: Ondas 1 a 6 (nada aqui corrige um bug; tudo aqui reescreve valores em massa)

### Escala tipográfica em tokens e o de-para das 253 declarações de font-size
Hoje existem 40+ tamanhos literais entre 0.56rem e 3rem sem nenhuma relação entre si, e os cinco mais frequentes são 0.72rem (20×), 0.625rem (18×), 0.68rem (16×), 0.76rem (14×) e 0.7rem (13×) — a UI inteira vive entre 9 e 12px enquanto o h1 tem 32px: razão 3,2× sem nenhum degrau intermediário.
Tokens em index.css, cada passo carregando seu line-height e letter-spacing: `--text-eyebrow: .6875rem` (11px, só uppercase), `--text-2xs: .75rem` (12px, piso absoluto), `--text-xs: .8125rem`, `--text-sm: .875rem`, `--text-base: 1rem` (já é o `--field-font`), `--text-md: 1.0625rem`, `--text-lg: 1.25rem`, `--text-xl: 1.5rem`, `--text-2xl: 1.875rem`, `--text-3xl: clamp(1.75rem, 5vw + .5rem, 2.5rem)`.
DE-PARA: 0.56–0.64rem (~41 decls) → --text-2xs; 0.62rem uppercase → --text-eyebrow; 0.65–0.71rem (~65) → --text-xs; 0.72rem → --text-xs se rótulo, --text-sm se valor; 0.73–0.78rem (~42) → --text-sm; 0.80–0.90rem (~31) → --text-base; 0.92–1.02rem → --text-md; 1.08–1.25rem → --text-lg; 1.30–1.50rem → --text-xl; 1.80–2.00rem → --text-2xl; os dois clamp() de h1 e .auth-heading → --text-3xl.
Cabeçalho: h1 de `clamp(2rem,4vw,2.75rem)` com letter-spacing −0.055em (apertado demais para português com acentos) → --text-3xl com −0.03em; h2 0.68rem → --text-lg; `.eyebrow` ls 0.105em → 0.08em; `.heading-copy` → --text-sm. A escada mobile fica 11px/28px/14px/20px/13-14px: razão h1/corpo cai de 3,2× para 2,0× com dois degraus reais no meio.
ARMADILHA: o texto cresce ~25% e containers de altura fixa estouram. Trocar por padding + `min-height: auto` em: `.metric-card` (134px, App.css:554), `.status-chip` (27px, :378), `.quality-chip` (22px, :2406), `.daily-goal-state` (22px, :4722), `.goal-open-boundary` (32px, NutritionGoals.css:245), `.comparison-select` (32px, :3029). Migrar junto os 3 usos de `!important` (App.css:4692-4696, NutritionGoals.css:228).
Arquivos: frontend/src/index.css:11, frontend/src/App.css:247, frontend/src/App.css:262, frontend/src/App.css:270, frontend/src/App.css:277, frontend/src/App.css:554, frontend/src/planning/NutritionGoals.css

### Espaçamento, raio, pesos e a decisão sobre a Inter
1) Escala base 4 (`--space-05: 2px` … `--space-14: 56px`) substituindo os 17 paddings e 24 gaps distintos. Regra do de-para: arredondar PARA CIMA em padding de container e margem entre seções (é onde falta ar), para o mais próximo em gap de ícone. Pontos que devem SUBIR de degrau, não só ser tokenizados: `main` 26/18 → 24/20; `.page-heading` margin-bottom 24 → 32; `.diary-section` 27 e `.overview-section` 31 → ambos 32 (seções irmãs devem respirar igual); `.calorie-summary/.macro-summary` 22 → 24; e remover as margens negativas de `.diary-status-row` (−8px, App.css:2060) e `.goal-validity-hint` (−7px), que são o que cola a linha de status no h1.
2) Raio: 18 valores distintos entre 9 e 22px, muitas vezes com 1px de diferença entre irmãos (.metric-card 17 vs .meal-card 18 vs .body-form-step 20 vs .nutrition-card 22) — não é percebido como variedade, é percebido como imprecisão. Sete tokens (`--radius-xs: 8` a `--radius-2xl: 24`, `--radius-full: 999px`). Preservar os casos deliberados: `.brand-mark` (10 10 5 10, é a marca), `.water-progress span` (0 3 3 0).
3) Pesos: o CSS usa 11 pesos (incluindo 550/650/680/720/730/750/760/780) mas `index.css:3` declara Inter e a fonte NUNCA é carregada — sem @font-face, sem link, e public/ só tem favicon.svg (confirmado). Com `font-synthesis: none` (index.css:6) o app cai no fallback: no iOS o SF Pro variável honra 650/750, no Windows o Segoe UI colapsa metade deles no mesmo bold. RECOMENDAÇÃO: assumir a stack de sistema, começar o `font-family` em `ui-sans-serif, system-ui, -apple-system` (deixar 'Inter' numa pilha onde ela nunca resolve é armadilha para o próximo dev) e normalizar os 68 `font-weight` em 400/500/600/700 (550→500; 600/650/680→600; 700/720/730/750/760/780→700; 800 mantém). Zero bytes e renderização nativa por plataforma, o que casa com a queixa 3. Ver decisões pendentes.
4) Chips coloridos: `--orange` sobre `--orange-soft` mede 2,42:1, `--blue` 2,57:1, `--purple` 3,00:1 — todos em textos de 9-10px. Criar tokens só de TEXTO (`--orange-text: #986132`, `--blue-text: #427397`, `--purple-text: #7a6198`, `--success-text: #33774a`, `--accent-text: #4b8434`), aliasados para os originais no bloco dark (onde os pares já passam), e trocar apenas `color:` — nunca `background:`, porque as mesmas variáveis pintam `.progress-fill`, `.metric-icon` e o TimeSeriesChart.
Arquivos: frontend/src/index.css:2, frontend/src/index.css:11, frontend/src/App.css:236, frontend/src/App.css:2060, frontend/src/App.css:2417, frontend/src/App.css:4262

### Densidade das duas telas mais usadas: item do diário e Home
1) Linha de item do diário (`.meal-item-list li`): seis níveis de informação num bloco de ~90px — nome truncado com ellipsis, subtítulo com 3 informações concatenadas a 9,4px, kcal, macros, chip de qualidade, "± N kcal" e dois botões separados por 3px. Reduzir o que é dito e aumentar o que sobra: remover "· v. preservada" (já na Onda 3), esconder o "± N kcal" no mobile (a incerteza já está na cor do chip), reescrever com `grid-template-areas: 'primary actions' 'nutrition actions' 'quality actions'` para os três blocos de texto empilharem numa coluna e as ações ficarem numa coluna própria centralizada, e trocar o `text-overflow: ellipsis` de `.item-primary strong` por `overflow-wrap: anywhere` — nome de alimento truncado é a informação mais importante da linha.
2) Colapsar as três ações da refeição num único botão "⋯" no mobile, abrindo uma folha com Editar/Duplicar/Excluir de 48px cada, reusando `.quick-action-grid` (App.css:2689). O `.meal-heading` volta a ser uma linha só, economizando ~46px por refeição — num dia de 5 refeições são 230px de rolagem a menos, que é exatamente o que o aumento de espaçamento consome. As duas mudanças se pagam. Bônus: resolve o pior caso de adjacência destrutiva do app.
3) Home: o anel de 164px fixos ocupa metade da largura útil a 320px → `clamp(140px, 42vw, 176px)` com inner em `calc(100% - 32px)`; grade de métricas em duas colunas para os cards numéricos e largura cheia para os textuais (altura do bloco cai de ~560px para ~300px); `.metric-note` com `-webkit-line-clamp: 2` (hoje recebe texto concatenado com ' · ' e vira um parágrafo de 10,7px espremido).
4) Listas de definição que truncam: `.goal-state-list` e `.effective-goal-summary` saem das duas colunas no mobile (com `overflow: visible; white-space: normal`) — hoje cada célula tem ~150px e o valor é truncado justamente onde deveria ser lido. É densidade que destrói informação.
Arquivos: frontend/src/App.css:2355, frontend/src/App.css:2371, frontend/src/App.css:2290, frontend/src/App.css:385, frontend/src/App.css:546, frontend/src/App.css:2189, frontend/src/pages/DiaryPage.tsx:229, frontend/src/planning/NutritionGoals.css:12

### Gráfico legível no celular e qualidade que não é só cor
1) TimeSeriesChart usa viewBox 800×300 com `width: 100%`: num celular de 360px o SVG ocupa ~326px, fator ~0,41, e os rótulos de `font-size: 10px` saem com ~4px reais. Os valores só existem dentro de `<title>`, que no toque nunca aparece. Três mudanças, ~40 linhas, sem biblioteca: (a) medir o contêiner com ResizeObserver e usar a largura medida como WIDTH, para 1 unidade = 1px (as polylines já usam `vector-effect: non-scaling-stroke`), subindo os rótulos para 12px; (b) `<text>` fixo no último ponto com o valor formatado — é o número que o usuário quer; (c) alvo de toque: `<g><circle r={14} fill="transparent"/><circle r={3.5}/></g>` com o ponto ativo renderizado como texto acima do figcaption. Bônus barato: `<table className="visually-hidden">` com data/valor quando há ≤40 pontos.
NÃO adotar Recharts (~95 KB gzip) nem Victory (~180 KB): nenhuma resolve sozinha rótulo em escala e leitura por toque, num app com 7 dependências de runtime.
2) FoodsPage.tsx:101 comunica a qualidade do dado só por um `<span>` de 8px colorido com `title` — no toque title nunca aparece, e como o `<Link>` tem `aria-label="Abrir {nome}"`, o aria-label substitui a subárvore inteira e a qualidade some do leitor de tela. Incluir a qualidade no aria-label e trocar a bolinha por `.quality-chip` com texto (classe que o Diário já usa).
Arquivos: frontend/src/analytics/TimeSeriesChart.tsx:6, frontend/src/analytics/TimeSeriesChart.tsx:76, frontend/src/App.css:5154, frontend/src/pages/FoodsPage.tsx:91, frontend/src/pages/FoodsPage.tsx:101

### Resolver as quatro classes órfãs e dividir App.css em 5 arquivos
App.css já tem 4 domínios de fato (núcleo 1-2963, corporal 2965-4095, atividade 4097-4627, análises 4629-5335), cada um com seu bloco responsivo no fim. Só existem 4 regiões fisicamente no bloco errado, e todas precisam ser MOVIDAS (nunca renomeadas) antes de qualquer split:
(a) App.css:4684-4690 `.calorie-progress` — já tratado na Onda 5;
(b) App.css:4750-4771 `.goal-state-dot.*`, `.availability-dot`, `.metric-icon.green` — consumidos por HomePage e TimeSeriesChart, mover para junto de `.metric-icon` (:563). `.goal-state-dot` é consultado literalmente por AnalyticsPages.test.tsx:132: mover sim, renomear jamais;
(c) App.css:4334 e 4473-4527 `.shell-dialog-backdrop`, `.quick-add-menu`, `.shell-quick-actions` — consumidos só pelo shell eager; o backdrop é absorvido pelo BottomSheet, o resto vai para o núcleo;
(d) App.css:4068-4095 — bloco `@media (prefers-color-scheme: dark)` GLOBAL enterrado entre o responsivo do corporal e o início de atividade; nenhuma dessas classes é de corporal.
Divisão (movimentação mecânica de linhas, ZERO renomeação): styles/core.css (1-2963 + as órfãs), body/BodyEvaluations.css, activity/Activity.css, analytics/Analytics.css, mais o NutritionGoals.css existente. Os três de feature são importados pelo componente de página, seguindo o padrão que NutritionGoalsPage.tsx:10 já usa — e todas essas páginas já são lazy. Com `cssCodeSplit` (padrão do Vite), ~44% do CSS deixa de bloquear a primeira pintura.
REGRA NÃO-NEGOCIÁVEL: os blocos responsivos 2698-2963 sobrescrevem regras de 1-2697 com a MESMA especificidade, vencendo apenas pela ordem. Eles nunca podem ser separados dessas linhas — a cascata é a única coisa que faz o desktop funcionar.
O commit da divisão precisa produzir diff visual EXATAMENTE zero contra as capturas da Onda 1. Se produzir qualquer diferença, a divisão está errada — não ajuste a baseline.
DECISÃO: manter CSS global com tokens. NÃO migrar para CSS Modules (o bloco @media 840px alcança 15 componentes de uma vez e não tem dono) nem Tailwind (reescreveria os ~330 contratos de classe em 40 arquivos .tsx, dos quais 7 são consultados por `closest()`/`querySelector` nos testes).
Arquivos: frontend/src/App.css:385, frontend/src/App.css:4068, frontend/src/App.css:4473, frontend/src/App.css:4750, frontend/src/App.tsx:20, frontend/src/analytics/AnalyticsPages.test.tsx:132, frontend/src/catalog/CatalogPages.test.tsx:322

**Verificacao:** Capturas de tela da Onda 1 comparadas passo a passo: a migração de tokens muda tipografia e espaçamento de propósito (revisar visualmente em 320/390/430px), mas a divisão de arquivos precisa dar diff pixel-a-pixel zero. Nenhum container de altura fixa estourando. Contraste medido: nenhum par texto/fundo abaixo de 4,5:1 nas telas Hoje, Diário e Catálogo, nos dois temas. Guardas de overflow e de 16px continuam verdes. `npm run check` e `npm run test:ui` verdes.

---

