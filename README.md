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

## Stack prevista

- Java 21 e Spring Boot
- Spring Security, Spring Data JPA, Flyway e Spring Modulith
- PostgreSQL
- React, TypeScript e Vite
- TanStack Query, React Hook Form e Zod
- Tailwind CSS, shadcn/ui e Recharts
- JUnit, Testcontainers, Vitest e Playwright
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

Os comandos definitivos serão adicionados junto com o scaffolding. O ambiente exigirá:

- JDK 21
- Node.js LTS
- Docker Desktop com Docker Compose
- Git

Nenhuma credencial deve ser commitada. Variáveis locais devem ficar em arquivos
`.env` ignorados pelo Git; exemplos seguros serão disponibilizados em `.env.example`.

## Contribuição

Consulte [CONTRIBUTING.md](CONTRIBUTING.md) para convenções de commits, validação
e fluxo de branches.

## Licença

Este repositório não possui uma licença de uso no momento.
