import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRef } from 'react'
import type { DailyAnalytics } from '../analytics/api'
import { dailyAnalyticsQuery, invalidateAnalytics } from '../analytics/queries'
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
  // A tela Hoje não lê o diário: ela lê o consolidado do dia. Para o mesmo toque responder nas duas
  // telas, o total provisório precisa entrar nos dois caches — do contrário o atalho da Home só se
  // mexeria depois da ida e volta, que é justamente o que se quer evitar ali.
  const analyticsKey = dailyAnalyticsQuery(date).queryKey
  const mutationKey = [...queryKey, 'water']
  // Quantos toques a rajada atual já teve. Volta a zero quando o último deles termina.
  const burst = useRef(0)

  return useMutation({
    mutationKey,
    mutationFn: (volumeMl: number) => addWater(date, volumeMl),
    onMutate: async (volumeMl) => {
      burst.current += 1
      await Promise.all([
        queryClient.cancelQueries({ queryKey }),
        queryClient.cancelQueries({ queryKey: analyticsKey }),
      ])
      const previous = queryClient.getQueryData<DailyLog | null>(queryKey)
      const previousAnalytics = queryClient.getQueryData<DailyAnalytics>(analyticsKey)

      if (previous) {
        queryClient.setQueryData<DailyLog>(queryKey, {
          ...previous,
          waterTotalMl: previous.waterTotalMl + volumeMl,
        })
      }
      if (previousAnalytics) {
        queryClient.setQueryData<DailyAnalytics>(analyticsKey, {
          ...previousAnalytics,
          nutrition: {
            ...previousAnalytics.nutrition,
            waterMl: (previousAnalytics.nutrition.waterMl ?? 0) + volumeMl,
          },
        })
      }
      return { previous, previousAnalytics }
    },
    onError: (_error, _volume, context) => {
      if (context?.previous !== undefined) queryClient.setQueryData(queryKey, context.previous)
      if (context?.previousAnalytics !== undefined) queryClient.setQueryData(analyticsKey, context.previousAnalytics)
    },
    onSettled: (log) => {
      // Toques em sequência têm respostas em voo ao mesmo tempo, e cada uma traz o total que o
      // servidor tinha ao processá-la — não necessariamente o último. Escrever cada resposta no
      // cache devolvia o total otimista ao valor de antes dos toques seguintes, e uma resposta
      // chegando fora de ordem deixava o total errado até a próxima recarga. Por isso só o fim da
      // rajada mexe no cache: um toque sozinho confia na própria resposta; uma rajada recarrega.
      if (queryClient.isMutating({ mutationKey }) > 1) return
      const single = burst.current === 1
      burst.current = 0
      if (log && single) queryClient.setQueryData(queryKey, log)
      else void queryClient.invalidateQueries({ queryKey })
      void invalidateAnalytics(queryClient)
    },
  })
}
