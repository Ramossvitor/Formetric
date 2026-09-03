import { Link } from 'react-router-dom'
import { Icon } from '../components/Icon'

/**
 * O endereço desconhecido antes levava a um redirecionamento silencioso para a tela inicial.
 *
 * Num navegador isso quase passa despercebido; num aplicativo instalado, onde não há barra de
 * endereço para conferir o que aconteceu, um atalho quebrado ou um link antigo simplesmente
 * levava a pessoa para outro lugar sem explicação — e ela concluía que o app tinha perdido o
 * registro que estava procurando.
 */
export function NotFoundPage() {
  return (
    <main id="conteudo">
      <section className="empty-state surface-card">
        <span aria-hidden="true"><Icon name="sparkle" size={24} /></span>
        <h1>Esta página não existe</h1>
        <p>
          O endereço pode ter mudado, ou o registro pode ter sido excluído. Nada foi perdido nas
          telas abaixo.
        </p>
        <div className="empty-actions">
          <Link className="submit-button" to="/">Ir para Hoje</Link>
        </div>
      </section>
    </main>
  )
}
