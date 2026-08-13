import { getErrorMessage } from '../api/http'

export function CatalogLoading({ message = 'Carregando catálogo…' }: { message?: string }) {
  return (
    <div aria-live="polite" className="catalog-state" role="status">
      <span className="route-spinner" />
      <p>{message}</p>
    </div>
  )
}

export function CatalogError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  return (
    <div className="catalog-state" role="alert">
      <p>{getErrorMessage(error)}</p>
      <button className="secondary-button" onClick={onRetry} type="button">Tentar novamente</button>
    </div>
  )
}
