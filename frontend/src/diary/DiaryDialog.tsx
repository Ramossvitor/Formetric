import type { ReactNode } from 'react'

export function DiaryDialog({ children, onClose, title }: { children: ReactNode; onClose: () => void; title: string }) {
  return (
    <div className="dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section aria-modal="true" className="diary-dialog surface-card" role="dialog" aria-labelledby="diary-dialog-title">
        <header className="dialog-heading">
          <h2 id="diary-dialog-title">{title}</h2>
          <button aria-label="Fechar" className="icon-button dialog-close" onClick={onClose} type="button">×</button>
        </header>
        {children}
      </section>
    </div>
  )
}
