const applicationOrigin = 'https://formetric.local'
const publicAuthPaths = new Set(['/login', '/accept-invite'])

/** Returns a same-origin private destination without carrying URL fragments. */
export function safePrivateDestination(destination?: string) {
  if (!destination?.startsWith('/') || destination.startsWith('//')) return '/'

  try {
    const parsed = new URL(destination, applicationOrigin)
    if (parsed.origin !== applicationOrigin || publicAuthPaths.has(parsed.pathname)) return '/'
    return `${parsed.pathname}${parsed.search}`
  } catch {
    return '/'
  }
}
