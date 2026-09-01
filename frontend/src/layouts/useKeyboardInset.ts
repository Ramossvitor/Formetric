import { useEffect } from 'react'

/**
 * Publica em `--keyboard-inset` quanto da tela o teclado virtual está cobrindo.
 *
 * O problema que isto resolve é específico do iOS. Lá o viewport de LAYOUT não encolhe quando o
 * teclado abre — só o visual — então um sheet ancorado ao fundo com `position: fixed` continua
 * ancorado no fundo da página, que agora está atrás do teclado. O usuário vê o campo que está
 * digitando e não alcança o botão de salvar. No Android o viewport de layout encolhe sozinho, a
 * conta abaixo dá zero, e nada muda: é o comportamento correto nos dois casos com uma regra só.
 *
 * `offsetTop` entra na conta porque o Safari desloca o viewport visual para cima ao rolar até o
 * campo focado; sem ele, a cobertura seria superestimada exatamente durante a rolagem.
 *
 * O atributo `data-keyboard` acompanha o valor porque CSS não sabe perguntar se uma medida é maior
 * que zero, e a barra inferior precisa sair do caminho enquanto se digita.
 */
export function useKeyboardInset() {
  useEffect(() => {
    const viewport = window.visualViewport
    if (!viewport) return

    const root = document.documentElement

    function update() {
      if (!viewport) return
      const covered = Math.max(0, Math.round(window.innerHeight - viewport.height - viewport.offsetTop))
      // Um teclado ocupa dezenas de pixels; abaixo disso é arredondamento de zoom ou barra de
      // endereço se recolhendo, e reagir a isso faria a interface tremer durante a rolagem.
      const inset = covered > 80 ? covered : 0
      root.style.setProperty('--keyboard-inset', `${inset}px`)
      root.toggleAttribute('data-keyboard', inset > 0)
    }

    update()
    viewport.addEventListener('resize', update)
    viewport.addEventListener('scroll', update)
    return () => {
      viewport.removeEventListener('resize', update)
      viewport.removeEventListener('scroll', update)
      root.style.removeProperty('--keyboard-inset')
      root.removeAttribute('data-keyboard')
    }
  }, [])
}
