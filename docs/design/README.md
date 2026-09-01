# Reforma de UI/UX mobile e camada PWA — documentos de origem

Estes documentos são a saída de duas investigações multi-agente feitas depois do primeiro
deploy em produção, quando o uso real pelo celular expôs problemas estruturais de front-end.
Eles existem para que a implementação não precise redescobrir medidas, e para que uma decisão
possa ser contestada com o argumento original à mão.

Não são documentação viva do produto: descrevem o estado do código no momento da investigação
(branch `feat/mobile-ux-pwa`, a partir do `main` em `dadc97f`). Referências a `arquivo:linha`
envelhecem — confirme antes de agir sobre uma delas.

| Arquivo | O que é | Quando consultar |
|---|---|---|
| [plano.md](plano.md) | O plano aprovado, em ondas | Ponto de entrada. Diz o que fazer e em que ordem. |
| [sistema-visual.md](sistema-visual.md) | Tokens de espaço, tipografia, raio, toque, cor e movimento, com os valores finais | Ao escrever qualquer CSS. É a fonte dos números. |
| [spec-tela-hoje.md](spec-tela-hoje.md) | Especificação da tela Hoje a 390px, bloco a bloco, com estados | Onda 5. |
| [spec-tela-diario.md](spec-tela-diario.md) | Idem para o Diário, incluindo ações por linha e contagem de toques | Onda 5. |
| [prescricoes-por-onda.md](prescricoes-por-onda.md) | O roadmap detalhado das 8 lentes de auditoria: cada item com o CSS/código concreto e os arquivos afetados | Ao executar uma onda. É o documento mais longo e o mais operacional. |
| [critica-adversarial.md](critica-adversarial.md) | Lacunas, riscos subestimados e excessos encontrados atacando o roadmap acima | **Ler antes de começar uma onda.** Corrige erros reais das prescrições. |
| [impacto-e-riscos.md](impacto-e-riscos.md) | Por que os tokens precisam ser globais, e os riscos assumidos no redesign | Ao decidir escopo. |
| [principios-e-descartados.md](principios-e-descartados.md) | Princípios que guiam as ondas e o registro do que foi rejeitado, com o motivo | Quando alguém propuser de novo algo que já foi descartado. |

## Precedência

Onde os documentos divergirem, vale nesta ordem:

1. `plano.md` — incorpora as decisões do dono do produto e as correções da crítica.
2. `critica-adversarial.md` — corrige erros concretos dos outros dois.
3. `prescricoes-por-onda.md`, `spec-tela-*.md`, `sistema-visual.md`.

Divergências conhecidas, já resolvidas em `plano.md`: a bottom-nav **mantém** o vidro (as specs
propunham torná-la opaca); o piso tipográfico entra na Onda 1, não na última; a unificação dos
sheets precisa preservar o breakpoint de 560px, que as specs afirmavam não existir.

## Achados refutados na execução

Os documentos foram escritos lendo o código, não rodando o app. Três afirmações não sobreviveram à
medição. Ficam registradas aqui para não serem redescobertas — e como lembrete de que o resto
também é leitura, não medição.

1. **A vírgula do teclado pt-BR NÃO é descartada.** As prescrições davam como certo que 27 campos
   `type="number"` transformavam `72,5` em vazio, e pediam a troca para `type="text"` com parser
   próprio. Digitando nos dois motores com locale pt-BR — Chromium e WebKit, que é o do iOS — o
   campo devolve `"72.5"` e `valueAsNumber` 72,5: os dois localizam o controle e normalizam
   sozinhos. A troca teria quebrado dez asserções e jogado fora a normalização do navegador.
   O que restou do item é real: `inputMode` para o iOS oferecer o teclado decimal compacto.

2. **A folga inferior era de 21,7px, não de 14px.** O plano deduziu o número do CSS. Medido no
   aparelho, a barra tem 72px e a ponta do FAB rotacionado chega a 90,3px — contra os 112px de
   `padding-bottom`. O defeito era real; o tamanho dele, não.

3. **Não havia estouro horizontal nenhum no celular.** Os cinco `minmax()` apontados como
   perigosos só entram a partir de 560px. O aperto que o dono sentiu era vertical e tipográfico;
   corrigir os `minmax()` continua valendo para tablet e janela estreita, mas não era isso.

## Decisões que mudaram na execução

O plano previa **toast com desfazer no dia a dia e confirmação nas ações graves**. A API inverteu
a atribuição: alimento, receita e avaliação corporal têm endpoint de **restauração**, então ali o
desfazer é real e acontece depois da ação; refeição, item e água do diário têm `DELETE` definitivo,
sem restauração, então ali a confirmação vem antes. Oferecer "Desfazer" no diário significaria
recriar o registro com outro identificador e, no caso da água, outro horário — e chamar isso de
desfazer seria mentir sobre o que aconteceu com o dado.

Duas coisas planejadas **não** foram feitas, e por decisão, não por esquecimento:

- **Swipe horizontal entre dias no diário.** A faixa de sete dias já resolve a troca de data em um
  toque, com contexto visual da semana. O gesto acrescentaria uma superfície de risco (conflito com
  a rolagem da própria faixa, histórico, cancelamento) para reduzir de um toque para zero.
- **`?editor=` na URL para representar diálogos.** O gesto de voltar fecha o sheet por uma entrada
  anônima de histórico. Serializar o id na URL quebraria a chave de idempotência do registro de
  treino e faria "Editar" abrir como "Adicionar" enquanto a lista mostrasse dados da consulta
  anterior.
