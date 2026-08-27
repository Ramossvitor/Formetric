# Go-live do piloto privado

Sequência do zero até as primeiras pessoas usando o Formetric com dados reais. O alvo é um
**piloto privado**: você e cerca de dez pessoas conhecidas, na URL `run.app`, sem domínio
próprio e sem cadastro público.

Os outros documentos explicam *como* cada peça funciona. Este explica **em que ordem** executar
e **como saber que deu certo**. Cada passo tem um critério de aceite; não avance sem ele.

> O que este documento não faz: substituir os detalhes de
> [wif-and-secrets.md](wif-and-secrets.md), [README.md](README.md),
> [migrations-and-rollback.md](migrations-and-rollback.md) e [../backup/README.md](../backup/README.md).
> Ele encadeia os quatro.

## Antes de começar

Você vai precisar de uma conta Google Cloud **com faturamento habilitado**. Não existe caminho
"Cloud Run sem cartão": o cartão é exigido para habilitar o serviço, mesmo que o consumo do
piloto fique inteiramente dentro do free tier permanente. O Neon e o GitHub não pedem cartão.

Espere uma conta de poucos centavos por mês — vem do armazenamento de imagens no Artifact
Registry acima de 0,5 GB e das versões de segredo acima de seis. Configure o alerta de orçamento
do passo 1 assim mesmo: ele é o que impede que um erro de configuração vire outra coisa.

## 1. Fundação na nuvem

1. Crie ou selecione o projeto Google Cloud, habilite o faturamento e configure **budget alert
   e spend cap** antes de qualquer outra coisa.
2. Crie o projeto Neon com PostgreSQL 17 na região AWS São Paulo e uma branch `production`.
3. Teste todas as migrations numa branch Neon descartável e apague-a em seguida.
4. Crie Artifact Registry, service accounts, pool WIF e secrets conforme
   [wif-and-secrets.md](wif-and-secrets.md).

> **Atenção ao WIF.** A `attribute-condition` do provider precisa aceitar os **dois** workflows
> que implantam: `deploy-candidate.yml` e `deploy-release.yml`. Ambos autenticam no mesmo
> provider. Se só o primeiro estiver na lista, o deploy de release falha na autenticação do
> Google — e falha tarde, depois de o revisor já ter aprovado o Environment.

**Aceite:** `gcloud iam workload-identity-pools providers describe` mostra os dois `workflow_ref`
na condição, e os quatro secrets permanentes existem com uma versão cada.

## 2. GitHub Environment

1. Crie o Environment `production` com **aprovação manual obrigatória** e restrição à branch
   `main`.
2. Preencha as *variables* do Environment com os nomes de
   [variables.example.env](variables.example.env). São identificadores públicos — nenhum valor
   secreto entra aqui.

**Aceite:** `gh variable list --env production` lista todas as chaves do arquivo de exemplo, e
`gh api repos/:owner/:repo/environments` mostra o `production` com revisor exigido.

## 3. Baseline e primeiro proprietário

Pré-crie o serviço privado de manutenção e a permissão de invocação específica do deploy
([wif-and-secrets.md](wif-and-secrets.md)). Confirme que o SHA que você vai implantar tem
execução verde do workflow `CI`.

O bootstrap acontece em duas revisões, e essa separação é o ponto do procedimento — a primeira
revisão carrega os três secrets temporários do proprietário, a segunda os remove:

1. Execute `Deploy initial production candidate` com `confirmation=DEPLOY_INITIAL_BASELINE`,
   `bootstrap_owner=true` e `promote=false`.
2. Revise health, logs e a criação idempotente do proprietário. **Não exponha a revisão.**
3. Execute de novo, no mesmo SHA, com `bootstrap_owner=false` e `promote=false`. Este deploy
   remove explicitamente os três bindings de bootstrap.
4. Confirme com `gcloud run revisions describe` que nenhum env da revisão limpa referencia
   `BOOTSTRAP_ADMIN_*` em `valueFrom`.
5. Desabilite as três versões temporárias de secret e exclua a revisão que ainda as referencia.

**Aceite:** existe uma revisão sem nenhum `BOOTSTRAP_ADMIN_*`, e é a única candidata a receber
tráfego ou a servir de rollback. A revisão de bootstrap nunca é alvo de rollback.

## 4. Cópia do banco, antes de qualquer dado real

Provisione o job diário e **execute o teste de restauração** conforme
[../backup/README.md](../backup/README.md).

Este passo vem antes do convite de propósito: a partir do momento em que as pessoas entram, os
dados são reais e insubstituíveis. Guarde uma cópia da frase secreta da cifra fora do Google,
num gerenciador de senhas — sem ela as cópias são inúteis.

O job usa identidade própria, `formetric-backup`, e não a `formetric-runtime` do serviço: só ela lê
a frase da cifra e escreve no bucket. Configure também o **alerta de falha** descrito no mesmo
documento — o ciclo de vida apaga cópias por idade mesmo quando nenhuma nova chega, então um job
quebrado em silêncio esvazia o bucket em trinta dias.

**Aceite:** o job rodou pelo menos uma vez, existe um objeto no bucket, você restaurou esse objeto
numa branch descartável do Neon com as contagens batendo, e a política de alerta aparece em
`gcloud alpha monitoring policies list`. Registre a data do teste.

## 5. Checklist de exposição

Antes de conceder acesso público à URL (necessário mesmo num piloto privado — as pessoas
precisam alcançar a tela de login pela internet; quem autoriza de fato é o Spring Security):

- Cookies `Secure`, headers, CORS/CSRF conferidos, e nada de Swagger ou Actuator além de health
  no perfil `prod`.
- Restauração provada no passo 4.
- **Limitação conhecida do rate limiter:** ele ignora `X-Forwarded-For` de propósito
  ([LoginRequestOriginResolver.java](../../backend/src/main/java/dev/formetric/identity/LoginRequestOriginResolver.java)),
  porque não há cadeia de proxy confiável provisionada. Atrás do Cloud Run isso faz o balde por
  IP colapsar num só, e quem protege de fato é o limite global de falhas de login. Para dez
  pessoas convidadas, com `max-instances=1`, é adequado. **É um bloqueador antes de qualquer
  abertura ampla** — abrir cadastro público exige limiter compartilhado ou proteção de edge.

Só então:

```bash
gcloud run services add-iam-policy-binding formetric \
  --project=PROJECT_ID --region=southamerica-east1 \
  --member="allUsers" --role="roles/run.invoker"
```

E execute o workflow com `bootstrap_owner=false` e `promote=true`.

**Aceite:** a URL `run.app` abre a tela de login, um deep link da SPA responde, e uma chamada de
sessão anônima retorna 401.

## 6. Convidar as dez pessoas

Entre como proprietário e use **Configurações → Convites** (`/settings/invitations`).

O convite **não é enviado por e-mail**: a API devolve o token na resposta e a tela o exibe. Você
copia e entrega por um canal privado, junto com o link `/accept-invite`. A pessoa define nome e
senha ao aceitar.

Combine com quem vai testar, antes de entregar o token:

- É um piloto; pode haver incidentes.
- No pior caso, a recuperação volta o banco para a madrugada anterior — até um dia de registros
  pode se perder e precisar ser refeito.
- O produto não serve para decisão clínica.

**Aceite:** cada pessoa entrou, criou o próprio perfil e registrou um dia. Confirme no dia
seguinte que a cópia automática rodou com os dados reais dentro.

## Depois do go-live

- **Releases seguintes** usam o workflow `Deploy release`, nunca o de baseline. Ele aplica as
  migrations num Cloud Run Job antes de criar a revisão — veja
  [migrations-and-rollback.md](migrations-and-rollback.md).
- **Rollback** só aponta para uma revisão limpa. Uma migration já aplicada não volta sozinha:
  releitura obrigatória do documento de migrations antes de qualquer reversão.
- **Repita o teste de restauração** depois de qualquer mudança de schema que altere tabelas
  existentes.
- **Custo:** acompanhe CU-hours, storage e transferência no Neon, e mantenha a limpeza do
  Artifact Registry preservando ao menos três imagens válidas.
