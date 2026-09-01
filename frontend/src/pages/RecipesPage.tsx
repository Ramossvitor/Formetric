import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { getErrorMessage } from '../api/http'
import { setRecipeFavorite } from '../catalog/api'
import { CatalogCount, CatalogError, CatalogLoading, CatalogLoadMore } from '../catalog/CatalogState'
import { formatNumber } from '../catalog/format'
import { recipesInfiniteQuery, recipesQueryKey } from '../catalog/queries'
import { useDebouncedValue } from '../catalog/useDebouncedValue'

export function RecipesPage() {
  const [search, setSearch] = useState('')
  const [favoritesOnly, setFavoritesOnly] = useState(false)
  const [catalogView, setCatalogView] = useState<'active' | 'archived'>('active')
  const debouncedSearch = useDebouncedValue(search)
  const queryClient = useQueryClient()
  const recipes = useInfiniteQuery(recipesInfiniteQuery(debouncedSearch, favoritesOnly, catalogView === 'archived'))
  const loadedRecipes = recipes.data?.pages.flatMap((page) => page.content) ?? []
  const visibleRecipes = loadedRecipes.filter((recipe) => recipe.archived === (catalogView === 'archived'))
  const totalRecipes = recipes.data?.pages[0]?.totalElements ?? 0
  const favorite = useMutation({
    mutationFn: ({ id, value }: { id: string; value: boolean }) => setRecipeFavorite(id, value),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: recipesQueryKey }),
  })

  return (
    <main id="conteudo">
      <header className="page-heading catalog-heading">
        <div>
          <p className="eyebrow">Biblioteca</p>
          <h1>Receitas</h1>
          <p className="heading-copy">Agrupe ingredientes uma vez e registre pela porção preparada.</p>
        </div>
        <Link className="submit-button page-action" to="/recipes/new">Nova receita</Link>
      </header>

      <section aria-label="Pesquisar receitas" className="catalog-toolbar surface-card">
        <label className="search-field" htmlFor="recipe-search">
          <span aria-hidden="true">⌕</span>
          <span className="visually-hidden">Pesquisar receitas</span>
          <input autoCapitalize="none" autoCorrect="off" enterKeyHint="search" spellCheck={false} autoComplete="off" id="recipe-search" onChange={(event) => setSearch(event.target.value)} placeholder="Buscar macarrão, frango…" type="search" value={search} />
        </label>
        <button aria-pressed={favoritesOnly} className={favoritesOnly ? 'filter-chip active' : 'filter-chip'} onClick={() => setFavoritesOnly((current) => !current)} type="button">★ Favoritos</button>
        <div aria-label="Status das receitas" className="catalog-status-filter" role="group">
          <button aria-pressed={catalogView === 'active'} className={catalogView === 'active' ? 'filter-chip active' : 'filter-chip'} onClick={() => setCatalogView('active')} type="button">Ativas</button>
          <button aria-pressed={catalogView === 'archived'} className={catalogView === 'archived' ? 'filter-chip active' : 'filter-chip'} onClick={() => setCatalogView('archived')} type="button">Arquivadas</button>
        </div>
      </section>

      {recipes.isPending ? <CatalogLoading message="Pesquisando receitas…" /> : null}
      {recipes.isError ? <CatalogError error={recipes.error} onRetry={() => void recipes.refetch()} /> : null}
      {favorite.isError ? <p className="form-error catalog-feedback" role="alert">{getErrorMessage(favorite.error)}</p> : null}

      {recipes.data && visibleRecipes.length === 0 && !recipes.hasNextPage ? (
        <section className="empty-state surface-card">
          <span aria-hidden="true">♨</span>
          <h2>{catalogView === 'archived' ? 'Nenhuma receita arquivada' : debouncedSearch || favoritesOnly ? 'Nenhuma receita encontrada' : 'Nenhuma receita cadastrada'}</h2>
          <p>{catalogView === 'archived' ? 'As receitas arquivadas aparecerão aqui e poderão ser restauradas.' : debouncedSearch || favoritesOnly ? 'Tente outro nome ou remova o filtro de favoritos.' : 'Crie uma receita para calcular total, por 100 g e por porção automaticamente.'}</p>
          {catalogView === 'active' && !debouncedSearch && !favoritesOnly ? <Link className="submit-button" to="/recipes/new">Criar receita</Link> : null}
        </section>
      ) : null}

      {recipes.data && (visibleRecipes.length > 0 || recipes.hasNextPage) ? (
        <section aria-label="Resultados" className="recipe-grid">
          <CatalogCount
            gender="f"
            hasMore={recipes.hasNextPage}
            loaded={visibleRecipes.length}
            noun={catalogView === 'archived' ? ['receita arquivada', 'receitas arquivadas'] : ['receita ativa', 'receitas ativas']}
            showTotal={catalogView !== 'archived'}
            total={totalRecipes}
          />
          {visibleRecipes.map((recipe) => {
            const version = recipe.currentVersion
            return (
              <article className="recipe-card surface-card" key={recipe.id}>
                <Link className="recipe-card-main" to={`/recipes/${recipe.id}`}>
                  <span className="catalog-avatar recipe-avatar" aria-hidden="true">♨</span>
                  <span className="recipe-copy">
                    <strong>{version.name}</strong>
                    <small>{version.ingredients.length} {version.ingredients.length === 1 ? 'ingrediente' : 'ingredientes'} · versão {version.versionNumber}</small>
                  </span>
                  <span className="recipe-energy"><b>{formatNumber(version.totalNutrition.caloriesKcal)}</b><small>kcal total</small></span>
                </Link>
                <button aria-label={recipe.favorite ? `Remover ${version.name} dos favoritos` : `Favoritar ${version.name}`} aria-pressed={recipe.favorite} className={recipe.favorite ? 'favorite-button active' : 'favorite-button'} disabled={favorite.isPending} onClick={() => favorite.mutate({ id: recipe.id, value: !recipe.favorite })} type="button">{recipe.favorite ? '★' : '☆'}</button>
              </article>
            )
          })}
          {recipes.hasNextPage ? <CatalogLoadMore isLoading={recipes.isFetchingNextPage} onLoadMore={() => void recipes.fetchNextPage()} /> : null}
        </section>
      ) : null}
    </main>
  )
}
