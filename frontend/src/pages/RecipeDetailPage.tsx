import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { getErrorMessage } from '../api/http'
import { archiveRecipe, createRecipeVersion, duplicateRecipe, restoreRecipe, setRecipeFavorite, type NutritionValues, type RecipeVersionInput } from '../catalog/api'
import { CatalogError, CatalogLoading } from '../catalog/CatalogState'
import { formatNutrition, unitLabels } from '../catalog/format'
import { recipeQuery, recipesQueryKey } from '../catalog/queries'
import { RecipeForm } from '../catalog/RecipeForm'

function NutritionBlock({ nutrition, title }: { nutrition: NutritionValues | null; title: string }) {
  return (
    <div className="recipe-nutrition-block">
      <h3>{title}</h3>
      {nutrition ? (
        <dl>{formatNutrition(nutrition).map((item) => <div key={item.label}><dt>{item.label}</dt><dd>{item.value}</dd></div>)}</dl>
      ) : <p>Não disponível para esta unidade de rendimento.</p>}
    </div>
  )
}

export function RecipeDetailPage() {
  const { id = '' } = useParams()
  const [editing, setEditing] = useState(false)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const recipe = useQuery(recipeQuery(id))
  const createVersion = useMutation({
    mutationFn: (version: RecipeVersionInput) => createRecipeVersion(id, version),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: recipesQueryKey })
      setEditing(false)
    },
  })
  const duplicate = useMutation({
    mutationFn: () => duplicateRecipe(id),
    onSuccess: async (copy) => {
      await queryClient.invalidateQueries({ queryKey: recipesQueryKey })
      navigate(`/recipes/${copy.id}`)
    },
  })
  const favorite = useMutation({
    mutationFn: (value: boolean) => setRecipeFavorite(id, value),
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: recipesQueryKey }),
  })
  const archive = useMutation({
    mutationFn: (restore: boolean) => restore ? restoreRecipe(id) : archiveRecipe(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: recipesQueryKey })
    },
  })

  if (recipe.isPending) return <CatalogLoading message="Calculando receita…" />
  if (recipe.isError) return <CatalogError error={recipe.error} onRetry={() => void recipe.refetch()} />

  const detail = recipe.data
  const version = detail.currentVersion

  return (
    <main id="conteudo">
      <header className="page-heading catalog-heading detail-heading">
        <div>
          <p className="eyebrow"><Link to="/recipes">Receitas</Link> / versão {version.versionNumber}</p>
          <h1>{version.name}</h1>
          <p className="heading-copy">Rendimento: {version.yieldQuantity.toLocaleString('pt-BR')} {unitLabels[version.yieldUnit]}</p>
        </div>
        <div className="heading-actions">
          <button aria-pressed={detail.favorite} className={detail.favorite ? 'secondary-button favorite-wide active' : 'secondary-button favorite-wide'} disabled={favorite.isPending} onClick={() => favorite.mutate(!detail.favorite)} type="button">{detail.favorite ? '★ Favorito' : '☆ Favoritar'}</button>
          <button className="secondary-button" disabled={duplicate.isPending} onClick={() => duplicate.mutate()} type="button">{duplicate.isPending ? 'Duplicando…' : 'Duplicar'}</button>
          {!detail.archived ? <button className="submit-button" onClick={() => setEditing(true)} type="button">Criar nova versão</button> : null}
          <button
            className={detail.archived ? 'secondary-button' : 'text-button danger-action'}
            disabled={archive.isPending}
            onClick={() => {
              if (!detail.archived && !window.confirm(`Arquivar “${version.name}”? Você poderá restaurá-la pela lista de arquivadas.`)) return
              archive.mutate(detail.archived)
            }}
            type="button"
          >
            {archive.isPending ? (detail.archived ? 'Restaurando…' : 'Arquivando…') : (detail.archived ? 'Restaurar' : 'Arquivar')}
          </button>
        </div>
      </header>

      {createVersion.isError || duplicate.isError || favorite.isError || archive.isError ? <p className="form-error catalog-feedback" role="alert">{getErrorMessage(createVersion.error ?? duplicate.error ?? favorite.error ?? archive.error)}</p> : null}

      {editing ? (
        <section className="catalog-editor surface-card" aria-labelledby="new-recipe-version-title">
          <div className="version-warning"><strong id="new-recipe-version-title">Nova versão da receita</strong><span>A composição anterior permanecerá associada aos registros históricos.</span></div>
          <RecipeForm initialVersion={version} onCancel={() => setEditing(false)} onSubmit={(values) => createVersion.mutate(values)} pending={createVersion.isPending} submitLabel="Salvar como nova versão" />
        </section>
      ) : (
        <div className="detail-grid recipe-detail-grid">
          <section className="detail-card surface-card recipe-nutrition" aria-labelledby="recipe-nutrition-title">
            <div className="section-heading profile-section-heading"><div><p className="eyebrow">Calculado pelo sistema</p><h2 id="recipe-nutrition-title">Nutrição da receita</h2></div></div>
            <div className="recipe-nutrition-grid">
              <NutritionBlock nutrition={version.totalNutrition} title="Receita completa" />
              <NutritionBlock nutrition={version.per100gNutrition} title="Por 100 g" />
              <NutritionBlock nutrition={version.perServingNutrition} title="Por porção" />
            </div>
          </section>

          <section className="detail-card surface-card" aria-labelledby="recipe-ingredients-title">
            <div className="section-heading profile-section-heading"><div><p className="eyebrow">Composição</p><h2 id="recipe-ingredients-title">Ingredientes</h2></div><span className="history-count">{version.ingredients.length}</span></div>
            <ol className="simple-list ingredient-detail-list">
              {version.ingredients.map((ingredient) => (
                <li key={`${ingredient.position}-${ingredient.foodVersionId}`}>
                  <strong>{ingredient.foodName}</strong>
                  <span>{ingredient.quantity.toLocaleString('pt-BR')} {unitLabels[ingredient.unit]} · {ingredient.nutrients.caloriesKcal.toLocaleString('pt-BR')} kcal</span>
                </li>
              ))}
            </ol>
          </section>

          <section className="detail-card surface-card detail-history" aria-labelledby="recipe-history-title">
            <div className="section-heading profile-section-heading"><div><p className="eyebrow">Rastreabilidade</p><h2 id="recipe-history-title">Histórico de versões</h2></div><span className="history-count">{detail.versions.length}</span></div>
            <ol className="version-list">
              {detail.versions.map((item) => (
                <li key={item.id}>
                  <span className="version-number">v{item.versionNumber}</span>
                  <span><strong>{item.name}</strong><small>{item.ingredients.length} ingredientes · {item.totalNutrition.caloriesKcal.toLocaleString('pt-BR')} kcal</small></span>
                  <time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleDateString('pt-BR')}</time>
                </li>
              ))}
            </ol>
          </section>
        </div>
      )}
    </main>
  )
}
