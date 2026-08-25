import { createMonotonicInstantClock, differenceInMilliseconds, formatInstantTimeInput, isInstant } from './instant'

describe('Instant absoluto', () => {
  it('calcula duração entre instantes sem usar o relógio civil do navegador', () => {
    expect(differenceInMilliseconds('2027-01-01T00:00:00Z', '2026-12-31T23:30:00Z')).toBe(30 * 60 * 1000)
  })

  it('formata o instante do servidor no fuso do perfil', () => {
    const serverNow = '2026-08-13T02:30:00Z'
    expect(formatInstantTimeInput(serverNow, 'America/Sao_Paulo')).toBe('23:30')
    expect(formatInstantTimeInput(serverNow, 'Pacific/Kiritimati')).toBe('16:30')
  })

  it('mantém um relógio corrente ancorado no servidor durante uma SPA aberta por horas', () => {
    let monotonicMilliseconds = 5_000
    const currentInstant = createMonotonicInstantClock(
      '2026-08-12T11:10:00Z',
      () => monotonicMilliseconds,
    )

    monotonicMilliseconds += 3 * 60 * 60 * 1000 + 25 * 60 * 1000

    expect(currentInstant()).toBe('2026-08-12T14:35:00.000Z')
    expect(formatInstantTimeInput(currentInstant(), 'America/Sao_Paulo')).toBe('11:35')
  })

  it('não trata uma PlainDate como Instant', () => {
    expect(isInstant('2026-08-12')).toBe(false)
    expect(isInstant('2026-08-12T11:10:00Z')).toBe(true)
  })
})
