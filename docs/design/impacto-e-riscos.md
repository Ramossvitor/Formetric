O redesenho é 90% de tokens e classes COMPARTILHADAS, então a maior parte do ganho vaza sozinha para as outras telas — e é justamente por isso que ele não pode ser aplicado só em Hoje e Diário. Contei os usos: `.surface-card` em 24 arquivos .tsx, `.secondary-button` em 26, `.eyebrow` em 25, `.submit-button` em 23, `.page-heading` e `.heading-copy` em 20, `.empty-state` em 10, `.text-button` em 9, `.status-chip` e `.section-title-row` em 7, `.icon-button` em 7. Mexer nelas repassa o app; NÃO mexer nelas produz exatamente a ilha bonita cercada de telas de 9px.

O MÍNIMO ACEITÁVEL, em ordem de commit:

COMMIT 1 — tokens (só index.css, zero .tsx). Adiciona --space-*, --fs-*, --lh-*, --radius-*, --tap*, --hairline e os tokens de movimento. Não muda pixel nenhum ainda. Custo: nulo. Risco: nulo.

COMMIT 2 — o piso global (só App.css, zero .tsx). É OBRIGATÓRIO e é o que impede a ilha:
  - toda declaração de font-size abaixo de 0.8rem sobe para --fs-footnote (13px), exceto a lista fechada de exceções de 12px (eyebrow, bottom-nav-item, quality-chip, status-chip, estimate-label).
  - `.icon-button` 34x34 -> 44x44. Atinge catálogo, receitas, treinos, peso, avaliações, perfil, convites e a sidebar. É a mudança com maior chance de deslocar um layout de lista em outra tela: exige uma varredura VISUAL dessas telas (não redesign) confirmando que nenhuma linha quebra em 390px — se alguma quebrar, a correção é a mesma de sempre (a linha vira grid de 3 colunas com o alvo na terceira).
  - `.submit-button`/`.secondary-button`/`.secondary-link` 48 -> 52px e 0.86rem -> 15px; `.compact-button` -> 44px/14px; `.text-button` -> 44px/15px.
  - `h1` do `.page-heading`: `clamp(2rem, 4vw, 2.75rem)` -> 1.75rem fixo no mobile, com o clamp preservado em `@media (min-width: 840px)`. Vale para as 20 telas de uma vez e é onde mora a economia real de altura — NÃO deletar o elemento, porque seis asserções entre App.test.tsx, DiaryPage.test.tsx e o e2e dependem dele.
  - `.eyebrow` -> 12px/700 uppercase; `.heading-copy` -> 15px/1.5.
  - `.empty-state`/`.inline-empty-state`/`.inline-hint`/`.catalog-state` -> corpo 15px, botões 52px, ações empilhadas em coluna no mobile.
  - `font-variant-numeric: tabular-nums` na lista de seletores de valor.

COMMIT 3 — o cromo do shell (App.css + ~6 linhas de AuthenticatedLayout.tsx). `main` com `padding: 12px 20px calc(76px + safe + 40px)`; `.bottom-nav` opaca sem blur e sem sombra a 76px; `.quick-add` desrotacionado com saliência de 12px; `.mobile-header` sticky com hairline no scroll; scrim de 24px. Isso conserta a queixa central em TODAS as 20 telas ao mesmo tempo, e é a razão de ele vir antes do redesenho de conteúdo.

COMMIT 4 — movimento global (só CSS): `:active scale(.97)`, entrada de rota no `main`, transição de `.dialog-backdrop`/`.diary-dialog` (que serve TODOS os diálogos do app, não só os do diário), `@property` do anel, e o bloco `prefers-reduced-motion` ampliado. Todas as telas ganham a sensação nativa sem nenhuma tocar em .tsx.

COMMITS 5 e 6 — Hoje e Diário, os únicos com mudança de estrutura em .tsx.

O QUE FICA COMO ESTÁ (e por que isso é aceitável): catálogo de alimentos, receitas, treinos, peso, avaliações corporais, análises mensal/gráficos, metas nutricionais, TDEE, perfil e convites mantêm seus layouts. Elas herdam a escala tipográfica, os alvos de 44/52px, a nav sólida, o padding correto, o movimento e os raios. Nenhuma delas vai parecer 'de outro app' — vai parecer a mesma família com menos ambição de layout, que é uma diferença que o dono não nota. O que NÃO seria aceitável é aplicar os tokens só nas duas telas: aí sim o contraste entre um item de refeição de 15px e uma linha de catálogo de 9,4px seria gritante na mesma sessão de uso.

DÍVIDA EXPLÍCITA, para depois do piloto: `.metric-card` só aparece em 1 arquivo .tsx (HomePage), então o card-grupo do Panorama não tem eco em outras telas — mas o mesmo padrão de 'lista agrupada de 68px' deve virar uma classe reutilizável (`.grouped-list`) para as telas de treino e peso na próxima passada. E os `.icon-button` de ação destrutiva colados em listas de catálogo/receitas devem receber o mesmo tratamento de sheet que as refeições receberam.

## RISCOS

1. O piso de 13px e os alvos de 44/52px fazem as páginas CRESCER em altura absoluta. Um Diário com 5 refeições e 20 itens vai rolar mais do que rola hoje, mesmo com a segunda linha de cada cabeçalho de refeição eliminada. A troca é deliberada — mais rolagem em nome de menos aperto, porque rolar é barato no celular e errar o alvo não é — mas é a primeira coisa que o dono vai notar e ele pode chamar isso de regressão.

2. O commit 2 (piso global + .icon-button de 34 para 44px) toca 7 arquivos .tsx indiretamente e pode deslocar linhas de lista em catálogo, receitas, treinos, peso e avaliações. Não há teste visual no repo: só uma varredura manual em 390px pega isso, e o risco de uma quebra passar despercebida até o piloto é real.

3. Editar item passa de 1 para 2 toques e excluir item de 1 para 3 (com confirmação); duplicar refeição vai de 1 para 2. Quem corrige muito registro sente. A mitigação é que os alvos deixam de ser dois botões de 34px com 3px entre eles, com o destrutivo colado no benigno — mas isso é um ganho abstrato contra uma perda concreta de velocidade.

4. A faixa de 7 dias no Diário é o único elemento verdadeiramente NOVO da proposta, e sem o ponto de 'dia com registro' ela é apenas um seletor de data mais bonito e mais alto (64px) que o input atual. Se o dono não usa muito a navegação entre dias, ela é 64px gastos à toa e deve ser a primeira coisa a cair na revisão.

5. O disclosure da .goal-state-list depende de o conteúdo permanecer no DOM (grid-template-rows: 0fr + overflow hidden) para os 5 casos de DiarySummary.test.tsx continuarem verdes. Se alguém 'otimizar' isso para renderização condicional ou display:none numa manutenção futura, cinco testes caem de uma vez — e o motivo não estará óbvio no diff.

6. O @property --calorie-progress não é suportado em Firefox mais antigo e em algumas WebViews Android. A degradação é silenciosa (o anel aparece no valor final), mas significa que a animação de assinatura do card não existe para uma parte dos 10 usuários, e não dá para saber quais sem perguntar.

7. Levar addWater para a Home via useQuickWater cria um segundo ponto de entrada da mutation, mesmo compartilhando o hook. A invalidação precisa acertar DUAS caches (dailyLogQuery(date) e a de analytics); se a de analytics falhar, o card de água mostra o valor antigo depois de o usuário ter tocado — que é pior do que não ter o atalho. Precisa de teste explícito de que o valor na Home muda após o toque.

8. A HomePage passa a ter um caminho de erro de mutation que não tinha (ela era 100% leitura sobre dailyAnalyticsQuery). Isso é código novo numa tela que hoje só tem três estados; a chance de o erro aparecer sem saída clara para o usuário é real.

9. Manter o anel de 200px, o bloco de faixa e o saldo antes dos macros significa que ver proteína exige rolar. Hoje os macros aparecem (ilegíveis) na primeira tela. Se o dono for do tipo que olha proteína primeiro, essa ordem está errada e a correção é inverter os dois blocos internos do .nutrition-card — barata, mas só se descobre com ele na mão.

10. A barra com ticks de min e max é a peça de UI mais nova da proposta e a única que pode DESINFORMAR se a matemática de escala estiver errada: com scaleMax mal escolhido, uma meta '≥ 120 e ≤ 160' com 170 g pode renderizar visualmente como sucesso. A fórmula está fixada na spec justamente por isso, e precisa de teste unitário do cálculo de pct antes de virar pixel.

11. Manter o gradiente radial, o gradiente linear e o anel (para não quebrar 'gostei da aparência') significa que a tela continua com três elementos decorativos que competem com a hierarquia nova. Se depois do deploy ela ainda parecer 'carregada', a próxima iteração terá de remover um de cada vez para atribuir a causa — e isso é mais um ciclo de feedback.

12. A `.bottom-nav` opaca elimina o efeito de vidro que o backdrop-filter dava. É uma perda estética visível e imediata, e é possível que o dono goste do blur mesmo sendo ele parte da causa do problema. O compromisso, se ele reclamar, é manter o blur mas devolver a folga (padding-bottom), nunca o contrário.

13. Os aria-labels 'Editar {nome}', 'Duplicar {nome}', 'Excluir {nome}' migram para dentro de sheets. Nenhum teste atual os clica, mas se um teste futuro for escrito assumindo que eles estão na página, ele vai falhar por um motivo que parece um bug de acessibilidade e não é.

14. O sheet de ações de item e o sheet de ações de refeição acrescentam dois tipos ao union `Editor` da DiaryPage, que já tem cinco e uma máquina de erro de diálogo não trivial (dialogMutations, shownInDialog, openEditor/closeEditor). O arquivo vai passar de 272 linhas e provavelmente precisa quebrar em MealCard/MealItemRow/WaterSection — refactor que não estava no orçamento do redesenho.