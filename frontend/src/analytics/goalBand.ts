import type { GoalReference } from './api'

/**
 * Posições, em porcentagem, para desenhar a faixa de meta.
 *
 * O backend modela meta como FAIXA — mínimo, máximo, quanto falta, quanto excedeu — e o anel de
 * progresso é estruturalmente incapaz de mostrar isso: um arco só sabe representar "quanto de um
 * alvo único". Até aqui esses quatro números terminavam numa frase de 11px abaixo do anel, que é
 * onde a informação que decide o próximo prato ia morrer.
 *
 * A escala é a parte que pode DESINFORMAR, e por isso está isolada e testada: com um teto mal
 * escolhido, uma meta de 120 a 160 com 170 registrados desenharia a barra quase cheia e verde, que
 * é exatamente a leitura oposta da correta.
 */
export interface GoalBandGeometry {
  /** Largura da parte preenchida, dentro da faixa. */
  valuePercent: number
  /** Marca do mínimo, ou `null` quando a meta não tem piso. */
  minPercent: number | null
  /** Marca do máximo, ou `null` quando a meta não tem teto. */
  maxPercent: number | null
  /** Trecho que ultrapassou o máximo, para pintar em tom de alerta. */
  excessStartPercent: number | null
}

function clampPercent(value: number) {
  return Math.min(100, Math.max(0, value))
}

export function goalBandGeometry(reference: GoalReference, value: number | null): GoalBandGeometry | null {
  const { minValue, maxValue } = reference
  if (minValue == null && maxValue == null) return null

  // O teto da escala considera o maior entre o limite da faixa e o que foi consumido, com uma folga
  // de 12%: sem incluir o consumido, um valor acima do máximo encostaria na borda e pareceria
  // apenas "no limite"; sem a folga, a marca do máximo cairia exatamente na ponta da barra e
  // deixaria de ser legível como marca.
  const upper = maxValue ?? minValue ?? 0
  const scaleMax = Math.max(upper, value ?? 0) * 1.12
  if (!(scaleMax > 0)) return null

  const percentOf = (amount: number) => clampPercent((amount / scaleMax) * 100)

  return {
    valuePercent: value == null ? 0 : percentOf(value),
    minPercent: minValue == null ? null : percentOf(minValue),
    maxPercent: maxValue == null ? null : percentOf(maxValue),
    excessStartPercent: maxValue != null && value != null && value > maxValue ? percentOf(maxValue) : null,
  }
}
