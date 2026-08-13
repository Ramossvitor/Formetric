# Infraestrutura local

O ambiente de desenvolvimento usa PostgreSQL 17 em Docker. É necessário ter Docker com Compose v2 instalado.

Na raiz do repositório, crie a configuração local e inicie o banco:

```powershell
Copy-Item .env.example .env
docker compose --env-file .env -f infra/compose.yaml up -d --wait
```

Por padrão, o banco fica disponível em `localhost:5432`, com database e usuário `formetric`. As credenciais do exemplo são exclusivas para desenvolvimento e podem ser alteradas no arquivo `.env`, que não deve ser versionado.

Para verificar o estado ou encerrar o serviço sem remover os dados:

```powershell
docker compose --env-file .env -f infra/compose.yaml ps
docker compose --env-file .env -f infra/compose.yaml down
```

O volume nomeado `formetric-postgres-data` preserva os dados entre reinicializações. O comando `down --volumes` também remove esse volume e deve ser usado somente quando a perda do banco local for intencional.

## Imagem da aplicação

O `Dockerfile` da raiz compila o frontend com Node.js 24, incorpora a SPA ao backend e gera uma imagem Java 21 executada por um usuário sem privilégios:

```powershell
docker build -t formetric:dev .
```

A configuração de produção usa `DB_POOLER_URL` para as conexões da aplicação,
`DB_DIRECT_URL` para as migrações Flyway, `DB_USERNAME`, `DB_PASSWORD` e
`PORT`. Esses valores devem ser fornecidos ao container como variáveis de
ambiente ou secrets da plataforma; nunca devem ser gravados na imagem.

O primeiro proprietário também deve ser provisionado por secrets
`BOOTSTRAP_ADMIN_EMAIL` e `BOOTSTRAP_ADMIN_PASSWORD`. O bootstrap é idempotente e
essas variáveis devem ser removidas depois que a conta existir. O perfil
`prod` ativa cookie de sessão seguro, limita a sessão a 12 horas e desabilita a
documentação HTTP.
