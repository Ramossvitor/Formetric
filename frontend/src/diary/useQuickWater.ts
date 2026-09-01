import { useMutation, useQueryClient } from '@tanstack/react-query'
import { invalidateAnalytics } from '../analytics/queries'
import { addWater, type DailyLog } from './api'
import { dailyLogQuery } from './queries'

/**
 * Registro de água com resposta imediata.
 *
 * São os botões mais tocados do app, e muitas vezes tocados em sequência — quatro copos ao voltar
 * do almoço. Esperando a ida e volta, cada toque deixava o total parado e os botões desabilitados,
 * o que parecia falha e provocava um segundo toque no mesmo botão.
 *
 * Só o TOTAL sobe na hora. A linha do histórico espera a resposta porque ela carrega um horário
 * absoluto, e o horário de um registro é do servidor: inventá-lo aqui daria uma hora errada na
 * lista — ou, para um dia passado, um horário que não existe naquele dia. O total é o que o usuário
 * olha ao tocar; o horário é o que ele confere depois.
 *
 * Um dia AINDA NÃO criado também não recebe tratamento otimista: inventar um `DailyLog` inteiro
 * significaria inventar estado, metas e totais, e o primeiro registro do dia é justamente aquele em
 * que mostrar algo errado seria mais grave.
 *
 * Vive fora da página porque a tela Hoje registra água pelo mesmo caminho: um lugar só, exportado,
 * em vez de duas implementações que precisam concordar sobre quais caches invalidar.
 */
export function useQuickWater(date: string) {
  const queryClient = useQueryClient()
  const queryKey = dailyLogQuery(date).queryKey

  return useMutation({
    mutationFn: (volumeMl: number) => addWater(date, volumeMl),
    onMutate: async (volumeMl) => {
      await queryClient.cancelQueries({ queryKey })
      const previous = queryClient.getQueryData<DailyLog | null>(queryKey)
      if (!previous) return { previous }

      queryClient.setQueryData<DailyLog>(queryKey, {
        ...previous,
        waterTotalMl: previous.waterTotalMl + volumeMl,
      })
      return { previous }
    },
    onError: (_error, _volume, context) => {
      if (context?.previous !== undefined) queryClient.setQueryData(queryKey, context.previous)
    },
    onSuccess: (log) => {
      queryClient.setQueryData(queryKey, log)
      void invalidateAnalytics(queryClient)
    },
  })
}
