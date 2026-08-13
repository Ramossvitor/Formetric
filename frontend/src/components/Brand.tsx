import { Link } from 'react-router-dom'

export function Brand() {
  return (
    <Link className="brand" to="/" aria-label="Formetric — início">
      <span className="brand-mark" aria-hidden="true">
        <span />
      </span>
      <span>Formetric</span>
    </Link>
  )
}
