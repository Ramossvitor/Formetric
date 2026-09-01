import { getErrorMessage } from '../api/http'
import { Skeleton, SkeletonRows } from '../components/Skeleton'

interface PlanningLoadingProps {
  message: string
}

export function PlanningLoading({ message }: PlanningLoadingProps) {
  return (
    <main id="conteudo">
      <div aria-busy="true" className="catalog-skeleton" role="status">
        <span className="visually-hidden">{message}</span>
        <Skeleton height={92} radius={20} />
        <SkeletonRows rows={3} height={72} />
      </div>
    </main>
  )
}

interface PlanningErrorProps {
  error: unknown
  onRetry: () => void
}

export function PlanningError({ error, onRetry }: PlanningErrorProps) {
  return (
    <main id="conteudo">
      <div className="planning-state" role="alert">
        <p>{getErrorMessage(error)}</p>
        <button className="secondary-button" onClick={onRetry} type="button">
          Tentar novamente
        </button>
      </div>
    </main>
  )
}
