# PRINCIPIOS

1. Corrigir a causa, não o sintoma: 16px nos campos mata o zoom do iOS; `maximum-scale=1` só esconde e quebra acessibilidade.
2. Zero dependência nova no runtime. O app tem 7 dependências de produção; tudo o que é proposto (Sheet, Toast, Skeleton, Field, parseDecimal, swipe, error boundary) cabe em ~400 linhas próprias. Única exceção avaliada: vite-plugin-pwa como devDependency.
3. Reusar o que já existe no repo antes de criar: `.settings-link-list`, `.filter-chip`, `.inline-empty-state`, `.sticky-form-actions`, `.quick-action-grid`, `useDebouncedValue`, o gerenciamento de foco já correto de `ActivityDialog.tsx:17-30`, o padrão de CSS de feature de `NutritionGoals.css`.
4. Cada onda é revertível sozinha. Correção pontual de CSS nunca viaja no mesmo PR que refatoração estrutural — um rollback jamais pode levar junto uma correção que estava funcionando.
5. Movimento informa, não enfeita: sem count-up em números nutricionais, sem stagger, sem animação em troca de data/filtro, sem keyframe disparado por classe de estado, nenhuma animação infinita além do spinner.
6. Nada de dado nutricional velho apresentado como atual: sem cache de /api no service worker, sem persistência do React Query enquanto não houver buster por usuário.
7. Toda mudança de UI precisa ser verificável: guardas numéricos em Playwright (overflow, 16px, alvo de toque, distância entre destrutivas) valem mais que captura de tela; safe-area e zoom do iOS só se provam em iPhone real.

# DESCARTADOS

1. Tailwind CSS — reescreveria os ~330 contratos de classe em 40 arquivos .tsx, dos quais 7 são consultados por closest()/querySelector nos testes (CatalogPages.test.tsx:322 usa .closest('div')); é migração tudo-ou-nada, sem entrega intermediária, com o app no ar num piloto, e adiciona build de CSS a um projeto que hoje não tem PostCSS nenhum.

2. CSS Modules — o estilo do app é intrinsecamente transversal (.surface-card em 73 pontos, .field-group em 79, e o bloco @media 840px alcança 15 componentes de uma vez sem ter dono); forçaria :global() em toda regra transversal ou prop-drilling de className.

3. motion / framer-motion (~34 KB gzip) — resolveria essencialmente uma coisa, AnimatePresence para a saída dos sheets, que custa ~15 linhas de CSS + useEffect. Layout animations, elemento compartilhado e drag não têm uso neste app. Seria a primeira dependência de animação de um app que hoje tem zero.

4. vaul / @radix-ui/react-dialog (~22-39 KB gzip) — o <dialog> nativo entrega trava de foco, restauração, Escape, inert e top layer com 0 KB, e o repo é declaradamente sem biblioteca de componentes; introduzir Radix por um único componente abriria a porta para o segundo e o terceiro.

5. body-scroll-lock / react-remove-scroll — showModal() já bloqueia a rolagem de fundo em Chromium e Safari 15.4+; o resíduo resolve-se com uma linha de overscroll-behavior: contain e, se um aparelho real ainda vazar, um hook de 20 linhas que as libs genéricas não saberiam fazer certo (index.css:48 tem scroll-behavior: smooth, então restaurar o scrollY exige behavior: 'instant').

6. sonner / react-hot-toast — traz sistema de estilo próprio que briga com as ~330 classes flat e com os tokens de index.css; a necessidade real (mensagem, tom, ação Desfazer, aria-live, pausa em background) cabe em ~110 linhas reusando --surface-raised/--shadow-floating/--danger-soft.

7. react-error-boundary (~1,5 KB) — o AppErrorBoundary prescrito tem ~35 linhas e cobre exatamente os dois casos necessários; o useErrorBoundary imperativo não é pedido por nenhum caso do repo.

8. react-number-format / imask — máscara decimal cria bugs de posição de cursor ao editar no meio do número, atrapalha colar valor de laudo e confunde leitor de tela; type=text + inputMode=decimal + parseDecimal de 12 linhas resolve o mesmo problema. Máscara só se justificaria para formatos rígidos (CPF, telefone), que o app não tem.

9. Recharts (~95 KB) / Victory (~180 KB) — nenhuma resolve sozinha os dois problemas reais do gráfico (rótulos em escala e leitura por toque); as três mudanças no TimeSeriesChart entregam mais por ~40 linhas. Só reconsiderar se surgirem zoom/pan, brush de período ou séries sobrepostas.

10. stylelint (+config, ~2,5 MB em node_modules) — o teste estático de ~60 linhas em vitest cobre exatamente as 5 regras que importam para este repo, roda dentro do npm test que o CI já executa e reporta arquivo:linha; um linter genérico traria centenas de avisos irrelevantes num arquivo legado e viraria ruído ignorado.

11. View Transition API — verificado em node_modules: o viewTransition do react-router 7 só é lido dentro de RouterProvider e o app usa <BrowserRouter> declarativo; o React 19.2.8 instalado não exporta ViewTransition; e startViewTransition à mão captura o spinner do Suspense das 8 rotas lazy e congela o app numa tela de carregamento. Substituído por cross-fade de 220ms com key no pathname.

12. transition-behavior: allow-discrete + overlay para a SAÍDA do sheet — overlay ainda não é transicionável no WebKit e sem ele o .close() tira o elemento da top layer no mesmo frame, então a animação de saída não roda no iPhone, que é o alvo. Substituído por data-closing + setTimeout(190ms). O @starting-style permanece, mas só para a entrada.

13. dvh em containers de preenchimento (body, #root, .app-shell, .page, .route-status, .auth-page) — altura dinâmica reflui a cada pixel de animação da barra de URL, que é exatamente o pulo de layout a evitar; svh não tem lacuna visível porque html/body propagam --background para o canvas. dvh fica só nos sheets roláveis, onde o reflow é absorvido pelo scroll interno.

14. maximum-scale=1 / user-scalable=no no viewport — esconde o sintoma, quebra o pinch-zoom de acessibilidade e o iOS 10+ ignora em muitos contextos. A causa é font-size < 16px e é ela que se corrige.

15. 16px só no mobile via media query — nenhuma query (pointer: fine, hover: hover, min-width) separa com segurança iPad com Magic Keyboard ou notebook com tela sensível de desktop, e nesses aparelhos o bug volta em produção. O ganho seria de 2-3px de densidade.

16. Persistir o cache do React Query em localStorage (@tanstack/query-sync-storage-persister) — o código se esforça para nunca deixar dado de uma conta vazar para outra (queryClient.clear() em ProtectedRoute.tsx:31 e queries.ts:23); persistir grava dado de saúde em disco e desfaz a proteção. Se um dia for feito, obrigatoriamente com buster contendo o user.id, removeClient() nos dois pontos e maxAge curto.

17. runtimeCaching de /api no service worker — Cache Storage é por ORIGEM, não por usuário: numa app multi-tenant com convites, qualquer resposta cacheada sobreviveria ao logout e seria legível pela próxima conta no mesmo dispositivo; e dado nutricional velho servido como atual é o pior modo de falha num app de dieta.

18. Web Push e Background Sync para mutações offline — o backend não tem infra de push, no iOS só funciona com o PWA instalado, e duplicar uma refeição registrada é dano real ao dado (a API não tem semântica de deduplicação para isso).

19. Splash screens iOS (apple-touch-startup-image) — exigiriam ~20 PNGs, um por resolução de device, regerados a cada iPhone novo; o iOS 17+ já monta o splash a partir de background_color + ícone do manifest.

20. screenshots no manifest — só enfeita o diálogo rico de instalação do Chrome; irrelevante para 10 usuários. Pode entrar quando abrir para mais gente.

21. Capacitor agora — o WebView carrega de https://localhost / capacitor://localhost, então toda chamada a /api vira cross-origin, não há config de CORS no SecurityConfiguration, e cookies cross-site exigiriam SameSite=None que o WKWebView bloqueia por ITP: obriga a reescrever a autenticação antes de qualquer coisa.

22. Swipe-para-voltar e swipe-para-excluir em linha de lista — o primeiro colide com o gesto de borda do sistema e exigiria transição interativa com rubber-banding (inviável sem lib de animação); o segundo é gesto destrutivo, e gesto destrutivo sem Desfazer maduro é pior que os botões pequenos de hoje.

23. Arrastar o sheet para baixo para fechar — 80 a 120 linhas de estado imperativo (pointer events, touch-action, threshold de velocidade, ignorar quando scrollTop > 0, aria-hidden durante o arrasto), e um sheet mal implementado que engole o scroll é pior que sheet sem arrasto. Entregar antes o Fechar de 44px, o Escape, o backdrop e a animação.

24. Count-up animado em números nutricionais e animação de traço no TimeSeriesChart — são dados de saúde: o usuário lê, não assiste. O gráfico é redesenhado a cada troca de filtro, e animá-lo seria animar justamente a interação mais repetida.

25. Extrair componentes Button, Card e PageHeader — 103 + 73 + 20 pontos de chamada para zero bug corrigido; tudo que essas classes precisam são ~6 declarações CSS (:active, transition, min-height sob pointer: coarse, hover guard) nas classes que já existem. Um Card que insira ou remova um <div> quebra CatalogPages.test.tsx:322.

26. Um-campo-por-tela no formulário corporal — 40 campos virariam 40 avanços. A alternativa adotada é agrupar com <details> nativo (zero JS) e dividir o passo 3, que hoje concentra ~25 controles.

# DECISOES PENDENTES

## Fonte: carregar Inter Variable auto-hospedada (~70-110 KB woff2) ou assumir a stack de sistema e normalizar os 11 pesos para 4? Hoje o CSS pede Inter e 7 pesos não-canônicos, mas a fonte nunca é carregada — o app tem aparência diferente por plataforma.
Opcoes: Stack de sistema (SF Pro / Roboto / Segoe UI), pesos 400/500/600/700, zero bytes | Inter Variable auto-hospedada em public/fonts, mantendo os pesos intermediários | Manter como está (pior dos dois mundos: o CSS aposta em pesos que não existem)
Recomendacao: Stack de sistema para o piloto. Zero bytes no caminho crítico, renderização nativa por plataforma — que é literalmente a queixa 3 do usuário — e nada de origem externa quebrando o PWA offline. A perda real é que 500 e 600 só são confiáveis no iOS/macOS; se o design pedir hierarquia mais fina depois do piloto, a Inter entra numa segunda etapa sem retrabalho (os tokens --weight-* não mudam).

## Subir a sessão de produção de 12h para 30 dias e tornar o cookie persistente (SecurityConfiguration.java:136-145 nunca chama setCookieMaxAge, application-prod.yml:19-29 usa 12h)? É afrouxamento consciente de segurança.
Opcoes: 30 dias com cookie persistente | Manter 12h e aceitar que o PWA instalado peça senha quase todo dia | Meio-termo: 7 dias
Recomendacao: 30 dias. Sem isso a sensação de app nativo não se sustenta: um diário alimentar que pede senha diariamente é abandonado. Os mitigantes já existem — cookie HttpOnly + Secure + SameSite=Lax, Argon2 e o AuthenticatedSessionRevalidationFilter revalidando a identidade a cada requisição, então sessão longa não vira sessão órfã. Verificar antes se algum teste de backend asserta 12h.

## Recompor a arquitetura de navegação agora (Perfil vira menu 'Mais', /progress vira tela-hub nova, Treinos ganha alcance) ou entregar só o mínimo (botão voltar contextual no header + destinos faltantes dentro do Perfil)?
Opcoes: Recomposição completa: bottom-nav Hoje/Diário/Evolução-hub/Mais + FAB, ProfilePage vira menu e o formulário de conta sai para /settings/account | Mínimo: botão voltar no mobile-header e acrescentar Treinos e Análises à lista do Perfil | Meio-termo: manter os 5 slots atuais mas trocar 'Perfil' por 'Mais' sem criar o hub
Recomendacao: Mínimo agora, recomposição depois do piloto. Hoje 2 dos 5 slots vão para tarefas raras e Treinos não tem porta nenhuma, o que é real — mas criar uma tela-hub nova quebra App.test.tsx e ProfilePage.test.tsx, é uma tela a mais para manter, e a resposta certa depende de observar se o piloto treina diariamente. O botão voltar contextual (Onda 6) resolve o beco sem saída de /settings/*, que é o problema urgente.

## Escurecer os chips coloridos para conformidade AA muda visivelmente a paleta pastel atual (orange de 2,42:1 para 4,54:1, blue de 2,57:1 para 4,50:1). Conformidade ou identidade visual?
Opcoes: Escurecer só as cores de TEXTO (tokens --orange-text etc.), mantendo os fundos -soft e as barras/ícones intactos | Manter a paleta e aceitar que os rótulos de 9-10px reprovem AA | Manter a cor e aumentar esses rótulos para 14px + peso 700 (não qualifica como 'texto grande', que exige 18,66px em negrito — não resolve)
Recomendacao: Escurecer só o texto. Preserva o visual pastel onde ele importa (fundos, barras de progresso, ícones e o gráfico) e devolve legibilidade exatamente onde falta — rótulos minúsculos lidos sob luz do dia na academia. Não existe solução que preserve os dois; a terceira opção parece um meio-termo mas matematicamente não qualifica.

## Meta de loja: Android primeiro via TWA, ou os dois desde já? A escolha é ditada por um detalhe já no código — a sessão é cookie HttpOnly SameSite=Lax.
Opcoes: TWA/Bubblewrap para Android, iOS só como PWA instalável | Capacitor para cobrir os dois desde já | Nenhum dos dois; ficar no PWA por enquanto
Recomendacao: TWA para Android; iOS fica no PWA instalável. A TWA roda o próprio Chrome com a origem real e o cookie jar do usuário — FORMETRIC_SESSION e XSRF-TOKEN funcionam sem tocar em uma linha de backend, e o custo é um assetlinks.json em /.well-known (já liberado na Onda 6). Capacitor carrega de https://localhost, tornando toda chamada a /api cross-origin: não há config de CORS hoje e cookies cross-site exigiriam SameSite=None, que o WKWebView bloqueia por ITP — na prática obriga a trocar sessão por bearer token, trabalho maior que todo o PWA junto. Custo zero para deixar preparado: nunca mexer em id/scope/start_url, não renomear as 24 rotas (viram deep links) e manter os deep links ?action= como contrato; a troca para bearer, se um dia vier, é local — todo fetch passa por `apiRequest` em api/http.ts:141-146.