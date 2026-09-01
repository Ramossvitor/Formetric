# Plano — Reforma de UI/UX mobile e camada PWA do Formetric

## Contexto

O Formetric teve o primeiro deploy em produção (piloto privado de ~10 pessoas). A aparência
agradou, mas o uso real pelo celular — o foco do produto — expôs problemas estruturais.
Duas investigações multi-agente (8 lentes de auditoria prescritiva + um painel de 3 propostas
concorrentes de redesign, ambas com crítica adversarial) apuraram que **as queixas têm causa
mecânica, não estética**:

1. **Zoom preso do iOS.** Nenhum controle do app chega a 16px computados. A regra base
   `.field-group input/select/textarea` fixa `0.9rem` ([App.css:899](frontend/src/App.css#L899)),
   mais sete regras de classe descendo até `0.72rem`, mais quatro `<select>` sem regra alguma
   caindo no default do UA (~13,3px). Como são regras de **classe**, um seletor de elemento em
   `index.css` não vence por especificidade — cada uma precisa ser tocada.
2. **Sensação de achatamento.** Quatro fatores somados: 75% das 241 declarações de `font-size`
   abaixo de 12,8px (a UI vive entre 9 e 12px); aninhamento de padding chegando a 66px de cromo
   lateral por lado; `--text-soft` reprovando até AA-large (3,13:1 sobre branco); e cinco grids
   `minmax()` cujos pisos somam 520–600px mas ligam a partir de 560px.
   **A causa física da queixa literal "vai muito perto do fim da tela" foi medida:**
   `main` tem `padding-bottom: calc(112px + safe)` ([App.css:236](frontend/src/App.css#L236))
   contra uma `.bottom-nav` de `calc(72px + safe)` com o FAB saliente 26px acima dela
   ([App.css:725](frontend/src/App.css#L725)) — a borda superior real do cromo está a 98px do
   fundo, deixando **14px de folga efetiva**.
3. **Ausência de fluidez.** Zero `:active` no repositório inteiro e
   `-webkit-tap-highlight-color: transparent` em `button, a` ([index.css:58](frontend/src/index.css#L58)):
   tocar num botão não devolve um pixel. Os três sheets aparecem por corte seco, nenhum trava a
   rolagem de fundo, e `refetchOnWindowFocus: 'always'` desmonta a aplicação inteira a cada
   retorno de foco ([auth/queries.ts:11](frontend/src/auth/queries.ts#L11) →
   [ProtectedRoute.tsx:51](frontend/src/auth/ProtectedRoute.tsx#L51)) — num PWA instalado isso
   destrói diálogo aberto, rascunho e scroll várias vezes por sessão.
4. **Não parece um aplicativo.** Zero camada PWA — e ela está bloqueada na raiz:
   `SecurityConfiguration.java:40-63` não libera `/manifest.webmanifest` nem `/sw.js`
   (o `permitAll` termina em `/favicon.svg`).

A investigação também achou defeitos que quebram **dado real** e que nenhuma auditoria de CSS
pegaria: 27 inputs `type="number"` descartam silenciosamente a vírgula do teclado pt-BR (o
usuário digita `72,5` e o campo esvazia); `locale`/`timeZone` são texto livre alimentando
`Intl.DateTimeFormat` sem nenhum error boundary no repositório (um "portugues" digitado no
Perfil derruba o app em tela branca sem volta); e o literal **"3 sessãoões"** aparece na tela
mais vista ([HomePage.tsx:138](frontend/src/pages/HomePage.tsx#L138)).

## Decisões tomadas

| Tema | Decisão |
|---|---|
| Amplitude visual | **Redesign visual** de Hoje e Diário, com sistema de tokens aplicado globalmente. |
| PWA | **Completo** — manifest, ícones, service worker, offline, aviso de versão, standalone, prompt de instalação. |
| Ações destrutivas | **Toast com Desfazer** no dia a dia + **confirmação explícita** no que é caro perder. |
| Ações por linha no Diário | **Menu `⋯` de 44px abrindo sheet.** Aceito +1 toque em editar/duplicar. |
| Bottom nav | **Manter o vidro** (blur, translucidez, sombra, FAB rotacionado). O aperto se resolve só por espaçamento. |
| Seletor de dia | **Incluir a faixa horizontal de 7 dias** no Diário. |
| Sessão | **30 dias**, cookie persistente. Afrouxamento consciente; mitigantes já existem (HttpOnly + Secure + SameSite=Lax, Argon2, filtro de revalidação). |
| Navegação | **Recompor a IA agora** — header contextual, slots da bottom-nav e tela-hub de Evolução. |
| Fonte | **Stack de sistema**, normalizando os 11 pesos para 400/500/600/700. A Inter é pedida mas nunca carregada hoje, então isso *preserva* o que já se vê. |
| Contraste | **Escurecer só o texto** dos chips; fundos pastel preservados. |
| Loja (futuro) | **TWA/Android** primeiro — roda o Chrome com a origem real e o cookie jar do usuário, então `FORMETRIC_SESSION` funciona sem tocar no backend. iOS fica no PWA instalável. Nada é decidido agora além de não fechar essa porta. |
| Verificação | **Guardas automatizadas**, mas baratas (ver Onda 0). |
| Branch | `feat/mobile-ux-pwa`, a partir do `main` atual. |

## Restrições do repositório

- `frontend/src/App.css` tem **5.335 linhas** e ~330 classes globais flat. Toda mudança é
  potencialmente global — inclusive para o desktop (≥840px), que **não tem cobertura E2E**
  (`playwright.config.ts` só define `chromium-mobile` / Pixel 7). Contagem de reuso das classes
  que serão tocadas: `.surface-card` em 24 arquivos `.tsx`, `.secondary-button` em 26,
  `.eyebrow` em 25, `.submit-button` em 23, `.page-heading` em 20, `.icon-button` em 7.
- 16 arquivos Vitest renderizam o `App` inteiro em jsdom com `fetch` stubado e buscam por
  texto/rótulo. **jsdom não calcula layout** — regressão visual só se trava no Playwright.
- CI (`.github/workflows/ci.yml`): `lint` → `test` → `build`, depois `container-e2e` que sobe a
  imagem integrada e roda o Playwright contra ela.
- O frontend é embutido no jar do Spring Boot, que serve o SPA com fallback para `index.html`.
  Isso condiciona o service worker (`navigateFallbackDenylist` para `/api`).

---

# Ondas

Cada onda é um conjunto de commits revertível sozinho. **Correção pontual de CSS nunca viaja no
mesmo commit que refatoração estrutural.**

## Onda 0 — Branch e catraca

Antes de qualquer mudança, criar a rede que impede a regressão de voltar no próximo deploy.

- **Capturas de baseline** em 320/390/430px das 12 rotas principais. A crítica apontou que os
  planos originais mandavam comparar contra capturas que ninguém foi instruído a tirar.
- **`frontend/src/css-contract.test.ts`** (~60 linhas, roda dentro do `npm test` que o CI já
  executa): lê `App.css`/`index.css` como texto e falha se (a) alguma regra de controle de
  formulário declarar `font-size` abaixo de 16px, (b) aparecer `100vh` fora de bloco
  `@supports`, (c) aparecer `env(safe-area-inset-*)` sem fallback `, 0px`.
- **Dois projetos extras no `playwright.config.ts` existente** (375px e 320px) e um
  `e2e/guards.spec.ts` que percorre as rotas autenticadas contra o container real e assere:
  `scrollWidth <= innerWidth`; nenhum `input/select/textarea` com `fontSize < 16px`; nenhum
  alvo interativo com caixa < 44px; distância mínima entre um botão destrutivo e o vizinho.

> Rejeitado: suíte Playwright paralela com `playwright.ui.config.ts` + mock de `**/api/v1/**`
> reconstruído a partir de `App.test.tsx`. Custaria mais que as correções e apodreceria na
> primeira rota nova; o config existente já roda contra o container e não precisa de mock.

## Onda 1 — Zoom, respiro e piso de legibilidade (risco baixo)

A onda que mata as duas queixas literais e dá resultado visível no piloto num deploy pequeno.

1. **Tokens de infraestrutura** em `frontend/src/index.css` (adição pura):
   `--field-font: 1rem`; `--safe-top/right/bottom/left: env(safe-area-inset-*, 0px)` — o
   fallback `, 0px` é obrigatório, sem ele a declaração inteira é invalidada onde não há
   suporte; `--keyboard-inset: 0px`; `--nav-height: calc(72px + var(--safe-bottom))`;
   `--nav-clearance: calc(var(--nav-height) + 66px)` (nav + 26px de FAB + 40px de folga);
   `--fill-h: 100svh`; `--sheet-h: 100dvh`; e a escala de z-index (`--z-sticky`, `--z-nav`,
   `--z-overlay`, `--z-toast`, `--z-skip`) migrando os 10 z-index literais do repo.
2. **16px em todo controle** — rede de segurança global (`input, select, textarea { font-size:
   max(16px, 1em) }`) **mais** cada uma das 8 regras de classe que a vencem por especificidade
   (`App.css:899`, `:1476`, `:2053`, `:1152`, `:4643`, `:4650`/`:5097`, `:3363`) e uma regra
   nova para os `<select>` órfãos de `.comparison-picker` e `.reported-result-row`.
   **Não** usar `maximum-scale=1` nem `user-scalable=no`.
3. **Absorver o reflow** dos campos maiores nas quatro telas afetadas.
4. **Os cinco `minmax()` que estouram** entre 560 e 640px: `.serving-row`, `.ingredient-row`,
   `.meal-item-list li`, `.weight-entry`, `.body-filter`.
5. **Desaninhar padding** no mobile (66px de cromo lateral em `/settings/nutrition-goals`).
6. **Respiro vertical:** os 6 `100vh` → `--fill-h`; os 4 `max-height: calc(100vh - N)` de
   diálogo → `--sheet-h`; `main` com `padding-bottom: var(--nav-clearance)`
   (= `calc(138px + safe)`, contra os 14px de folga efetiva de hoje); safe-area inferior nos
   dois backdrops que não a têm. **Cuidado:** usar `var(--safe-left/right)` *puros*, não
   `calc(12px + …)` — em retrato o inset vale 0 e 12px fixos descolam o sheet das bordas com
   cantos retos embaixo. E `App.css:4333` é o seletor **compartilhado**
   `.activity-dialog-backdrop, .shell-dialog-backdrop`, com `.shell-dialog-backdrop`
   sobrescrevendo `padding` inteiro em `:4474` — reescrever o shorthand mexe no quick-add.
7. **Piso tipográfico** (trazido para cá; a crítica mostrou que sem ele metade da tela mais
   usada continua entre 9 e 10px depois da onda): os ~41 tamanhos abaixo de `0.65rem` sobem
   para `0.75rem`, com uma lista fechada de exceções de 12px (eyebrow, `.bottom-nav-item`,
   `.quality-chip`, `.status-chip`, `.estimate-label`), todas com peso ≥700.
   Casos nomeados: `.meal-total small` `:2325`, `.item-primary span` `:2382`, `.quality-chip`
   `:2412`, `.meal-heading span` `:2299`, `.bottom-nav-item` `:748`, `.quick-add small` `:782`.
8. **Contraste:** quatro trocas de hex (`--text-soft` de `#8a948e`/3,13:1 para `#6a726d`/4,95:1
   e equivalentes), escurecendo só o texto dos chips.
9. **Quebra de texto:** `.item-primary strong` troca `text-overflow: ellipsis` por
   `overflow-wrap: anywhere` (nome de alimento truncado é a informação mais importante da
   linha); `overflow-wrap` também em `.workout-notes` e `.weight-entry > p`, os dois campos
   livres de 2000 caracteres hoje desprotegidos.

## Onda 2 — Toque que responde e entrada que não apaga (risco baixo)

1. **Tokens de movimento:** `--ease-out: cubic-bezier(.22,.61,.36,1)`,
   `--ease-sheet: cubic-bezier(.32,.72,0,1)`, `--dur-press: 90ms`, `--dur-fast: 160ms`,
   `--dur: 220ms`, `--dur-sheet: 280ms`, `--dur-bar: 520ms`, `--dur-ring: 700ms`.
2. **`:active` em todas as famílias de botão**, usando a propriedade **`scale` isolada** (não
   `transform`), porque `App.css:773` e `:1658` já usam `transform` e seriam sobrescritos.
3. **Blindar os `:hover`** em `@media (hover: hover)`. Caso crítico: `.favorite-button:hover`
   divide declaração com `.favorite-button.active` (`App.css:1661`) — depois de tocar num card
   a estrela fica acesa sem o item estar favoritado.
4. **Alvos de 44px** e separação das ações destrutivas. Atenção: `.weight-entry-actions` está
   `position: absolute` fora de fluxo (`App.css:4468`) e só volta a `static` em ≥560px — dois
   alvos de 44px em coluna passam de ~62px para ~98px e cobrem a nota da pesagem.
5. **Separador decimal pt-BR:** `parseDecimal` aceitando vírgula **e** `formatDecimalInput`
   simétrico na saída — sem o segundo, o app aceita `72,5` e devolve `72.5` num produto onde
   todo o resto usa vírgula. Atinge ~27 campos. **Quebra 10 asserções `toHaveValue(<número>)`**
   ao trocar `type="number"` por `type="text"` (jest-dom devolve `Number()` para number e
   string para text): `ActivityPages.test.tsx:302,:307`, `BodyEvaluationPages.test.tsx:62`,
   `PlanningPages.test.tsx:177,:178,:182,:185,:186,:242,:245`.
6. **`--keyboard-inset` via `visualViewport`**, aplicado a `.sticky-form-actions`, ao
   esconder a bottom-nav **e — crítico — dentro do sheet**:
   `max-height: calc(var(--sheet-h) - 32px - var(--keyboard-inset))` e
   `padding-bottom: calc(20px + max(var(--safe-bottom), var(--keyboard-inset)))`.
   Sem isso, corrigir o zoom entrega um app onde o usuário vê o campo e **não alcança o botão
   Salvar**, porque no iOS o viewport de *layout* não encolhe com o teclado e `.dialog-backdrop`
   é `position: fixed; align-items: end`.
7. **`inputMode`/`enterKeyHint`/`autoCapitalize`/`autoCorrect`** campo a campo (hoje
   `enterKeyHint` e `autoCapitalize` têm zero ocorrências no repo).
8. **Foco visível** em `textarea` (fora da lista de `index.css:71`) e no heading do assistente
   corporal (`App.css:3270` faz `outline: none` num heading focado por código).

## Onda 3 — Nenhum beco sem saída (risco baixo, paralela à Onda 2)

1. **Primeiros passos na tela Hoje:** as dez negações viram links. `MISSING_TDEE` faz a linha
   de saldo virar `<Link to="/settings/tdee">` com chip "CONFIGURAR"; `diaryStatus === 'MISSING'`
   ganha um botão de 52px "Começar o registro de hoje".
2. **Seletor de alimento:** hoje é um `<select>` de até 200 `<option>` (`ItemEditor.tsx:133`,
   `CATALOG_PAGE_SIZE = 100` para foods **e** recipes) com o campo de busca *acima* dele — o
   usuário abre a roda do iOS, não acha, fecha, digita, reabre. Vira lista tocável reusando
   `.catalog-list-card`/`.catalog-card-main` (`App.css:1530-1564`, já existentes) com a busca
   colada no topo. **E** trocar a guarda `if (foods.isPending || recipes.isPending) return
   <CatalogLoading/>` (`ItemEditor.tsx:102`) por `isLoading`: hoje cada termo novo desmonta o
   próprio `<input>` de busca e **fecha o teclado a cada 250ms de pausa**.
3. **Error boundary + saneamento de identidade.** O boundary sozinho não basta: o crash mora em
   `ProfileTimeContextProvider`, que está *acima* do `AuthenticatedLayout`. Validar
   `locale`/`timeZone` **dentro do provider** com try/catch e fallback para
   `navigator.language`/UTC, trocar os campos de texto livre por `<select>` com `z.enum`, e
   montar um boundary entre o gate de sessão e o provider.
4. **Parar de apagar o app a cada retorno de foco** (`refetchOnWindowFocus: 'always'` →
   revalidação sem desmonte). O overlay de revalidação precisa ser
   `position: fixed; inset: 0` — `visibility: hidden` preserva layout e empilharia 100vh de
   vazio rolável, pior que o desmonte atual.
5. **404 real, fallback de rota e indicador de offline.**
6. **Política de histórico** (pré-requisito das ondas 6 e 7): `selectDate` do Diário usa
   `setSearchParams(params)` **sem** `replace` (`DiaryPage.tsx:157`) — cada dia empilha uma
   entrada. Passa a `replace: true`. A data da Home vive em `useState`
   (`HomePage.tsx:264`), não vai para a URL: recarregar perde, voltar sai do app, e não existe
   "Ir para hoje" — migra para search param com o mesmo botão do Diário. Rolagem ao topo na
   troca de `pathname`.
7. **Texto:** plural quebrado ("3 sessãoões"), jargão de engenharia vazando ("As mutações estão
   bloqueadas"), e erros do backend em inglês chegando ao usuário via `getErrorMessage`.

> Rejeitado: restauração de scroll por `sessionStorage` + `location.key` (~25 linhas de
> contrato implícito com o Router). O bug real é resolvido pelo `scrollTo({top: 0})`.

## Onda 4 — Fluidez percebida (risco médio)

1. **Defaults do QueryClient** e `staleTime` por domínio (contexto de tempo/perfil/catálogo
   longos; log diário e analytics do dia curtos).
2. **`placeholderData: keepPreviousData`** em Home, Diário, Gráficos, Mensal, Peso, Treinos e
   na busca do catálogo — hoje toda troca de data/filtro apaga a região para um spinner.
3. **Skeletons com formas reais** no lugar dos 17 spinners. **Usar `aria-busy` no container, não
   um segundo `role="status"`:** `ProfilePage.test.tsx:97` e `PlanningPages.test.tsx:240,:377`
   usam `findByRole('status')` no singular e o RTL estoura em "found multiple elements".
4. **Optimistic update** nos dois controles mais tocados: água e favorito. Corrigir de passagem
   `invalidateQueries({ queryKey: foodsQueryKey })` (`FoodsPage.tsx:23`), que derruba todas as
   páginas infinitas de 100 itens ao favoritar.
5. **Boot mais curto:** sessão em paralelo, prefetch de `/api/v1/profile/time-context`,
   `LoginPage` lazy (tira zod + react-hook-form do caminho crítico de quem já está logado).

> Rejeitado: `manualChunks` + aquecimento por `requestIdleCallback`. Otimizar RTT de chunks de
> 6-12 KB para 10 usuários é ruído, e mudar o hashing dos assets na véspera de introduzir
> precache de service worker adiciona variável ao deploy mais delicado do plano.

## Onda 5 — Sistema de design e redesign de Hoje e Diário (risco alto)

O redesign autorizado. **A camada de tokens é aplicada globalmente antes das duas telas** —
aplicá-la só nelas produziria uma ilha bonita cercada de telas de 9px, e o contraste entre um
item de refeição de 15px e uma linha de catálogo de 9,4px na mesma sessão seria gritante.

1. **Tokens de design** em `index.css`: espaço base-4 (`--space-1..8`); tipografia
   (`--fs-caption` 12px, `--fs-footnote` 13px = piso absoluto de texto de leitura, `--fs-body`
   15px, `--fs-headline` 17px, `--fs-title` 20px, `--fs-title-lg` 28px, `--fs-display` 40px,
   `--fs-numeral` 44px); raios em 4 degraus (12/16/20/24 + pill); `--hairline`; `--tap: 44px`,
   `--tap-lg: 52px`. **Nenhum valor de cor novo** — a paleta light + o override completo de dark
   permanecem byte a byte.
2. **Aplicação global às classes compartilhadas** — é isto que repassa o app inteiro:
   `.submit-button`/`.secondary-button` 48→52px e `0.86rem`→`--fs-body`; `.icon-button` 34→44;
   `.compact-button`→44; `.text-button`→44; `.eyebrow`→12px/700; `.heading-copy`→15px;
   `.empty-state`/`.inline-empty-state`/`.catalog-state` com corpo 15px e ações empilhadas;
   `font-variant-numeric: tabular-nums` em todo valor numérico.
   `h1` do `.page-heading`: `clamp(2rem, 4vw, 2.75rem)` → **1.75rem fixo no mobile**, clamp
   preservado em `@media (min-width: 840px)`. **Não deletar o elemento** — seis asserções entre
   `App.test.tsx`, `DiaryPage.test.tsx` e o e2e dependem dele.
3. **Stack de sistema** e normalização dos pesos 650/680/730/750/760/800 → 400/500/600/700.
4. **Tela Hoje:** anel de 200px mantendo `role`/`aria-value*`/`.without-target`; **bloco de
   faixa** novo abaixo dele (linha "Faltam 480 kcal para a faixa" + barra de 10px com dois ticks
   de 2px marcando min e max) alimentado por `reference.minValue/maxValue/remainingToRange/
   excessOverRange`, que o backend já devolve (`analytics/api.ts:44-51`) e que hoje morre dentro
   de uma frase de 0.7rem — o `conic-gradient` é estruturalmente incapaz de desenhar uma faixa;
   saldo energético em linha de 56px; **card-grupo de 3 linhas de 68px + rodapé de 52px (256px)
   substituindo o `.overview-grid` de quatro cards (572px)**; atalho "+250" de um toque na linha
   de água. A estrutura `.nutrition-card > .calorie-summary + .macro-summary` é **preservada**
   porque o desktop (`App.css:2884+`) monta o grid de duas colunas em cima desses dois blocos.
5. **Tela Diário:** faixa de 7 dias com `scroll-snap`; menu `⋯` de 44px por refeição e por item
   abrindo sheet de ações (elimina `.meal-actions { grid-column: 1 / -1 }` de `App.css:2330`,
   que hoje gasta uma **segunda linha inteira** por refeição); linha de item em 2 colunas com
   P/C/G mantido visível; `.quality-chip` renderizado só quando `dataQuality !== 'EXACT'`; água
   numa fila de 4 botões de 56px; ações do dia empilhadas; disclosure "Ver classificação das
   metas" com `grid-template-rows: 0fr → 1fr`, **nunca `display: none`** — o conteúdo precisa
   permanecer no DOM ou 5 casos de `DiarySummary.test.tsx` caem de uma vez.
6. **Teste unitário da matemática de escala** (`pct()`, `scaleMax`) antes de virar pixel: é a
   única peça nova que pode **desinformar** — com `scaleMax` errado, uma meta "≥120 e ≤160" com
   170 g renderiza visualmente como sucesso.
7. **`useQuickWater(date)` extraído para `diary/queries.ts`** (encapsula `addWater` +
   `setQueryData` + `invalidateAnalytics`), consumido por Diário **e** Home — um lugar só, não
   dois. Precisa de teste explícito de que o valor na Home muda após o toque.
8. `DiaryPage.tsx` passa de 272 linhas e precisa quebrar em `MealCard`/`MealItemRow`/
   `WaterSection` — refactor que faz parte desta onda, não um extra.

## Onda 6 — Sheet unificado, toast e movimento (risco alto)

1. **`<BottomSheet>` sobre `<dialog>` nativo**, renderizado **condicionalmente** — manter o nó
   vivo quebra `DiaryPage.test.tsx:363,:388` (`queryByRole('dialog')).not.toBeInTheDocument()`)
   por construção. **Preservar o breakpoint de 560px:** `App.css:2737-2868`, `:4544-4614` já
   centralizam os três diálogos a partir de 560px com larguras deliberadas (620px, 650px,
   440px) — as larguras viram variante do componente, não um valor único.
2. **Migrar os três modais.** `DiaryDialog` hoje não tem Escape nem gerenciamento de foco;
   `ActivityDialog.tsx:17-30` já faz foco inicial, Escape e restauração — é o modelo a
   generalizar. Somar scroll lock (técnica que funciona no iOS), `overscroll-behavior: contain`
   e `inert` no fundo.
3. **Voltar fecha o sheet** via `useSheetHistory` — o hook empilha uma entrada ao abrir e fecha
   no `popstate`, **sem serializar id nenhum na URL**. Isso evita de propósito os dois problemas
   da abordagem "modal no URL": `WorkoutsPage.tsx:62` guarda um `crypto.randomUUID()` como
   `requestId` de idempotência que a URL não carrega, e os editores guardam **objetos**
   (`{ type: 'item'; item?: MealItem }`), então procurar por id numa lista servida por
   `keepPreviousData` abriria "Editar" como "Adicionar".
4. **Toast próprio + Desfazer** nas exclusões reversíveis; **sheet de confirmação** para
   arquivar alimento/receita e excluir avaliação, no lugar do `window.confirm` nativo.
   Cuidado com cardinalidade de `role`: `DiaryPage.test.tsx:337` assere
   `getAllByRole('alert')).toHaveLength(1)`.
   Corrigir de passagem: `removeMeal`, `removeItem`, `removeWater` e `reopen` **não estão em
   nenhum grupo de `dialogMutations`** (`DiaryPage.tsx:115-121`), então `.reset()` nunca é
   chamado neles e uma exclusão que falha deixa o alerta cravado no topo do diário pelo resto da
   sessão, inclusive depois de a operação ser refeita com sucesso.
5. **Movimento onde informa:** entrada de rota no container (`opacity` + `translateY(8px)`,
   220ms) — nunca card a card; sheet `translateY(100% → 0)` em 280ms; anel via
   `@property --calorie-progress` (a custom property já é setada inline em `HomePage.tsx:159`);
   barras com `transition-delay` escalonado terminando em 700ms; confirmação de água por
   `scale(1 → 1.06 → 1)`. **Proibidos:** count-up em número nutricional, stagger de lista,
   parallax, ripple, hover-lift, animação em troca de data/filtro, colapso de cabeçalho
   interpolado por scroll. `prefers-reduced-motion` passa a zerar também `animation-duration`,
   `animation-iteration-count` e o `scale` do `:active` — hoje só zera `transition-duration`, e
   o `route-spinner` infinito continua girando.
6. **Swipe horizontal entre dias** no Diário — só depois da política de histórico da Onda 3,
   usando `replace: true`; sem ela, deslizar uma semana cria 7 entradas e o voltar do PWA
   instalado deixa de servir para sair da tela.

## Onda 7 — Navegação e arquitetura de informação (risco médio)

- **Header contextual:** botão voltar e título nas telas profundas (`/foods/:id`,
  `/progress/evaluations/:id`, `/settings/*`), reaproveitando os `.page-heading` que já existem
  para não duplicar título. Num PWA instalado no iOS não há botão voltar do navegador.
- **Recompor os slots da bottom-nav** e criar a tela-hub de Evolução/Acompanhamento; Treinos
  hoje não tem porta nenhuma no mobile. Quebra testes de navegação em `App.test.tsx` e
  `ProfilePage.test.tsx` — atualizá-los faz parte da onda.
- **Perfil vira menu "Mais"** de verdade, com os destinos restantes organizados.

## Onda 8 — PWA (risco médio)

1. **Desbloquear no Spring Security:** `SecurityConfiguration.java:40-63` precisa liberar
   `/manifest.webmanifest` e `/sw.js`. Sem isso nada do resto funciona.
2. **Manifest + ícones + tags iOS.** Corrigir a divergência: os `theme-color` de
   `index.html` (`#f4f6f2`/`#0e1210`) não batem com `--background` (`#f3f5f1`/`#0d1210`).
   `public/` hoje só tem `favicon.svg` — gerar 192/512/maskable/apple-touch-icon a partir dele.
3. **`vite-plugin-pwa`** (única dependência nova, e é `devDependency`), precache **só do
   shell**, `navigateFallbackDenylist` para `/api`, e **nenhum cache de `/api`** — num app
   multi-tenant por convite, servir dado nutricional velho como atual é pior que não funcionar
   offline.
4. **Prompt de atualização em PT-BR** e `Cache-Control` correto no backend.
5. **Standalone, sessão de 30 dias e prompt de instalação** discreto (com a instrução manual
   "Compartilhar → Adicionar à Tela de Início" no iOS, que não tem `beforeinstallprompt`).
6. **`shortcuts` do manifest por último**, e declarando `?action=` como contrato permanente —
   um shortcut fica congelado no ícone instalado até a reinstalação, então mudar o contrato
   depois quebra silenciosamente.

---

## Verificação

**Automatizada (roda no CI existente):**
- `npm test` — o `css-contract.test.ts` da Onda 0; o teste unitário de `pct()`/`scaleMax` da
  Onda 5; a suíte Vitest atual, com as 10 asserções `toHaveValue` migradas para string na
  Onda 2 e as de navegação atualizadas na Onda 7.
- `npm run test:e2e` — `e2e/guards.spec.ts` nos projetos de 320/375/390px: sem overflow
  horizontal, sem controle abaixo de 16px, sem alvo abaixo de 44px, distância mínima entre
  destrutivas. Mais os 4 testes de fluxo já existentes, que não podem regredir.

**Manual, em aparelho real (o que nenhum guarda cobre):**
- **iPhone:** focar quantidade no diário e peso — a tela não pode ampliar. Abrir o sheet do
  diário com o teclado aberto — Salvar precisa estar alcançável. Confirmar que as ações do sheet
  não encostam no indicador de home. Girar para paisagem e conferir o inset lateral.
- **Andar as 12 rotas em 320/390/430px** comparando com as capturas de baseline da Onda 0 —
  é a única forma de pegar as linhas de lista deslocadas pelo `.icon-button` de 34→44px em
  catálogo, receitas, treinos, peso e avaliações.
- **Conta nova de convite:** chegar de Hoje até uma refeição registrada sem sair da tela para
  descobrir o caminho.
- **Slow 4G:** trocar data no diário sem a lista sumir; digitar na busca sem esvaziar a tela.
- **Android:** Chrome oferece instalar; ícone maskable não fica recortado; os shortcuts abrem
  o sheet certo. Deslogado, `curl -i /manifest.webmanifest` e `/sw.js` retornam 200.

## Riscos assumidos

1. **As páginas vão crescer em altura.** Piso de 13px e alvos de 44/52px fazem o Diário rolar
   mais do que rola hoje, mesmo eliminando a segunda linha de cada cabeçalho de refeição. A
   troca é deliberada — rolar é barato no celular, errar o alvo não é — mas é a primeira coisa
   que vai ser notada.
2. **Editar item passa de 1 para 2 toques; excluir, de 1 para 3; duplicar refeição, de 1 para 2.**
   Se incomodar, a saída barata é promover só "Duplicar" de volta ao cabeçalho como segundo
   botão de 44px — o cabeçalho tem folga depois que a segunda linha morreu.
3. **A faixa de 7 dias é o único elemento verdadeiramente novo** e, sem marcar dias com
   registro (não existe endpoint), é um seletor de data mais bonito e 64px mais alto. Deve ser
   a primeira coisa a cair se não provar valor.
4. **`@property --calorie-progress` não existe em WebViews Android antigas.** A degradação é
   silenciosa (o anel aparece no valor final), mas a animação de assinatura não existirá para
   parte dos 10 usuários e não há como saber quais.
5. **Manter o vidro na bottom-nav** significa que o conteúdo continua passando semi-visível
   atrás da barra ao rolar. A folga foi corrigida, a sujeira visual não.
6. **A ordem do card de nutrição** (anel → faixa → saldo → macros) exige rolar para ver
   proteína. Se estiver errada, inverter os dois blocos internos é barato — mas só se descobre
   com o app na mão.
7. **Três elementos decorativos preservados** (gradiente radial, gradiente linear, anel) para
   não quebrar "gostei da aparência". Se a tela ainda parecer carregada, a próxima iteração terá
   de removê-los um por vez para atribuir a causa.
8. **Onda 7 quebra testes de navegação de propósito.** Atualizá-los é trabalho previsto, mas é
   onde um erro passa despercebido com mais facilidade.

## Nota de execução

As especificações completas de tela, o sistema visual, as prescrições detalhadas por onda e a
crítica adversarial estão em [`docs/design/`](./README.md) — elas contêm valores por elemento
(alturas, pesos, cores, derivação exata das strings de faixa) que não cabem neste plano e que a
implementação consulta linha a linha. Ver [README.md](./README.md) para a ordem de precedência
entre os documentos e as divergências já resolvidas.
