import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { getErrorMessage } from '../api/http'
import { createFood, type FoodVersionInput } from '../catalog/api'
import { FoodForm } from '../catalog/FoodForm'
import { foodsQueryKey } from '../catalog/queries'

export function NewFoodPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const create = useMutation({
    mutationFn: (version: FoodVersionInput) => createFood({ ...version, origin: 'USER' }),
    onSuccess: async (food) => {
      await queryClient.invalidateQueries({ queryKey: foodsQueryKey })
      navigate(`/foods/${food.id}`, { replace: true })
    },
  })

  return (
    <main id="conteudo">
      <header className="page-heading catalog-heading">
        <div>
          <p className="eyebrow"><Link to="/foods">Alimentos</Link> / novo</p>
          <h1>Novo alimento</h1>
          <p className="heading-copy">Use os valores do rótulo para a porção de referência.</p>
        </div>
      </header>
      <section className="catalog-editor surface-card">
        {create.isError ? <p className="form-error" role="alert">{getErrorMessage(create.error)}</p> : null}
        <FoodForm pending={create.isPending} submitLabel="Cadastrar alimento" onSubmit={(values) => create.mutate(values)} />
      </section>
    </main>
  )
}
