import { useEffect, useRef } from 'react'
import { useSheetHistory } from './useSheetHistory'

/**
 * O comportamento que todo diálogo do app precisa ter, num lugar só.
 *
 * Havia três implementações de modal com três comportamentos diferentes: a de atividade tratava
 * Escape, foco inicial e devolução do foco; a do shell tratava só Escape; a do diário — que é a
 * mais usada, e cobre refeição, item, cópia, fechamento e cadastro rápido — não tratava nada. Quem
 * navega por teclado ficava preso atrás do diálogo, e no celular a página de trás rolava sob o
 * sheet ao arrastar.
 *
 * O que este hook garante, para os três:
 *
 * - **Foco inicial** no painel, para o leitor de tela anunciar o diálogo e não continuar no fundo.
 * - **Armadilha de foco**, para Tab não sair para uma página que está marcada como `aria-modal`.
 * - **Devolução do foco** ao elemento que abriu, ao fechar.
 * - **Escape** fecha, quando o diálogo é dispensável, e o gesto de VOLTAR também.
 * - **Trava de rolagem** do fundo. No iOS `overflow: hidden` no `body` não basta: só fixar a
 *   posição segura a página, e por isso o deslocamento é guardado e restaurado — sem isso, fechar
 *   um sheet devolveria o usuário ao topo da lista de onde ele veio.
 */
export function useModalBehavior({ dismissible = true, onClose }: {
  dismissible?: boolean
  onClose: () => void
}) {
  const panelRef = useRef<HTMLElement>(null)
  // O diálogo só existe enquanto está montado, então a partir daqui "aberto" é sempre verdadeiro.
  useSheetHistory(true, dismissible ? onClose : () => {})
  const onCloseRef = useRef(onClose)
  const dismissibleRef = useRef(dismissible)
  onCloseRef.current = onClose
  dismissibleRef.current = dismissible

  useEffect(() => {
    const panel = panelRef.current
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const { body } = document
    const scrollY = window.scrollY
    const previousStyle = body.style.cssText

    body.style.position = 'fixed'
    body.style.top = `-${scrollY}px`
    body.style.left = '0'
    body.style.right = '0'
    body.style.overflow = 'hidden'

    function focusable() {
      if (!panel) return []
      const selector = 'a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])'
      return Array.from(panel.querySelectorAll<HTMLElement>(selector)).filter((element) => element.offsetParent !== null)
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && dismissibleRef.current) {
        onCloseRef.current()
        return
      }
      if (event.key !== 'Tab') return

      const elements = focusable()
      if (elements.length === 0) {
        // Sem nada focável dentro, o foco fica no próprio painel em vez de escapar para o fundo.
        event.preventDefault()
        panel?.focus()
        return
      }

      const first = elements[0]
      const last = elements[elements.length - 1]
      const active = document.activeElement
      if (event.shiftKey && (active === first || active === panel)) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && active === last) {
        event.preventDefault()
        first.focus()
      }
    }

    panel?.focus()
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      body.style.cssText = previousStyle
      window.scrollTo({ top: scrollY })
      previouslyFocused?.focus()
    }
  }, [])

  return panelRef
}
