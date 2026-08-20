# Formetric

Formetric é uma plataforma para acompanhar, em um só lugar, nutrição, atividade
física e evolução corporal. O objetivo não é apenas contar calorias, mas relacionar
o que foi consumido e treinado com mudanças de peso, medidas e composição corporal
ao longo do tempo.

> O projeto está em construção e ainda não deve ser usado para decisões clínicas ou
> como substituto de acompanhamento profissional.

## Princípios do produto

O domínio separa explicitamente três conceitos:

- **Dado:** aquilo que o usuário registrou, como peso ou uma refeição.
- **Cálculo:** resultado determinístico do sistema, como saldo energético ou média móvel.
- **Interpretação:** explicação contextual, futuramente auxiliada por algoritmos ou IA.

Essa separação mantém os resultados reproduzíveis e impede que cálculos essenciais
dependam de modelos probabilísticos.

## Arquitetura

O Formetric nasce como um monólito modular, com uma API única e banco relacional.
Essa estrutura reduz o custo operacional do MVP sem misturar as responsabilidades do
domínio.

```text
React Web
   │ REST / OpenAPI
   ▼
Spring Boot
   ├── identity
   ├── catalog
   ├── diary
   ├── planning
   ├── activity
   ├── body
   └── analytics
        │
        └── PostgreSQL
```

O repositório será organizado como monorepo:

```text
backend/   aplicação Java e regras de negócio
frontend/  aplicação React responsiva
infra/     ambiente local e definições de deploy
```

## Stack

- Java 21 e Spring Boot 4.1
- Spring Security, Spring Data JPA, Flyway, Spring Modulith e springdoc-openapi
- PostgreSQL
- React 19, TypeScript e Vite 8
- JUnit, Testcontainers, Vitest e Testing Library
- Docker e GitHub Actions

## Roadmap

1. Fundação do monorepo, build integrado e ambiente local.
2. Autenticação por convite, perfil e isolamento multiusuário.
3. Metas nutricionais e TDEE com vigência histórica.
4. Catálogo de alimentos, porções e receitas versionadas.
5. Diário alimentar, água, cópia de refeições e fechamento do dia.
6. Treinos, histórico de peso e tendência.
7. Avaliações corporais e comparação de evolução.
8. Dashboards diário e mensal, analytics e primeiro deploy.

Fotografias privadas, calendário, ciclos, OCR, relatórios em PDF, integrações
com bases externas e assistente de IA ficam para fases posteriores.

## Desenvolvimento local

O ambiente exige:

- JDK 21
- Node.js 24 LTS
- Docker Desktop com Docker Compose
- Git

Inicie o PostgreSQL:

```powershell
Copy-Item .env.example .env
docker compose --env-file .env -f infra/compose.yaml up -d --wait
```

Execute o backend em um terminal:

```powershell
cd backend
$env:BOOTSTRAP_ADMIN_EMAIL="seu-email@exemplo.com"
$env:BOOTSTRAP_ADMIN_PASSWORD="uma-senha-local-com-12-ou-mais-caracteres"
$env:BOOTSTRAP_ADMIN_DISPLAY_NAME="Seu nome"
.\mvnw.cmd spring-boot:run
```

Essas variáveis criam o primeiro usuário `OWNER` de forma idempotente. Depois do
primeiro acesso, remova-as do ambiente: novos usuários devem entrar somente por
convites criados pelo proprietário. Use valores reais apenas no shell local, no
arquivo `.env` ignorado ou no gerenciador de secrets do ambiente; nunca os versione.

Execute o frontend em outro terminal:

```powershell
cd frontend
npm install
npm run dev
```

O frontend fica em `http://localhost:5173` e encaminha `/api` para o backend em
`http://localhost:8080`. Swagger UI fica em `http://localhost:8080/swagger-ui.html`.
O acesso é privado e não existe cadastro público.

Para executar todas as verificações locais:

```powershell
cd frontend
npm run check
npm run build

cd ..\backend
.\mvnw.cmd verify
```

Os testes de contexto do backend usam Testcontainers e, portanto, precisam do Docker
ativo. Consulte [infra/README.md](infra/README.md) para detalhes do banco e da imagem,
[infra/E2E.md](infra/E2E.md) para o teste do contêiner integrado e
[infra/cloud-run/README.md](infra/cloud-run/README.md) para a baseline privada no
Cloud Run + Neon. O runbook de Cloud Run não é uma automação genérica para migrations
posteriores.

Nenhuma credencial deve ser commitada. Variáveis locais devem ficar em arquivos
`.env` ignorados pelo Git; exemplos seguros serão disponibilizados em `.env.example`.

## Contribuição

Consulte [CONTRIBUTING.md](CONTRIBUTING.md) para convenções de commits, validação
e fluxo de branches.

## Licença

Este repositório não possui uma licença de uso no momento.
