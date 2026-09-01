import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'

/**
 * Aviso passageiro, com uma ação opcional.
 *
 * Substitui as confirmações que ficavam cravadas na página para sempre — "Perfil atualizado." não
 * tinha por que continuar na tela depois de lido — e é onde mora o "Desfazer".
 *
 * Sobre o desfazer, uma distinção que vem da API e não do gosto: arquivar alimento, receita e
 * avaliação corporal é REVERSÍVEL, porque o backend expõe restauração. Excluir refeição, item ou
 * água do diário não é: são `DELETE` definitivos, sem endpoint de restauração. Oferecer "Desfazer"
 * ali significaria recriar o registro — com outro identificador e, no caso da água, outro horário —
 * e chamar isso de desfazer seria mentir sobre o que aconteceu com o dado. Por isso o diário usa
 * confirmação antes, e o catálogo usa desfazer depois.
 *
 * Sem `role="status"` nem `role="alert"` de propósito: os dois já são usados pelas telas, e um
 * segundo tornaria ambíguas as buscas por papel que a suíte faz no singular. `aria-live` anuncia
 * igual sem entrar na contagem de papéis.
 */
interface ToastAction {
  label: string
  onAct: () => void
}

interface ToastRequest {
  message: string
  tone?: 'neutral' | 'danger'
  action?: ToastAction
}

interface ActiveToast extends ToastRequest {
  id: number
}

const ToastContext = createContext<((toast: ToastRequest) => void) | null>(null)

/** Tempo suficiente para ler e decidir desfazer, curto o bastante para não virar mobília. */
const TOAST_MS = 6000

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ActiveToast | null>(null)
  const nextId = useRef(0)

  const show = useCallback((request: ToastRequest) => {
    nextId.current += 1
    setToast({ ...request, id: nextId.current })
  }, [])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), TOAST_MS)
    return () => window.clearTimeout(timer)
  }, [toast])

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div aria-atomic="true" aria-live="polite" className="toast-region">
        {toast ? (
          <div className={toast.tone === 'danger' ? 'toast danger' : 'toast'} key={toast.id}>
            <span>{toast.message}</span>
            {toast.action ? (
              <button
                onClick={() => {
                  toast.action?.onAct()
                  setToast(null)
                }}
                type="button"
              >
                {toast.action.label}
              </button>
            ) : (
              <button aria-label="Dispensar aviso" onClick={() => setToast(null)} type="button">×</button>
            )}
          </div>
        ) : null}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const show = useContext(ToastContext)
  // Fora do provedor o aviso simplesmente não aparece, em vez de derrubar a tela: um aviso é
  // acessório, e um teste que monte uma página isolada não deveria quebrar por causa dele.
  return show ?? (() => {})
}
