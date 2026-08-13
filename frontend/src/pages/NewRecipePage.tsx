import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { getErrorMessage } from '../api/http'
import { createRecipe, type RecipeVersionInput } from '../catalog/api'
import { RecipeForm } from '../catalog/RecipeForm'
import { recipesQueryKey } from '../catalog/queries'

export function NewRecipePage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const create = useMutation({
    mutationFn: createRecipe,
    onSuccess: async (recipe) => {
      await queryClient.invalidateQueries({ queryKey: recipesQueryKey })
      navigate(`/recipes/${recipe.id}`, { replace: true })
    },
  })

  return (
    <main id="conteudo">
      <header className="page-heading catalog-heading">
        <div>
          <p className="eyebrow"><Link to="/recipes">Receitas</Link> / nova</p>
          <h1>Nova receita</h1>
          <p className="heading-copy">O cálculo usa versões fixas dos alimentos para preservar o histórico.</p>
        </div>
      </header>
      <section className="catalog-editor surface-card">
        {create.isError ? <p className="form-error" role="alert">{getErrorMessage(create.error)}</p> : null}
        <RecipeForm pending={create.isPending} submitLabel="Criar e calcular receita" onSubmit={(values: RecipeVersionInput) => create.mutate(values)} />
      </section>
    </main>
  )
}
