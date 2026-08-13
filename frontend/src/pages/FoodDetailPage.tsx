import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getErrorMessage } from '../api/http'
import { archiveFood, createFoodVersion, restoreFood, setFoodFavorite, type FoodVersionInput } from '../catalog/api'
import { CatalogError, CatalogLoading } from '../catalog/CatalogState'
import { FoodForm } from '../catalog/FoodForm'
import { formatNutrition, qualityLabels, unitLabels } from '../catalog/format'
import { foodQuery, foodsQueryKey } from '../catalog/queries'

function NutritionGrid({ nutrition }: { nutrition: Parameters<typeof formatNutrition>[0] }) {
  return (
    <dl className="nutrition-grid">
      {formatNutrition(nutrition).map((item) => <div key={item.label}><dt>{item.label}</dt><dd>{item.value}</dd></div>)}
    </dl>
  )
}

export function FoodDetailPage() {
  const { id = '' } = useParams()
  const [editing, setEditing] = useState(false)
  const queryClient = useQueryClient()
  const food = useQuery(foodQuery(id))
  const favorite = useMutation({
    mutationFn: (nextFavorite: boolean) => setFoodFavorite(id, nextFavorite),
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: foodsQueryKey }),
  })
  const createVersion = useMutation({
    mutationFn: (version: FoodVersionInput) => createFoodVersion(id, version),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: foodsQueryKey })
      setEditing(false)
    },
  })
  const archive = useMutation({
    mutationFn: (restore: boolean) => restore ? restoreFood(id) : archiveFood(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: foodsQueryKey })
    },
  })

  if (food.isPending) return <CatalogLoading message="Carregando alimento…" />
  if (food.isError) return <CatalogError error={food.error} onRetry={() => void food.refetch()} />

  const detail = food.data
  const version = detail.currentVersion

  return (
    <main id="conteudo">
      <header className="page-heading catalog-heading detail-heading">
        <div>
          <p className="eyebrow"><Link to="/foods">Alimentos</Link> / versão {version.versionNumber}</p>
          <h1>{version.name}</h1>
          <p className="heading-copy">{version.brand ?? 'Sem marca informada'}</p>
        </div>
        <div className="heading-actions">
          <button
            aria-label={detail.favorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
            aria-pressed={detail.favorite}
            className={detail.favorite ? 'secondary-button favorite-wide active' : 'secondary-button favorite-wide'}
            disabled={favorite.isPending}
            onClick={() => favorite.mutate(!detail.favorite)}
            type="button"
          >{detail.favorite ? '★ Favorito' : '☆ Favoritar'}</button>
          {detail.origin !== 'SYSTEM' && !detail.archived ? <button className="submit-button" onClick={() => setEditing(true)} type="button">Criar nova versão</button> : null}
          {detail.origin !== 'SYSTEM' ? (
            <button
              className={detail.archived ? 'secondary-button' : 'text-button danger-action'}
              disabled={archive.isPending}
              onClick={() => {
                if (!detail.archived && !window.confirm(`Arquivar “${version.name}”? Você poderá restaurá-lo pela lista de arquivados.`)) return
                archive.mutate(detail.archived)
              }}
              type="button"
            >
              {archive.isPending ? (detail.archived ? 'Restaurando…' : 'Arquivando…') : (detail.archived ? 'Restaurar' : 'Arquivar')}
            </button>
          ) : null}
        </div>
      </header>

      {favorite.isError || createVersion.isError || archive.isError ? <p className="form-error catalog-feedback" role="alert">{getErrorMessage(favorite.error ?? createVersion.error ?? archive.error)}</p> : null}

      {editing ? (
        <section className="catalog-editor surface-card" aria-labelledby="new-version-title">
          <div className="version-warning">
            <strong id="new-version-title">Nova versão</strong>
            <span>A versão {version.versionNumber} continuará disponível nos registros históricos.</span>
          </div>
          <FoodForm
            initialVersion={version}
            onCancel={() => setEditing(false)}
            onSubmit={(values) => createVersion.mutate(values)}
            pending={createVersion.isPending}
            submitLabel="Salvar como nova versão"
          />
        </section>
      ) : (
        <div className="detail-grid">
          <section className="detail-card surface-card" aria-labelledby="food-nutrition-title">
            <div className="section-heading profile-section-heading">
              <div><p className="eyebrow">Versão atual</p><h2 id="food-nutrition-title">Informação nutricional</h2></div>
              <span className="status-chip">{qualityLabels[version.quality]}</span>
            </div>
            <p className="reference-copy">Por {version.referenceQuantity.toLocaleString('pt-BR')} {unitLabels[version.referenceUnit]}{version.kcalUncertainty == null ? '' : ` · ± ${version.kcalUncertainty.toLocaleString('pt-BR')} kcal`}</p>
            <NutritionGrid nutrition={version} />
            {version.notes ? <p className="detail-notes">{version.notes}</p> : null}
          </section>

          <section className="detail-card surface-card" aria-labelledby="food-servings-title">
            <div className="section-heading profile-section-heading"><div><p className="eyebrow">Conversões</p><h2 id="food-servings-title">Porções alternativas</h2></div></div>
            {version.servings.length === 0 ? <p className="inline-hint">Nenhuma porção alternativa cadastrada.</p> : (
              <ul className="simple-list">
                {version.servings.map((serving) => (
                  <li key={serving.id ?? serving.label}>
                    <strong>{serving.label}</strong>
                    <span>{serving.quantity.toLocaleString('pt-BR')} {unitLabels[serving.unit]} = {serving.referenceQuantityEquivalent.toLocaleString('pt-BR')} {unitLabels[version.referenceUnit]}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="detail-card surface-card detail-history" aria-labelledby="food-history-title">
            <div className="section-heading profile-section-heading"><div><p className="eyebrow">Rastreabilidade</p><h2 id="food-history-title">Histórico de versões</h2></div><span className="history-count">{detail.versions.length}</span></div>
            <ol className="version-list">
              {detail.versions.map((item) => (
                <li key={item.id}>
                  <span className="version-number">v{item.versionNumber}</span>
                  <span><strong>{item.name}</strong><small>{item.referenceQuantity.toLocaleString('pt-BR')} {unitLabels[item.referenceUnit]} · {item.caloriesKcal.toLocaleString('pt-BR')} kcal</small></span>
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
