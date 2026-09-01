import type { ReactNode } from 'react'
import { useModalBehavior } from '../components/useModalBehavior'

interface ActivityDialogProps {
  title: string
  children: ReactNode
  dismissible?: boolean
  onClose: () => void
}

export function ActivityDialog({ title, children, dismissible = true, onClose }: ActivityDialogProps) {
  const panelRef = useModalBehavior({ dismissible, onClose })

  return (
    <div className="activity-dialog-backdrop" onMouseDown={(event) => {
      if (dismissible && event.currentTarget === event.target) onClose()
    }}>
      <section aria-labelledby="activity-dialog-title" aria-modal="true" className="activity-dialog surface-card" ref={panelRef} role="dialog" tabIndex={-1}>
        <header className="dialog-heading">
          <h2 id="activity-dialog-title">{title}</h2>
          <button aria-label="Fechar" className="icon-button dialog-close" disabled={!dismissible} onClick={onClose} type="button">
            ×
          </button>
        </header>
        {children}
      </section>
    </div>
  )
}
