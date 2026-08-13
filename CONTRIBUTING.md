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

## Segurança e privacidade

Nunca versione:

- arquivos `.env` reais;
- senhas, tokens, chaves ou cookies;
- fotos e relatórios corporais;
- dumps de bancos de desenvolvimento;
- logs com informações pessoais.

Segredos de CI e produção devem ser configurados nos provedores correspondentes.
