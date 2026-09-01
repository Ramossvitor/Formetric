import { useEffect, useState } from 'react'
import { Icon } from '../components/Icon'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const DISMISSED_KEY = 'formetric:install-prompt-dismissed'

function isStandalone() {
  // Este componente mora no shell, FORA da barreira de erro que protege as telas: se ele lançar,
  // leva o aplicativo inteiro junto. Por isso cada consulta ao ambiente é defendida — `matchMedia`
  // não existe em todo ambiente de execução, e descobrir isso em produção seria uma tela branca.
  const standaloneDisplay = typeof window.matchMedia === 'function'
    && window.matchMedia('(display-mode: standalone)').matches
  // O iOS não implementa `display-mode: standalone` na consulta de mídia; expõe esta propriedade
  // fora do padrão em vez disso.
  return standaloneDisplay || (navigator as { standalone?: boolean }).standalone === true
}

function isIosSafari() {
  const agent = navigator.userAgent
  return /iPad|iPhone|iPod/.test(agent) && !/CriOS|FxiOS|EdgiOS/.test(agent)
}

function wasDismissed() {
  try {
    return window.localStorage.getItem(DISMISSED_KEY) === 'true'
  } catch {
    // Navegação privada e políticas de site podem lançar ao ler o armazenamento. Sem memória do
    // descarte, o convite volta a aparecer — chato, mas melhor do que a tela quebrar.
    return false
  }
}

/**
 * Convite discreto para instalar o app.
 *
 * Dois caminhos, porque os navegadores não concordam: no Chrome existe um evento que permite abrir
 * o diálogo nativo de instalação; no Safari do iOS não existe nada equivalente, e a única forma de
 * instalar é pelo menu Compartilhar — que ninguém encontra sem ser avisado, e é justamente o
 * aparelho onde o app instalado ganha mais (barra de endereço some, safe-area passa a valer).
 *
 * Aparece uma vez e some ao ser dispensado. Um convite que reaparece toda sessão vira propaganda.
 */
export function InstallPrompt() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null)
  const [showIosHint, setShowIosHint] = useState(false)

  useEffect(() => {
    if (isStandalone() || wasDismissed()) return

    function capture(event: Event) {
      // Sem isto o Chrome mostra o próprio banner, em inglês e fora do desenho do app.
      event.preventDefault()
      setInstallEvent(event as BeforeInstallPromptEvent)
    }

    window.addEventListener('beforeinstallprompt', capture)
    if (isIosSafari()) setShowIosHint(true)
    return () => window.removeEventListener('beforeinstallprompt', capture)
  }, [])

  function dismiss() {
    setInstallEvent(null)
    setShowIosHint(false)
    try {
      window.localStorage.setItem(DISMISSED_KEY, 'true')
    } catch {
      // O convite volta na próxima sessão; nada mais que isso.
    }
  }

  if (!installEvent && !showIosHint) return null

  return (
    <div className="install-prompt">
      <span className="install-prompt-mark"><Icon name="plus" size={18} /></span>
      <span className="install-prompt-copy">
        <strong>Instale o Formetric</strong>
        <small>
          {installEvent
            ? 'Abre em tela cheia, sem a barra do navegador.'
            : 'Toque em Compartilhar e depois em “Adicionar à Tela de Início”.'}
        </small>
      </span>
      {installEvent ? (
        <button
          onClick={() => {
            void installEvent.prompt()
            dismiss()
          }}
          type="button"
        >
          Instalar
        </button>
      ) : null}
      <button aria-label="Dispensar convite de instalação" className="install-prompt-dismiss" onClick={dismiss} type="button">×</button>
    </div>
  )
}
