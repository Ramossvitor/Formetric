# Baseline inicial: Cloud Run + Neon

Este diretório descreve o deploy do monólito Formetric como uma única imagem: o
Spring Boot serve a API e os arquivos compilados da SPA na mesma origem. Os comandos
abaixo usam apenas identificadores públicos. Senhas, URLs de banco e tokens devem ser
inseridos diretamente no Neon, no Secret Manager ou em uma CLI autenticada.

## Topologia inicial

- Cloud Run e Artifact Registry em `southamerica-east1`.
- Neon PostgreSQL 17 em AWS São Paulo.
- Billing por requisição, 1 vCPU, 1 GiB, concorrência 20.
- Zero instâncias mínimas e no máximo uma instância durante a baseline do Flyway.
- Aplicação acessível pela URL `run.app`; domínio próprio fica para depois.
- Endpoint Neon pooled para a aplicação e endpoint direto para o Flyway.

O serviço começa privado. Login e SPA só recebem invocação anônima depois da remoção
dos secrets de bootstrap, da aprovação do checklist de segurança e do smoke privado.
A autorização dos dados continua sendo feita pelo Spring Security. Não use VPC
connector, load balancer ou instância mínima neste primeiro beta.

> Este workflow serve somente para a baseline de um banco vazio e para criar a revisão
> de limpeza imediatamente posterior. Antes de qualquer release futura com migration,
> implemente o job descrito em [migrations-and-rollback.md](migrations-and-rollback.md).

## Ordem de preparação

1. Crie/selecione um projeto Google Cloud com billing e configure um budget ou spend
   cap antes de liberar tráfego.
2. Crie o projeto Neon com PostgreSQL 17 na região AWS São Paulo e uma branch
   `production`.
3. Teste todas as migrations numa branch Neon descartável e apague-a depois.
4. Crie o Artifact Registry, as service accounts, o pool WIF e os secrets conforme
   [wif-and-secrets.md](wif-and-secrets.md).
5. Pré-crie o serviço privado de manutenção e a permissão de invocação específica do
   deploy conforme [wif-and-secrets.md](wif-and-secrets.md).
6. Configure o GitHub Environment `production`, com aprovação manual e restrição à
   branch `main`.
7. Confirme que o mesmo SHA possui execução verde do workflow `CI`.
8. Execute `Deploy initial production candidate` com `bootstrap_owner=true` e
   `promote=false`.
9. Revise health, logs e a criação idempotente do proprietário; não exponha a revisão.
10. Execute novamente o mesmo SHA com `bootstrap_owner=false` e `promote=false`. Esse
    deploy remove explicitamente os três bindings de bootstrap.
11. Desabilite as versões de bootstrap, exclua a revisão que ainda as referencia e
    conclua o checklist de exposição pública abaixo.
12. Somente então conceda `roles/run.invoker` a `allUsers` no serviço e execute o
    workflow com `bootstrap_owner=false` e `promote=true`.

O workflow exige CI verde para o SHA, baixa a imagem que passou pelo E2E integrado,
confere seu checksum e image ID, escaneia novamente, publica exatamente esse artefato
e confirma no Artifact Registry o digest retornado pelo push antes do deploy. Ele não envia
tráfego à candidata antes do smoke e usa WIF, sem chave long-lived. A URL tagged ainda
pode iniciar e tornar a revisão acessível a quem tiver `run.invoker`; `--no-traffic`
não é uma fronteira de acesso.

## Bloqueadores antes de `allUsers`

- O rate limiter em memória e baseado em `remoteAddr` é apenas defesa em profundidade:
  reinicia em cold starts, não é compartilhado entre instâncias e precisa ser validado
  atrás do proxy do Cloud Run. Mantenha uma instância e beta restrito; proteção de edge
  ou limiter compartilhado é requisito antes de abertura ampla.
- Execute um teste de restore Neon, confirme retenção e registre o ponto de restauração.
- Confirme cookies `Secure`, headers, CORS/CSRF e ausência de Swagger/Actuator além de
  health no perfil `prod`.

## Bootstrap do primeiro proprietário

Os três secrets de bootstrap devem existir juntos durante uma única revisão privada:

1. Adicione versões temporárias para `BOOTSTRAP_ADMIN_EMAIL`,
   `BOOTSTRAP_ADMIN_PASSWORD` e `BOOTSTRAP_ADMIN_DISPLAY_NAME` no Secret Manager sem
   expor valores no terminal ou no GitHub.
2. Faça o deploy privado, sem tráfego, com `bootstrap_owner=true`.
3. Confirme nos logs que o runner idempotente concluiu e que a candidata ficou ready.
4. Implante a mesma imagem com `bootstrap_owner=false`; esse caminho chama
   `--remove-secrets` para os três nomes e cria uma nova revisão limpa.
5. Inspecione a revisão limpa com `gcloud run revisions describe`: nenhum env deve ter
   `BOOTSTRAP_ADMIN_*` em `valueFrom`.
6. Desabilite as três versões temporárias e exclua a revisão antiga que ainda as
   referencia. Só a revisão limpa pode receber tráfego ou ser alvo de rollback.

A revisão de bootstrap nunca é candidata a rollback. A senha não deve ser passada em
parâmetro de script, arquivo `.env`, issue, PR, chat ou log.

## Deploy manual de uma candidata

O script [deploy-candidate.ps1](deploy-candidate.ps1) é uma alternativa local ao
workflow. Ele exige uma referência imutável `@sha256`, nomes/versões de secrets e uma
sessão `gcloud` já autenticada. Ele não promove tráfego.

Exemplo sem valores sensíveis:

```powershell
./infra/cloud-run/deploy-candidate.ps1 `
  -ProjectId "SEU_PROJECT_ID" `
  -ImageRef "southamerica-east1-docker.pkg.dev/SEU_PROJECT_ID/formetric/formetric@sha256:DIGEST" `
  -RuntimeServiceAccount "formetric-runtime@SEU_PROJECT_ID.iam.gserviceaccount.com" `
  -DbPoolerUrlSecret "formetric-db-pooler-url" `
  -DbDirectUrlSecret "formetric-db-direct-url" `
  -DbUsernameSecret "formetric-db-username" `
  -DbPasswordSecret "formetric-db-password" `
  -SecretVersion "1" `
  -ConfirmInitialBaseline
```

Para criar a revisão privada de bootstrap, acrescente `-BootstrapOwner` e os três nomes
de secret mais `-BootstrapSecretVersion`. A execução normal acima remove explicitamente
qualquer binding `BOOTSTRAP_ADMIN_*` herdado.

Promova somente a revisão limpa e depois dos checks:

```powershell
gcloud run services update-traffic formetric `
  --project SEU_PROJECT_ID `
  --region southamerica-east1 `
  --to-tags candidate=100
```

## Health e logs

- Startup: `/actuator/health/readiness`, com até quatro minutos para acordar o Neon e
  aplicar/validar migrations.
- Liveness: `/actuator/health/liveness`; nunca deve depender do banco.
- Smoke público: `/`, `/login`, um deep link da SPA e sessão anônima retornando 401.
- Cloud Run coleta stdout/stderr e request logs automaticamente.

Não coloque tokens em query strings e não registre e-mail, senha, corpo de requests ou
dados corporais. Depois de validar a telemetria, uma exclusão apenas para health checks
2xx pode reduzir ruído; nunca exclua erros ou eventos de autenticação.

## Custo controlado

- Mantenha `min-instances=0`; aceite o cold start combinado de Cloud Run e Neon.
- Limite a uma instância durante bootstrap/baseline. Aumente para duas apenas depois de
  validar o schema e remover os secrets temporários.
- Configure limpeza no Artifact Registry, preservando ao menos três imagens válidas.
- Acompanhe CU-hours, storage e transferência no Neon.
- Budget alerts não são um teto por si só; habilite spend cap quando disponível.

O plano gratuito do Neon possui retenção curta. Para abrir o produto a terceiros, a
decisão de backup/restore deve ser explícita e revista antes de superar um beta pessoal.

## Documentos relacionados

- [E2E.md](../E2E.md): ambiente integrado local/CI.
- [wif-and-secrets.md](wif-and-secrets.md): identidade sem chave e secrets.
- [migrations-and-rollback.md](migrations-and-rollback.md): política de banco e retorno.
