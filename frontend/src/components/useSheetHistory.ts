import { useEffect, useRef } from 'react'

/** Marca a entrada de histórico que existe apenas para representar um sheet aberto. */
const SHEET_STATE = { formetricSheet: true }

function isSheetEntry(state: unknown) {
  return typeof state === 'object' && state !== null && 'formetricSheet' in state
}

/**
 * Faz o gesto de voltar fechar o sheet, em vez de sair da tela.
 *
 * Num aplicativo instalado voltar é o gesto mais usado que existe, e não há barra de endereço para
 * corrigir o engano: com um sheet aberto, voltar levava o usuário para fora da página inteira e o
 * trabalho dentro do sheet ia junto.
 *
 * Nenhum identificador vai para a URL. A alternativa — representar o diálogo em `?editor=`, com o
 * id do item — quebraria duas coisas reais: o registro de treino guarda um `requestId` de
 * idempotência que a URL não carrega, e os editores guardam o OBJETO, então procurá-lo por id numa
 * lista servida com dados da consulta anterior abriria "Editar" como "Adicionar". Uma entrada
 * anônima de histórico resolve o gesto sem nada disso.
 *
 * A guarda na limpeza é o ponto delicado: se o sheet fechou porque o usuário navegou — o cadastro
 * rápido é feito de links — voltar aqui desfaria a navegação que ele acabou de pedir. Por isso a
 * entrada só é removida quando ela ainda é a atual.
 */
export function useSheetHistory(open: boolean, onClose: () => void) {
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    if (!open) return

    window.history.pushState(SHEET_STATE, '')
    let popped = false

    function handlePopState() {
      popped = true
      onCloseRef.current()
    }

    window.addEventListener('popstate', handlePopState)
    return () => {
      window.removeEventListener('popstate', handlePopState)
      // `popped` cobre o fechamento pelo próprio gesto de voltar, em que a entrada já saiu.
      // `isSheetEntry` cobre o fechamento por navegação: ali a entrada atual já é a da rota nova, e
      // voltar desfaria a navegação.
      if (!popped && isSheetEntry(window.history.state)) window.history.back()
    }
  }, [open])
}
