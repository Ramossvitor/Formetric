/**
 * Formas cinzas com o tamanho aproximado do que está por vir.
 *
 * Um spinner centralizado diz "espere" e nada mais: a região inteira some, e quando o conteúdo
 * chega a página salta. O contorno mantém a altura, mostra quantas linhas esperar e deixa a
 * chegada do dado ser uma troca em vez de um pulo.
 *
 * Tudo aqui é `aria-hidden`. Quem usa leitor de tela não ganha nada com retângulos, e o anúncio da
 * espera continua sendo feito por um único `role="status"` no componente que envolve o esqueleto —
 * acrescentar um segundo tornaria ambíguas as buscas por papel que a suíte já faz.
 */
export function Skeleton({ height = 16, width = '100%', radius = 8 }: {
  height?: number | string
  width?: number | string
  radius?: number
}) {
  return (
    <span
      aria-hidden="true"
      className="skeleton"
      style={{ height, width, borderRadius: radius }}
    />
  )
}

/** Linhas de lista: o formato mais comum de espera no app. */
export function SkeletonRows({ rows = 4, height = 56 }: { rows?: number; height?: number }) {
  return (
    <span aria-hidden="true" className="skeleton-rows">
      {Array.from({ length: rows }, (_, index) => (
        <Skeleton height={height} key={index} radius={12} />
      ))}
    </span>
  )
}
