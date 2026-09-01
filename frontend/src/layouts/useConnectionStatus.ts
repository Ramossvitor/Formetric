import { useEffect, useState } from 'react'

/**
 * Diz se o navegador acredita estar conectado.
 *
 * `navigator.onLine` só sabe que existe uma interface de rede ativa, não que o servidor responde —
 * mas o caso que interessa num aplicativo instalado é o mais grosseiro de todos: o metrô, o
 * elevador, o modo avião. Sem nenhum aviso, o app apenas falhava toda ação com uma mensagem de
 * erro genérica, e a pessoa concluía que o produto estava quebrado.
 */
export function useConnectionStatus() {
  const [online, setOnline] = useState(() => typeof navigator === 'undefined' || navigator.onLine)

  useEffect(() => {
    const goOnline = () => setOnline(true)
    const goOffline = () => setOnline(false)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])

  return online
}
