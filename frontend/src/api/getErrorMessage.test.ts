import { ApiError, getErrorMessage } from './http'

describe('mensagem de erro para o usuário', () => {
  it('repassa o detail dos domínios do produto', () => {
    const error = new ApiError(409, {
      type: 'https://formetric.dev/problems/diary-conflict',
      detail: 'Já existe uma refeição nessa posição.',
      status: 409,
    })

    expect(getErrorMessage(error)).toBe('Já existe uma refeição nessa posição.')
  })

  it('confia no detail quando a resposta não declara tipo', () => {
    const error = new ApiError(401, { title: 'Não autenticado', detail: 'Autenticação necessária.', status: 401 })

    expect(getErrorMessage(error)).toBe('Autenticação necessária.')
  })

  it('substitui o detail em inglês que o framework monta sozinho', () => {
    // Com problem details ligado, o Spring preenche `detail` para corpo malformado e método não
    // suportado, sob o tipo `about:blank`. Era exatamente o caso que as frases em português cobrem.
    const error = new ApiError(400, { type: 'about:blank', title: 'Bad Request', detail: 'Failed to read request', status: 400 })

    expect(getErrorMessage(error)).toBe('O servidor não entendeu a solicitação. Atualize o aplicativo e tente de novo.')
  })
})
