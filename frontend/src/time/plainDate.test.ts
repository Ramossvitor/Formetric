import {
  addPlainDateDays,
  addPlainDateYears,
  isPlainDate,
  parsePlainDate,
  subtractPlainDateDays,
  wholeYearsBetweenPlainDates,
} from './plainDate'

describe('PlainDate civil', () => {
  it('atravessa viradas de mês e ano sem depender do fuso do navegador', () => {
    expect(addPlainDateDays('2026-08-31', 1)).toBe('2026-09-01')
    expect(addPlainDateDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(subtractPlainDateDays('2027-01-01', 1)).toBe('2026-12-31')
  })

  it('não pula dias civis nas datas de transição de DST', () => {
    expect(addPlainDateDays('2026-03-08', 1)).toBe('2026-03-09')
    expect(addPlainDateDays('2026-11-01', 1)).toBe('2026-11-02')
  })

  it('ajusta 29 de fevereiro ao mover anos e calcula idade por datas civis', () => {
    expect(addPlainDateYears('2024-02-29', 1)).toBe('2025-02-28')
    expect(wholeYearsBetweenPlainDates('1991-08-13', '2026-08-12')).toBe(34)
    expect(wholeYearsBetweenPlainDates('1991-08-13', '2026-08-13')).toBe(35)
  })

  it('recusa strings e datas de calendário inválidas', () => {
    expect(isPlainDate('2026-02-29')).toBe(false)
    expect(isPlainDate('2026-2-01')).toBe(false)
    expect(() => parsePlainDate('2026-13-01')).toThrow(RangeError)
  })
})
