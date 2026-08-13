# Formetric Web

Interface web mobile-first do Formetric, construída com React, TypeScript e Vite.

## Desenvolvimento

Pré-requisitos: Node.js 22 ou superior e npm.

```bash
npm install
npm run dev
```

Durante o desenvolvimento, chamadas para `/api` são encaminhadas para
`http://localhost:8080`.

## Verificações

```bash
npm run lint
npm test
npm run typecheck
npm run build
```

`npm run check` executa tipagem, lint e testes em sequência.

## Estado atual

A tela inicial é uma demonstração estática da direção visual do produto. Os valores
exibidos são deliberadamente marcados como ilustrativos e ainda não representam dados
persistidos ou respostas da API.
