import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { scanCss, scanStyleContract, type Violation } from './css-contract.ts'

// Catraca, não portão. O CSS entrou nesta reforma violando o contrato em 22 pontos, e a linha de
// base existia para que eles pudessem ser corrigidos ao longo de várias ondas sem que o teste
// falhasse desde o primeiro dia — um teste vermelho por semanas é um teste desligado.
//
// Hoje ela está VAZIA: as quatro classes foram zeradas. O mecanismo fica de pé porque a próxima
// onda que precisar de tolerância temporária vai querê-lo, e porque é ele que faz o número descer:
// o teste falha tanto quando aparece uma violação nova quanto quando a linha de base guarda uma
// entrada que já não existe. Sem essa segunda metade a lista viraria um depósito.
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

  it('enxerga as cinco classes de defeito', () => {
    // Guarda o próprio scanner contra um regex quebrado: sem isto, um scanner cego aprovaria tudo e
    // os dois testes acima ficariam verdes para sempre — um silêncio que se pareceria com sucesso.
    // O exercício é contra um CSS de mentira, e não contra as folhas reais, justamente porque elas
    // agora estão limpas: um teste que dependesse dos defeitos existirem morreria ao corrigi-los.
    // Um defeito por regra, de propósito. O campo usa 0,9375rem — 15px, que ESTÁ na escala e ainda
    // assim está abaixo do piso de 16px: é o único tamanho que separa as duas regras, e usá-lo aqui
    // impede que este teste passe por acidente porque uma delas cobriu a falha da outra.
    const defeituoso = `
      .campo input { font-size: 0.9375rem; }
      .rotulo select { font: inherit; }
      .tela { min-height: 100vh; }
      .barra { padding-bottom: env(safe-area-inset-bottom); }
      .cartao { padding: 17px; }
    `
    expect(scanCss(defeituoso, 'falso.css').map(({ rule }) => rule).sort()).toEqual([
      'altura-de-viewport-fixa',
      'controle-abaixo-de-16px',
      'controle-sem-tamanho-proprio',
      'safe-area-sem-fallback',
      'valor-fora-da-escala',
    ])
  })

  it('cobra a escala em cada família de propriedade', () => {
    // O defeito que motivou a quinta regra não é um valor errado: são onze recuos de cartão e
    // dezesseis raios coexistindo. Cada família precisa da própria régua, senão 22px passa por ser
    // um espaçamento válido quando o que se está escrevendo é um raio.
    const foraDaEscala = `
      .a { padding: 15px; }
      .b { gap: 9px; }
      .c { margin-top: 21px; }
      .d { border-radius: 22px; }
      .e { font-size: 0.77rem; }
    `
    expect(scanCss(foraDaEscala, 'falso.css').map(({ key }) => key.split(':').at(-1))).toEqual([
      'padding', 'gap', 'margin-top', 'border-radius', 'font-size',
    ])
  })

  it('não acusa o que é correto', () => {
    // O outro lado da guarda: um scanner cego demais é inútil, mas um que acusa CSS válido é pior,
    // porque ensina a ignorar a falha. `font: inherit` seguido de tamanho explícito é o padrão do
    // arquivo; `env()` com fallback e `svh`/`dvh` são exatamente o que a reforma pede.
    //
    // Na escala entram também os casos que a régua não cobre e ainda assim estão certos: o token,
    // o zero, o fio de 1px, a pílula de 999px, a porcentagem, o `calc()` cujo literal é um degrau,
    // a lista de quatro valores toda na régua, e a reserva de coluna, que é largura de um controle
    // sobreposto e não respiro.
    const correto = `
      .campo input { font: inherit; font-size: var(--field-font); }
      .estado input:focus { border-color: red; }
      .tela { min-height: 100svh; }
      .sheet { max-height: calc(100dvh - 32px); }
      .barra { padding-bottom: env(safe-area-inset-bottom, 0px); }
      .token { padding: var(--space-4) var(--space-5); }
      .zero { margin: 0 auto; }
      .fio { border-radius: 1px; }
      .pilula { border-radius: 999px; }
      .circulo { border-radius: 50%; }
      .conta { padding-bottom: calc(20px + var(--safe-bottom)); }
      .lista { border-radius: 24px 24px 0 0; }
      .reserva { padding: 12px 60px 12px 12px; }
      .degrau { font-size: 1.0625rem; }
    `
    expect(scanCss(correto, 'falso.css')).toEqual([])
  })
})
