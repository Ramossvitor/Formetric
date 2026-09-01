import { useRegisterSW } from 'virtual:pwa-register/react'

/**
 * Registra o service worker e avisa quando existe versão nova.
 *
 * `registerType: 'prompt'` em vez de atualização automática porque este app é preenchido com
 * formulários longos — uma avaliação corporal tem quarenta campos. Recarregar sozinho no meio de um
 * preenchimento perderia o trabalho, e o usuário não teria como saber por quê. Quem decide o momento
 * é quem está digitando.
 *
 * O aviso é discreto e não bloqueia: ficar na versão antiga é uma escolha válida até a próxima
 * abertura do app, quando o worker novo assume sozinho.
 */
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW()

  if (!needRefresh) return null

  return (
    <div aria-live="polite" className="update-prompt">
      <span>Uma versão nova do Formetric está pronta.</span>
      <span className="update-prompt-actions">
        <button onClick={() => void updateServiceWorker(true)} type="button">Atualizar</button>
        <button className="muted" onClick={() => setNeedRefresh(false)} type="button">Depois</button>
      </span>
    </div>
  )
}
