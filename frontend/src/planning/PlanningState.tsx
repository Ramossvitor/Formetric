import { getErrorMessage } from '../api/http'

interface PlanningLoadingProps {
  message: string
}

export function PlanningLoading({ message }: PlanningLoadingProps) {
  return (
    <main id="conteudo">
      <div className="planning-state" role="status">
        <span className="route-spinner" aria-hidden="true" />
        <p>{message}</p>
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
