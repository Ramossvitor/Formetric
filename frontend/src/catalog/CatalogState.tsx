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

/**
 * Contagem dos resultados carregados. Enquanto houver páginas por buscar, o texto deixa claro
 * que a lista está parcial — antes ela dizia "100 alimentos" mesmo havendo mais no servidor.
 * O total do servidor só é exibido na visão de ativos: em arquivados a consulta traz ativos e
 * arquivados juntos, então `totalElements` não corresponde ao que está na tela.
 */
export function CatalogCount({ gender, hasMore, loaded, noun, showTotal, total }: {
  gender: 'm' | 'f'
  hasMore: boolean
  loaded: number
  noun: readonly [string, string]
  showTotal: boolean
  total: number
}) {
  const withTotal = hasMore && showTotal
  // O substantivo concorda com o número a que ele se refere: em "1 de 2 alimentos", é o total.
  const label = (withTotal ? total : loaded) === 1 ? noun[0] : noun[1]

  // Sem o total do servidor e ainda com páginas por buscar, "0 arquivados" pareceria uma resposta
  // definitiva; o que a tela sabe é que nada apareceu no que já foi carregado.
  if (hasMore && !showTotal && loaded === 0) {
    return (
      <p aria-live="polite" className="result-count">
        {gender === 'f' ? 'Nenhuma' : 'Nenhum'} {noun[0]} nas páginas carregadas até agora.
      </p>
    )
  }

  return (
    <p aria-live="polite" className="result-count">
      {withTotal ? `${loaded} de ${total} ${label}` : `${loaded} ${label}`}
      {/* O particípio concorda com o substantivo, que muda de gênero entre alimentos e receitas. */}
      {hasMore && !showTotal ? ` carregad${gender === 'f' ? 'a' : 'o'}${loaded === 1 ? '' : 's'} até agora` : null}
    </p>
  )
}

/** Aviso de lista parcial nos seletores que ainda buscam uma página só. */
export function CatalogTruncationHint({ id, message }: { id?: string; message: string }) {
  return <span className="field-hint" id={id}>{message}</span>
}

export function CatalogLoadMore({ isLoading, onLoadMore }: { isLoading: boolean; onLoadMore: () => void }) {
  return (
    <button className="secondary-button catalog-load-more" disabled={isLoading} onClick={onLoadMore} type="button">
      {isLoading ? 'Carregando…' : 'Carregar mais'}
    </button>
  )
}
