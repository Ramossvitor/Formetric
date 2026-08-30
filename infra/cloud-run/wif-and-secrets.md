# WIF, service accounts e secrets

Use estes comandos no Cloud Shell ou numa estação já autenticada com uma conta
administradora. Substitua apenas identificadores. Nenhuma chave JSON é criada.

## APIs e Artifact Registry

```bash
gcloud config set project PROJECT_ID
gcloud services enable \
  cloudresourcemanager.googleapis.com \
  iam.googleapis.com \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  secretmanager.googleapis.com \
  iamcredentials.googleapis.com \
  sts.googleapis.com \
  storage.googleapis.com \
  cloudscheduler.googleapis.com \
  monitoring.googleapis.com \
  logging.googleapis.com

gcloud artifacts repositories create formetric \
  --repository-format=docker \
  --location=southamerica-east1 \
  --description="Formetric production images"
```

As duas primeiras APIs costumam já vir ligadas em projetos novos, mas habilitá-las de novo é
inofensivo e evita descobrir o contrário no meio do caminho — são elas que sustentam
`gcloud projects` e `gcloud iam service-accounts`. As quatro últimas servem à cópia diária do
banco: bucket, agendamento, alerta de falha e os logs que o alerta observa. Sem elas os comandos
de [../backup/README.md](../backup/README.md) falham no meio da execução, depois de metade dos
recursos já existir.

Crie duas identidades distintas:

```bash
gcloud iam service-accounts create formetric-runtime \
  --display-name="Formetric Cloud Run runtime"
gcloud iam service-accounts create formetric-deploy \
  --display-name="Formetric GitHub deploy"
```

O runtime não recebe permissões de deploy. O deploy recebe apenas escrita no registry,
atualização do Cloud Run e autorização para usar a identidade de runtime:

```bash
gcloud projects add-iam-policy-binding PROJECT_ID \
  --member="serviceAccount:formetric-deploy@PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/run.developer"

gcloud artifacts repositories add-iam-policy-binding formetric \
  --location=southamerica-east1 \
  --member="serviceAccount:formetric-deploy@PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/artifactregistry.writer"

gcloud iam service-accounts add-iam-policy-binding \
  formetric-runtime@PROJECT_ID.iam.gserviceaccount.com \
  --member="serviceAccount:formetric-deploy@PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/iam.serviceAccountUser"
```

Esses mesmos papéis cobrem o job de migration usado pelas releases: `roles/run.developer`
autoriza criar e executar Cloud Run Jobs e `roles/iam.serviceAccountUser` permite que o
job rode com a identidade de runtime. Nenhuma concessão adicional é necessária.

## Serviço privado inicial e IAM

`roles/run.developer` não concede invocação. Para evitar o impasse em que o workflow
cria a primeira candidata mas não consegue testar sua URL privada, um administrador
deve pré-criar o serviço com uma revisão de manutenção e então conceder invocação ao
deploy somente nesse serviço:

```bash
gcloud run deploy formetric \
  --project=PROJECT_ID \
  --region=southamerica-east1 \
  --image=us-docker.pkg.dev/cloudrun/container/hello \
  --service-account=formetric-runtime@PROJECT_ID.iam.gserviceaccount.com \
  --execution-environment=gen2 \
  --min-instances=0 \
  --max-instances=1 \
  --no-allow-unauthenticated

gcloud run services add-iam-policy-binding formetric \
  --project=PROJECT_ID \
  --region=southamerica-east1 \
  --member="serviceAccount:formetric-deploy@PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/run.invoker"
```

A revisão de manutenção recebe o tráfego enquanto a primeira revisão Formetric fica
em `--no-traffic`. Não conceda invocação no projeto inteiro apenas para contornar o
bootstrap. O workflow usa um ID token cujo audience é a URL canônica do serviço para
testar a URL tagged privada.

Somente depois de concluir bootstrap, remover os três bindings temporários e aprovar o
checklist de exposição pública do runbook, conceda `roles/run.invoker` a `allUsers`.
Restrinja a concessão ao serviço:

```bash
gcloud run services add-iam-policy-binding formetric \
  --project=PROJECT_ID \
  --region=southamerica-east1 \
  --member="allUsers" \
  --role="roles/run.invoker"
```

## Workload Identity Federation

Descubra o número do projeto e crie um pool/provedor exclusivo:

```bash
PROJECT_NUMBER="$(gcloud projects describe PROJECT_ID --format='value(projectNumber)')"

gcloud iam workload-identity-pools create github \
  --location=global \
  --display-name="GitHub Actions"

gcloud iam workload-identity-pools providers create-oidc formetric-github \
  --location=global \
  --workload-identity-pool=github \
  --issuer-uri="https://token.actions.githubusercontent.com" \
  --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.ref=assertion.ref,attribute.environment=assertion.environment,attribute.workflow_ref=assertion.workflow_ref" \
  --attribute-condition="assertion.repository=='Ramossvitor/Formetric' && assertion.ref=='refs/heads/main' && assertion.environment=='production' && assertion.workflow_ref in ['Ramossvitor/Formetric/.github/workflows/deploy-candidate.yml@refs/heads/main', 'Ramossvitor/Formetric/.github/workflows/deploy-release.yml@refs/heads/main', 'Ramossvitor/Formetric/.github/workflows/publish-backup-image.yml@refs/heads/main']"

gcloud iam service-accounts add-iam-policy-binding \
  formetric-deploy@PROJECT_ID.iam.gserviceaccount.com \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/github/attribute.repository/Ramossvitor/Formetric"

# O smoke privado dos deploys chama a URL da candidata com um ID token da identidade de
# deploy. A credencial federada não emite ID token diretamente; o workflow o obtém por
# impersonação. Como a autenticação do workflow já executa as chamadas de API como a
# própria service account, quem pede o token é ela mesma — o papel precisa valer para os
# dois membros:
gcloud iam service-accounts add-iam-policy-binding \
  formetric-deploy@PROJECT_ID.iam.gserviceaccount.com \
  --role="roles/iam.serviceAccountTokenCreator" \
  --member="principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/github/attribute.repository/Ramossvitor/Formetric"

gcloud iam service-accounts add-iam-policy-binding \
  formetric-deploy@PROJECT_ID.iam.gserviceaccount.com \
  --role="roles/iam.serviceAccountTokenCreator" \
  --member="serviceAccount:formetric-deploy@PROJECT_ID.iam.gserviceaccount.com"
```

A condição do provider e as regras do GitHub Environment precisam concordar: somente
`Ramossvitor/Formetric`, branch `main`, a aprovação do ambiente `production` e exatamente
os três workflows autorizados:

| Workflow | Para quê |
|---|---|
| `deploy-candidate.yml` | Baseline inicial e bootstrap do proprietário. |
| `deploy-release.yml` | Migrations e todas as releases seguintes. |
| `publish-backup-image.yml` | Imagem do job de cópia diária do banco. |

Os três autenticam neste mesmo provider. Deixar algum de fora faz aquele workflow falhar na
autenticação do Google, e falhar tarde — depois de o revisor já ter aprovado o Environment.

Não reduza a condição a repositório e branch: isso permitiria que outro workflow na
`main` solicitasse a mesma identidade sem passar pelos revisores do Environment. **Ao criar um
workflow novo que autentique aqui, acrescentar o `workflow_ref` dele a esta lista faz parte da
mudança** — não é um passo posterior de configuração.

## Secret Manager

Crie quatro secrets permanentes e três temporários; adicione os valores via console ou `--data-file=-` numa sessão
local. Não coloque o valor na linha de comando:

```bash
for secret in \
  formetric-db-pooler-url \
  formetric-db-direct-url \
  formetric-db-username \
  formetric-db-password \
  formetric-bootstrap-admin-email \
  formetric-bootstrap-admin-password \
  formetric-bootstrap-admin-display-name
do
  gcloud secrets create "$secret" --replication-policy=automatic
done
```

Conceda leitura somente à identidade de runtime e somente nesses secrets:

```bash
for secret in \
  formetric-db-pooler-url \
  formetric-db-direct-url \
  formetric-db-username \
  formetric-db-password \
  formetric-bootstrap-admin-email \
  formetric-bootstrap-admin-password \
  formetric-bootstrap-admin-display-name
do
  gcloud secrets add-iam-policy-binding "$secret" \
    --member="serviceAccount:formetric-runtime@PROJECT_ID.iam.gserviceaccount.com" \
    --role="roles/secretmanager.secretAccessor"
done
```

As URLs devem ser JDBC com TLS obrigatório. A URL `DB_POOLER_URL` usa o hostname
`-pooler`; `DB_DIRECT_URL` usa o endpoint direto e é usada apenas pelo Flyway.

Os três valores de bootstrap precisam existir juntos; inclusive o nome de exibição é
obrigatório no perfil `prod`. Fixe uma versão numérica no deploy. Para rotacionar, crie a nova versão, atualize
`DB_SECRET_VERSION`, implante uma candidata, valide e só então desabilite a anterior.

## Variáveis do GitHub Environment `production`

Configure os nomes de [variables.example.env](variables.example.env). Eles são
identificadores, não conteúdos de secrets. A forma do provider é:

```text
projects/PROJECT_NUMBER/locations/global/workloadIdentityPools/github/providers/formetric-github
```

Não crie `GCP_SERVICE_ACCOUNT_KEY`, não exporte connection strings para o GitHub e não
use o plano de controle do Neon em workflows originados por forks.
