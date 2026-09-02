import { useEffect, useRef } from 'react'

/** Marca a entrada de histórico que existe apenas para representar um sheet aberto. */
const SHEET_STATE = { formetricSheet: true }

function isSheetEntry(state: unknown) {
  return typeof state === 'object' && state !== null && 'formetricSheet' in state
}

// Quantos sheets estão montados agora. Um sheet que substitui outro no mesmo commit — o de ações
// da linha abrindo "Editar", o cadastro rápido abrindo "Refeição" — reaproveita a entrada em vez de
// empilhar outra, e é esta contagem que diz à limpeza do primeiro que ainda não é hora de voltar.
let openSheets = 0

// Um `back()` pedido na limpeza e ainda em voo. O navegador processa a travessia de forma
// assíncrona, e um sheet que montar nesse intervalo não pode reaproveitar a entrada atual (ela
// está saindo) nem empilhar outra (seria ela a removida): ele espera a saída e só então entra.
let backInFlight = false
window.addEventListener('popstate', () => {
  backInFlight = false
})

function claimEntry() {
  if (!isSheetEntry(window.history.state)) window.history.pushState(SHEET_STATE, '')
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
export function useSheetHistory(onClose: () => void) {
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    openSheets += 1
    let popped = false
    let waitingForBack = backInFlight
    if (!waitingForBack) claimEntry()

    function handlePopState() {
      // A primeira saída depois de montar é a do sheet anterior, não o gesto do usuário.
      if (waitingForBack) {
        waitingForBack = false
        claimEntry()
        return
      }
      popped = true
      onCloseRef.current()
    }

    window.addEventListener('popstate', handlePopState)
    return () => {
      openSheets -= 1
      window.removeEventListener('popstate', handlePopState)
      // A decisão de voltar espera um microtask porque, quando um sheet dá lugar a outro, a limpeza
      // deste roda ANTES do efeito do próximo. Um `back()` disparado aqui removeria a entrada que o
      // sucessor acabou de reaproveitar e o fecharia no instante em que abriu. O StrictMode faz a
      // mesma sequência (montar, limpar, montar) em desenvolvimento, e fechava todo sheet sozinho.
      //
      // `waitingForBack` cobre o sheet que fechou antes de chegar a ter a própria entrada.
      // `popped` cobre o fechamento pelo próprio gesto de voltar, em que a entrada já saiu.
      // `isSheetEntry` cobre o fechamento por navegação: ali a entrada atual já é a da rota nova, e
      // voltar desfaria a navegação.
      queueMicrotask(() => {
        if (waitingForBack || popped || openSheets > 0 || !isSheetEntry(window.history.state)) return
        backInFlight = true
        window.history.back()
      })
    }
  }, [])
}
