import { readFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

// As folhas de estilo do app são globais e escritas à mão, e os quatro defeitos que esta reforma
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
//     suporte — e o que cai costuma ser justamente o padding que afastava o conteúdo da borda.
//
// Ele não interpreta a cascata: resolver herança exigiria um motor de CSS. As regras acima foram
// escolhidas por serem decidíveis a partir de um bloco isolado, sem falso positivo.

const STYLESHEETS = ['index.css', 'App.css', 'planning/NutritionGoals.css']

/** Abaixo disto o Safari do iOS amplia o viewport ao focar o campo, e não desfaz o zoom. */
export const MIN_CONTROL_FONT_PX = 16

export type ContractRule = 'controle-abaixo-de-16px' | 'controle-sem-tamanho-proprio' | 'altura-de-viewport-fixa' | 'safe-area-sem-fallback'

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

    // Uma regra que contém outras regras (`@media`, `@supports`) é reaberta para as folhas dela.
    if (body.includes('{')) {
      for (const nested of readBlocks(body)) {
        blocks.push({ ...nested, line: nested.line + lineAt(css, bodyStart) - 1 })
      }
      continue
    }

    blocks.push({ selector, body, line: lineAt(css, bodyStart) })
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

  for (const block of readBlocks(raw)) {
    const declared = declarations(block.body)

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
