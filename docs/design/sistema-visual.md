TUDO ABAIXO VAI PARA index.css :root — hoje não existe UM token de espaço ou tipo, e é por isso que o App.css tem 3px, 7px, 9px, 11px, 13px, 15px, 21px, 25px, 27px, 29px, 31px espalhados e font-sizes entre 0.56rem e 2.75rem sem critério. Nenhum valor de COR novo: a paleta atual (light + o override completo de dark) permanece byte a byte.

ESPAÇO (base 4)
--space-1: 4px; --space-2: 8px; --space-3: 12px; --space-4: 16px; --space-5: 20px; --space-6: 24px; --space-7: 32px; --space-8: 40px;
Regra: gap dentro de um bloco = --space-2 ou --space-3; entre blocos irmãos = --space-4; entre seções = --space-6; antes do rodapé = --space-7. Gutter do main = --space-5. Todo valor ímpar existente cai no degrau mais próximo.

TIPOGRAFIA (mobile; o desktop pode subir um degrau em >=840px)
--fs-caption:   0.75rem   /* 12px */ --lh-caption: 1.35; peso 700; uppercase 0.08em
--fs-footnote:  0.8125rem /* 13px — PISO ABSOLUTO de qualquer texto de leitura */ --lh: 1.45
--fs-body:      0.9375rem /* 15px — corpo padrão */ --lh: 1.5
--fs-headline:  1.0625rem /* 17px — nome de refeição, nome de item, valor de macro, linha de sheet */ --lh: 1.35
--fs-title:     1.25rem   /* 20px — título de seção forte, título de sheet, dd de macro */ --lh: 1.3
--fs-title-lg:  1.75rem   /* 28px — h1 no mobile, no lugar do clamp(2rem,4vw,2.75rem) */ --lh: 1.05; -0.02em
--fs-display:   2.5rem    /* 40px — kcal do card do Diário */ --lh: 1; -0.03em
--fs-numeral:   2.75rem   /* 44px — número dentro do anel */ --lh: 1; -0.03em
Pesos: 600 rótulo, 650 título de linha, 700 número e título de tela, 750 só em eyebrow uppercase.
As ÚNICAS coisas permitidas abaixo de 13px são --fs-caption em: eyebrow, rótulo da bottom-nav, quality-chip, status-chip, estimate-label — todas com peso >=700 e alto contraste. Isso apaga as 0.56/0.58/0.59/0.60/0.61/0.62/0.65/0.66/0.67/0.68/0.69/0.70/0.72/0.75/0.76/0.77rem do arquivo. A razão entre o maior e o menor texto cai de 44px<->9px para 44px<->12px, e o CORPO DOBRA — é essa razão, não o padding, que produzia a impressão de coisa achatada.

TOQUE
--tap: 44px; --tap-lg: 52px;
`.icon-button` 34x34 -> 44x44 (glifo permanece 18-20px). `.submit-button`/`.secondary-button`/`.secondary-link` min-height 48 -> 52 e font-size 0.86rem -> --fs-body. `.compact-button` 40/36 -> 44 e 0.72rem -> 0.875rem. `.text-button` 38 -> 44 e -> --fs-body. `.add-item-button` 45 -> 52. `.water-buttons button` 42 -> 56. `.empty-actions`/`.diary-day-actions` 43 -> 52. `.status-chip` 27 -> 24 de altura mas com --fs-caption legível. `.quality-chip` 22 -> 24.

RAIOS (consolida 9/10/11/12/13/14/17/18/20/22 em quatro degraus)
--radius-chip: 12px;    /* quadrado de ícone, chip, caixa pequena */
--radius-control: 16px; /* botão, pílula de saldo, controle inline */
--radius-card: 20px;    /* card de conteúdo, meal-card, card-grupo, water-section */
--radius-hero: 24px;    /* nutrition-card, diary-summary, topo do sheet */
--radius-pill: 999px;

SOMBRAS E HAIRLINE
--shadow e --shadow-floating permanecem como estão. Novo:
--hairline: color-mix(in srgb, var(--border) 65%, transparent);  /* só entre itens de lista, nunca em grade de células */
A `.bottom-nav` PERDE a sua (`box-shadow: 0 -8px 30px rgba(32,50,40,.08)`) e perde o `backdrop-filter: blur(18px)` e a translucidez de 94%. `--shadow-floating` fica reservada ao sheet e ao FAB.

O CROMO INFERIOR (a correção literal da queixa)
`.bottom-nav`: `background: var(--surface)` OPACO, `border-top: 1px solid var(--border)`, sem blur, sem sombra, `min-height: calc(76px + env(safe-area-inset-bottom))`, `padding: 10px 8px max(8px, env(safe-area-inset-bottom))`, 5 colunas MANTIDAS. `.bottom-nav-item` alvo 56px, ícone 24px, rótulo --fs-caption (era 0.62rem = 9,9px). Item ativo ganha, além de --primary-strong, uma pílula de fundo --primary-soft de 56x32 radius 12 atrás do ícone.
`.quick-add > span`: PERDE `transform: rotate(45deg)`, perde a `border: 5px solid var(--surface)` que recortava o alvo, e o `margin-top: -26px` vira `-12px`. Vira um quadrado de 52x52, radius 18, --primary-strong com ícone #fff (dark: --accent com #102017). O `<small>Adicionar</small>` fica, em --fs-caption. O botão CONTINUA EXISTINDO (App.test.tsx:337 e os quatro destinos de AuthenticatedLayout.tsx:166-171).
`main`: `padding: 12px 20px calc(76px + env(safe-area-inset-bottom) + 40px)` (era `26px 18px calc(112px + safe)`). Um `.page::after` de 24px, `position: fixed; bottom: calc(76px + safe); left: 0; right: 0; background: linear-gradient(to top, var(--background), transparent); pointer-events: none` faz o conteúdo desaparecer por baixo em vez de ser cortado.
Resultado: folga real de 40px e 28px acima da ponta do FAB, contra os 14px efetivos de hoje.

NÚMEROS
`.num { font-variant-numeric: tabular-nums; font-feature-settings: "tnum" 1 }` aplicado (via classe ou via lista de seletores) a todo valor: kcal, gramas, litros, kg, horas, dias da faixa. Se a Inter não carregar e cair no system-ui, degrada para proporcional sem quebrar layout.

COR — a paleta não muda um valor; muda a distribuição
- Verde deixa de ser confinado a chips de 27px e ao conic-gradient e passa a ESTRUTURAR: anel, fill de barra de macro, pílula do dia selecionado na faixa, botão primário, FAB, pílula ativa da nav.
- Semântica fixa: --blue = hidratação e dia fechado; --orange = superávit, dia aberto e dado estimado; --purple = peso e corpo; --danger = destrutivo e SÓ destrutivo; --accent-strong = progresso e meta atingida; --success = déficit e meta positiva.
- --text-soft deixa de ser cor de rótulo (era ilegível a 9-11px) e passa a ser exclusivamente a cor da AUSÊNCIA ('Sem registro', 'Não informado', 'Não registrado') e de notas de 13px. Rótulos vão para --text-muted.
- Um acento por card. O `radial-gradient` do `.calorie-summary` e o `linear-gradient` do `.diary-calories` FICAM: são parte do que o dono aprovou, e removê-los junto com o resto tornaria impossível atribuir uma eventual regressão de gosto.
- As bordas de `.surface-card` FICAM. Removê-las globalmente atinge 24 arquivos .tsx e o desktop.

DENSIDADE DE REFERÊNCIA
Linha de lista com dois níveis de texto: 68px. Linha de lista simples: 56px. Cabeçalho de seção: 32px. Botão pleno: 52px. Controle inline: 44px. Padding interno de card grande: 24px 20px; de card de lista: 16px. Nada mais de `min-height: 34px | 42px | 43px | 45px` decidido caso a caso.

MOVIMENTO — nove regras, nenhuma decorativa
--ease-out: cubic-bezier(.22,.61,.36,1); --ease-sheet: cubic-bezier(.32,.72,0,1);
--dur-press: 90ms; --dur-fast: 160ms; --dur: 220ms; --dur-sheet: 280ms; --dur-bar: 520ms; --dur-ring: 700ms;
1. Entrada de rota: `main` faz `opacity 0->1` e `translateY(8px->0)` em 220ms --ease-out. Anima o CONTAINER, nunca card a card — stagger de tela inteira é a poluição que o dono rejeitou.
2. Sheet: backdrop `opacity 0->1` 200ms linear; `.diary-dialog` `translateY(100%->0)` em 280ms --ease-sheet; saída 200ms cubic-bezier(.4,0,1,1). É o movimento que mais faz o app parecer nativo e a estrutura JÁ existe (`.dialog-backdrop` com `align-items:end`, `.diary-dialog` com radius 22px 22px 0 0) — hoje ela aparece sem transição nenhuma.
3. Disclosure ('Ver classificação das metas'): `grid-template-rows: 0fr -> 1fr` 240ms --ease-out + `opacity` 160ms delay 80ms, `overflow:hidden`. Sem max-height chutada, sem medir altura em JS, e o conteúdo permanece no DOM.
4. Anel: `@property --calorie-progress { syntax: '<percentage>'; inherits: true; initial-value: 0% }` + `transition: --calorie-progress 700ms --ease-out`, uma vez por montagem. O número faz só fade-in de 240ms — NADA de count-up. Sem suporte a @property, o anel aparece no valor final.
5. Barras (faixa calórica e as 4 de macro): `width 0 -> valor` em 520ms --ease-out com `transition-delay` 0/60/120/180ms. A cauda inteira acaba em 700ms.
6. Toque: `:active { transform: scale(.97) }` com 90ms --ease-out na entrada e 160ms na volta, em botões, links de card e linhas tocáveis. É a regra de melhor custo-benefício do conjunto.
7. Confirmação de água: o total do card faz `scale(1 -> 1.06 -> 1)` em 260ms ao sucesso da mutation. Confirma a ação sem toast e sem prometer um 'desfazer' que o backend não tem.
8. Header sticky: a hairline entra com `transition: box-shadow 180ms linear` quando o sentinela de 1px sai da viewport. Booleano, não progresso.
9. Cor de barra e de chevron: `transition: background-color 200ms, transform 200ms`.
EXPLICITAMENTE FORA: swipe, toque longo, parallax, count-up, skeleton pulsante (o `.route-spinner` já resolve), stagger de lista, ripple, hover-lift, transição de rota horizontal, e colapso de cabeçalho interpolado por scroll.
REDUCED MOTION: o bloco atual (index.css:79-86) só zera `transition-duration`. Passa a zerar também `animation-duration: .01ms !important; animation-iteration-count: 1 !important` e a neutralizar o `:active { transform: none !important }`.