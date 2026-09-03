declare const plainDateBrand: unique symbol

/** A civil calendar date without a time or time zone, encoded as YYYY-MM-DD. */
export type PlainDate = string & { readonly [plainDateBrand]: true }

const plainDatePattern = /^(\d{4,})-(\d{2})-(\d{2})$/

function utcDate(year: number, month: number, day: number) {
  const value = new Date(0)
  value.setUTCHours(0, 0, 0, 0)
  value.setUTCFullYear(year, month - 1, day)
  return value
}

function parts(value: string) {
  const match = plainDatePattern.exec(value)
  if (!match) return null

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (!Number.isInteger(year) || year < 1 || month < 1 || month > 12 || day < 1) return null

  const parsed = utcDate(year, month, day)
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) return null

  return { year, month, day, parsed }
}

export function comparePlainDates(left: string, right: string) {
  const leftDate = parsePlainDate(left)
  const rightDate = parsePlainDate(right)
  return leftDate.localeCompare(rightDate)
}

export function isPlainDate(value: string): value is PlainDate {
  return parts(value) !== null
}

export function parsePlainDate(value: string): PlainDate {
  if (!isPlainDate(value)) throw new RangeError(`Invalid PlainDate: ${value}`)
  return value
}

function encode(value: Date): PlainDate {
  const year = String(value.getUTCFullYear()).padStart(4, '0')
  const month = String(value.getUTCMonth() + 1).padStart(2, '0')
  const day = String(value.getUTCDate()).padStart(2, '0')
  return parsePlainDate(`${year}-${month}-${day}`)
}

export function addPlainDateDays(value: string, days: number): PlainDate {
  if (!Number.isInteger(days)) throw new RangeError('PlainDate days must be an integer')
  const parsed = parts(value)
  if (!parsed) throw new RangeError(`Invalid PlainDate: ${value}`)
  parsed.parsed.setUTCDate(parsed.parsed.getUTCDate() + days)
  return encode(parsed.parsed)
}

export function subtractPlainDateDays(value: string, days: number): PlainDate {
  return addPlainDateDays(value, -days)
}

/**
 * A janela de sete dias que a faixa de dias mostra.
 *
 * Termina em amanhã para o dia seguinte ficar alcançável — quem registra o jantar depois da
 * meia-noite precisa dele — mas nunca passa de amanhã, porque registrar num futuro distante é erro
 * de toque, não intenção. Quando a data escolhida é hoje, a janela vira a semana que passou, que é
 * o que se quer olhar na maior parte das vezes.
 */
export function weekWindow(date: string, today: string): PlainDate[] {
  const tomorrow = addPlainDateDays(today, 1)
  const start = comparePlainDates(date, today) >= 0
    ? addPlainDateDays(date, -6)
    : addPlainDateDays(date, -3)
  const window: PlainDate[] = []
  for (let offset = 0; offset < 7; offset += 1) {
    const candidate = addPlainDateDays(start, offset)
    if (comparePlainDates(candidate, tomorrow) > 0) break
    window.push(candidate)
  }
  return window
}

function daysInMonth(year: number, month: number) {
  return utcDate(year, month + 1, 0).getUTCDate()
}

export function addPlainDateYears(value: string, years: number): PlainDate {
  if (!Number.isInteger(years)) throw new RangeError('PlainDate years must be an integer')
  const parsed = parts(value)
  if (!parsed) throw new RangeError(`Invalid PlainDate: ${value}`)

  const targetYear = parsed.year + years
  if (targetYear < 1) throw new RangeError('PlainDate year must be positive')
  const targetDay = Math.min(parsed.day, daysInMonth(targetYear, parsed.month))
  return encode(utcDate(targetYear, parsed.month, targetDay))
}

export function subtractPlainDateYears(value: string, years: number): PlainDate {
  return addPlainDateYears(value, -years)
}

export function wholeYearsBetweenPlainDates(earlier: string, later: string) {
  const start = parts(earlier)
  const end = parts(later)
  if (!start || !end || comparePlainDates(earlier, later) > 0) return null

  let years = end.year - start.year
  if (end.month < start.month || (end.month === start.month && end.day < start.day)) years -= 1
  return years
}

export function formatPlainDate(
  value: string,
  locale: string,
  options: Intl.DateTimeFormatOptions = { dateStyle: 'medium' },
) {
  const parsed = parts(value)
  if (!parsed) throw new RangeError(`Invalid PlainDate: ${value}`)
  return new Intl.DateTimeFormat(locale, { ...options, timeZone: 'UTC' }).format(parsed.parsed)
}
