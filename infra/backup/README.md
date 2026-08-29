# Cópia diária do banco

O plano gratuito do Neon guarda um histórico curto — cerca de 6 horas, ou 1 GB de alterações,
o que vier primeiro. Um defeito percebido no dia seguinte já não é recuperável por ele. Esta
cópia externa é o que permite ficar no plano gratuito com dados reais.

**Objetivo acordado:** perder no máximo 24 horas de registros, retenção de 30 dias, e uma
restauração provada antes de convidar as pessoas.

O risco que isso cobre não é "o Neon quebrar sozinho" — é uma migration defeituosa, um bug de
isolamento, um comando de manutenção errado ou uma exclusão acidental alterarem dados reais.

## Onde roda cada peça, e por quê

| Peça | Região | Motivo |
|---|---|---|
| Bucket | `us-central1` | Os 5 GB permanentemente gratuitos do Cloud Storage só existem em `us-central1`, `us-east1` e `us-west1`. |
| Job e agendamento | `southamerica-east1` | Junto da imagem e do banco: o Cloud Run baixa a imagem a cada execução, e na mesma região isso não é cobrado. |

A escolha das regiões é o que mantém o custo em zero, e a intuição aqui engana: parece natural
colocar o job junto do bucket, mas é o arranjo caro. A imagem tem centenas de MB e é baixada
todo dia; o dump cifrado tem poucos MB e sobe uma vez. Vale otimizar para o tráfego da imagem,
não para o do dump.

O Cloud Run Job e o Cloud Scheduler cabem no free tier permanente, e a leitura do Neon entra
como tráfego de entrada, que não é cobrado.

O app e o banco continuam em São Paulo. Só as cópias saem do país, e por isso saem cifradas.

## Como funciona

[backup.sh](backup.sh) roda como Cloud Run Job:

1. `pg_dump --format=custom` no endpoint direto do Neon (o mesmo que o Flyway usa).
2. Cifra com `openssl enc -aes-256-cbc -pbkdf2`.
3. Envia para `gs://BUCKET/formetric/AAAA/MM/DD/formetric-<timestamp>.dump.enc` pela API JSON
   do Cloud Storage, autenticando com o token do metadata server.

Os segredos chegam por `--set-secrets`, como no job de migrations — o script nunca chama a API
do Secret Manager. A imagem parte do `postgres:18-alpine` oficial para garantir um `pg_dump` na
mesma major do servidor: um cliente mais antigo se recusa a exportar de um servidor 18.

A retenção de 30 dias é uma regra de ciclo de vida do bucket, não do script.

> **A frase secreta é indispensável para restaurar.** Ela fica no Secret Manager do mesmo
> projeto — se o projeto for perdido, cópia e chave se perdem juntas. Guarde uma segunda cópia
> fora do Google, num gerenciador de senhas. Sem ela os arquivos são inúteis.

## Provisionamento

Rode uma vez, com uma sessão `gcloud` autenticada. Substitua `PROJECT_ID` e escolha um nome de
bucket global único.

O job tem identidade própria, separada da `formetric-runtime` que atende as requisições da
internet. É o que impede que um vazamento de token pelo app entregue junto a frase que decifra as
cópias: quem serve a aplicação não precisa — e não deve — conseguir lê-la.

```bash
PROJECT_ID="SEU_PROJECT_ID"
BUCKET="formetric-backup-SEU_SUFIXO"
BACKUP_SA="formetric-backup@${PROJECT_ID}.iam.gserviceaccount.com"

# 1. Identidade dedicada ao job de cópia.
gcloud iam service-accounts create formetric-backup \
  --project="$PROJECT_ID" \
  --display-name="Formetric database backup job"

# 2. Bucket privado em região do free tier, com acesso público bloqueado.
gcloud storage buckets create "gs://${BUCKET}" \
  --project="$PROJECT_ID" \
  --location=us-central1 \
  --default-storage-class=STANDARD \
  --uniform-bucket-level-access \
  --public-access-prevention

# 3. Retenção de 30 dias.
cat > /tmp/lifecycle.json <<'JSON'
{"lifecycle":{"rule":[{"action":{"type":"Delete"},"condition":{"age":30}}]}}
JSON
gcloud storage buckets update "gs://${BUCKET}" --lifecycle-file=/tmp/lifecycle.json

# 4. O job só precisa criar objetos — não apagar nem ler. Quem apaga é o ciclo de vida.
gcloud storage buckets add-iam-policy-binding "gs://${BUCKET}" \
  --member="serviceAccount:${BACKUP_SA}" \
  --role="roles/storage.objectCreator"

# 5. Frase secreta da cifra. Gere e guarde uma cópia no seu gerenciador de senhas
#    ANTES de continuar; ela não aparece em lugar nenhum depois disso.
openssl rand -base64 48 | tr -d '\n' | gcloud secrets create formetric-backup-passphrase \
  --project="$PROJECT_ID" --data-file=- --replication-policy=automatic

# 6. Leitura dos segredos: a frase da cifra e as credenciais do banco, só para esta identidade.
for secret in \
  formetric-backup-passphrase \
  formetric-db-direct-url \
  formetric-db-username \
  formetric-db-password
do
  gcloud secrets add-iam-policy-binding "$secret" \
    --project="$PROJECT_ID" \
    --member="serviceAccount:${BACKUP_SA}" \
    --role="roles/secretmanager.secretAccessor"
done
```

A `formetric-runtime` não recebe nenhum destes bindings. Se ela já tiver acesso ao bucket ou à
frase de uma tentativa anterior, remova com `remove-iam-policy-binding` antes de seguir.

### Publicar a imagem

A publicação é feita pelo workflow **Publish backup image**
([publish-backup-image.yml](../../.github/workflows/publish-backup-image.yml)), acionado
manualmente em Actions com a tag desejada. Ele autentica por WIF, sem chave de longa duração, e
publica no repositório `formetric` que já existe — o mesmo do app, em `southamerica-east1`.

Como ele passa pelo Environment `production`, a publicação exige a mesma aprovação humana de um
deploy. É deliberado: esta imagem roda com acesso de leitura ao banco inteiro.

O workflow imprime no resumo a referência `@sha256:` publicada. Use **essa referência imutável**
no passo seguinte, nunca a tag.

### Criar o job e o agendamento

O job fica em `southamerica-east1`, junto da imagem e do banco — **não na região do bucket**. O
Cloud Run baixa a imagem a cada execução: mantê-la na mesma região torna esse tráfego gratuito.
O que atravessa o continente passa a ser só o dump cifrado, de poucos MB. O caminho inverso —
job perto do bucket — puxaria centenas de MB por dia entre continentes e custaria mais do que
todo o resto da solução economiza.

```bash
IMAGE="southamerica-east1-docker.pkg.dev/${PROJECT_ID}/formetric/formetric-backup@sha256:DIGEST"

gcloud run jobs deploy formetric-backup \
  --project="$PROJECT_ID" \
  --region=southamerica-east1 \
  --image="$IMAGE" \
  --service-account="$BACKUP_SA" \
  --set-env-vars="BACKUP_BUCKET=${BUCKET}" \
  --set-secrets="DB_DIRECT_URL=formetric-db-direct-url:1,DB_USERNAME=formetric-db-username:1,DB_PASSWORD=formetric-db-password:1,BACKUP_PASSPHRASE=formetric-backup-passphrase:1" \
  --cpu=1 --memory=512Mi \
  --max-retries=2 --parallelism=1 --tasks=1 --task-timeout=15m

# Cloud Scheduler dá 3 jobs grátis por conta de faturamento; este é o único.
# 03:00 em São Paulo, quando ninguém está registrando refeição.
gcloud scheduler jobs create http formetric-backup-diario \
  --project="$PROJECT_ID" \
  --location=southamerica-east1 \
  --schedule="0 3 * * *" \
  --time-zone="America/Sao_Paulo" \
  --uri="https://southamerica-east1-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/${PROJECT_ID}/jobs/formetric-backup:run" \
  --http-method=POST \
  --oauth-service-account-email="$BACKUP_SA"
```

O Scheduler precisa poder disparar o job:

```bash
gcloud run jobs add-iam-policy-binding formetric-backup \
  --project="$PROJECT_ID" --region=southamerica-east1 \
  --member="serviceAccount:${BACKUP_SA}" \
  --role="roles/run.invoker"
```

## Alerta de falha — o job não pode quebrar em silêncio

A regra de ciclo de vida apaga por idade, não por "existe cópia mais nova": um job que pare de
rodar não interrompe a exclusão das antigas. Trinta dias de falha silenciosa — rotação de segredo,
mudança de major do Postgres, cota estourada — deixam o bucket vazio sem ninguém perceber. O alerta
abaixo é parte do provisionamento, não um extra.

```bash
# Canal de notificação por e-mail (uma vez por projeto).
gcloud beta monitoring channels create \
  --project="$PROJECT_ID" \
  --display-name="Formetric alertas" \
  --type=email \
  --channel-labels=email_address=SEU_EMAIL

CHANNEL="$(gcloud beta monitoring channels list --project="$PROJECT_ID" \
  --filter='displayName="Formetric alertas"' --format='value(name)')"

# Alerta por execução falha do job.
gcloud alpha monitoring policies create --project="$PROJECT_ID" --policy-from-file=- <<JSON
{
  "displayName": "Backup do banco falhou",
  "combiner": "OR",
  "conditions": [{
    "displayName": "Execução do formetric-backup com erro",
    "conditionMatchedLog": {
      "filter": "resource.type=\"cloud_run_job\" resource.labels.job_name=\"formetric-backup\" severity>=ERROR"
    }
  }],
  "alertStrategy": { "notificationRateLimit": { "period": "3600s" } },
  "notificationChannels": ["${CHANNEL}"]
}
JSON
```

Isso cobre o job que roda e falha. **Não cobre o job que deixa de ser disparado** — para isso,
confira o bucket junto do teste de restauração e sempre que repetir esse teste: a data do objeto
mais recente é a resposta.

```bash
gcloud storage ls --long "gs://${BUCKET}/formetric/**" | tail -3
```

## Restauração — o teste obrigatório antes do convite

**A cópia só conta como pronta depois deste teste.** Ele restaura numa branch descartável do
Neon; a branch `production` não é tocada em momento nenhum.

```bash
# 1. Baixe a cópia mais recente.
gcloud storage ls "gs://${BUCKET}/formetric/**" | tail -1
gcloud storage cp "gs://${BUCKET}/formetric/AAAA/MM/DD/ARQUIVO.dump.enc" /tmp/backup.enc

# 2. Decifre com a frase do Secret Manager. Ela entra por descritor de arquivo e não toca o
#    disco: um erro nos passos seguintes não deixa a chave em claro na sua máquina.
openssl enc -d -aes-256-cbc -pbkdf2 -iter 600000 \
  -in /tmp/backup.enc -out /tmp/backup.dump \
  -pass fd:3 3< <(gcloud secrets versions access latest \
    --secret=formetric-backup-passphrase --project="$PROJECT_ID")

# 3. Crie uma branch descartável no Neon e pegue a URL direta dela.
#    Restaure com a versão 18 do cliente.
pg_restore --no-owner --no-privileges -d "postgresql://USUARIO:SENHA@HOST_DA_BRANCH/formetric?sslmode=require" /tmp/backup.dump

# 4. Confirme que os dados vieram, tabela a tabela.
psql "postgresql://.../formetric?sslmode=require" -c "
  SELECT 'user_accounts' AS tabela, count(*) FROM user_accounts
  UNION ALL SELECT 'daily_logs', count(*) FROM daily_logs
  UNION ALL SELECT 'meals', count(*) FROM meals
  UNION ALL SELECT 'meal_items', count(*) FROM meal_items
  UNION ALL SELECT 'water_logs', count(*) FROM water_logs
  UNION ALL SELECT 'food_versions', count(*) FROM food_versions
  UNION ALL SELECT 'recipe_versions', count(*) FROM recipe_versions
  UNION ALL SELECT 'weight_logs', count(*) FROM weight_logs
  UNION ALL SELECT 'workouts', count(*) FROM workouts
  UNION ALL SELECT 'body_evaluations', count(*) FROM body_evaluations;"

rm -f /tmp/backup.dump /tmp/backup.enc
```

O bloco usa substituição de processo (`3< <(…)`), então rode-o no **bash**, não no `sh`.

**Critério de aceite:** as contagens batem com a produção e a branch descartável é apagada em
seguida. Registre a data do teste; repita depois de qualquer mudança no schema que altere
tabelas existentes.

## Limites que valem saber

- **A perda máxima é de 24 horas.** Registros feitos depois da última execução se perdem num
  desastre. Foi a escolha explícita para o piloto de 10 pessoas.
- **A restauração é manual.** Não há botão de "voltar no tempo"; alguém executa o procedimento
  acima. Para um piloto, isso é aceitável; para uso mais amplo, não é.
- **A URL do banco no segredo precisa ser JDBC com parâmetros válidos de libpq.** O script tira
  o prefixo `jdbc:` e entrega o resto ao `pg_dump`. Um parâmetro exclusivo do driver Java faz o
  job falhar em vez de conectar sem TLS — o comportamento desejado. O `PGSSLMODE=require` exportado
  pelo script garante a cifra mesmo que a URL não traga parâmetro de TLS nenhum.
- **O dump cabe na memória do container, não em disco.** `/tmp` no Cloud Run é tmpfs: o arquivo em
  claro e a cópia cifrada ocupam RAM ao mesmo tempo, dentro dos `--memory=512Mi` do job. Para dez
  pessoas sobra folga, mas a falha, quando vier, é um OOM de madrugada e sem cópia daquele dia.
  Acompanhe o tamanho impresso na última linha do log: passando de ~150 MB, aumente `--memory`
  antes de continuar, ou migre para upload resumable com `pg_dump | openssl | curl` em fluxo.
- **A imagem é fixada por digest, e atualizá-la são três passos.** Refixe o digest do
  `postgres:18-alpine` no [Dockerfile](Dockerfile), publique pelo workflow **Publish backup
  image** com uma **tag nova** — a anterior é recusada, publicar é sempre criar — e reimplante o
  job com a nova referência `@sha256:`. Parar no primeiro passo não muda nada em produção: o
  Cloud Run continua puxando o digest antigo.

## Documentos relacionados

- [../cloud-run/README.md](../cloud-run/README.md): baseline de Cloud Run e Neon.
- [../cloud-run/migrations-and-rollback.md](../cloud-run/migrations-and-rollback.md): política
  de banco e retorno.
