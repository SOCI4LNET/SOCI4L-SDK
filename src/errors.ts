import type { RateLimit } from './types'

export interface Soci4lErrorOptions {
  /** HTTP status (0 for network/timeout errors). */
  status: number
  /** Parsed response body, when available. */
  body?: unknown
  /** Rate-limit headers from the failing response, when present. */
  rateLimit?: RateLimit
}

/**
 * Thrown for any non-2xx API response (and network/timeout failures).
 * Inspect `status` or the `isRateLimited` / `isUnauthorized` helpers.
 */
export class Soci4lError extends Error {
  readonly status: number
  readonly body?: unknown
  readonly rateLimit?: RateLimit

  constructor(message: string, options: Soci4lErrorOptions) {
    super(message)
    this.name = 'Soci4lError'
    this.status = options.status
    this.body = options.body
    this.rateLimit = options.rateLimit
    // Preserve prototype chain when targeting older runtimes.
    Object.setPrototypeOf(this, Soci4lError.prototype)
  }

  /** HTTP 429 — daily quota exhausted. Retry after `rateLimit.resetAt`. */
  get isRateLimited(): boolean {
    return this.status === 429
  }

  /** HTTP 401 — missing or invalid API key. */
  get isUnauthorized(): boolean {
    return this.status === 401
  }

  /** HTTP 400 — invalid input (e.g. malformed address). */
  get isBadRequest(): boolean {
    return this.status === 400
  }
}
