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
