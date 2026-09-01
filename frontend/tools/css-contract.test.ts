import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { scanStyleContract, type Violation } from './css-contract.ts'

// Catraca, não portão. O CSS entra nesta reforma violando o contrato em 22 pontos, corrigidos ao
// longo de várias ondas; falhar de imediato só faria o teste ser desligado. Então a linha de base é
// versionada e o teste falha em dois casos: quando aparece uma violação nova, e quando a linha de
// base guarda uma entrada que já não existe. O segundo caso é o que faz o número descer — sem ele,
// a lista viraria um depósito e o contrato não valeria nada.
//
// Para atualizar depois de corrigir um lote: `UPDATE_CSS_BASELINE=1 npm test -- css-contract`.

const BASELINE_PATH = join(dirname(fileURLToPath(import.meta.url)), 'css-contract.baseline.json')

function describeViolation({ key, snippet }: Violation) {
  return `${key}  ${snippet.replace(/\s+/g, ' ').slice(0, 140)}`
}

describe('contrato das folhas de estilo globais', () => {
  const current = scanStyleContract()

  if (process.env.UPDATE_CSS_BASELINE) {
    writeFileSync(BASELINE_PATH, `${JSON.stringify(current.map(({ key }) => key), null, 2)}\n`)
  }

  const baseline: string[] = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'))
  const known = new Set(baseline)
  const present = new Set(current.map(({ key }) => key))

  it('não introduz violação nova', () => {
    expect(current.filter(({ key }) => !known.has(key)).map(describeViolation)).toEqual([])
  })

  it('não deixa entrada obsoleta na linha de base', () => {
    // Uma entrada obsoleta significa que a correção já foi feita mas a catraca não foi apertada,
    // e a violação poderia voltar em silêncio.
    expect(baseline.filter((key) => !present.has(key))).toEqual([])
  })

  it('enxerga as quatro classes de defeito que a reforma corrige', () => {
    // Guarda o próprio scanner: se uma mudança de regex o cegar, ele passaria a aprovar tudo e os
    // dois testes acima ficariam verdes para sempre. Quando uma classe for zerada de verdade, é
    // esta lista que se encolhe — e o encolhimento é a prova de que a onda terminou.
    expect(new Set(current.map(({ rule }) => rule))).toEqual(
      new Set([
        'controle-abaixo-de-16px',
        'controle-sem-tamanho-proprio',
        'altura-de-viewport-fixa',
        'safe-area-sem-fallback',
      ]),
    )
  })
})
