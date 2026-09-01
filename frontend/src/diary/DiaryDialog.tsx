import type { ReactNode } from 'react'
import { getErrorMessage } from '../api/http'
import { useModalBehavior } from '../components/useModalBehavior'

export function DiaryDialog({ children, error, onClose, title }: { children: ReactNode; error?: unknown; onClose: () => void; title: string }) {
  const panelRef = useModalBehavior({ onClose })

  return (
    <div className="dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section aria-modal="true" className="diary-dialog surface-card" ref={panelRef} role="dialog" tabIndex={-1} aria-labelledby="diary-dialog-title">
        <header className="dialog-heading">
          <h2 id="diary-dialog-title">{title}</h2>
          <button aria-label="Fechar" className="icon-button dialog-close" onClick={onClose} type="button">×</button>
        </header>
        {error ? <p className="form-error" role="alert">{getErrorMessage(error)}</p> : null}
        {children}
      </section>
    </div>
  )
}
