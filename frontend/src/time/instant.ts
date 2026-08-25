declare const instantBrand: unique symbol

/** An absolute point on the timeline, encoded as an ISO-8601 instant. */
export type Instant = string & { readonly [instantBrand]: true }

const offsetPattern = /T.*(?:Z|[+-]\d{2}:\d{2})$/i

export function isInstant(value: string): value is Instant {
  return offsetPattern.test(value) && Number.isFinite(Date.parse(value))
}

export function parseInstant(value: string): Instant {
  if (!isInstant(value)) throw new RangeError(`Invalid Instant: ${value}`)
  return value
}

export function differenceInMilliseconds(later: string, earlier: string) {
  const laterInstant = parseInstant(later)
  const earlierInstant = parseInstant(earlier)
  return Date.parse(laterInstant) - Date.parse(earlierInstant)
}

export function instantFromEpochMilliseconds(value: number): Instant {
  if (!Number.isFinite(value)) throw new RangeError(`Invalid epoch milliseconds: ${value}`)
  return parseInstant(new Date(value).toISOString())
}

export function createMonotonicInstantClock(
  serverNow: string,
  monotonicNow: () => number = () => performance.now(),
) {
  const serverEpoch = Date.parse(parseInstant(serverNow))
  const anchoredAt = monotonicNow()

  return () => instantFromEpochMilliseconds(serverEpoch + Math.max(0, monotonicNow() - anchoredAt))
}

export function formatInstantTimeInput(value: string, timeZone: string) {
  const instant = parseInstant(value)
  const parts = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone,
  }).formatToParts(new Date(instant))
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((candidate) => candidate.type === type)?.value
  const hour = part('hour')
  const minute = part('minute')
  if (!hour || !minute) throw new RangeError(`Could not format Instant in time zone: ${timeZone}`)
  return `${hour}:${minute}`
}

export function formatInstant(
  value: string,
  locale: string,
  timeZone: string,
  options: Intl.DateTimeFormatOptions,
) {
  return new Intl.DateTimeFormat(locale, { ...options, timeZone }).format(new Date(parseInstant(value)))
}

export function formatInstantTime(value: string, locale: string, timeZone: string) {
  return formatInstant(value, locale, timeZone, { hour: '2-digit', minute: '2-digit' })
}

export function formatInstantDateTime(value: string, locale: string, timeZone: string) {
  return formatInstant(value, locale, timeZone, {
    dateStyle: 'short',
    timeStyle: 'short',
  })
}
