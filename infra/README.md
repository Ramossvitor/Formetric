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

A configuração de produção, incluindo `SPRING_DATASOURCE_URL`, `SPRING_DATASOURCE_USERNAME` e `SPRING_DATASOURCE_PASSWORD`, deve ser fornecida ao container como variáveis de ambiente ou secrets da plataforma; ela nunca deve ser gravada na imagem.
