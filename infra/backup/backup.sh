#!/bin/sh
# Cópia diária do PostgreSQL para um bucket privado do Cloud Storage.
#
# Roda como Cloud Run Job. Os segredos chegam por `--set-secrets`, do mesmo jeito que no job
# de migrations, então este script nunca chama a API do Secret Manager. O upload usa a API
# JSON do Cloud Storage com o token do metadata server, o que dispensa a CLI do gcloud e
# mantém a imagem pequena e com o pg_dump na mesma major do servidor.
set -eu

fail() { echo "backup: $1" >&2; exit 1; }

: "${BACKUP_BUCKET:?BACKUP_BUCKET não definido}"
: "${DB_DIRECT_URL:?DB_DIRECT_URL não definido}"
: "${DB_USERNAME:?DB_USERNAME não definido}"
: "${DB_PASSWORD:?DB_PASSWORD não definido}"
: "${BACKUP_PASSPHRASE:?BACKUP_PASSPHRASE não definido}"

# O segredo guarda uma URL JDBC porque é ela que o Flyway consome. Tirar o prefixo `jdbc:`
# devolve uma URI que o libpq entende. Parâmetros exclusivos do driver JDBC não podem estar
# na URL: o pg_dump abaixo falha, de propósito, em vez de conectar sem TLS.
CONNECTION="${DB_DIRECT_URL#jdbc:}"
case "$CONNECTION" in
  postgresql://*|postgres://*) ;;
  *) fail "DB_DIRECT_URL não é uma URL JDBC PostgreSQL" ;;
esac

STAMP="$(date -u +%Y-%m-%dT%H-%M-%SZ)"
OBJECT="formetric/$(date -u +%Y/%m/%d)/formetric-${STAMP}.dump.enc"
DUMP="$(mktemp)"
ENCRYPTED="$(mktemp)"
trap 'rm -f "$DUMP" "$ENCRYPTED"' EXIT

export PGUSER="$DB_USERNAME"
export PGPASSWORD="$DB_PASSWORD"
export PGCONNECT_TIMEOUT=30
# Sem isto o libpq usaria `sslmode=prefer` e aceitaria texto claro quando a URL do segredo não
# trouxer parâmetro de TLS. A recusa de conectar sem cifra passa a ser garantia do job, não do
# conteúdo do Secret Manager.
export PGSSLMODE=require

echo "backup: gerando dump"
pg_dump --format=custom --no-owner --no-privileges --file="$DUMP" "$CONNECTION" \
  || fail "pg_dump falhou"

# O bucket fica nos EUA e o conteúdo é dado de saúde, então o arquivo sai cifrado daqui.
# A frase secreta é indispensável para restaurar: guarde uma cópia fora do projeto.
echo "backup: cifrando"
openssl enc -aes-256-cbc -pbkdf2 -iter 600000 -salt \
  -in "$DUMP" -out "$ENCRYPTED" -pass env:BACKUP_PASSPHRASE \
  || fail "openssl falhou"

# O status desta substituição é o do `sed`, não o do `curl`, então quem detecta a falha é a
# checagem de token vazio abaixo — ela cobre tanto metadata fora do ar quanto resposta inesperada.
TOKEN="$(
  curl -sS --fail --max-time 30 -H 'Metadata-Flavor: Google' \
    'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token' \
    | sed -n 's/.*"access_token"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p'
)"
[ -n "$TOKEN" ] || fail "não foi possível obter o token da service account no metadata server"

echo "backup: enviando ${OBJECT} (${BACKUP_BUCKET})"
ENCODED_NAME="$(printf '%s' "$OBJECT" | sed 's|/|%2F|g')"
curl -sS --fail-with-body --retry 3 --retry-connrefused --max-time 900 \
  -X POST \
  -H "Authorization: Bearer ${TOKEN}" \
  -H 'Content-Type: application/octet-stream' \
  --data-binary "@${ENCRYPTED}" \
  "https://storage.googleapis.com/upload/storage/v1/b/${BACKUP_BUCKET}/o?uploadType=media&name=${ENCODED_NAME}" \
  >/dev/null || fail "upload recusado pelo Cloud Storage"

echo "backup: concluído — gs://${BACKUP_BUCKET}/${OBJECT} ($(wc -c < "$ENCRYPTED") bytes)"
