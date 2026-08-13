import { useEffect, useRef, type ReactNode } from 'react'

interface ActivityDialogProps {
  title: string
  children: ReactNode
  dismissible?: boolean
  onClose: () => void
}

export function ActivityDialog({ title, children, dismissible = true, onClose }: ActivityDialogProps) {
  const dialogRef = useRef<HTMLElement>(null)
  const onCloseRef = useRef(onClose)
  const dismissibleRef = useRef(dismissible)
  onCloseRef.current = onClose
  dismissibleRef.current = dismissible

  useEffect(() => {
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && dismissibleRef.current) onCloseRef.current()
    }

    dialogRef.current?.focus()
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      previouslyFocused?.focus()
    }
  }, [])

  return (
    <div className="activity-dialog-backdrop" onMouseDown={(event) => {
      if (dismissible && event.currentTarget === event.target) onClose()
    }}>
      <section aria-labelledby="activity-dialog-title" aria-modal="true" className="activity-dialog surface-card" ref={dialogRef} role="dialog" tabIndex={-1}>
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
