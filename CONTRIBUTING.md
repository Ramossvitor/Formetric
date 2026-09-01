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
nunca desfazer o zoom), `font: inherit` em controle, `vh`, e `env(safe-area-inset-*)` sem
fallback. Roda dentro do `npm test`.

`frontend/e2e/layout-guards.spec.ts` mede a página renderizada em 320, 375 e 412px: nenhuma rota
pode rolar de lado, nenhum controle pode ficar abaixo de 16px depois da cascata, nenhum alvo de
toque pode ter caixa menor que 44px. Roda dentro do `npm run test:e2e`.

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
