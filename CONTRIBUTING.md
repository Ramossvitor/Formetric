# Contribuindo com o Formetric

## Fluxo de desenvolvimento

Até o primeiro deploy, as entregas concluídas e validadas são integradas diretamente
na branch `main`. Não devem existir commits `WIP` nessa branch.

Após a versão `v0.1.0`, cada incremento deve seguir este fluxo:

1. Criar uma branch `agent/<descricao-curta>` a partir da `main` atualizada.
2. Implementar uma unidade funcional e executar os testes relevantes.
3. Abrir uma pull request como draft.
4. Integrar somente após todos os checks passarem.

## Commits

Use Conventional Commits em inglês:

```text
<type>(<optional-scope>): <imperative summary>

Explain what changed and why.
Describe relevant product or architecture decisions.
List the validation performed when it adds useful context.
```

Tipos mais comuns:

- `feat`: nova capacidade do produto.
- `fix`: correção de comportamento.
- `refactor`: mudança interna sem alterar o comportamento esperado.
- `test`: cobertura automatizada.
- `docs`: documentação.
- `chore`: infraestrutura, dependências ou manutenção.
- `ci`: automação de integração e entrega.

Cada commit deve representar uma unidade lógica completa. Antes de criá-lo:

1. Inspecione `git status` e o diff que será versionado.
2. Confirme que não existem segredos, dados pessoais ou artefatos gerados.
3. Execute os testes e verificadores proporcionais à alteração.
4. Registre no corpo do commit as decisões que não forem óbvias pelo diff.

## Qualidade

- Preserve o isolamento por usuário em todas as consultas e mutações.
- Mantenha dados registrados, cálculos e interpretações em camadas distintas.
- Não altere resultados históricos ao editar metas, TDEE, alimentos ou receitas.
- Use unidades canônicas e tipos decimais para valores nutricionais e corporais.
- Cubra regras de negócio com testes unitários e persistência com PostgreSQL real
  através de Testcontainers.

### Layout no celular

O app é usado principalmente no celular, e nenhuma das suítes enxerga um defeito de layout
sozinha: o jsdom não calcula caixas, e os testes de componente buscam por texto e papel. Duas
catracas cobrem essa lacuna, e ambas falham com a lista do que corrigir.

`frontend/tools/css-contract.ts` lê as folhas de estilo como texto e recusa controle de
formulário abaixo de 16px (é o que faz o Safari do iOS ampliar o viewport ao focar o campo e
nunca desfazer o zoom), `font: inherit` em controle, `vh`, `env(safe-area-inset-*)` sem
fallback, e medida fora da escala declarada em `index.css` — `padding`, `margin`, `gap`,
`border-radius` e `font-size` em px ou rem cru que não caia num degrau. Roda dentro do `npm test`.

A quinta regra é a única que nasce com linha de base cheia, e de propósito: são 505 medidas
fora da régua espalhadas pelo arquivo, que encolhem tela a tela. Ela é a razão de a escala parar
de ser sugestão — uma escala declarada e não cobrada não reduz variação, só acrescenta mais um
valor aos que já existiam. As exceções nomeadas estão no topo do scanner: o fio de 1px, a pílula
de 999px, e as reservas de coluna de 58/60/76/94px, que são largura de controle sobreposto e não
respiro.

`frontend/e2e/layout-guards.spec.ts` mede a página renderizada em 320, 375, 412 e 900px: nenhuma
rota pode rolar de lado, nenhum controle pode ficar abaixo de 16px depois da cascata, nenhum alvo
de toque — botão, link, campo, seleção — pode ter caixa menor que 44px. Roda dentro do
`npm run test:e2e`. A largura de 900px existe porque é a faixa em que o sidebar já ocupa 264px e
o conteúdo cabe em ~552px: quatro grades escritas contra um número de viewport estouravam ali, e
nenhuma das outras três larguras as alcançava.

As duas partem de uma linha de base versionada, porque as violações são corrigidas ao longo de
várias ondas. Depois de corrigir um lote, aperte a catraca:

```
UPDATE_CSS_BASELINE=1 npm test -- css-contract
UPDATE_LAYOUT_BASELINE=1 npm run test:e2e -- layout-guards
```

Para comparar uma tela antes e depois de uma mudança, capture as duas pontas e olhe lado a lado
(`screenshots/` é ignorada pelo git):

```
CAPTURE_SCREENSHOTS=screenshots/antes npm run test:e2e -- layout-guards
```

## Segurança e privacidade

Nunca versione:

- arquivos `.env` reais;
- senhas, tokens, chaves ou cookies;
- fotos e relatórios corporais;
- dumps de bancos de desenvolvimento;
- logs com informações pessoais.

Segredos de CI e produção devem ser configurados nos provedores correspondentes.
