# Política de migrations e rollback

O código e o schema têm ciclos de vida diferentes. Redirecionar tráfego para uma
revisão antiga não desfaz uma migration, portanto toda mudança aplicada antes da
promoção precisa ser compatível com a revisão anterior.

## Regras obrigatórias

1. Nunca altere um arquivo `V*.sql` que já tenha sido aplicado em qualquer ambiente
   compartilhado. Toda mudança recebe uma migration nova.
2. Teste migrations do zero no PostgreSQL do CI e novamente numa branch Neon
   descartável, incluindo `btree_gist`, `unaccent` e `pg_trgm`.
3. Use endpoint Neon direto para Flyway e endpoint pooled para a aplicação.
4. Antes de produção, crie um restore point/snapshot e registre migration, commit,
   digest da imagem, branch Neon e horário UTC.
5. Alterações devem seguir expand/contract; migrations destrutivas nunca entram na
   mesma entrega que deixa de usar a estrutura antiga.
6. A revisão candidata permanece sem tráfego até startup, Flyway e smoke concluírem.
7. `Deploy initial production candidate` não deve ser reutilizado para uma release
   posterior que contenha migration; o job dedicado abaixo é pré-requisito.

## Primeiro deploy

Como o banco está vazio, o Flyway pode rodar no startup da candidata:

1. Crie uma branch Neon temporária a partir da produção vazia.
2. Inicie a imagem com `DB_DIRECT_URL` nessa branch e confirme todas as migrations.
3. Verifique `flyway_schema_history` e as extensões instaladas.
4. Apague a branch temporária.
5. Implante produção com uma única candidata privada, tagged e sem tráfego. A URL tagged
   aceita requisições autorizadas mesmo em 0%, portanto não trate `--no-traffic` como
   isolamento.
6. Só permita escala até duas instâncias depois que o schema estiver validado.

Consultas de conferência:

```sql
SELECT installed_rank, version, description, success
FROM flyway_schema_history
ORDER BY installed_rank;

SELECT extname
FROM pg_extension
WHERE extname IN ('btree_gist', 'pg_trgm', 'unaccent')
ORDER BY extname;
```

## Entregas posteriores

Antes da próxima mudança de schema, extraia migration para um Cloud Run Job ou etapa
protegida que:

- recebe credenciais diretas com privilégio de DDL;
- executa uma vez e termina;
- bloqueia o deploy se Flyway falhar;
- não serve HTTP nem contém secrets de bootstrap;
- deixa o serviço web apenas validar a versão do schema.

O usuário do pool da aplicação deve evoluir para um papel sem DDL. Grants para novas
tabelas precisam fazer parte da migration.

## Expand/contract

Exemplo seguro para renomear uma coluna:

1. **Expandir:** adicionar a nova coluna nullable e aceitar os dois formatos.
2. **Migrar:** preencher dados em lotes observáveis e idempotentes.
3. **Trocar:** implantar código que lê a nova coluna, ainda escrevendo de modo
   compatível durante a transição.
4. **Contrair:** remover a coluna antiga somente numa entrega posterior, depois que
   nenhuma revisão passível de rollback depender dela.

Índices grandes devem ser criados de modo não bloqueante quando o PostgreSQL permitir.
Backfills não pertencem ao startup da aplicação.

## Decisão de rollback

| Situação | Ação |
| --- | --- |
| Erro somente no código, schema compatível | Direcionar 100% do tráfego à revisão estável anterior. |
| Candidata falha antes de receber tráfego | Manter 0%, corrigir e gerar outra imagem/revisão. |
| Migration expand falha em transação | Corrigir com uma nova migration; não editar a migration já registrada. |
| Migration aplicada e código novo falha | Rollback da aplicação somente se a revisão antiga aceitar o schema expandido. |
| Corrupção/perda de dados | Interromper escritas, preservar logs e avaliar restore Neon. |
| Migration destrutiva incompatível | Não promover; restauração de banco é último recurso e pode perder escritas. |

Rollback de revisão:

```bash
gcloud run services update-traffic formetric \
  --project=PROJECT_ID \
  --region=southamerica-east1 \
  --to-revisions=REVISION_ESTAVEL=100
```

Depois do rollback, preserve a candidata e seus logs até concluir a análise. Não
exclua a imagem nem a branch/snapshot imediatamente.

## Evidência mínima por release

- CI backend, frontend e container E2E aprovados.
- Digest e scan da imagem registrados.
- Lista/checksum Flyway conferidos.
- Smoke da candidata aprovado.
- Métricas de 5xx, startup, memória e pool observadas após promoção.
- Comando e revisão de rollback conhecidos antes da mudança de tráfego.
