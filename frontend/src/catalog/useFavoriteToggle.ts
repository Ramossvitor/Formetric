import { useMutation, useQueryClient, type InfiniteData, type QueryKey } from '@tanstack/react-query'

interface FavoritableItem {
  id: string
  favorite: boolean
}

interface Page<T> {
  content: T[]
}

/**
 * Alterna o favorito escrevendo na tela antes de perguntar ao servidor.
 *
 * Dois defeitos moravam aqui. O primeiro é de sensação: a estrela só mudava depois da ida e volta,
 * e num catálogo de cem itens a lista inteira ficava indisponível enquanto isso. O segundo é
 * concreto — a invalidação atingia a chave raiz do catálogo, e a consulta é infinita: invalidar a
 * raiz descarta TODAS as páginas já carregadas e volta para a primeira. Quem tinha rolado até o
 * quarto lote perdia o lote inteiro por ter tocado numa estrela.
 *
 * Agora a página que contém o item é reescrita no lugar, e a invalidação depois do sucesso é
 * marcada para refazer só o que estiver em tela.
 */
export function useFavoriteToggle<T extends FavoritableItem>({ queryKey, setFavorite }: {
  queryKey: QueryKey
  setFavorite: (id: string, favorite: boolean) => Promise<unknown>
}) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, favorite }: { id: string; favorite: boolean }) => setFavorite(id, favorite),
    onMutate: async ({ id, favorite }) => {
      // Cancelar evita que uma resposta em voo, buscada antes do toque, sobrescreva o valor novo.
      await queryClient.cancelQueries({ queryKey })
      const previous = queryClient.getQueriesData<InfiniteData<Page<T>>>({ queryKey })

      for (const [key, data] of previous) {
        if (!data?.pages) continue
        queryClient.setQueryData<InfiniteData<Page<T>>>(key, {
          ...data,
          pages: data.pages.map((page) => ({
            ...page,
            content: page.content.map((item) => item.id === id ? { ...item, favorite } : item),
          })),
        })
      }

      return { previous }
    },
    onError: (_error, _variables, context) => {
      // Devolve exatamente o que havia antes: sem isto, a estrela ficaria acesa sobre um servidor
      // que recusou a alteração, e o usuário só descobriria ao recarregar.
      for (const [key, data] of context?.previous ?? []) queryClient.setQueryData(key, data)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey, refetchType: 'active' }),
  })
}
