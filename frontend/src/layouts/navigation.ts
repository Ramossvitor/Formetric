import type { IconName } from '../components/Icon'

/**
 * Os quatro destinos da barra, e a função que diz a qual deles uma rota pertence.
 *
 * A barra tem quatro slots e o app tem vinte e quatro rotas. Antes deste módulo, o item aceso era
 * decidido por igualdade exata de caminho, então catorze rotas não acendiam nada: quem chegava em
 * Treinos atravessando Evolução via a barra apagada e perdia a única indicação de onde estava. O
 * sidebar do desktop tinha o mesmo defeito em seis rotas, e ainda listava uma árvore diferente da
 * do celular — expunha Análises, Peso e Treinos no primeiro nível e ao mesmo tempo oferecia
 * Evolução, que no celular é a porta desses mesmos três.
 *
 * Um lugar só decide isso agora, e as duas barras consomem daqui.
 */
export interface NavigationDestination {
  label: string
  icon: IconName
  to: string
}

export const NAVIGATION: NavigationDestination[] = [
  { label: 'Hoje', icon: 'home', to: '/' },
  // A raiz do slot é a rota que RENDERIZA. `/analytics` é só um redirecionamento para cá, e usá-lo
  // como destino fazia a própria tela da aba contar como profunda: chevron de voltar no lugar da
  // marca, num destino de primeiro nível.
  { label: 'Análises', icon: 'calendar', to: '/analytics/monthly' },
  { label: 'Evolução', icon: 'trend', to: '/progress' },
  { label: 'Mais', icon: 'settings', to: '/more' },
]

/**
 * Prefixos de cada slot, em ordem de especificidade.
 *
 * A comparação é por SEGMENTO, não por texto: `/foods` cobre `/foods/new` e nunca `/foodsomething`.
 * Sem isso, uma rota nova cujo nome comece igual ao de outra acenderia o slot errado em silêncio.
 */
const SLOT_PREFIXES: Array<[slot: string, prefixes: string[]]> = [
  ['/analytics/monthly', ['/analytics']],
  ['/progress', ['/progress', '/workouts']],
  ['/more', ['/more', '/foods', '/recipes', '/settings', '/profile']],
  // O registro do dia mora na tela Hoje desde a fusão; /diary redireciona para lá e, enquanto a
  // navegação acontece, o slot aceso já é o certo.
  ['/', ['/diary']],
]

function startsWithSegment(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`)
}

/**
 * O slot que uma rota acende, ou `null` quando ela vive fora da barra (login, convite, 404).
 *
 * `/` é o último caso testado de propósito: como prefixo ele casaria com tudo.
 */
export function slotFor(pathname: string): string | null {
  for (const [slot, prefixes] of SLOT_PREFIXES) {
    if (prefixes.some((prefix) => startsWithSegment(pathname, prefix))) return slot
  }
  return pathname === '/' ? '/' : null
}

/**
 * Abas irmãs da raiz de um slot: a mesma tela partida em duas rotas. Não são profundas — um
 * "voltar" de Gráficos que levasse a Resumo mensal seria voltar de uma aba para a outra.
 */
const SIBLING_ROOTS = new Set(['/analytics/charts'])

/** Uma rota é profunda quando acende um slot sem ser a raiz dele — é aí que o voltar faz falta. */
export function isDeepRoute(pathname: string): boolean {
  const slot = slotFor(pathname)
  return slot !== null && slot !== pathname && !SIBLING_ROOTS.has(pathname)
}
