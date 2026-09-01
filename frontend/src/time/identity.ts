/**
 * Saneamento do idioma e do fuso vindos do perfil.
 *
 * `locale` e `timeZone` são campos de texto livre no perfil, e alimentam todo `Intl.DateTimeFormat`
 * do app. Um valor que o navegador não reconhece — "portugues" em vez de "pt-BR", um fuso digitado
 * sem o sublinhado — faz o construtor lançar `RangeError` dentro do render, o que num aplicativo
 * instalado significa tela branca sem caminho de volta, num campo que o próprio usuário preencheu.
 *
 * Cair para um valor utilizável é o comportamento certo aqui: uma data formatada no fuso errado é
 * um incômodo, uma tela branca é o fim da sessão. A validação no formulário do perfil impede novos
 * valores inválidos; isto protege quem já gravou um.
 */

export function usableLocale(candidate: string | null | undefined): string {
  if (candidate) {
    try {
      new Intl.DateTimeFormat(candidate)
      return candidate
    } catch {
      // Cai para o idioma do navegador logo abaixo.
    }
  }
  return typeof navigator === 'undefined' ? 'pt-BR' : navigator.language || 'pt-BR'
}

export function usableTimeZone(candidate: string | null | undefined): string {
  if (candidate) {
    try {
      new Intl.DateTimeFormat('en', { timeZone: candidate })
      return candidate
    } catch {
      // UTC é o único fuso que sempre existe; errar por ele é visível e não engana.
    }
  }
  return 'UTC'
}
