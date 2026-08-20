# Testes E2E da imagem integrada

O ambiente E2E compila o frontend, incorpora os assets ao JAR, inicia a imagem final
com PostgreSQL 17 e executa Chromium contra `http://127.0.0.1:18080`. Ele não usa Neon,
credenciais de produção nem mocks de rede.

## Fluxos cobertos

- Deep link protegido, redirecionamento ao login, retorno ao destino e refresh.
- Sessão/CSRF reais pelo Spring Security.
- Cadastro de alimento com valores nutricionais.
- Registro proporcional no diário, água, fechamento e persistência após reload.
- Convite via fragmento, remoção do token da URL antes de requests e criação de sessão.
- Isolamento de tenant tanto na busca quanto no acesso direto por identificador.
- Registro de peso, treino e avaliação corporal pelo fluxo real da interface.
- Reflexo de peso e treino no consolidado mensal e série de peso nos gráficos.

Testes determinísticos de regras, fórmulas, matrizes completas de isolamento e erros
continuam nos testes de integração/unitários. Produção recebe somente smoke read-only;
nunca rode a suíte mutável contra o banco real.

## Execução local

Instale o Chromium uma vez:

```powershell
cd frontend
npm ci
npx playwright install chromium
cd ..
```

Suba a imagem integrada e aguarde o health endpoint:

```powershell
docker compose -f infra/compose.e2e.yaml up --build -d
Invoke-WebRequest http://127.0.0.1:18080/actuator/health/readiness
```

Execute os testes:

```powershell
cd frontend
npm run test:e2e
```

Finalize sempre removendo containers e volumes descartáveis:

```powershell
cd ..
docker compose -f infra/compose.e2e.yaml down --volumes --remove-orphans
```

Valores `E2E_ADMIN_*` possuem defaults exclusivos de teste. Para sobrescrevê-los,
defina variáveis locais; nunca reutilize credenciais reais.

## Estabilidade no CI

- Um único worker Chromium mobile-first.
- Datas e timezone controlados.
- Dados exclusivos por tentativa para permitir retry sem conflito.
- Nenhum `waitForTimeout`; readiness e UI são aguardados por polling/assertions.
- Dois retries somente no CI.
- Trace na primeira repetição e screenshot/vídeo somente em falhas.
- Logs dos containers, relatório HTML, traces e SARIF ficam disponíveis por sete dias.

Se o job falhar antes do Playwright, abra primeiro `container-e2e.log`. Se a aplicação
estiver saudável, use o trace para diferenciar falha funcional de seletor/timeout.
