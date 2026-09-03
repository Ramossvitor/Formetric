import { readFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

// As folhas de estilo do app são globais e escritas à mão, e os cinco defeitos que esta reforma
// corrige podem voltar sem que nenhum teste de componente perceba: jsdom não calcula layout, e a
// suíte de componentes busca por texto e papel, nunca por pixel. Este scanner lê o CSS como texto
// e é a única barreira automática contra a reintrodução deles:
//
//   - controle de formulário abaixo de 16px, que faz o Safari do iOS ampliar o viewport ao focar
//     o campo e nunca desfazer o zoom;
//   - `font: inherit` num controle, que é como o tamanho de um campo acaba dependendo de um
//     rótulo minúsculo quatro seletores acima;
//   - `vh`, que no Safari mede o viewport grande e deixa a borda inferior de todo sheet ancorado
//     embaixo fora da área visível;
//   - `env(safe-area-inset-*)` sem fallback, que invalida a declaração inteira onde não há
//     suporte — e o que cai costuma ser justamente o padding que afastava o conteúdo da borda;
//   - medida fora da escala declarada, que é como o arquivo chegou a onze recuos de cartão e
//     dezesseis raios num sistema que declara cinco.
//
// Ele não interpreta a cascata: resolver herança exigiria um motor de CSS. As regras acima foram
// escolhidas por serem decidíveis a partir de um bloco isolado, sem falso positivo.

const STYLESHEETS = ['index.css', 'App.css', 'planning/NutritionGoals.css']

/** Abaixo disto o Safari do iOS amplia o viewport ao focar o campo, e não desfaz o zoom. */
export const MIN_CONTROL_FONT_PX = 16

export type ContractRule =
  | 'controle-abaixo-de-16px'
  | 'controle-sem-tamanho-proprio'
  | 'altura-de-viewport-fixa'
  | 'safe-area-sem-fallback'
  | 'valor-fora-da-escala'

export interface Violation {
  /** `regra@arquivo:linha`, relativo a `frontend/src`. Identidade estável na linha de base. */
  key: string
  rule: ContractRule
  /** O trecho ofensor, para o relatório dizer o que corrigir sem abrir o arquivo. */
  snippet: string
}

interface Block {
  selector: string
  body: string
  line: number
  /** O prelúdio da at-rule que envolve o bloco (`@media (min-width: 840px)`), ou vazio na raiz. */
  context: string
}

const SOURCE_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', 'src')

function stripComments(css: string) {
  // Preserva as quebras de linha para os números de linha continuarem verdadeiros.
  return css.replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, ' '))
}

function lineAt(css: string, index: number) {
  let line = 1
  for (let cursor = 0; cursor < index; cursor += 1) if (css[cursor] === '\n') line += 1
  return line
}

/**
 * Percorre as regras de nível folha — as que contêm declarações, e não outras regras. Basta para
 * o contrato: nenhuma das quatro verificações depende de saber em qual `@media` a regra está.
 */
function readBlocks(css: string): Block[] {
  const blocks: Block[] = []
  let depth = 0
  let selectorStart = 0
  let bodyStart = 0

  for (let cursor = 0; cursor < css.length; cursor += 1) {
    const char = css[cursor]
    if (char === '{') {
      if (depth === 0) bodyStart = cursor
      depth += 1
      continue
    }
    if (char !== '}') continue

    depth -= 1
    if (depth !== 0) continue

    const body = css.slice(bodyStart + 1, cursor)
    const selector = css.slice(selectorStart, bodyStart).trim()
    selectorStart = cursor + 1

    // Uma regra que contém outras regras (`@media`, `@supports`) é reaberta para as folhas dela. O
    // prelúdio acompanha cada folha porque a mesma declaração costuma existir na raiz e dentro de
    // uma `@media` — sem ele as duas teriam a mesma identidade na linha de base, e corrigir uma
    // deixaria a outra invisível.
    if (body.includes('{')) {
      for (const nested of readBlocks(body)) {
        blocks.push({
          ...nested,
          context: nested.context ? `${selector} ${nested.context}` : selector,
          line: nested.line + lineAt(css, bodyStart) - 1,
        })
      }
      continue
    }

    blocks.push({ selector, body, line: lineAt(css, bodyStart), context: '' })
  }

  return blocks
}

function targetsFormControl(selector: string) {
  if (selector.startsWith('@')) return false
  return /(^|[\s,>+~([])(input|select|textarea)($|[\s,>+~:[.)])/.test(selector)
}

/**
 * Um seletor de estado (`:focus`, `:hover`, `[aria-invalid='true']`) sobrescreve pontualmente o
 * bloco base e não tem obrigação de repetir a tipografia — cobrar tamanho dele só geraria ruído.
 */
function stylesOnlyAState(selector: string) {
  return selector.split(',').every((part) => /:(focus|hover|active|disabled|checked|focus-visible)\b|\[[^\]]+\]/.test(part))
}

/** Devolve o tamanho em px, ou `null` quando o valor não é comparável estaticamente. */
function fontSizeInPx(value: string) {
  const match = /^(-?[\d.]+)(px|rem|em)$/.exec(value.trim())
  if (!match) return null
  const amount = Number(match[1])
  if (!Number.isFinite(amount)) return null
  // O app não redefine `font-size` na raiz, então 1rem e 1em valem os 16px do navegador.
  return match[2] === 'px' ? amount : amount * 16
}

/**
 * A escala declarada em `index.css`, em pixels, por família de propriedade.
 *
 * Uma escala declarada e não cobrada não reduz variação: acrescenta mais um valor aos que já
 * existiam, porque agora alguns blocos usam `var(--space-4)`, outros `16px` e outros `17px`, e o
 * leitor não consegue mais distinguir qual é deliberado. É por isto que esta regra existe.
 */
const SCALE_PX: Record<string, number[]> = {
  // --space-1..8, mais o zero.
  espaco: [0, 4, 8, 12, 16, 20, 24, 32, 40],
  // --radius-chip/control/card/hero/pill, mais o zero.
  raio: [0, 12, 16, 20, 24, 999],
  // --fs-caption..numeral, os oito degraus.
  tipo: [12, 13, 15, 17, 20, 28, 40, 44],
}

/**
 * Valores que não pertencem à escala e ainda assim são corretos, cada um pelo seu motivo. Existem
 * nomeados para que a lista seja curta e discutível — uma exceção sem nome vira permissão geral.
 */
const ALLOWED_PX: Record<string, number[]> = {
  // Fio de 1px: borda e divisor não são espaçamento e não têm degrau na régua.
  espaco: [1],
  raio: [1],
  tipo: [],
}

/**
 * Reservas de coluna: recuo que não é respiro, e sim espaço vago para um controle sobreposto ao
 * card (o botão de favorito, as ações da linha). O número sai da largura do controle, não da
 * régua, e por isso não cabe num degrau. Ficam aqui até virarem token com o nome do que reservam.
 */
const COLUMN_RESERVATIONS_PX = [58, 60, 76, 94]

const PROPERTY_FAMILY: Array<[RegExp, keyof typeof SCALE_PX]> = [
  [/^(padding|margin)(-(top|right|bottom|left|inline|block)(-(start|end))?)?$/, 'espaco'],
  [/^(gap|row-gap|column-gap)$/, 'espaco'],
  [/^border(-(start|end)-(start|end))?-?radius$/, 'raio'],
  [/^font-size$/, 'tipo'],
]

function familyOf(property: string) {
  return PROPERTY_FAMILY.find(([pattern]) => pattern.test(property))?.[1]
}

/**
 * Todos os comprimentos literais de um valor, em pixels.
 *
 * Percorre `calc()` e valores compostos sem os interpretar: `calc(20px + var(--safe-bottom))` rende
 * 20, e `22px 22px 0 0` rende 22 duas vezes. O que não é `px` nem `rem` — porcentagem, `ch`, `fr`,
 * `auto` — sai de fora, porque não há degrau com que comparar.
 */
function literalLengthsInPx(value: string): number[] {
  const found: number[] = []
  for (const match of value.matchAll(/(-?\d*\.?\d+)(px|rem)\b/g)) {
    const amount = Number(match[1])
    // O app não redefine `font-size` na raiz, então 1rem vale os 16px do navegador.
    found.push(Math.abs(match[2] === 'px' ? amount : amount * 16))
  }
  // `padding: 0` e `margin: 0 auto` não casam a regex acima porque não trazem unidade — e um zero
  // sem unidade é sempre válido, então não precisa entrar.
  return found
}

function declarations(body: string) {
  return body
    .split(';')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const separator = entry.indexOf(':')
      if (separator < 0) return null
      return { property: entry.slice(0, separator).trim().toLowerCase(), value: entry.slice(separator + 1).trim() }
    })
    .filter((entry): entry is { property: string; value: string } => entry !== null)
}

/**
 * Exportada para que o próprio scanner possa ser exercitado contra um CSS de mentira que viola as
 * quatro regras de propósito. Sem isso, uma expressão regular quebrada deixaria o scanner cego e a
 * catraca ficaria verde para sempre — um silêncio que se pareceria com sucesso.
 */
export function scanCss(source: string, file: string): Violation[] {
  const raw = stripComments(source)
  const violations: Violation[] = []
  // A propriedade entra na chave porque uma mesma regra pode violar o contrato duas vezes — a
  // `.bottom-nav` usa `env()` sem fallback no `min-height` e no `padding`. Sem ela, corrigir uma
  // das duas deixaria a linha de base intacta e a outra sobreviveria em silêncio.
  const add = (line: number, rule: ContractRule, property: string, snippet: string) =>
    violations.push({ key: `${rule}@${file}:${line}:${property}`, rule, snippet })

  /**
   * Identidade por SELETOR, não por linha, e só para `valor-fora-da-escala`.
   *
   * As outras quatro regras têm linha de base vazia e nunca voltam a encher; esta nasce com
   * centenas de entradas e vai encolher ao longo de várias passadas, cada uma delas mexendo no meio
   * do arquivo. Com número de linha, editar uma regra invalidaria a chave de todas as que estão
   * abaixo dela, o teste de entrada obsoleta acusaria dezenas de falsos, e o único caminho prático
   * seria regenerar a linha de base a cada commit — que é o mesmo que não ter catraca.
   * Pelo seletor, a entrada só muda quando a declaração ofensora muda, que é exatamente quando
   * queremos saber.
   */
  const addBySelector = (block: Block, rule: ContractRule, property: string, snippet: string) => {
    const where = `${block.context} ${block.selector}`.replace(/\s+/g, ' ').trim()
    violations.push({ key: `${rule}@${file}:${where}:${property}`, rule, snippet })
  }

  for (const block of readBlocks(raw)) {
    const declared = declarations(block.body)

    for (const { property, value } of declared) {
      const family = familyOf(property)
      if (family && !value.includes('env(')) {
        const permitted = new Set([
          ...SCALE_PX[family],
          ...ALLOWED_PX[family],
          ...(family === 'espaco' ? COLUMN_RESERVATIONS_PX : []),
        ])
        const offenders = literalLengthsInPx(value).filter((length) => !permitted.has(length))
        if (offenders.length > 0) {
          addBySelector(block, 'valor-fora-da-escala', property, `${block.selector} { ${property}: ${value} }`)
        }
      }
    }

    for (const { property, value } of declared) {
      if (/\b\d[\d.]*vh\b/.test(value)) {
        // `vh` é o viewport *grande* do Safari: mede sempre como se a barra de endereço estivesse
        // recolhida, então toda tela ganha um scroll fantasma e todo sheet ancorado embaixo tem a
        // própria borda inferior fora da área visível. Usar `svh`/`dvh`.
        add(block.line, 'altura-de-viewport-fixa', property, `${block.selector} { ${property}: ${value} }`)
      }

      for (const inset of value.matchAll(/env\(\s*safe-area-inset-[a-z]+\s*(,?)/g)) {
        // Sem o fallback, um navegador sem suporte invalida a declaração inteira — e o que cai
        // costuma ser justamente o padding que afastava o conteúdo da borda.
        if (!inset[1]) add(block.line, 'safe-area-sem-fallback', property, `${block.selector} { ${property}: ${value} }`)
      }
    }

    if (!targetsFormControl(block.selector) || stylesOnlyAState(block.selector)) continue

    // O bloco é julgado inteiro, não declaração a declaração: `font: inherit` seguido de um
    // `font-size` explícito é correto, e era o padrão do arquivo antes desta reforma.
    const explicitSize = declared.findLast(({ property }) => property === 'font-size')?.value
    if (explicitSize !== undefined) {
      const size = fontSizeInPx(explicitSize)
      if (size !== null && size < MIN_CONTROL_FONT_PX) {
        add(block.line, 'controle-abaixo-de-16px', 'font-size', `${block.selector} { font-size: ${explicitSize} }`)
      }
      continue
    }

    // `font: inherit` num controle foi como os campos de análises acabaram em 11,5px: o valor vem
    // de um rótulo minúsculo quatro seletores acima, e ninguém revisa isso ao editar o rótulo.
    //
    // Um controle que simplesmente não declara tamanho NÃO é cobrado aqui, ainda que possa estar
    // órfão. Distinguir órfão de sobrescrita legítima exigiria resolver a cascata, e o resultado
    // seria ruído — `.field-group textarea { min-height }` e `.activity-filter .field-group input`
    // herdam de um bloco base correto. A rede de segurança para o órfão é outra e é estrutural:
    // a regra de elemento em index.css põe todo controle em `max(16px, 1em)` por padrão.
    if (declared.some(({ property, value }) => property === 'font' && /\binherit\b/.test(value))) {
      add(block.line, 'controle-sem-tamanho-proprio', 'font', `${block.selector} { font: inherit }`)
    }
  }

  return violations
}

function scanStylesheet(path: string): Violation[] {
  const absolute = join(SOURCE_ROOT, path)
  return scanCss(readFileSync(absolute, 'utf8'), relative(SOURCE_ROOT, absolute).replaceAll('\\', '/'))
}

export function scanStyleContract(): Violation[] {
  return STYLESHEETS.flatMap(scanStylesheet).sort((left, right) => left.key.localeCompare(right.key))
}
