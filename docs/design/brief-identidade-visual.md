# Formetric: brief completo da proposta do produto

Este texto descreve o Formetric por inteiro, do propósito às telas, para servir de base à criação de uma identidade visual. Ele não diz como desenhar. Diz o que o produto é, para quem existe, como se comporta, o que já foi decidido visualmente e o que o dono aprovou ou rejeitou. Tudo o que está aqui foi tirado do código, dos documentos de design e dos textos que aparecem na interface. Onde há inferência minha, está marcado.

## Em uma frase

Formetric é um aplicativo privado, feito para o celular, que registra nutrição, treino e corpo num lugar só e mostra, com honestidade matemática, como uma coisa se relaciona com a outra ao longo do tempo.

A descrição oficial, usada no manifesto do app instalável e na meta description do site, é: "Acompanhamento integrado de nutrição, treino e evolução corporal." A frase que recebe a pessoa na tela de login é: "Acompanhe sua nutrição, seus treinos e sua evolução em um só lugar." Logo abaixo dela vem o aviso que define a fase atual do produto: "O acesso ao beta é feito por convite."

## O nome

Nenhum documento do projeto explica a origem do nome. O pacote de código é `dev.formetric` e o domínio usado nos identificadores técnicos é formetric.dev. A leitura mais natural, e isto é uma inferência minha, junta "form" (forma física, forma corporal) com "metric" (métrica, medida). Combina com o que o produto é: um instrumento que mede a forma. O nome funciona em português e em inglês, e isso importa porque o produto nasce brasileiro com intenção declarada de ser global.

## A tese

O README abre assim: "Formetric é uma plataforma para acompanhar, em um só lugar, nutrição, atividade física e evolução corporal. O objetivo não é apenas contar calorias, mas relacionar o que foi consumido e treinado com mudanças de peso, medidas e composição corporal ao longo do tempo."

A frase-chave é "não é apenas contar calorias". Existem dezenas de contadores de calorias. O Formetric parte da ideia de que contar é o começo, não o fim: o que interessa é a relação entre o que a pessoa registrou (comida, água, treino) e o que mudou nela (peso, medidas, dobras, percentual de gordura), lida ao longo de semanas e meses.

Para sustentar isso, o produto separa explicitamente três camadas, e essa separação é a espinha dorsal de tudo:

- Dado: aquilo que a pessoa registrou, como uma pesagem ou uma refeição.
- Cálculo: resultado determinístico do sistema, como o saldo energético ou uma média móvel.
- Interpretação: explicação contextual, futuramente auxiliada por algoritmos ou IA.

O README justifica: "Essa separação mantém os resultados reproduzíveis e impede que cálculos essenciais dependam de modelos probabilísticos." Ou seja, o número que aparece na tela é sempre reproduzível, e a IA, quando chegar, fica confinada à camada de interpretação. Isso é uma posição de caráter, não só de arquitetura: o Formetric quer ser confiável como uma balança, não persuasivo como um coach.

O projeto também assume o próprio limite por escrito: "O projeto está em construção e ainda não deve ser usado para decisões clínicas ou como substituto de acompanhamento profissional." Na tela de avaliação corporal, a mesma cautela aparece para a pessoa: "Resultados extrapolados são estimativas matemáticas, não diagnóstico ou promessa clínica."

## Para quem é e onde é usado

Hoje o Formetric é um piloto privado com cerca de dez pessoas conhecidas do dono do produto. Não existe cadastro público. Cada conta nasce de um convite de uso único criado pelo proprietário e enviado por um canal privado. A infraestrutura roda em São Paulo, a interface é exclusivamente em português do Brasil, as unidades são métricas (quilo, centímetro, mililitro), os fusos oferecidos são os brasileiros e os alimentos de exemplo são arroz, feijão, ovo, frango, pão francês, banana, leite e whey. A intenção de longo prazo é abrir para mais gente e ser global, mas a identidade nasce num produto pequeno, íntimo e brasileiro.

A pessoa que usa o Formetric é descrita nos documentos pelo contexto de uso, não por demografia. Um comentário no CSS diz que os rótulos do app "são lidos de pé, na academia, com a tela no sol". Outro fala em "rótulos minúsculos lidos sob luz do dia na academia". Essa pessoa registra uma refeição entre uma série e outra, dá um toque para somar 250 ml de água, anota o peso de manhã em jejum, cadastra um alimento lendo o rótulo da embalagem no supermercado, e uma vez por mês, talvez, preenche quarenta campos de uma avaliação corporal com o resultado de uma bioimpedância ou das dobras medidas por um profissional.

O celular é o lugar do produto. Mobile-first é tratado como axioma: a largura de referência é 390 pixels, o app é instalável como PWA e abre em tela cheia sem a barra do navegador, o ícone instalado tem três atalhos (Registrar refeição, Registrar treino, Registrar peso), e existem guardas automáticas que reprovam qualquer alvo de toque abaixo de 44 pixels ou qualquer campo abaixo de 16 pixels. Existe um layout de desktop com barra lateral, mas ele é secundário. A sensação buscada é de app nativo, não de site.

## O que a pessoa faz no dia a dia

A navegação tem quatro destinos e um botão de adicionar, para um total de cerca de vinte e quatro rotas. O comentário no código resume: "Quatro destinos e um botão de adicionar. 'Evolução' e 'Mais' são portas, não telas finais." Os destinos são Hoje, Análises, Evolução e Mais, com o botão de adicionar no centro da barra.

Hoje é a tela inicial e, desde setembro de 2026, também o registro do dia: o que antes era uma tela separada chamada Diário virou um bloco abaixo do resumo. No topo, o título com a data e uma faixa horizontal com sete dias em pílulas, o dia selecionado em verde-escuro. No centro, um anel de calorias com o consumido do dia dentro dele e a meta nominal embaixo. Abaixo do anel, uma barra de faixa com dois traços marcando o mínimo e o máximo da meta, com uma frase do tipo "Faltam 320 para a faixa", "Dentro da faixa" ou "180 acima da faixa". Depois, o saldo energético: "Saldo previsto" enquanto o dia está aberto, "Saldo fechado" quando foi confirmado, com um chip de projeção, confirmado ou pendente, e a linha "TDEE vigente". Em seguida, a classificação das metas por nutriente (proteína, carboidratos, gorduras, fibras), cada uma com barra e estado. Por fim, um panorama com três linhas: Água, com um botão de um toque que soma 250 ml; Treino, com o total do dia; Peso, com a pesagem oficial da data. Se não há nada registrado, a tela oferece "Começar o registro de hoje".

O registro do dia, ainda chamado de diário nos textos da interface, vem logo abaixo, na mesma tela. As refeições: cada uma com horário, nome, calorias e proteína, e um menu que abre editar, duplicar ou excluir. Cada item mostra nome, quantidade, "v. preservada" (a versão do alimento que valia quando foi registrado), calorias e macros, e um chip de qualidade quando o dado não é exato: "Estimado", "Altamente estimado", "± 40 kcal". A hidratação tem quatro botões: +250 ml, +500 ml, +750 ml, +1 L. Depois, os totais do dia numa grade com proteína, carboidratos, gorduras, fibras, sódio e água. No fim, as ações do dia: "Fechar dia" e "Copiar registros". Fechar um dia sem comida exige marcar "Confirmo que este foi um dia de jejum", porque "Uma refeição vazia não conta como acompanhamento".

Análises é o segundo destino da barra e responde "estou melhorando?" em duas abas: o resumo mensal e os gráficos, descritos adiante.

Evolução é uma porta para os registros que a pessoa cria. Peso, com "pesagens, médias móveis e tendência": último peso, menor, maior, média móvel de 7 e de 14 dias, e uma tendência em quilos por semana calculada por regressão linear dos últimos 28 dias, que só aparece com pelo menos três pesagens. Treinos, com sessões por modalidade (musculação, corrida, caminhada, futebol, beach tennis, bicicleta, outra), duração, grupos musculares e um gasto calórico estimado que é explicitamente "informativo; não altera o saldo". Avaliações corporais, o formulário mais profundo do app: quatro etapas, doze perímetros (pescoço, ombros, tórax, abdômen, cintura, quadril, braços, coxas, panturrilhas), sete dobras cutâneas com protocolo Jackson e Pollock 7 mais Siri 1961, e um bloco separado para os resultados de um laudo profissional. O sistema calcula densidade corporal, percentual de gordura, massa gorda e massa livre de gordura, e cada resultado carrega a sua proveniência: informado no laudo, calculado pelo sistema, ou derivado de um valor informado. Duas avaliações podem ser comparadas, e a comparação avisa quando os métodos são diferentes: "Métodos diferentes podem limitar a leitura deste delta." Resumo mensal, com cobertura do mês (dias fechados, em aberto, sem diário), médias apenas dos dias elegíveis, déficit e superávit acumulados separadamente, e atingimento de meta por nutriente. Gráficos, com séries de 7 a 365 dias para calorias, macros, água, saldo energético e peso, em que "lacunas interrompem a linha; nenhum valor ausente é interpolado".

Mais é a biblioteca, o planejamento e a conta. Alimentos: catálogo pessoal cadastrado a partir do rótulo ("Use os valores do rótulo para a porção de referência"), com marca, porção de referência, sódio opcional, porções alternativas ("1 fatia equivale a 30 g"), favoritos, arquivamento e um campo de confiabilidade em três níveis: exato, estimado, altamente estimado, com incerteza em kcal. Editar um alimento cria uma nova versão; o que já foi comido continua valendo o que valia. Receitas: ingredientes com versão fixa, rendimento, e cálculo automático do total, por 100 g e por porção; a qualidade da receita é a do pior ingrediente. Metas nutricionais: aqui está a decisão mais opinativa do produto. A meta de cada nutriente não é um número, é uma lista ordenada de faixas, cada uma com mínimo, máximo, rótulo escrito pela pessoa, um tom visual (positivo, neutro ou alerta) e uma marcação independente de "valores nesta faixa contam como meta atingida". Um comentário do código explica por quê: "o anel de progresso é estruturalmente incapaz de mostrar isso: um arco só sabe representar 'quanto de um alvo único'". TDEE: o gasto energético diário é informado pela pessoa, não calculado por fórmula, e é versionado por período de vigência, "sem recalcular o passado". Perfil: nome, idioma, fuso, unidades, data de nascimento e "sexo usado em fórmulas corporais", com a nota "usado apenas quando uma fórmula exigir esse dado". Convites: só o proprietário vê.

O botão de adicionar, um losango verde-escuro no centro da barra inferior, abre um painel que pergunta "O que deseja registrar?" com quatro respostas: alimentação ou água, treino, peso, avaliação corporal.

## Os princípios que dão caráter ao produto

O que faz o Formetric ser o Formetric não é a lista de funções, é um conjunto de recusas. Elas estão documentadas, testadas por código e repetidas na interface.

Ausência nunca vira zero. Este é o princípio mais repetido. Uma pesagem que não existe aparece como "Sem registro", nunca como 0 kg. Um sódio desconhecido em um ingrediente torna o sódio da receita "Incompleto", não zero. Um dia sem diário é "Sem diário", não um dia de zero calorias. A especificação da tela inicial diz: "barra vazia mente tanto quanto um zero", e exige "zero barras preenchidas e zero zeros na tela" quando não há dado. Um dia só conta como zero calorias quando a pessoa confirmou explicitamente que foi um dia de jejum. Existe até uma cor reservada exclusivamente para a ausência, um cinza que só pode ser usado em "Sem registro", "Não informado" e "Não registrado".

O histórico é imutável. Alimentos, receitas e avaliações corporais são versionados; corrigir cria uma versão nova e nunca reescreve a anterior. O diário guarda um retrato congelado do alimento no momento em que foi registrado, "para que o histórico possa dizer 'duas fatias' sem recalcular o catálogo". Metas e TDEE têm vigência: mudar a meta hoje não altera a adesão de março. A regra de contribuição é literal: "Não altere resultados históricos ao editar metas, TDEE, alimentos ou receitas."

Meta é faixa, não número. Já descrito acima. A consequência visual é que o produto precisa representar mínimo, máximo, quanto falta e quanto excedeu, e não apenas "quanto de um alvo".

Treino não volta para o saldo. Um teste de arquitetura impede, por código, que calorias de treino alterem o saldo energético: "workout calories are informational and must not alter TDEE or diary energy balance". A interface repete: "Registre sessões sem duplicar o gasto estimado no balanço energético."

Uma pesagem oficial por dia, com hora e condição ("em jejum", "após treino"), porque a média móvel exige uma amostra por dia civil. E a tela de peso avisa: "Acompanhe tendências sem tirar conclusões de uma pesagem isolada." A tendência "é uma regressão dos últimos 28 dias disponíveis e não uma previsão".

Proveniência explícita. Na composição corporal, o que a balança de bioimpedância disse, o que o sistema calculou e o que o sistema derivou do informado coexistem na mesma tela, rotulados e separados: "Nenhum cálculo sobrescreve um valor informado." As fórmulas devolvem avisos em vez de esconder resultados: "A idade está fora da faixa da população usada para validar a equação", "O percentual calculado está fora da faixa plausível usada pela aplicação; o valor não foi ajustado."

Privacidade rígida. Dados de saúde não vão para cache em disco, não há fotos nem laudos no repositório, a sessão dura 30 dias porque "um diário alimentar que pede senha diariamente é abandonado", e o app instalável não guarda nenhuma resposta da API, porque "dado nutricional velho servido como atual é o pior modo de falha num app de dieta".

Sem gamificação. Não há streak, badge, ponto, ranking, mascote, confete ou mensagem de parabéns. Não há sequer número que sobe animado: "count-up animado em números nutricionais e animação de traço no gráfico: são dados de saúde: o usuário lê, não assiste." O princípio de movimento é "Movimento informa, não enfeita", e a lista do que está fora inclui swipe, toque longo, parallax, count-up, skeleton pulsante, stagger de lista, ripple, hover-lift e transição de rota horizontal.

Sem IA no cálculo. Nenhuma linha do backend usa um modelo de linguagem. O assistente de IA está previsto para uma fase futura, na camada de interpretação, e a arquitetura existe para que ele nunca toque num número.

Fechamento explícito do dia. Um dia aberto é "em andamento" e seus valores são parciais. Fechar o dia é o gesto que transforma registro em histórico. Isso cria dois estados visuais que o produto distingue o tempo todo: aberto (laranja) e fechado (azul).

## Personalidade e tom de voz

Se o Formetric fosse uma pessoa, seria alguém que mede com cuidado, diz exatamente o que sabe e o que não sabe, e nunca faz elogio para agradar. Um instrumento de medição honesto, não um treinador.

A voz é em português do Brasil, na segunda pessoa implícita, informal sem ser íntima, técnica sem jargão. Zero emoji, zero exclamação, zero frase motivacional. Nenhuma tela diz "Parabéns" ou "Você consegue". Em vez disso, quase toda tela de análise carrega uma nota metodológica: "Cada média mostra seu próprio número de amostras. Diários abertos e valores ausentes não são transformados em zero." Ou: "O denominador usa apenas diários fechados, com valor registrado e classificação vigente."

Os estados vazios orientam e oferecem saída, nunca só lamentam: "Sua biblioteca está vazia. Cadastre o primeiro alimento para começar a registrar refeições." "Nenhum registro neste dia. O diário será criado ao adicionar a primeira refeição, água, copiar registros ou confirmar um dia de jejum." Até a página não encontrada tranquiliza com fatos: "Esta página não existe. O endereço pode ter mudado, ou o registro pode ter sido excluído. Nada foi perdido nas telas abaixo."

Os erros falam como gente: "Sua sessão expirou. Entre novamente para continuar." "Alguém alterou este registro antes de você. Recarregue e tente de novo." "Muitas tentativas seguidas. Espere um instante e tente de novo." "Não foi possível conectar ao Formetric. Verifique sua conexão e tente novamente." Quando um pedaço da tela quebra: "Algo quebrou nesta tela. O restante do aplicativo continua funcionando."

Os estados de carregamento nomeiam a operação em vez de dizer "Carregando": "Calculando o resumo diário", "Consolidando o mês", "Preparando a série", "Pesquisando alimentos", "Verificando se já existe uma pesagem". Os botões pendentes ficam no gerúndio: "Entrando", "Salvando", "Fechando", "Reabrindo".

Ação destrutiva pergunta antes, com botões que dizem o que fazem: "Excluir a pesagem?" com as opções "Manter" e "Excluir". Ação reversível oferece desfazer depois: "Alimento arquivado." com um "Desfazer". O produto se recusa a oferecer "Desfazer" onde não consegue restaurar o dado idêntico, porque "chamar isso de desfazer seria mentir sobre o que aconteceu com o dado".

As regras de copy em vigor: uma palavra por conceito ("Sem meta" e "Sem registro" substituíram onze variações), um nome por destino, menos negações por tela, plural e concordância corretos, nada de enum em inglês visível, e "se um texto só cabe truncado, ele é longo demais e a correção é a string, não o CSS". O vocabulário próprio do produto inclui: vigente, elegível, snapshot, versão preservada, proveniência, faixa, saldo, fechado, em andamento.

## O que o Formetric não é

Não é um contador de calorias. Contar é o meio, relacionar é o fim.

Não é um coach de IA. Não há assistente, não há sugestão automática de dieta, não há "seu plano personalizado".

Não é uma rede social. Não há feed, seguidores, compartilhamento, comparação com outras pessoas.

Não é um app de dieta da moda. Não promete emagrecimento, não mostra "dias para a meta", não projeta peso futuro, não vende plano.

Não é uma planilha. Os documentos de design nomeiam "a grade de linhas de 1px que fazia a coisa parecer planilha" como algo a eliminar, e a densidade minúscula (três quartos dos tamanhos de fonte abaixo de 13 pixels) como a causa de "a tela não tem corpo, tem legenda e título".

Não é gamificado. Nenhuma recompensa, nenhum reforço emocional.

Não é um painel hospitalar. Apesar da precisão e da cautela clínica, o produto é de uso pessoal e diário, e a aparência aprovada pelo dono é acolhedora: cartões brancos arredondados sobre um fundo levemente esverdeado, sombras difusas, um anel de progresso com gradiente.

## A identidade visual que já existe

O Formetric já tem um sistema visual documentado e em produção. Ele deve ser tratado como ponto de partida e como registro do gosto do dono, não como restrição inegociável. Você pode manter, evoluir ou substituir, desde que o resultado continue fiel ao caráter descrito acima.

O símbolo atual é um alvo. No favicon: um quadrado de 64 por 64 com cantos de raio 20, preenchido em verde-escuro #244b3c; dentro, um anel branco-esverdeado #f4f6f2 com traço de espessura 6 e raio 15; no centro, um ponto verde-limão #8bc66b de raio 5. É o mesmo anel de progresso calórico da tela inicial, com o ponto marcando o centro. Na interface, o mesmo símbolo aparece com 32 pixels, um dos cantos inferiores com raio menor que os outros (10, 10, 5, 10) e uma rotação de menos cinco graus, o que dá uma leve assimetria e inclinação. Note que o favicon é simétrico e reto enquanto a marca na interface é assimétrica e inclinada; essa divergência é uma dívida conhecida, e a identidade nova é a oportunidade de resolvê-la.

O wordmark é a palavra "Formetric" na fonte do sistema, peso 700, com tracking negativo de 0,035 em, ao lado do símbolo. Não existe logotipo desenhado, não existe versão monocromática, não existe versão para fundo escuro definida como marca.

A paleta clara é esta. Fundo da página #f3f5f1, um branco levemente esverdeado. Superfície dos cartões #ffffff. Texto #17221d. Texto secundário #626c65. Cinza da ausência #6a726d. Fio de borda #e4e9e5. Verde primário #244b3c, o verde-escuro da marca, com uma variante mais forte #173a2d usada em botão primário, no losango de adicionar e no dia selecionado, e uma variante suave #e1eee5 para pílulas ativas. Verde-limão de acento #8bc66b, o ponto do logo, com a variante #5a9f3f usada em progresso e meta atingida. Azul #5a9ecf. Laranja #d98a48. Roxo #9b7bc0. Verde de sucesso #3b8955. Vermelho #b33f4a. Cada acento tem um fundo pastel correspondente e uma versão escurecida para texto, porque os pastéis reprovavam em contraste "num app cujos rótulos vivem em 12px e são lidos de pé, na academia, com a tela no sol".

A paleta escura é completa e obrigatória, ativada pela preferência do sistema. Fundo #0d1210, superfície #151c18, texto #eff5f1. O verde primário inverte para um verde claro #a9d594 e o acento fica #8fca70. O vermelho sobe para #f08a94. Não há alternador manual; o app segue o aparelho.

A semântica de cor é fixa e documentada: azul é hidratação e dia fechado; laranja é superávit, dia aberto e dado estimado; roxo é peso e corpo; vermelho é destrutivo e só destrutivo; verde-limão forte é progresso e meta atingida; verde de sucesso é déficit e meta positiva; o cinza dedicado é a ausência. A regra é "um acento por card", e o verde da marca "passa a estruturar: anel, fill de barra de macro, pílula do dia selecionado, botão primário, FAB, pílula ativa da nav".

A tipografia é a fonte do sistema por decisão explícita: "A stack de sistema é a decisão, não o acaso." A Inter estava listada e nunca foi carregada; foi removida para que "a renderização seja igual para todos, não custe um byte no caminho crítico e sobreviva ao modo offline". Pesos usados: 400, 500, 600 e 700. Escala de seis degraus de texto: 12, 13, 15, 17, 20 e 28 pixels, com 13 como piso de qualquer texto que se leia e 12 reservado a rótulos curtos em caixa alta; mais dois degraus só para número, 40 pixels para as calorias do dia e 44 para o número dentro do anel. Todo número usa algarismos tabulares. Os rótulos de seção ("eyebrows") são 12 pixels, peso 700, caixa alta, tracking de 0,08 em, no cinza secundário. Está registrada como decisão pendente a possibilidade de auto-hospedar uma Inter Variable no futuro, sem retrabalho.

A forma é feita de cantos generosos com significado de aninhamento, "o raio diminui para dentro, sempre": 12 pixels para chip, ícone e campo; 16 para botão e caixa interna; 20 para cartão; 24 para os cartões-herói e o topo dos painéis; 999 para pílulas. Toque mínimo de 44 pixels, botão de largura plena com 52. Sombras muito difusas e de baixíssima opacidade: 0 12px 32px a 6 por cento de um verde-escuro. Espaçamento em base 4.

Os ícones são quinze glifos desenhados à mão no próprio projeto, SVG de 24 pixels, traço de 1,8 sem preenchimento, pontas arredondadas: atividade, livro, calendário, chevron, gota, comida, casa, sair, mais, adicionar, receita, balança, ajustes, brilho, tendência. Não há biblioteca de ícones. Há uma dívida registrada: o glifo de tendência identifica ao mesmo tempo a aba Evolução, as avaliações corporais, as análises e o TDEE; pedem-se um ícone de gráfico e um de fita métrica. Símbolos de texto (a estrela de favorito, a lupa, o sinal de mais) são considerados defeito porque renderizam diferente em cada plataforma.

O movimento é curto e funcional. Entrada de tela com fade e 8 pixels de subida em 220 ms. Painel sobe do fundo em 280 ms com uma desaceleração longa "própria de painel que sobe: o movimento chega e assenta". Toque encolhe o elemento para 97 por cento em 90 ms. O anel de calorias preenche em 700 ms, mas o número dentro dele só faz fade, nunca conta. A água confirma com um pulso de escala de 260 ms, "sem toast e sem prometer um desfazer que o backend não tem".

O que o dono aprovou, com as próprias palavras: "gostei da aparência". Três coisas foram preservadas explicitamente contra a recomendação dos especificadores: o vidro da barra inferior (fundo translúcido com desfoque de 18 pixels e sombra para cima), o losango de adicionar rotacionado 45 graus com borda branca grossa, e os gradientes do anel de calorias e do resumo do diário. O documento registra: "O radial-gradient do resumo de calorias e o linear-gradient do resumo do diário ficam: são parte do que o dono aprovou."

O que o dono rejeita: enfeite sem informação, aparência de planilha, densidade minúscula, sombra e cromo em excesso, superfícies aninhadas demais, e uma dívida de paleta que o próprio plano nomeia: "o chip selecionado, que é o estado padrão da tela, é laranja num app de marca verde", e "a mesma cor laranja carrega quatro significados diferentes". A correção está registrada como decisão de paleta a tomar num documento, não num ajuste de CSS. A identidade nova pode e deve tomar essa decisão.

## Sensação desejada e sensação a evitar

Adjetivos que descrevem o Formetric: preciso, calmo, sóbrio, honesto, discreto, nativo, diário, íntimo, confiável como um instrumento. Verde sem ser "natureba"; é o verde de uma medição bem feita, não de uma folha. Acolhedor sem ser fofo. Técnico sem ser frio. Brasileiro sem clichê visual.

O que evitar: estética fitness agressiva (preto e neon, tipografia condensada gritada, corpos sarados), gradientes berrantes, mascotes, ilustrações genéricas de frutas e halteres, ícones de fogo e raio, tom hospitalar ou de laboratório, azul corporativo de software de saúde, aparência de planilha ou de dashboard de gestão, qualquer elemento que sugira competição, recompensa ou pressa.

## Onde a identidade precisa sobreviver

O símbolo precisa funcionar como favicon de 16 pixels, como ícone de app de 192 e 512 pixels, como ícone maskable do Android (em que o sistema corta até 20 por cento de cada borda, então o miolo precisa caber na zona segura), como ícone do iOS de 180 pixels com cantos aplicados pelo sistema, e como marca de 32 pixels ao lado do wordmark no cabeçalho do app. Hoje os PNGs são gerados automaticamente a partir de um único SVG, para que "não exista uma segunda cópia do logo para divergir"; a identidade nova deve permitir o mesmo.

Ela precisa viver nos dois temas, claro e escuro, sem versão improvisada. Precisa aparecer na tela de login (a única tela pública, com o cartão branco centrado e a marca no topo), na splash do app instalável, na cor da barra de status do celular (hoje #f3f5f1 no claro e #0d1210 no escuro), e nos três atalhos do ícone. No futuro próximo, precisa caber numa ficha da loja Android via Trusted Web Activity, e mais adiante numa landing page e num domínio próprio.

## Para onde o produto vai

A passada de setembro de 2026 já fundiu Hoje e Diário numa tela só e deu à barra inferior os cinco lugares descritos acima: Hoje, Análises, o botão de adicionar, Evolução e Mais. Ela também reduziu a densidade, encurtou textos e deu corpo à tipografia. O que ainda está por vir dessa passada: o botão de adicionar passar a executar ações reais (somar 250 ml de água sem trocar de tela) e o desktop ganhar o mesmo gesto de registrar.

O roteiro de longo prazo, explicitamente adiado, inclui fotografias privadas de evolução, calendário, ciclos, OCR de rótulo, relatórios em PDF, importação de bases externas de alimentos e um assistente de IA na camada de interpretação. A abertura para mais gente está prevista, com capturas de tela no manifesto "quando abrir para mais gente" e domínio próprio depois.

A identidade precisa caber num produto que vai crescer de dez pessoas para muitas, de um piloto brasileiro para algo global, e de um registro manual para um sistema com interpretação assistida, sem trocar de personalidade em nenhum desses passos.

## O que se espera desta identidade

Uma identidade que pareça um instrumento de medição de uso diário: algo que a pessoa abre na academia, de pé, com pressa, e reconhece de imediato como o lugar onde os números são verdadeiros. Que trate a ausência de dado com a mesma dignidade que o dado presente. Que seja calma o suficiente para ser aberta todo dia por anos, e precisa o suficiente para que o anel, a faixa e o saldo pareçam medidos e não estimados. Que funcione a 16 pixels e a 512, no claro e no escuro, no favicon e na loja. Que respeite o verde-escuro e o anel com o ponto como ponto de partida, porque o dono gostou deles, mas que tenha liberdade para resolver as dívidas registradas: o símbolo divergente entre favicon e interface, a ausência de um wordmark desenhado, o laranja sem significado único, e a falta de uma marca que exista fora da tela. E que seja brasileira por naturalidade, não por bandeira.
