import userEvent from '@testing-library/user-event'

/**
 * Sessão de interação usada por todos os testes.
 *
 * `delay: null` remove a espera que o user-event insere entre teclas. Com o padrão, cada tecla
 * devolve o controle ao event loop e força um reprocessamento do React; num formulário longo
 * isso passa de quatro segundos e faz o teste estourar o timeout quando a suíte inteira disputa
 * CPU. As interações continuam sendo eventos reais de teclado e ponteiro — só o intervalo
 * artificial entre elas desaparece.
 */
export function setupUser() {
  return userEvent.setup({ delay: null })
}
