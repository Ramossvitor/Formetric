import { useState } from 'react'

/**
 * O módulo virtual `virtual:pwa-register/react` é criado pelo plugin de PWA durante o build, e o
 * ambiente de teste não carrega esse plugin — sem este substituto, qualquer teste que monte o App
 * falharia ao resolver o import.
 *
 * O substituto é fiel ao que acontece em teste: não há service worker no jsdom, então nunca existe
 * versão nova a anunciar.
 */
export function useRegisterSW() {
  const needRefresh = useState(false)
  const offlineReady = useState(false)
  return {
    needRefresh,
    offlineReady,
    updateServiceWorker: async () => {},
  }
}
