import { useInfiniteQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { getErrorMessage } from '../api/http'
import { setFoodFavorite } from '../catalog/api'
import { CatalogCount, CatalogError, CatalogLoading, CatalogLoadMore } from '../catalog/CatalogState'
import { formatNumber, qualityLabels, unitLabels } from '../catalog/format'
import { foodsInfiniteQuery, foodsQueryKey } from '../catalog/queries'
import { useFavoriteToggle } from '../catalog/useFavoriteToggle'
import { useDebouncedValue } from '../catalog/useDebouncedValue'

export function FoodsPage() {
  const [search, setSearch] = useState('')
  const [favoritesOnly, setFavoritesOnly] = useState(false)
  const [catalogView, setCatalogView] = useState<'active' | 'archived'>('active')
  const debouncedSearch = useDebouncedValue(search)
  const foods = useInfiniteQuery(foodsInfiniteQuery(debouncedSearch, favoritesOnly, catalogView === 'archived'))
  const loadedFoods = foods.data?.pages.flatMap((page) => page.content) ?? []
  const visibleFoods = loadedFoods.filter((food) => food.archived === (catalogView === 'archived'))
  const totalFoods = foods.data?.pages[0]?.totalElements ?? 0
  const favoriteMutation = useFavoriteToggle({ queryKey: foodsQueryKey, setFavorite: setFoodFavorite })

  return (
    <main id="conteudo">
      <header className="page-heading catalog-heading">
        <div>
          <p className="eyebrow">Biblioteca</p>
          <h1>Alimentos</h1>
          <p className="heading-copy">Encontre rapidamente seus itens, marcas e porções.</p>
        </div>
        <Link className="submit-button page-action" to="/foods/new">Novo alimento</Link>
      </header>

      <section aria-label="Pesquisar alimentos" className="catalog-toolbar surface-card">
        <label className="search-field" htmlFor="food-search">
          <span aria-hidden="true">⌕</span>
          <span className="visually-hidden">Pesquisar alimentos</span>
          <input
            autoCapitalize="none"
            autoComplete="off"
            autoCorrect="off"
            enterKeyHint="search"
            id="food-search"
            spellCheck={false}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar banana, whey, marca…"
            type="search"
            value={search}
          />
        </label>
        <button
          aria-pressed={favoritesOnly}
          className={favoritesOnly ? 'filter-chip active' : 'filter-chip'}
          onClick={() => setFavoritesOnly((current) => !current)}
          type="button"
        >
          ★ Favoritos
        </button>
        <div aria-label="Status dos alimentos" className="catalog-status-filter" role="group">
          <button aria-pressed={catalogView === 'active'} className={catalogView === 'active' ? 'filter-chip active' : 'filter-chip'} onClick={() => setCatalogView('active')} type="button">Ativos</button>
          <button aria-pressed={catalogView === 'archived'} className={catalogView === 'archived' ? 'filter-chip active' : 'filter-chip'} onClick={() => setCatalogView('archived')} type="button">Arquivados</button>
        </div>
      </section>

      {foods.isPending ? <CatalogLoading message="Pesquisando alimentos…" /> : null}
      {foods.isError ? <CatalogError error={foods.error} onRetry={() => void foods.refetch()} /> : null}
      {favoriteMutation.isError ? <p className="form-error catalog-feedback" role="alert">{getErrorMessage(favoriteMutation.error)}</p> : null}

      {foods.data && visibleFoods.length === 0 && !foods.hasNextPage ? (
        <section className="empty-state surface-card">
          <span aria-hidden="true">⌕</span>
          <h2>{catalogView === 'archived' ? 'Nenhum alimento arquivado' : debouncedSearch || favoritesOnly ? 'Nenhum alimento encontrado' : 'Sua biblioteca está vazia'}</h2>
          <p>{catalogView === 'archived' ? 'Os alimentos arquivados aparecerão aqui e poderão ser restaurados.' : debouncedSearch || favoritesOnly ? 'Tente outro termo ou remova o filtro de favoritos.' : 'Cadastre o primeiro alimento para começar a registrar refeições.'}</p>
          {catalogView === 'active' && !debouncedSearch && !favoritesOnly ? <Link className="submit-button" to="/foods/new">Cadastrar alimento</Link> : null}
        </section>
      ) : null}

      {foods.data && (visibleFoods.length > 0 || foods.hasNextPage) ? (
        <section aria-label="Resultados" className="catalog-list">
          <CatalogCount
            gender="m"
            hasMore={foods.hasNextPage}
            loaded={visibleFoods.length}
            noun={catalogView === 'archived' ? ['alimento arquivado', 'alimentos arquivados'] : ['alimento ativo', 'alimentos ativos']}
            showTotal={catalogView !== 'archived'}
            total={totalFoods}
          />
          {visibleFoods.map((food) => {
            const version = food.currentVersion
            return (
              <article className="catalog-list-card surface-card" key={food.id}>
                <Link aria-label={`Abrir ${version.name}`} className="catalog-card-main" to={`/foods/${food.id}`}>
                  <span className="catalog-avatar food-avatar" aria-hidden="true">{version.name.slice(0, 1).toUpperCase()}</span>
                  <span className="catalog-card-copy">
                    <strong>{version.name}</strong>
                    <small>{version.brand ?? `${formatNumber(version.referenceQuantity)} ${unitLabels[version.referenceUnit]}`}</small>
                    <span className="catalog-macros">
                      <b>{formatNumber(version.caloriesKcal)} kcal</b>
                      <span>{formatNumber(version.proteinG)} g prot.</span>
                    </span>
                  </span>
                  <span className={`quality-dot ${version.quality.toLowerCase()}`} title={qualityLabels[version.quality]} />
                </Link>
                <button
                  aria-label={food.favorite ? `Remover ${version.name} dos favoritos` : `Favoritar ${version.name}`}
                  aria-pressed={food.favorite}
                  className={food.favorite ? 'favorite-button active' : 'favorite-button'}
                  onClick={() => favoriteMutation.mutate({ id: food.id, favorite: !food.favorite })}
                  type="button"
                >
                  {food.favorite ? '★' : '☆'}
                </button>
              </article>
            )
          })}
          {foods.hasNextPage ? <CatalogLoadMore isLoading={foods.isFetchingNextPage} onLoadMore={() => void foods.fetchNextPage()} /> : null}
        </section>
      ) : null}
    </main>
  )
}
