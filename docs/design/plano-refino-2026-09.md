# Plano de refino de UI — setembro de 2026

Segunda passada sobre a interface, depois da reforma de agosto (`docs/design/plano.md`, oito ondas,
commits `f2843e4`..`501264e`). Aquela reforma resolveu o que estava medido: zoom de foco no iOS,
alvos de toque, becos sem saída, PWA. Esta trata do que sobrou e não estava medido — ritmo
vertical, alinhamento horizontal, densidade e arquitetura de informação.

**Origem.** Auditoria de 02/09/2026 sobre o ambiente publicado, com conta real e dados semeados,
a 320, 375, 390 e 1440px. Nove auditores varreram um grupo de telas cada; nove céticos tentaram
refutar cada achado. Sobraram **199 achados confirmados** e 12 foram descartados — os motivos do
descarte estão na seção 6 e valem tanto quanto os achados. As medidas de apoio estão em
[medidas-2026-09-02.md](medidas-2026-09-02.md) e o backlog completo em
[achados-2026-09-02.md](achados-2026-09-02.md).

**Precedência.** Este documento fica ABAIXO de `plano.md` e `critica-adversarial.md` na ordem
declarada em [README.md](README.md): onde ele contradisser uma decisão já tomada lá, a decisão
antiga vence, salvo se a seção 6 der o argumento novo explicitamente.

---
## Plano único de correção de ponta a ponta

Documento executável. Todos os números abaixo foram reconferidos no código em 02/09/2026, não copiados dos achados.

---

## 1. Diagnóstico em uma página

O app não tem um problema de espaçamento. Tem **um sistema de design declarado na documentação e nenhum sistema de design na cascata** — e o que o dono descreve como "confuso" e "esquisito" é o ruído de quatro mecanismos que essa ausência produz.

**Mecanismo 1 — `.surface-card` é cromo sem anatomia.** O bloco inteiro (App.css:454-458) declara três propriedades: `border`, `background`, `box-shadow`. Elas dizem o que um cartão *parece* e nada sobre o que ele *contém*. A classe é usada em **77 pontos de `.tsx`**, e como nunca declara `padding` nem `border-radius`, cada consumidor precisa inventar os dois. Setenta e sete invenções independentes produziram **11 recuos** (10, 11/13, 15, 16, 17, 18, 19, 20, 21, 22, 25, 30px) e **16 raios** num sistema que declara quatro. Isso não é desleixo: é a saída previsível de um contrato que omite exatamente as duas propriedades de que todo consumidor precisa.

**Mecanismo 2 — o `1px` de borda nunca é descontado, e mora em níveis diferentes.** Um cartão com `border: 1px` e `padding: 16px` entrega conteúdo em 20+1+16 = **37**. Um bloco sem borda com `padding: 15px` entrega em 20+15 = **35**. E o `.diary-summary`, que tem borda e `padding: 0`, entrega seus filhos em 21, de onde uma célula com `padding-left: 15px` cai em **36**. É daí que saem os pares separados por um pixel que a medição registrou em todas as telas grandes: **20/21, 36/37, 53/54, 74/75, 202/203**.

Esse é o achado central sobre "centralização esquisita": **um recuo de 20px lê-se como hierarquia; um recuo de 1 a 5px lê-se como erro.** O olho detecta desalinhamento muito abaixo do limiar em que consegue nomeá-lo como intenção. Em `/analytics/monthly` há **11 bordas esquerdas com cinco pares de 1px**. Na Home, o texto do callout cai em 38 e o interior do cartão de nutrição em 43 — dois blocos empilhados a 5px de diferença.

**Mecanismo 3 — recuo acumula por profundidade de aninhamento, não por papel.** Gutter da página (20) + recuo do cartão + recuo do sub-cartão + recuo da linha. Ninguém declarou "o conteúdo desta tela vive em x=37". Cada nível acrescentou o seu respiro localmente, correto isolado, e a soma é uma escada. O ritmo vertical tem o mesmo mecanismo com outro nome: uma margem decidida no momento em que o bloco foi escrito está sempre "mais ou menos certa" — o erro só aparece quando se empilham nove delas. A Home usa **catorze medidas verticais distintas, das quais quatro são token**.

**Mecanismo 4 — a escala tipográfica opera com dois degraus, e os dois ficam embaixo.** Contagem real de uso dos seis tokens:

| token | px | usos |
|---|---|---|
| `--fs-caption` | 12 | **113** |
| `--fs-footnote` | 13 | 56 |
| `--fs-body` | 15 | **8** |
| `--fs-headline` | 17 | **5** |
| `--fs-title` | 20 | 2 |
| `--fs-title-lg` | 28 | 1 |

Mais **89 declarações em rem/px cru, em 31 valores** — das quais 32 se espremem entre 0,75rem e 0,78rem, ou seja, quatro tamanhos indistinguíveis dentro de um único degrau. O `index.css` diz por escrito que `--fs-caption` é "reservado a rótulo curto em caixa alta e peso alto"; ele carrega hoje toda a prosa do app. **A tela não tem corpo — tem legenda e título.** É essa razão, e não o padding, que produz a massa cinza.

**Por que a escala não resolveu nada.** Contagem sobre `App.css`: `padding` 17 tokenizados contra **151 crus**; `gap` 13 contra **174**; `border-radius` 16 contra **122**. A escala foi declarada, Hoje e Diário foram parcialmente reconstruídos sobre ela, e as outras 22 telas nunca foram convertidas. E **nada obriga**: `tools/css-contract.ts` tem quatro regras e nenhuma é sobre escala.

Uma escala declarada e não obrigada não reduz variação — **acrescenta o vigésimo valor aos dezenove que já existiam**, porque agora alguns blocos usam `var(--space-4)`, outros usam `16px` e outros `17px`, e o leitor não consegue distinguir qual é deliberado. É literalmente a frase do dono: "às vezes está correto, às vezes está errado".

---

## 2. As regras novas do sistema

Onze invariantes. Cada uma mata uma classe inteira de defeito; juntas resolvem cerca de 100 dos 199 achados sem que ninguém precise abrir um achado.

### R1 — Duas bordas esquerdas por tela. Duas.

- **x = `--page-gutter`** (20px): título de página, eyebrow de página, ação de nível de página. Tudo que está *fora* de cartão.
- **x = gutter + 1 (borda) + `--space-4`** = **37px**: *todo* conteúdo dentro de cartão.

Corolário: célula de grade, linha de lista, nota e cabeçalho interno de cartão usam **o mesmo recuo horizontal, `--space-4`**. O recuo *vertical* continua livre por função. Um cartão-herói respira mais em cima e embaixo, nunca dos lados: `.calorie-summary, .macro-summary { padding: var(--space-5) var(--space-4) }`.

Única exceção autorizada: **sub-cartão com fundo e borda próprios** (`.goal-state`, `.energy-balance`), que se lê pela própria borda e não pelo fio do cartão pai.

Escolhi 16 e não 20 porque `.hub-item`, `.day-overview-row`, `.meal-heading`, `.meal-item-list li` e `.summary-footnote` já estão em 16 — é o único lugar onde o sistema já é consistente, e 20 quebraria justamente ele. É também o mais barato verticalmente, e o dono pediu menos.

> Resolve sozinha: `home-cinco-bordas-esquerdas`, `cinco-margens-esquerdas`, `quatro-bordas-dentro-do-diary-summary`, `seis-bordas-esquerdas-no-sheet-de-item`, `foods-quatro-bordas-esquerdas`, `novo-alimento-tres-bordas`, `tres-bordas-esquerdas-foods-new`, `seis-arestas-esquerdas-mensal`, `padding-15-vs-16-vs-18`, `desktop-saldo-e-panorama-desalinhados`, mais a 4ª borda de `/recipes/new`. **~12 achados.**

### R2 — `.surface-card` ganha raio, e só raio. O recuo tem vocabulário de três valores.

```css
.surface-card {
  border: 1px solid var(--border);
  border-radius: var(--radius-card);   /* NOVO */
  background: var(--surface);
  box-shadow: var(--shadow);
}
```

Seguro: todo cartão que quer outro raio já o redeclara mais abaixo no arquivo e continua vencendo por ordem. De quebra, `.nutrition-card` sai de 22 para o token.

**Não pôr `padding` em `.surface-card`.** São 77 pontos de uso e pelo menos dez são deliberadamente sem recuo — `.nutrition-card`, `.day-overview`, `.meal-card`, `.hub-list`, `.diary-summary`, `.catalog-list-card` — porque contêm linhas que sangram de borda a borda. Pôr recuo ali quebraria exatamente os cartões que estão certos hoje. Em vez disso, **escrever o contrato como comentário no topo do bloco**, nomeando os cartões de recuo zero: foi a ausência de contrato escrito, e não a ausência de padding, que produziu os 11 valores.

Vocabulário de recuo: `--space-4` (linha, célula, cartão de lista) · `--space-5 var(--space-4)` (cartão-herói) · `--space-6` (estado vazio, e cartão no desktop ≥840px).

Vocabulário de raio, com significado de **aninhamento — o raio diminui para dentro, sempre**:

| token | px | onde |
|---|---|---|
| `--radius-chip` | 12 | ícone, chip, campo, controle pequeno |
| `--radius-control` | 16 | botão, caixa interna de cartão |
| `--radius-card` | 20 | cartão |
| `--radius-hero` | **24 (novo)** | `.nutrition-card`, `.diary-summary`, topo do sheet |
| `--radius-pill` | 999 | pílula |

De-para: 9/10/11/12/13 → chip · 14/15/16/17 → control · 18/20 → card · 22 → hero.

> Resolve: `surface-card-sem-anatomia`, `escala-quebrada-paddings-raios`, `sete-raios-treze-paddings`, `dois-raios-de-card`, `onze-raios-num-scroll`, `oito-raios-dentro-dos-sheets`, `sete-raios-numa-tela`, `raio-em-px-cru`, `home-paddings-e-raios`. **~9 achados.**

### R3 — Três degraus verticais, e nada entre eles.

- **Entre SEÇÕES** (blocos com título próprio): `--space-7` (32).
- **Entre BLOCOS irmãos**, e entre um cabeçalho e o conteúdo que ele rotula: `--space-4` (16).
- **Dentro de um bloco** (gap de lista, rótulo→valor): `--space-2` (8) ou `--space-3` (12).
- `.page-heading` fica em `--space-6` (24). É o degrau de "cabeçalho de página" e existe em uma instância por tela.

**Duas proibições:**

1. **Margem negativa para corrigir a margem do vizinho.** Existem três hoje — `.diary-status-row { margin: -8px }`, `.reference-copy { margin: -12px }`, `.goal-validity-hint { margin: -7px }`. Cada uma é a assinatura de dois blocos que discordam sobre quem paga o vão, e a de `.reference-copy` produz o defeito mais visível do gênero: dois cartões idênticos em `/foods/:id` com 15px e 27px entre título e conteúdo.
2. **Vão pago pelos dois lados.** O vão pertence ao bloco de **cima** (`margin-bottom`). `margin-top` de bloco vira exceção que precisa de comentário justificando.

> Resolve: `home-ritmo-vertical-erratico`, `nove-ritmos-verticais`, `tres-ritmos-verticais-no-mesmo-sheet`, `ritmo-vertical-foods-quatro-gaps`, `ritmo-vertical-sete-valores`, `heading-27-menos-12-detalhe`, `tres-gaps-de-cabecalho-quase-iguais`, `ritmo-vertical-do-formulario`, `margem-de-secao-colide-com-o-gap`, `home-cta-colada-no-cartao`, `home-saldo-colado`, `more-rola-26px`, mais as três lacunas de ritmo interno. **~15 achados.**

### R4 — Par de botões: mesma largura e mesma altura, ou não é par.

- **`flex: 1 1 0`, nunca `flex: 1 1 auto`.** Base `auto` divide o espaço livre *sobre* a largura do conteúdo, então o rótulo mais longo ganha o botão mais largo — é a causa aritmética exata de "Registrar peso" medir 181px, 164px e 202px em três telas irmãs.
- **Altura:** `--tap-lg` (52) para botão de largura plena ou de par; `--tap` (44) só para controle embutido em linha.
- **Texto:** `--fs-body` (15) em **todo** texto de botão. Exceção única e escrita no CSS: `.filter-chip`/`.compact-button` em `--fs-footnote`, porque são controles inline de barra. Apagar o `font-size` de `.heading-actions .submit-button` (App.css:2325), que hoje faz o mesmo botão ter 13px no cabeçalho e 15px no cartão da mesma tela.
- **Hierarquia dentro do par é de peso e cor, não de largura.** A única exceção é o sheet, onde `.dialog-actions > .secondary-button { flex: 0 1 auto }` — 'Cancelar' encolhe para ~100px e o primário fica com 240px a 390px, cabendo em uma linha sem tocar em copy assertada.
- **Onde há três botões e um é destrutivo, o destrutivo sai da linha:** `flex-basis: 100%; margin-top: var(--space-2)`.

> Resolve: `par-de-botoes-flex-1-1-auto`, `acoes-detalhe-tres-larguras`, `primario-quebra-em-duas-linhas`, `acoes-esticadas-no-painel-de-desktop`, `estado-vazio-com-tres-larguras-centradas`, `home-dois-botoes-verdes-diferentes`, `home-cta-menor-que-link-secundario`, `cinco-tamanhos-de-texto-de-botao`, `alturas-de-controle-divergentes`, mais a lacuna do `.heading-actions`. **~10 achados.**

### R5 — Um eyebrow por tela, no cabeçalho, e nunca acima de um h2 que diz o mesmo.

O `.eyebrow` existe para dizer **em que parte do app você está**. É um por tela, dentro do `.page-heading`. Dentro do conteúdo, seção tem `<h2>` e mais nada — um `<p class="eyebrow">` acima de um `<h2>` é a mesma informação em duas tipografias, custando 24px cada (12px + `--space-2`).

**Exceção única no app inteiro:** eyebrow que rotula um *número* que sem ele não tem nome — 'CONSUMIDO' sobre os 32px do `.diary-calories`.

Em **tela-porta** o eyebrow também sai: 'MENU' sobre 'Mais' e 'ACOMPANHAMENTO' sobre 'Evolução' são o título dito duas vezes. E o `.heading-copy` sai das telas-porta e da Home — é copy de sistema descrevendo a arquitetura do produto para quem só quer saber quanto comeu.

> Resolve: `home-quatro-titulos-duplos`, `quatro-tratamentos-para-quatro-secoes`, `titulo-de-secao-do-hub-duplica-o-eyebrow`, `eyebrow-nao-e-migalha`, `desktop-h2-desiguais`, mais o corte de densidade correspondente. **~6 achados e ~200px verticais.**

### R6 — Uma família de sheet. Três larguras, zero chromes.

`.diary-dialog` e `.activity-dialog` são hoje **idênticos declaração por declaração** — mesmo `overflow`, `width`, `max-height`, `padding`, `border-radius`, `box-shadow` — escritos duas vezes a 1.870 linhas de distância. Foi assim que divergiram.

Os corpos compartilhados vão para os seletores agrupados **que já existem** (App.css:3304 e 3310, confirmados). Cada classe fica só com `--sheet-w`, e `width: min(100%, var(--sheet-w, 100%))` dentro do `@media 560` preserva **620 / 650 / 440** (restrição 3). Não criar `.sheet`/`.sheet-backdrop`: não existem em nenhum `.tsx` e o bloco base não se aplicaria a nada.

Mais quatro invariantes de sheet:

- **`.diary-dialog, .activity-dialog, .quick-add-menu { outline: none }`.** A "borda escura visível" que diferenciava o `.activity-dialog` não é decisão de design: é o anel de foco do navegador no `<section role="dialog" tabIndex={-1}>`, que aparece quando o sheet abre por deep link e não aparece quando abre por toque. O mesmo sheet tem duas aparências.
- **Cabeçalho e rodapé grudam por `position: sticky`**, nas classes que já existem — zero TSX. Reestruturar o painel em grid exigiria um slot novo em `DiaryDialog`/`ActivityDialog` e tocaria 8 pontos de chamada, porque as ações vivem dentro de cada formulário filho.
- **O erro fica sempre imediatamente acima de `.dialog-actions`**, dentro do bloco que gruda. Hoje ele fica no topo no diário e no fim na atividade — em nenhum dos dois o usuário o vê ao tocar em salvar.
- **`border-radius: var(--radius-hero) var(--radius-hero) 0 0`**, e `padding: var(--space-6)` nos três painéis a ≥560px (hoje 26/26/24).

> Resolve: `tres-chromes-sao-copia-carbono`, `anel-de-foco-do-navegador-no-painel`, `sheet-rola-inteiro-sem-rodape-fixo`, `erro-do-formulario-em-dois-lugares`, `oito-raios-dentro-dos-sheets`, `padding-26-e-classe-morta`, `painel-560-perde-teclado`, `keyboard-inset-sem-fallback`, `titulo-do-sheet-fora-da-escala`, mais as lacunas de `overscroll-behavior` e do quick-add sem teto de altura. **~11 achados.**

### R7 — Uma altura de linha de lista por PAPEL. Três no app inteiro.

| altura | token | papel |
|---|---|---|
| **68px** | `--row-lg` | linha com dois níveis de texto: destino de hub, linha de dado |
| **56px** | `--row` | linha simples: ação de sheet, escolha de catálogo |
| **52px** | `--tap-lg` | botão de largura plena |

`.settings-link` (70px, e **86px quando a nota quebra** — 16px de degrau dentro da mesma lista) morre junto com o cartão de navegação do Perfil. `.shell-quick-actions a` (69) → 68. `.water-history li` (43) → 52. `.add-item-button` (45) → 52.

**Corolário que resolve o defeito invisível:** altura de linha é `min-height` **mais padding vertical**, nunca `min-height` sozinho com `align-items: center`. Hoje o `.hub-item` tem altura fixa de 68px: a linha cuja nota cabe em uma linha respira 13,5px acima e abaixo, e a de duas linhas respira **5px**, no mesmo cartão, uma ao lado da outra. Onde a altura for fixa por decisão, **a nota tem de caber em uma linha, e isso é responsabilidade da copy** — não do padding.

> Resolve: `tres-alturas-para-a-mesma-linha-de-lista`, `hub-item-respira-13px-ou-5px`, `alturas-de-linha-decididas-caso-a-caso`, `terceira-lista-agrupada-divergente`, `historico-de-agua-com-fio-duplo`, `quick-add-sem-hierarquia`. **~6 achados.**

### R8 — Nome não trunca. Número cede.

Numa linha com nome e valor, quem recebe `overflow: hidden; text-overflow: ellipsis; white-space: nowrap` é o **valor**; a coluna do nome é `minmax(0, 1fr)`. O valor é o dado com redundância — está no cartão, no total, na tela irmã. O nome é o único identificador da linha.

Concretamente, a coluna do valor vira **`minmax(0, auto)`**. É o `auto` sem o `minmax(0, …)` que impede a trilha de encolher abaixo do `min-content` e força a quebra a acontecer no vizinho — a causa mecânica de as três notas do Panorama truncarem em 'Nenhuma s…' e 'Pesagem oficial n…'.

- **Nunca trunca:** nome de alimento, nome de refeição, nome de treino, título de avaliação, rótulo de linha de lista. Onde não couber, quebra em duas linhas e a linha cresce.
- **Pode truncar:** valor concatenado (lista de modalidades), nota derivada.
- **Corolário de copy:** se um texto só cabe truncado, ele é longo demais e a correção é a *string*, não o CSS. Três notas do app são estáticas e não carregam dado nenhum — 'Pesagem oficial nesta data' é a mais clara — e saem.

> Resolve: `home-metric-title-classe-morta`, `home-notas-do-panorama-truncadas`, `linha-do-item-quebra-em-quatro-a-320`, `titulos-de-lista-menores-que-o-corpo`, `reserva-de-94px-no-cartao-de-avaliacao`, mais a lacuna do `.item-primary strong`. **~6 achados.**

### R9 — A escala tem seis degraus e o meio existe. *(a maior)*

- **`--fs-caption` (12) volta aos cinco papéis autorizados:** eyebrow, rótulo da bottom-nav, `quality-chip`, `status-chip`, `estimate-label`. Os outros ~100 usos vão para `--fs-footnote` (prosa), `--fs-body` (rótulo de campo, texto de controle) ou `--fs-headline` (nome de item, valor de macro).
- **`--fs-footnote` (13) é o piso de qualquer texto que se LEIA. `--fs-body` (15) é o piso de qualquer CONTROLE.**
- **Nome de item, nome de refeição e valor de macro são `--fs-headline` (17), sem exceção** — é o degrau que `index.css:101` já nomeia exatamente assim, e que hoje tem 5 usos no app inteiro. O caso mais grave: `.item-primary strong { font-size: 0.77rem }` põe o **nome do alimento a 12,32px**, com um comentário logo acima da regra dizendo "o nome do alimento é a informação mais importante da linha".
- **Declarar `--fs-display: 2.5rem` e `--fs-numeral: 2.75rem`.** Hoje o maior número do produto é `2rem` = 32px contra um h1 de 28px — e no desktop, onde o h1 vira `clamp(2rem, 4vw, 2.75rem)` = 44px, a hierarquia está **invertida**: o título da página é maior que o número que a página existe para mostrar.
- **Zero tamanho em rem cru.** As 89 declarações em 31 valores morrem.

**Esta é a única regra com ordem obrigatória.** Subir 25 blocos de prosa de 12 para 13px acrescenta altura, e ela entra *depois* dos cortes de densidade da fase 6. E depende de uma decisão ainda aberta: `principios-e-descartados.md` registra que a escolha da fonte não foi feita, e que "500 e 600 só são confiáveis no iOS/macOS". Toda hierarquia apoiada em peso 600 é indecidível até isso fechar.

> Resolve: `home-seis-tamanhos-no-mesmo-degrau`, `fs-caption-usado-fora-dos-cinco-papeis`, `noventa-e-um-tamanhos-fora-da-escala`, `rotulo-de-campo-em-0-78rem`, `rotulo-de-campo-em-quatro-tamanhos`, `nome-da-refeicao-menor-que-o-corpo`, `macro-sem-hierarquia`, `valores-de-macro-menores-que-o-rotulo`, `nome-do-alimento-menor-que-a-busca`, `legenda-menor-que-o-campo`, `caption-carregando-texto-corrido`, `prosa-em-fs-caption`, `cinco-tamanhos-de-numero-invertidos`, `atingimento-sem-hierarquia`, `rotulo-de-campo-e-nome-de-item`, `linha-de-pesagem-toda-em-12px`, `rotulo-e-nota-com-mesmo-peso`, `tokens-de-numero-nunca-declarados`, `nome-do-nutriente-menor-que-item-de-menu`. **~19 achados.**

### R10 — Toda regra vive uma vez.

Um seletor declarado duas vezes é bug latente: a segunda vence e a primeira mente para quem lê. Confirmados no arquivo: **`.section-title-row`** (App.css:483 e 726 — a segunda inverte o `align-items` da primeira e é ela que vale em todo cabeçalho de seção do app), **`.compact-button`** (1848 e 2245 — a primeira o faz pílula junto com `.filter-chip`, a segunda o transforma em retângulo de 10px), mais `.weight-metric-grid`, `.analytics-chart-controls`, `.analytics-chart-panel`, `.body-history`.

E CSS morto: o bloco **`.metric-*` inteiro** (App.css:844-913) é resto do `.metric-card` que a Onda 5 apagou — `.metric-copy > strong` (1,42rem), `.metric-copy > strong small`, `.metric-note.positive` e `.metric-copy > strong.metric-title` não casam com nada, e é dentro dele que vive a classe morta que trunca o valor do treino. Mais `.date-navigation > label input` (dez declarações sobre um input com `opacity: 0`, incluindo `min-height: 40px`), ` item-dialog-form`, `.linear-progress`/`.progress-fill.*`, e `.catalog-load-more`, que é aplicada no TSX e não tem regra nenhuma.

**E a ordem de importação.** `NutritionGoals.css` é importado dentro de `NutritionGoalsPage.tsx:10`, ou seja, **antes** de `App.css` no grafo de módulos. Três regras escritas de propósito nunca rodaram. A correção é mover o import para `App.tsx`, logo depois de `./App.css` — corrigir a *causa*, não as três regras.

> Resolve: `compact-button-definido-duas-vezes` (×2), `css-morto-do-seletor-de-data`, `css-morto-sobre-o-input-de-data`, `carregar-mais-em-meia-coluna`, `home-metric-title-classe-morta`, `nutrition-goals-css-perde-por-ordem`, mais a lacuna do bloco `.metric-*`. **~8 achados.**

### R11 — A quinta catraca: `valor-fora-da-escala`.

Sem isto, tudo acima volta em seis meses — é exatamente o que aconteceu com a escala declarada em `index.css`.

`tools/css-contract.ts` ganha uma quinta regra para `padding` / `gap` / `margin` / `border-radius` / `font-size` em literal px ou rem, **com linha de base congelada no estado atual**, no mesmo modelo de catraca do `layout-guards.baseline.json`. Nada novo entra a partir do momento em que ela sobe; a conversão das fases seguintes *encolhe* a linha de base, e o CI falha se ela crescer.

As exceções de compensação entram nomeadas: `58/60/76/94px` de reserva de coluna, `1px` de fio, `999px`, `50%`. O próprio comentário de abertura do arquivo já afirma cobrir "as 5 regras que importam" — hoje ele cobre quatro.

---

## 3. Redução de densidade, tela por tela

Regra do dono: **nada de funcionalidade perdida**; divulgação progressiva e reorganização são permitidas. O padrão de divulgação é o `<details>` nativo, zero JS, já aprovado no descartado 26.

### Hoje (`/`) — 1742px, **20 negações visíveis na conta vazia**

O dono estimou "cerca de dez". São vinte, e a variação de redação faz o leitor procurar uma diferença de significado que não existe: 'meta não configurada', 'Classificação não configurada', 'Sem meta configurada' ×4 e 'Meta não configurada' dizem a mesma coisa de quatro maneiras.

| Sai | Vai para | Ganho | Custo |
|---|---|---|---|
| `.heading-copy` — o manifesto do produto | nada | −44px | 0 |
| 3 eyebrows: 'Consumido', 'Nutrientes', 'Panorama' | nada (o h2 já diz) | −72px | 0 |
| `.status-chip` duplicado no cabeçalho do cartão | já está no callout, a 60px | −64px | 0 |
| `input[type=date]` de largura plena + 'Data do resumo' | pílula de 44px ao lado do h1 (o vocabulário do /diary) | −70px | 0 |
| nota 'Pesagem oficial nesta data' | nada — string estática sem dado | −20px | 0 |
| `.day-overview-footer` ('Ver mês \| Gráficos') | a aba Análises da barra (§4) | −52px | 0 |
| bloco `.macro-summary` da primeira dobra | o disclosure do Diário; 'Ver diário' é a porta | −180px | ver nota |
| nota da Água: 3 fatos concatenados | 1 fato (a comparação) | — | 0 |

**Unifica:** quatro redações de 'sem meta' → **'Sem meta'**; sete de 'sem dado' → **'Sem registro'**. As negações restantes deixam de parecer fatos distintos. **Custo: `AnalyticsPages.test.tsx:168` e `:170` reescritos — restrição 5, decidir com o dono antes.**

**Resultado: de 20 negações visíveis para ~7, e de 1742px para ~1440px.**

> ⚠️ Ao remover o `.macro-summary`, reescrever no MESMO commit `App.css:3777-3790`: o `.nutrition-card` vira duas colunas a ≥840px apoiado exatamente no par `.calorie-summary + .macro-summary`. Sem isso, a Home no desktop fica com uma coluna vazia.

### Diário (`/diary`) — 1806px

- **Saem** os eyebrows 'ALIMENTAÇÃO' e 'HIDRATAÇÃO' — tautologias sobre 'Refeições' e 'Água · 0,75 L' logo abaixo. −40px.
- **Sai** o parágrafo `DiarySummary.tsx:157`: no mesmo cartão, três linhas acima, `.diary-calories` já diz 'Sem meta calórica vigente'. É a mesma informação duas vezes, e a segunda ainda instrui sobre outra tela. −44px.
- **Move** o segundo parágrafo para dentro do painel do disclosure, onde ele qualifica o que se está lendo. −66px, **custo zero**: o painel usa `grid-template-rows: 0fr`, nunca `display: none`, então `getByText` continua verde.
- **Sai** 'Nenhum item nesta refeição.' — o botão logo abaixo já comunica. −50px por refeição vazia.
- **Sai** '· v. preservada' da linha do item para o sheet de ações: é literal fixo no JSX, idêntico em todas as linhas de todos os dias, e por isso não distingue nada. Devolve ~90px de largura por linha e tira sozinho uma das quatro quebras a 320px. **Custo: `DiaryPage.test.tsx:186`.**
- **Sai** 'Feche para incluir este dia em análises históricas confirmadas.' — o sheet de confirmação já diz o mesmo com mais detalhe, no momento em que importa.
- **Sai** 'Copiar registros' do cartão de fim de dia: são três portas para o mesmo `CopyPanel`, e esta é a única sob o título 'Quando terminar o dia' — copiar é ação de *começo* de dia.
- **Condicional:** `.diary-day-actions` só quando `log` existe. Hoje, num dia sem nada, o cartão 'Quando terminar o dia' com 'Fechar dia' aparece logo abaixo de 'Nenhum registro neste dia', e os dois botões escuros da tela vazia usam a mesma `.submit-button` — a ação terminal do dia disputa o papel de ação principal.
- **NÃO sai** a célula 'Água' da grade: `spec-tela-diario.md:25` decidiu o contrário com o número do teste (`DiarySummary.test.tsx:162-164` navega por `.diary-macro-grid`).

**−250px.**

### Sheets — o de treino tem 992px de conteúdo num painel de 812px

- **Treino:** 'Horário', 'Gasto calórico estimado' + a nota de duas linhas, e 'Observações' → `<details>` 'Mais detalhes'. Ficam visíveis Data, Modalidade, Título, Grupos musculares e Duração. **992 → ~520px**, e as ações passam a caber na primeira dobra mesmo antes do rodapé sticky.
- **Peso:** 'Data' e 'Horário' → `<details>` 'Ajustar data e hora', com o valor corrente no `<summary>` ('02/09/2026, 13:03'); 'Condição da pesagem' e 'Observações' → o mesmo `<details>`. Hoje o campo que dá nome ao sheet é o **terceiro**, ~300px abaixo do título, e os dois acima já vêm preenchidos. **O sheet passa a caber inteiro sem rolagem a 390×844.**
- **Item:** o parágrafo azul `.snapshot-note` (modelo de dados, lido uma vez na vida) e o cartão `.snapshot-settings` ('Qualidade' + 'Incerteza', cujo padrão 'Herdar do catálogo' é a resposta certa em quase todo registro) → `<details>` 'Ajustes avançados', **sem o cartão de fundo**. −260px, e o terceiro nível de recuo desaparece de tabela.
- **Item:** rótulo 'Pesquisar catálogo' → o `.search-field` que já existe no repo, com o rótulo em `visually-hidden`. −26px.
- **Quick-add:** o eyebrow 'CADASTRO RÁPIDO' (que repete o rótulo do botão que abriu o menu) e os quatro `<small>`, exceto o de 'Avaliação corporal', cujo título é o único ambíguo. **−109px; o menu vai de ~300px para ~190px.**
- **RowActionSheet:** a linha 'Fechar' — o × do cabeçalho e o toque no backdrop já fecham, e hoje há **três rótulos de dispensa** (×, Fechar, Cancelar) para uma ação só. −56px.

### `/settings/nutrition-goals` — **10.639px, 12,6 telas, 141 controles**

O formulário mais profundo do app e o mais escondido.

- Os cinco nutrientes não-calóricos entram em `<details>` fechados, **um por nutriente**, com `<summary>{n} faixas · {resumo}</summary>`, abertos só para Calorias. **10.639 → ~1.900px.**
- **Preservar `<fieldset>`/`<legend>`.** Envolver apenas a `.goal-band-list` e o '+ Adicionar faixa'. Trocar por `details`/`summary` quebraria `PlanningPages.test.tsx:172, 188, 241`, que usam `getByRole('group', { name: 'Calorias' })`.
- **Sai** 'Posição {bandIndex}' — o índice zero-based do array exposto ao usuário, contradizendo o 'Faixa 1' da linha acima.
- A dica 'A ordem é usada na classificação…' é renderizada **seis vezes** (378px somados) → uma vez, no topo.
- 'A data final exibida pela API é exclusiva' só quando há períodos, e reescrita sem citar a API.
- Ordem no celular: **'Vigente hoje' → 'Histórico' → 'Novo período'**. Hoje o histórico está em y=10.204, atrás de 141 controles, e quem entra na tela na maioria das vezes quer conferir o que está valendo.

**Custo: ~12 asserções (abrir o `<summary>` antes de interagir).** E uma regra obrigatória: **no submit com erro, abrir programaticamente o `<details>` que contém o campo inválido** — sem isso a mensagem fica invisível e o formulário vira um beco.

### `/analytics/monthly` — 3118px, **25 negações**

- Os **seis cartões de médias vazios** — 398px de rolagem para doze strings de negação — viram um bloco vazio único com `.goal-setup-link` para /diary, reusando a classe cujo comentário já defende "um caminho por seção, e não um por linha". −310px.
- `.analytics-coverage` (quatro células que são uma partição de um só total, três deles deriváveis) → linha de contexto no cabeçalho + `<details>` 'Como este mês foi contado'. −150px.
- `.analytics-extremes-grid` → `/analytics/charts`, como marcação de máximo e mínimo da própria série. São quatro fatos sobre *dias isolados* dentro de um cartão intitulado 'Balanço dos dias calculáveis'; no gráfico ganham contexto. −190px.
- Chips '0 dias sem TDEE' e '0 dias sem nutrição calculável' só renderizam com contagem > 0. Ressalva de método só é informação quando existe.
- **As barras de meta em 0% não são desenhadas quando não há meta.** Seis fios cinzas empilhados leem-se como "você atingiu 0% de tudo", que é uma afirmação sobre desempenho — quando o dado real é "não há meta para comparar". Ausência virou fracasso. −40px e apaga a mentira visual.
- Rótulo 'Mês analisado' sai: o h1 diz 'Setembro de 2026' e o input mostra 'setembro de 2026' 14px abaixo. O mês está escrito **três vezes em 100px**.

**De 25 negações para ~8; de 3118px para ~2.000px.**

### `/progress/weight` — 1455px, **sete cartões para quatro números**

Com uma única pesagem, quatro cartões exibem o mesmo `82,4 kg` três vezes mais `0 kg` de mudança.

- Menor peso, Maior peso, Média 7 e Média 14 → `<details>` 'Mínimos, máximos e médias móveis'. **Manter os sete no DOM**: `ActivityPages.test.tsx:398` exige ≥4 'Dados insuficientes', e esconder 'Mudança no período' condicionalmente derruba a contagem para 3. −200px.
- O parágrafo de metodologia (43 palavras, 85px, lido uma vez na vida) entra no mesmo `<details>`, **preservando o `role="note"` único da rota** — `ActivityPages.test.tsx:352` usa `getByRole('note')` no singular, e isso também respeita a restrição 6.
- **O filtro De/Até/Aplicar (222px) vira chips** '30d / 90d / 180d / Tudo', com as datas exatas em `<details>` 'Período personalizado'. −160px, e o caso comum cai de três toques para um. ⚠️ Rótulos **curtos** e `flex-wrap: wrap`: '30 dias / 90 dias / 180 dias / Tudo' com `white-space: nowrap` soma ~360px contra 350px de conteúdo a 390px — estouro horizontal, que é violação dura.
- Os dois ícones por linha viram um botão 'Ações de …' abrindo o `.row-action-list` que o Diário já tem. Em Peso, some uma faixa de 54px por cartão (44% da altura do cartão de uma pesagem); em Treinos, devolvem-se 98px de título.

### `/workouts`

- Os dois cartões de resumo → uma linha no `.result-count` do histórico: `'3 sessões · 2h40'`. A contagem já estava impressa dois centímetros abaixo e a duração já está em cada linha. −100px.
- 'informativo; não altera o saldo', hoje repetido uma vez por treino, vira nota única no rodapé da lista.
- Mesmo filtro por chips.

### `/profile` — 2256px, **41% é menu duplicado**

`ProfilePage.tsx:254-333` ainda renderiza inteiro o hub que `/more` foi criado para substituir — o próprio comentário de `MorePage.tsx` diz que esses destinos "antes moravam dentro da tela de Perfil". Eles nunca saíram.

- **Apagar as quatro seções.** Cinco dos sete destinos já estão em `/more`, dois em `/progress`, e 'Convites' já está em `/more` para OWNER. **2256 → ~1230px.**
- Apagar o segundo 'Sair da conta' (o de `/more` fica).
- **Sai o chip 'USER'** — e não pelo idioma: `.status-chip` usa `--success-text` sobre `--primary-soft` e significa **período vigente** nas telas irmãs ('Ativo' em /settings/tdee, 'Vigente' em /settings/nutrition-goals). Pintar o papel do usuário com o verde de estado dá significado de estado a um dado que não é estado.
- 'Idioma' e 'Sistema de unidades' têm **uma única opção selecionável** cada, com 2 a 3 linhas de dica. Escondidos enquanto houver uma opção só.

### `/foods` e `/recipes`

- CTA duplicado do estado vazio → o do cabeçalho. Quatro verbos para uma ação (Novo / Cadastrar / Nova / Criar) viram um.
- **Avatar de inicial** (46px + 12 de gap = 58px, **17% da largura do cartão a 390px**): a letra "P" de "Peito de frango" repete o primeiro caractere do nome ao lado, não identifica e não diferencia. Sai; os 58px vão para o nome, que hoje trunca.
- `.quality-dot` de 8px com `title=`: no celular é um pixel colorido indecifrável e o `title` nunca aparece sob o dedo. Passa a renderizar **só quando ≠ EXACT**, com a palavra 'estimado' ao lado.
- '· versão N' sai do cartão de receita; entra no lugar a **caloria total**, hoje escondida no celular por `display: none`. Troca líquida de um número inútil por um número decisivo.
- Chip 'Arquivados' sai da toolbar (três linhas, 176px, para dois filtros) e vira link no fim da lista.
- A toolbar deixa de ser `.surface-card`: hoje é borda + sombra + raio envolvendo um `.search-field` que **já tem borda e fundo próprios** — duas superfícies aninhadas em volta de um input. −20px e uma vertical.

### `/foods/new` e `/recipes/new` — ~1997px

Observações, Sódio, o fieldset 'Confiabilidade' e 'Porções alternativas' → `<details>` 'Detalhes opcionais'. O primeiro écran fica com os nove campos que o rótulo da embalagem fornece. **~1997 → ~900px**, sem remover um campo. Em `/recipes/new`, 'Observações' (textarea de 86px, o *segundo* campo) e 'Tamanho de uma porção' vão junto — hoje um campo opcional separa o nome da receita dos ingredientes, que são a razão da tela existir; eles sobem ~190px.

### `/foods/:id` · `/more` · `/analytics/charts`

- **Detalhe:** 'Histórico de versões' → `<details>` fechado com a contagem que já existe no `.history-count`. 'Arquivar' sai da linha das primárias (hoje a 8px de 'Criar nova versão').
- **/more:** encurtar a nota longa ('Faixas por nutriente e classificação do dia' → 'Faixas por nutriente'), o que devolve às cinco linhas o mesmo respiro; 'Sair da conta' vira linha do cartão 'Conta'. −76px, e /more **cabe em uma tela**.
- **/charts:** 'Ver resumo mensal' sai (a aba logo abaixo já faz); o `<figcaption>` sai (a unidade vai para o eixo Y, e a frase sobre lacunas já está no `<desc>` e nos chips); `.analytics-chart-controls` deixa de ser cartão separado e entra no cartão do gráfico — hoje o controle e o resultado que ele controla estão em superfícies distintas. −160px.

---

## 4. Nova arquitetura de informação

### O que está quebrado hoje

1. **Dois slots levam a telas cujo `<h1>` é a mesma palavra.** `HomePage.tsx:379` e `DiaryPage.tsx:239` renderizam ambos 'Hoje'. `App.test.tsx:338` codifica a ambiguidade: `getAllByRole('link', { name: 'Hoje' })` com `toHaveLength(2)`.
2. **Catorze das 24 rotas não acendem nenhum item da barra** — o array `navigation` tem quatro caminhos exatos e nada mapeia `/workouts`, `/analytics/*`, `/settings/*`, `/foods`, `/recipes`, `/profile` de volta a um slot. O usuário atravessa o hub Evolução para chegar em Treinos e, ao chegar, a barra não mostra de onde ele veio. **O sidebar do desktop tem o mesmo defeito em seis rotas.**
3. **O desktop tem outra árvore.** Ele expõe Análises, Peso e Treinos como primeiro nível *e* oferece 'Evolução', que no celular é a porta desses mesmos três — o hub é tela intermediária morta no desktop. E **seis destinos não têm entrada nenhuma no sidebar**.
4. **`/analytics/monthly` tem cinco nomes:** Análises, Resumo mensal, Ver mês, Consolidado, 'Setembro de 2026'.
5. **O FAB abre um sheet cujo primeiro item não registra nada:** fecha o sheet, navega para `/diary` e abre um *segundo* sheet, também intitulado 'Cadastro rápido'. A ação mais frequente do produto custa dois toques e uma troca de rota.
6. **O `.primary-action` do desktop e o FAB do celular não têm um único destino em comum.** A interseção é vazia: no desktop não há caminho de um gesto para registrar refeição, treino, peso ou avaliação.

### Os cinco slots

| # | Slot | Rota | Papel |
|---|---|---|---|
| 1 | **Hoje** | `/` | Resumo **e** registro do dia — funde `/diary` |
| 2 | **Análises** | `/analytics` | Responde "estou melhorando?"; hoje está a dois níveis de profundidade |
| 3 | **[FAB] Registrar** | — | Não é destino: abre o sheet com as **ações reais** |
| 4 | **Evolução** | `/progress` | Peso, Treinos, Avaliações corporais — **três** linhas, não cinco |
| 5 | **Mais** | `/more` | Biblioteca · Planejamento · Conta |

**O que vira hub:** `/progress` e `/more` já são hubs e continuam. `/progress` perde 'Resumo mensal' e 'Gráficos' para o slot 2 e fica com três destinos homogêneos — todos REGISTROS que o usuário cria, o que resolve de graça o problema de agrupamento sem custar um único título de seção.

**O que se funde:** `/` + `/diary` (slot 1), e `/analytics/monthly` + `/analytics/charts` como **duas abas de uma tela**, que é o que elas já são — as duas compartilham o mesmo `.analytics-tabs`, o que é a confissão de que são uma tela partida em duas rotas.

### Custo de renomeação de rota: **zero**

**Nenhuma rota é renomeada.** Isto é a exigência central, e `principios-e-descartados.md:85` a registra: "nunca mexer em id/scope/start_url, não renomear as 24 rotas (viram deep links)".

Os três shortcuts do manifest continuam válidos sem uma linha de manifest alterada:

| shortcut | como sobrevive |
|---|---|
| `/diary?action=quick` | `/diary` vira `<Navigate>` preservando `?date=` e `?action=` |
| `/workouts?action=new` | intocado |
| `/progress/weight?action=new` | intocado |

`/analytics` **já existe** como `<Route element={<Navigate replace to="/analytics/monthly" />} path="analytics" />` (App.tsx:59) e apenas passa a ser a rota canônica da aba. Custo: zero.

**E um bug de deep link a corrigir no mesmo trabalho.** `DiaryPage.tsx:204-211` consome `?action=quick` incondicionalmente e apaga o parâmetro da URL, mas o diálogo é renderizado sob a guarda `&& open`. **Com o dia fechado, o usuário toca no atalho do ícone instalado e nada acontece — e recarregar não ajuda, porque o parâmetro já foi engolido.** Correção: esperar `query.isSuccess`, então ramificar — dia OPEN abre o editor; dia CLOSED avisa pelo `useToast()` que já existe, **deliberadamente sem `role="status"`/`role="alert"`** (o comentário em `components/Toast.tsx:16` registra a decisão), preservando a restrição 6.

### Como o desktop passa a espelhar a mesma árvore

Um módulo, `frontend/src/layouts/navigation.ts`, exporta os destinos e uma função `slotFor(pathname)` que casa por **prefixo de segmento** (`/foods` casa `/foods/new`, nunca `/foodsomething`). **Três consumidores:** a bottom-nav, o sidebar e o cálculo de `deep`. É esse módulo único que paga por quatro coisas de uma vez:

- as 14 rotas sem slot aceso no celular e as 6 no desktop;
- os cinco nomes de `/analytics/monthly` — nas **portas** o nome é 'Análises'; 'Resumo mensal' e 'Gráficos' existem só como rótulo de **aba**;
- a divergência de árvore: o sidebar **perde as seções ACOMPANHAMENTO e BIBLIOTECA** e passa a listar os mesmos quatro destinos das portas. Isso iguala a arquitetura das duas plataformas em ~10 linhas e resolve de tabela os seis destinos sem entrada, porque todos passam a estar sob 'Evolução' ou 'Mais', como no celular;
- o item 'Análises' passa a apontar para o prefixo `/analytics`, não para `/analytics/monthly` — sem isso ele nunca acende em `/analytics/charts`.

Mais duas correções de paridade:

- **`.primary-action` do sidebar vira `<button>` 'Registrar'** e abre o **mesmo** `QuickAddSheet`. O CSS já resolve: `App.css:5472-5481` já centra o `.shell-dialog-backdrop` e dá `min(100%, 440px)` ao painel a partir de 560px — a largura deliberada de 440px da restrição 3 é preservada, e **não é preciso escrever uma linha de CSS**. 'Novo alimento' volta para `/foods`, onde `FoodsPage.tsx:31` já tem o mesmo link.
- **O bloco de perfil do sidebar vira `<Link to="/profile">`.** Hoje o avatar não é clicável e o `.mobile-header` some a ≥840px, então no desktop a única porta para `/profile` é Mais → Conta → Perfil, três níveis, contra um toque no celular. ⚠️ `.sidebar-profile` é `grid-template-columns: auto 1fr auto`: o template vira `1fr auto` e o Link recebe `display: grid; grid-template-columns: auto 1fr`, senão o botão de sair pula de coluna.

### A primeira camada do FAB

| entra | comportamento |
|---|---|
| **+250 ml de água** | **EXECUTA no shell.** `useQuickWater(today)` já é exportado e já é compartilhado por `HomePage.tsx:363` e `DiaryPage.tsx:148` — update otimista e invalidação prontos, **zero mutação nova** |
| **Refeição** | deep link novo `?action=meal`, abrindo o `MealEditor` direto |
| **Treino** / **Peso** | abrem o `ActivityDialog` **sobre a rota atual**, sem atravessar tela |
| **Avaliação corporal** | continua navegando (a tela de destino é o próprio trabalho) e **desce para o fim** — é a ação mais rara do produto, um formulário de ~40 campos preenchido talvez uma vez por mês, e hoje ocupa um quarto do menu de ação primária |

'Item em \<refeição\>' e 'Copiar' ficam só dentro do diário, porque dependem do log carregado. `?action=quick` continua vivo e intocado para o shortcut do manifest.

### A fusão Hoje + Diário — decisão própria, e a última

`principios-e-descartados.md` registra "Mínimo agora, recomposição depois do piloto". **Aquela premissa está vencida**: o motivo declarado era que "criar uma tela-hub nova quebra App.test.tsx e ProfilePage.test.tsx" — e os hubs **já existem**. O que não aconteceu foi apagar o lado antigo. A recomposição está pela metade, e metade é pior que qualquer um dos extremos.

A fusão é o passo seguinte e é o que libera o slot para Análises. `/diary` sobrevive como rota redirecionando para `/` com `?date=` e `?action=` preservados. **Custo: ~10 asserções** (`App.test.tsx:135, 170, 289, 334, 338`; `AnalyticsPages.test.tsx:125, 232`; `DiaryPage.test.tsx:95`; `AuthenticatedLayout.test.tsx:80, 92`).

**Ela é a última fase de propósito: se o dono recusar, nada do que veio antes é desfeito.** Antes dela entra um passo de uma linha que já mata a ambiguidade — o `<h1>` de `/diary` passa a ser 'Diário' incondicional (custo: 1 asserção).

---

## 5. Ordem de execução

Princípio 4: cada fase é revertível sozinha, e correção pontual de CSS **nunca** viaja no mesmo PR que refatoração estrutural.

### As três redes, e o que cada uma NÃO vê

| rede | pega | **não vê** |
|---|---|---|
| `tools/css-contract.ts` | 16px em controle, `font: inherit`, `vh`, safe-area sem fallback, **(novo)** valor fora da escala | cascata, herança, layout, ordem de importação |
| `e2e/layout-guards.spec.ts` | overflow horizontal, 16px depois da cascata, alvo <44px — em 3 larguras × 12 rotas | ritmo vertical, alinhamento, hierarquia, densidade |
| `npm test` (vitest/RTL) | strings, papéis, contagens, estrutura de DOM | um único pixel |
| **olho humano** | **tudo o que sobrou — e é a maior parte deste plano** | — |

Nada automatizado verifica ritmo vertical nem alinhamento. Por isso a verificação humana está **especificada** em cada fase, não deixada implícita: captura antes/depois **a 320, 390 e 1440px, nos dois estados (vazio e com dado), por tela tocada**.

---

**FASE 0 — Ampliar a rede antes de tocar em qualquer coisa. (2 commits)**

- **C0.1** — Acrescentar `/more`, `/progress`, `/settings/tdee`, `/progress/evaluations` e `/recipes` ao `ROUTES`; semear uma avaliação corporal em `seedEveryListedRoute` (sem isso `/progress/evaluations` renderiza `.body-empty` e **nunca** o `.comparison-select`, que é a única razão de incluir a rota); acrescentar uma largura de ~900px ao `playwright.config.ts`.
  *Motivo:* as duas telas-hub mais novas — e a tela com o único estouro horizontal medido, 76px a 900px em `/settings/tdee` — estão **fora da rede**. O baseline não tem nenhuma chave de desktop. Editar CSS dessas telas hoje é editar sem catraca.
- **C0.2** — Acrescentar `input:not([type=hidden]), select, textarea` ao seletor de alvos do e2e. **Isto fica vermelho, de propósito:** pega `.activity-filter .field-group input { min-height: 42px }` (em `/workouts` e `/progress/weight`, **duas rotas já na lista, que passam hoje porque `input[type=date]` nunca é medido como alvo**) e `.date-navigation > label input { min-height: 40px }`. Os três consertos viajam no mesmo commit.
- **Verificação:** `npm test` + `npm run test:e2e`, linha de base ainda vazia nos quatro projetos de largura.

**FASE 1 — Os tokens que faltam. Não muda um pixel. (1 commit)**

Declarar em `index.css`: `--space-8: 40px`, `--radius-hero: 24px`, `--keyboard-inset: 0px`, `--row: 56px`, `--row-lg: 68px`, `--chip: 24px`, `--fs-display: 2.5rem`, `--fs-numeral: 2.75rem`, `--lh-caption/footnote/body/headline/title/title-lg`, `--measure: 68ch`. Trocar o literal de `--content-gutter-bottom` por `var(--space-8)`. Corrigir o comentário de `index.css:106`, que afirma "consolidando em QUATRO degraus" e passaria a mentir.

**Só declaração, nenhum consumo.** Diff de ~18 linhas.

> **Por que primeiro:** `--keyboard-inset: 0px` sozinho conserta cinco declarações que hoje **caem inteiras** quando o hook não roda (`window.visualViewport` ausente, ou no unmount, que chama `removeProperty`) — e o que cai inclui o `padding` inteiro do backdrop de dois sheets e o `max-height` do painel. É a maior razão benefício/risco do plano inteiro, e é uma linha.

**Verificação:** `npm test`; captura de `/diary` antes/depois deve ser byte-idêntica.

**FASE 2 — Código morto e regra duplicada. (1 commit)**

Apagar o bloco `.metric-*` exceto o que `.day-overview` consome, e `.metric-icon.green`; apagar `.date-navigation > label input`; apagar `.compact-button` de 2245-2249 separando `.filter-chip` de `.compact-button` (cada um com o seu raio e a sua cor, **nunca fundidos**, senão o chip do catálogo muda de cor); fundir `.section-title-row`; remover ` item-dialog-form` do TSX; apagar `.linear-progress`/`.progress-fill.*`; dar regra a `.catalog-load-more`.

**E corrigir a ORDEM de importação de `NutritionGoals.css`** — sai de `NutritionGoalsPage.tsx:10`, entra em `App.tsx` logo depois de `./App.css`. Hoje três regras escritas de propósito nunca rodaram.

**Verificação:** `npm test`; e2e; **olho humano em `/settings/nutrition-goals`** — é a única tela cuja aparência muda com a ordem de importação (o padding de `.nutrition-goal-editor` sai de 21px para o valor declarado). Como regressão permanente, um `grep -bo` dos dois pares de seletores em `dist/assets/*.css`, uma linha no script de build.

**FASE 3 — A quinta catraca, com linha de base congelada. (1 commit)**

`valor-fora-da-escala` em `tools/css-contract.ts`. **Nada novo entra a partir daqui.** Verificação: `npm test` verde com a linha de base cheia, e um commit descartável introduzindo `padding: 17px` **tem de falhar**.

**FASE 4 — Tokenização por TELA. (~10 commits)**

Ordem: Diário → Hoje → sheets → catálogo → evolução → análises → ajustes. Aplicar **R1, R2, R3 e R10 na mesma passada da tela**.

> **Por tela, não por valor.** Um commit "todos os 10px do app" espalha-se por ~20 telas e torna o rollback inútil: reverter '10px' desfaz correções de telas que estavam certas. `.diary-summary` inteiro num commit é revisável numa captura; "todos os 10px" não é.

Regra mecânica: arredondar para o degrau mais próximo, **empate sobe**. Nada de "12 quando é gap e 16 quando é padding" — isso é decisão caso a caso com outro nome.

**Verificação por commit:** a linha de base do contrato **encolheu**; e2e verde nos quatro projetos; **olho humano a 320/390/1440, nos dois estados**. É a única verificação que pega "ficou certo mas ficou feio".

⚠️ Armadilha em `.diary-macro-grid`: os fios divisórios são `gap: 1px` sobre `background: var(--border)`, não `border`. Mexer no padding das células move a grade de fios junto — conferir com metas cadastradas **e** sem.

**FASE 5 — Tipografia (R9). Depois dos cortes. (3 commits)**

- **C5.1 — o que não acrescenta altura:** 11 textos de controle 12→15, 7 rótulos de `<dl>`, nome de item e valor de macro → `--fs-headline`, `--fs-display`/`--fs-numeral` no anel e no kcal do diário. ⚠️ `.goal-checkbox` sustenta 12px com **três `!important`** — é o único ponto onde um tamanho vence por `!important` e não por cascata, e portanto o único onde o de-para **falha em silêncio**. Remover os `!important` no mesmo commit.
- **C5.2 — `body { line-height: var(--lh-body) }`** mais os ~15 degraus que divergem. **Não** parear `font-size`/`line-height` em 185 pontos: a herança resolve com ~15 regras, e o diff cabe numa revisão.
- **C5.3 — os 25 blocos de prosa 12→13**, só depois dos cortes da fase 6.

> **Custo declarado:** C5.2 sai de `normal` (~1,2 nas stacks de sistema) para 1,5 no corpo, o que acrescenta ~25% de altura em todo bloco de prosa. **C5.2 e C5.3 juntos, sem os cortes antes, entregam ao dono o oposto do que ele pediu.**

**Dependência aberta:** a escolha da fonte precisa fechar antes de qualquer hierarquia apoiada em peso 600 — no Android/Windows o 600 cai para 700 e o rótulo fica idêntico ao valor.

**FASE 6 — Densidade: `<details>` e cortes. (~8 commits, um por tela)**

Ordem por razão ganho/risco: `/settings/nutrition-goals` (10.639→1.900) → `/analytics/monthly` (25 negações→8) → sheets → `/foods/new` → `/progress/weight` → Hoje → Diário → `/profile`.

**Verificação:** aqui os **testes de componente são a rede principal** — todo `<details>` fechado tira conteúdo da árvore de acessibilidade e derruba `getAllByRole`. Cada PR declara o custo de teste no corpo. **Olho humano no estado VAZIO e no estado COM DADO** — os cortes só se avaliam nos dois. Regra obrigatória em todo formulário com `<details>`: abrir programaticamente o que contém o campo inválido no submit com erro.

**FASE 7 — Navegação, sem a fusão. (4 commits)**

- **C7.1** — `layouts/navigation.ts` com `slotFor(pathname)`, três consumidores.
- **C7.2** — apagar `ProfilePage.tsx:254-333`, o segundo logout, e `.settings-link-list`/`.settings-link` do CSS (nenhum outro `.tsx` os consome). **Reescrever `InvitationsPage.test.tsx:104-113` para renderizar `/more`** no mesmo commit — `MorePage.tsx:56-59` já monta 'Convites' para OWNER lendo `sessionQuery`, então a asserção sobrevive com a rota trocada.
- **C7.3** — um nome nas portas; o sidebar perde as duas seções; `.primary-action` vira 'Registrar'; o bloco de perfil vira Link.
- **C7.4** — o FAB passa a listar ações reais; `+250 ml` executa no shell; a guarda de dia fechado no deep link.
- **Verificação:** `npm test` (`AuthenticatedLayout.test.tsx` e `App.test.tsx` são a rede); e2e com as rotas novas; **olho humano: percorrer as 24 rotas confirmando que sempre há um slot aceso**, no celular e no desktop.

**FASE 8 — A fusão Hoje + Diário. Decisão própria. (2 commits)**

Só depois de tudo acima estar em produção e o dono ter visto. ~10 asserções reescritas, nomeadas no PR. `/diary` vira `<Navigate>` preservando query; o manifest não muda.

**Uma correção transversal, sem fase própria:** `.mobile-header` não declara `position` nenhum — **não é sticky**, e rola junto com a página. Num PWA instalado, onde não existe botão voltar do navegador, o único botão voltar do app sai de vista assim que se rola o diário, `/foods` ou o formulário corporal de ~40 campos, e a saída vira o gesto de borda, que no iOS em standalone praticamente não existe. As duas specs prescrevem `position: sticky; top: 0`. Entra na fase 7, com teste explícito de troca de rota — sticky sobre um `main` com `animation: route-enter` pode criar contexto de empilhamento.

---

## 6. O que eu NÃO vou fazer, e por quê

### Os 26 descartados: nenhum é reproposto

O plano inteiro é **CSS em classes que já existem, mais `<details>` nativo, mais um módulo de ~40 linhas de navegação**. Zero dependência nova, e três descartes merecem menção explícita porque este plano poderia tê-los tentado:

- **Extrair `Button` / `Card` / `PageHeader` (descartado 25).** Não. As onze regras da seção 2 são todas declarações em classes existentes — é literalmente o que aquele descarte prometeu: "tudo que essas classes precisam são ~6 declarações CSS". Um `Card` que insira ou remova um `<div>` quebra `CatalogPages.test.tsx:322`, que usa `closest('div')`.
- **Recharts (descartado 9).** Não. A correção do gráfico é `ResizeObserver` + leitura por toque, que é exatamente o que aquele descarte disse entregar por ~40 linhas.
- **`@media (pointer: coarse)` (descartado 15).** Não. Nenhuma consulta separa com segurança iPad com teclado de desktop.

### O que a verificação descartou como já-decidido ou refutado — e eu mantenho descartado

| item | por quê |
|---|---|
| Tirar 'Água' da grade de macros | `spec-tela-diario.md:25` decidiu o contrário **com o número do teste**; e os dois ramos da proposta derrubam `DiarySummary.test.tsx:163-164` |
| Refazer a reserva de 76px da unidade | Causa trocada: `padding-right` não empurra nada num input de texto alinhado à esquerda. E a correção proposta era a mais arriscada do lote — mover a borda para o wrapper quebra `.field-group input:focus`, que desenha borda e anel no próprio input |
| Trocar os glifos de ícone do catálogo | As duas evidências não acontecem: em `m-foods.png` o ⌕ renderiza monocromático. E `Icon.tsx` **não tem** um ícone `search` — a correção era inexecutável como escrita |
| Alça de redimensionar do textarea | Artefato de captura de Chromium desktop; nem Safari iOS nem Chrome Android pintam o resizer |
| Alinhar o CTA do catálogo ao eyebrow | Inverteria a norma: **seis** dos sete cabeçalhos de página usam `flex-start`; a correção faria do catálogo a única exceção |
| "Voltar e aba ativa se contradizem" | É o padrão correto e universal. O próprio conserto proposto é um no-op nas duas telas citadas |
| "Cabeçalho profundo sem título" | Medida errada (os 68px são a altura vertical, citada como vão horizontal), e é já-decidido em `plano.md:312-314`. O defeito real daquela área é o header não ser sticky, e está na fase 7 |
| Rótulos da barra a 320px | Medido: 'Adicionar' tem 3,8px de folga à esquerda e 4,2 à direita. Nada estoura |
| "Grade de métricas com sobra no desktop" | O grep estava errado: `App.css:5492` declara 4 colunas a ≥840px |
| "Numerais sem tabular-nums" | São **14** seletores, não 2, e quatro dos sete "descobertos" já têm |

### O que eu julgo não valer o risco

1. **`padding` em `.surface-card`.** 77 pontos de uso, **dez deliberadamente sem recuo** porque contêm linhas que sangram. Quebraria exatamente os cartões que estão certos. O que falta ali é o *contrato escrito*, e ele entra como comentário.
2. **Converter por VALOR em vez de por TELA.** Um commit por valor espalha cada mudança por ~20 telas e mata o rollback.
3. **Criar `.list-row` unificando `.hub-item` e `.day-overview-row`.** Duas linhas (`.metric-icon` 39→36 e apagar o override redundante) entregam o mesmo alinhamento; uma classe nova entrega um segundo vocabulário que ninguém pediu.
4. **Agrupar `/progress` em seções.** Cinco itens que cabem numa tela não precisam de aponte de leitura, e dois títulos custam ~88px numa reforma cujo pedido é reduzir. Com a IA da seção 4 o hub cai para **três** destinos homogêneos e a questão desaparece.
5. **Esconder o grupo 'Biblioteca' de `/more` no desktop.** Faria `/more` mostrar conteúdo diferente conforme a largura, quebraria a promessa de menu estável (quem aprendeu o caminho no celular não o acha no notebook) e é conteúdo removido por CSS num app instalável que gira entre tablet e desktop.
6. **`.settings-link` como alias de `.hub-item`.** Não sobra consumidor; um alias vivo convida o próximo a reusá-lo.
7. **Criar `.sheet`/`.sheet-backdrop`.** Não existem em nenhum `.tsx`; o bloco base não se aplicaria a nada. A unificação vai nos seletores agrupados que já existem.
8. **Reestruturar o painel do sheet em grid para fixar cabeçalho e rodapé.** As ações vivem dentro de cada formulário filho — exigiria um slot novo em `DiaryDialog`/`ActivityDialog` e tocaria 8 pontos de chamada. `position: sticky` nas classes existentes entrega o mesmo resultado com zero TSX.
9. **Parear `font-size`/`line-height` em 185 pontos.** A herança resolve com ~15 regras.
10. **Remover os círculos do gráfico antes da leitura por toque.** O `<title>` deles é hoje o **único** portador do valor; remover primeiro apaga a única forma de ler um número em 90/180/365 dias.
11. **Unificar o crachá de data de `/progress/weight`.** Acrescenta ~20px por linha numa lista que estamos encurtando — e são **três** desenhos, não dois; unificar dois recria a inconsistência no terceiro.
12. **Mexer nos 9px da `.bottom-nav`.** Restrição 2, e o valor não move um pixel visível: com 5 colunas `1fr` a 320px, os 22px de trilha ganhos valem 4,4px por coluna.
13. **Subir `min-height` de campo de 48 para 52.** Custa altura em 78 pontos numa reforma de densidade. O que entra de graça é `padding-inline` e `border-radius`, que é o que se vê na captura lado a lado com o botão.
14. **Renomear qualquer rota.** Zero. É promessa registrada e é o que mantém os três shortcuts do manifest e a preparação para TWA.
15. **Trocar `.filter-chip.active` do laranja para o verde da marca.** Isso é decisão de paleta e vai para o documento, não para um PR de CSS. O que entra é a linha que já foi decidida: `color: var(--orange-text)`, que leva o contraste de 2,42:1 para ≥4,5:1 mantendo o fundo pastel.
16. **Um terceiro `role="status"`/`role="alert"` global.** Restrição 6. Onde o plano precisa avisar algo novo (deep link em dia fechado), usa o `useToast()` existente, que é deliberadamente sem `role`.
---

## Resultado da execução — 03/09/2026

Branch `feat/refino-ui-2026-09`, 18 commits. Verificado em volume limpo a cada passo: typecheck,
lint, 132 testes de componente e 74 E2E em quatro larguras (320, 375, 412, 900) e 17 rotas.

### A catraca

`valor-fora-da-escala` saiu de **505 violações para 6**. As seis que ficam são deliberadas: o
recuo da bottom-nav (restrição 2, decisão registrada do dono), dois `clamp()` de título, os
rótulos SVG do gráfico e o raio da marca.

### Bordas esquerdas, por rota, ao fim

| Rota | Antes | Depois |
| --- | --- | --- |
| `/analytics/monthly` | 11, com 5 pares de 1px | 4, sem pares |
| `/diary` | 7, com 2 pares | 3 |
| `/settings/nutrition-goals` | 6 | 5, sem pares |
| `/` | 5 | 5, um par estrutural |
| `/foods/new`, `/recipes`, `/progress/weight`, `/settings/tdee`, `/profile`, `/analytics/charts` | 2 a 4 | **2** |

O par `20/21` que resta em cinco telas é o único legítimo: é a borda de 1px do card, e separa o
que está fora dele do que está dentro. Sobra **um** par de 1px real, em `/progress/evaluations`.

### Altura de rolagem

| Rota | Antes | Depois |
| --- | --- | --- |
| `/settings/nutrition-goals` | 12,6 telas | **5,5** |
| `/profile` | 2,7 | **1,7** |
| `/analytics/monthly` | 3,7 | 3,5 |

`/diary` cresceu (2,1 → 3,4) porque a conta de teste acumulou refeições entre execuções, e porque
os nomes de item subiram de 12,3px para 17px — a troca que o plano assumiu por escrito.

### O que o plano previu e não se confirmou

- **A ordem de importação do `NutritionGoals.css` não causava nada.** Os dois arquivos não
  compartilham um único seletor.
- **`.date-navigation > label input` não era regra morta.** Casava e vencia por especificidade.
- **O bloco `.metric-*` não era todo morto** — quatro seletores eram, as cinco classes não.
- **`.catalog-load-more` não renderizava em meia coluna.** `.catalog-list` é grid de uma coluna.
- **A conferência "captura byte-idêntica" não funciona neste ambiente:** duas capturas do mesmo
  build já diferem. Foi substituída por prova de consumo de token, que é determinística.
- **As doze asserções orçadas para reabrir os `<details>` não foram necessárias** — e não porque a
  mudança seja invisível: o jsdom não remove da árvore de acessibilidade o conteúdo de um
  `<details>` fechado. A suíte de componentes não distingue dobrado de aberto. Quem verificou foi
  a guarda de layout, que mede o Chromium.

### O que a execução descobriu e o plano não tinha

- **A largura de 900px achou quatro estouros horizontais, não um.** Entre 840 e ~1100px o sidebar
  já consome 264px e sobram ~552px de conteúdo; quatro grades tinham sido escritas contra um
  número de viewport que parou de significar algo quando o sidebar apareceu.
- **Zerar o mínimo de um grid nem sempre é a correção certa.** Em dois dos quatro casos trocou
  rolagem lateral por campos sobrepostos dentro do card: a guarda ficou verde e a tela piorou.
  Onde isso aconteceu, `auto-fit` decide pelo espaço real do container.
- **A "borda escura" do sheet de atividade era o anel de foco do navegador**, não CSS: aparecia
  quando o sheet abria por deep link e não quando abria por toque.
- **Acima de 560px o painel tinha perdido o `--keyboard-inset` da conta** e voltava a ficar atrás
  do teclado.
- **`.meal-total small` e `.weight-metric-grid` estavam declaradas duas vezes**, além das
  duplicatas que o plano listou.

### Fase 8 — feita, com autorização do dono

`/` passou a conter o dia inteiro: cabeçalho, pílula de data, faixa da semana, anel com faixa de
meta e classificação, refeições, água, totais e fechamento. O registro virou componente e recebe a
data de quem o hospeda. O slot liberado foi para **Análises**, que respondia "estou melhorando?" a
dois níveis de profundidade. `/diary` sobrevive redirecionando para `/` com a query intacta —
nenhuma rota foi renomeada em toda a reforma, e os atalhos do ícone instalado continuam válidos.

A fusão revelou três defeitos que ela mesma criou, e os três foram corrigidos:

1. O registro estava pendurado no portão de carregamento do resumo — uma falha no cálculo do dia
   escondia as refeições e o botão de água. As duas consultas têm portões independentes.
2. O resumo e o anel mostravam o mesmo total na mesma tela. `DiarySummary` ganhou `showCalories`, e
   o que resta dele é o único lugar onde sódio aparece.
3. Sem o `<h2>` do total, o número mais importante do dia ficava **sem nome acessível** quando não
   há meta configurada: o rótulo do anel dizia o assunto, nunca o valor. Agora carrega o valor.

### O que não foi feito
- **Cortes de densidade restantes:** o sheet de treino em `<details>`, os sete cartões de
  `/progress/weight`, os filtros por chips, e a redução de `/analytics/monthly` abaixo de três
  telas. As telas com pior razão altura/conteúdo já foram tratadas.
- **Aperto pré-existente na faixa 840–1100px:** o card de avaliação corporal quebra o título e
  "Dados insuficientes" parte no meio da palavra. Não são falhas de guarda; são densidade e
  tipografia numa faixa que agora, pela primeira vez, está sob medição.
