import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  /** Aparece no título, para o usuário saber o que falhou e o que ainda funciona. */
  scope: string
  /** Muda de valor quando o usuário navega, para a tela quebrada não sobreviver à navegação. */
  resetKey?: string
}

interface State {
  error: Error | null
  /** Cópia da última chave vista, para reconhecer a navegação sem um segundo render. */
  seenKey: string | undefined
}

/**
 * Rede embaixo do render.
 *
 * Sem isto, qualquer exceção durante o render — um `Intl` recusando um fuso inválido, um campo
 * inesperado numa resposta — deixa a página em branco. No navegador o usuário recarrega e segue;
 * num aplicativo instalado, sem barra de endereço, a tela branca é o fim da sessão e não há o que
 * fazer além de fechar e reabrir.
 *
 * É um componente de classe porque não existe equivalente em hooks: capturar erro de render é a
 * única coisa que o React ainda só oferece por `componentDidCatch`.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, seenKey: this.props.resetKey }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  // Navegar é a tentativa de recuperação mais natural, e a que o usuário faz sozinho. Sem isto, o
  // estado de erro sobreviveria à mudança de rota e a tela quebrada perseguiria a pessoa pelo app.
  // Feito na derivação, e não em `componentDidUpdate`, para limpar o erro ANTES do render em vez
  // de renderizar a tela de falha mais uma vez antes de a substituir.
  static getDerivedStateFromProps(props: Props, state: State): Partial<State> | null {
    if (props.resetKey === state.seenKey) return null
    return { error: null, seenKey: props.resetKey }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Não há coletor de erros no projeto; o console é o que existe, e é onde alguém vai olhar ao
    // reproduzir o problema com o usuário.
    console.error(`Falha inesperada em ${this.props.scope}:`, error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <div className="route-status" role="alert">
        <p>
          <strong>Algo quebrou em {this.props.scope}.</strong>
          <br />
          O restante do aplicativo continua funcionando. Você pode tentar de novo ou ir para outra tela.
        </p>
        <button className="secondary-button" onClick={() => this.setState({ error: null, seenKey: this.props.resetKey })} type="button">
          Tentar novamente
        </button>
      </div>
    )
  }
}
