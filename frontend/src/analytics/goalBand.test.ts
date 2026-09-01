import type { GoalReference } from './api'
import { goalBandGeometry } from './goalBand'

function reference(partial: Partial<GoalReference>): GoalReference {
  return {
    label: 'Faixa',
    minValue: null,
    maxValue: null,
    minInclusive: true,
    maxInclusive: true,
    remainingToRange: null,
    excessOverRange: null,
    ...partial,
  }
}

describe('goalBandGeometry', () => {
  it('põe o valor dentro da faixa entre as duas marcas', () => {
    const geometry = goalBandGeometry(reference({ minValue: 120, maxValue: 160 }), 140)!

    expect(geometry.minPercent!).toBeLessThan(geometry.valuePercent)
    expect(geometry.valuePercent).toBeLessThan(geometry.maxPercent!)
    expect(geometry.excessStartPercent).toBeNull()
  })

  it('mostra o excesso à direita do máximo quando o valor ultrapassa a faixa', () => {
    // É o caso que a escala pode mentir: com um teto mal escolhido, 170 numa faixa que termina em
    // 160 desenharia a barra quase cheia e sem excedente, ou seja, indistinguível de sucesso.
    const geometry = goalBandGeometry(reference({ minValue: 120, maxValue: 160 }), 170)!

    expect(geometry.excessStartPercent).toBe(geometry.maxPercent)
    expect(geometry.valuePercent).toBeGreaterThan(geometry.maxPercent!)
    expect(geometry.valuePercent).toBeLessThan(100)
  })

  it('mantém a marca do máximo dentro da barra e longe da ponta', () => {
    const geometry = goalBandGeometry(reference({ minValue: 2000, maxValue: 2500 }), 1800)!

    // A folga da escala existe para a marca continuar sendo uma MARCA, e não a borda da barra.
    expect(geometry.maxPercent!).toBeCloseTo(89.3, 1)
    expect(geometry.maxPercent!).toBeLessThan(100)
  })

  it('desenha só o trilho e as marcas quando ainda não há valor registrado', () => {
    const geometry = goalBandGeometry(reference({ minValue: 120, maxValue: 160 }), null)!

    expect(geometry.valuePercent).toBe(0)
    expect(geometry.minPercent).not.toBeNull()
  })

  it('aceita faixa aberta de um lado só', () => {
    const semTeto = goalBandGeometry(reference({ minValue: 120 }), 140)!
    expect(semTeto.maxPercent).toBeNull()
    expect(semTeto.minPercent).not.toBeNull()

    const semPiso = goalBandGeometry(reference({ maxValue: 160 }), 140)!
    expect(semPiso.minPercent).toBeNull()
    expect(semPiso.maxPercent).not.toBeNull()
  })

  it('não desenha nada sem limites, nem com limites zerados', () => {
    expect(goalBandGeometry(reference({}), 140)).toBeNull()
    // Uma escala de teto zero dividiria por zero e produziria NaN em toda posição.
    expect(goalBandGeometry(reference({ maxValue: 0 }), 0)).toBeNull()
  })
})
