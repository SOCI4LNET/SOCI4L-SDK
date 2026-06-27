import { Soci4lError } from './errors'
import type {
  BatchResponse,
  HistoryResponse,
  RateLimit,
  ScoreResponse,
  S4Vector,
  VerifyResult,
  VerifyThresholds,
} from './types'

export interface Soci4lOptions {
  /** Your API key (`s4_live_…`). Create one at https://soci4l.net/developers. */
  apiKey: string
  /** Override the base URL. Default: `https://soci4l.net/api/v1`. */
  baseUrl?: string
  /** Custom fetch implementation. Default: the global `fetch` (Node 18+). */
  fetch?: typeof fetch
  /** Per-request timeout in milliseconds. Default: 15000. */
  timeoutMs?: number
}

const DEFAULT_BASE_URL = 'https://soci4l.net/api/v1'
const DEFAULT_TIMEOUT_MS = 15_000
const MAX_BATCH = 50
const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/

/** Dimensions checked by {@link Soci4lClient.verify}, in a stable order. */
const VERIFY_DIMENSIONS: Array<keyof VerifyThresholds> = [
  'humanity',
  'activity',
  'social',
  'economic',
  'composite',
  'confidence',
]

/**
 * Client for the SOCI4L reputation API.
 *
 * ```ts
 * const client = new Soci4lClient({ apiKey: process.env.SOCI4L_API_KEY! })
 * const { passed } = await client.verify(address, { humanity: 50 })
 * ```
 */
export class Soci4lClient {
  private readonly apiKey: string
  private readonly baseUrl: string
  private readonly fetchImpl: typeof fetch
  private readonly timeoutMs: number

  constructor(options: Soci4lOptions) {
    if (!options || !options.apiKey) {
      throw new Error('Soci4lClient: `apiKey` is required')
    }
    this.apiKey = options.apiKey
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, '')
    const fetchImpl = options.fetch ?? globalThis.fetch
    if (typeof fetchImpl !== 'function') {
      throw new Error(
        'Soci4lClient: no global `fetch` found. On Node <18 pass `options.fetch`.',
      )
    }
    this.fetchImpl = fetchImpl
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  }

  /** Full reputation vector for one address. `GET /score/:address`. */
  async score(address: string): Promise<ScoreResponse> {
    assertAddress(address)
    return this.request<ScoreResponse>('GET', `/score/${address.toLowerCase()}`)
  }

  /**
   * Bulk score up to 50 addresses in one call. `POST /score/batch`.
   * Each address consumes one rate-limit unit. Never-before-seen addresses
   * return `signals: 'none'` — warm them with {@link score} first.
   */
  async batch(addresses: string[]): Promise<BatchResponse> {
    if (!Array.isArray(addresses) || addresses.length === 0) {
      throw new Error('batch(): `addresses` must be a non-empty array')
    }
    if (addresses.length > MAX_BATCH) {
      throw new Error(`batch(): at most ${MAX_BATCH} addresses per call`)
    }
    addresses.forEach(assertAddress)
    return this.request<BatchResponse>('POST', '/score/batch', {
      addresses: addresses.map((a) => a.toLowerCase()),
    })
  }

  /** Daily score snapshots for trend analysis. `GET /score/:address/history`. */
  async history(
    address: string,
    options: { days?: number; includeBreakdown?: boolean } = {},
  ): Promise<HistoryResponse> {
    assertAddress(address)
    const params = new URLSearchParams()
    if (options.days != null) params.set('days', String(options.days))
    if (options.includeBreakdown) params.set('include', 'breakdown')
    const qs = params.toString()
    return this.request<HistoryResponse>(
      'GET',
      `/score/${address.toLowerCase()}/history${qs ? `?${qs}` : ''}`,
    )
  }

  /**
   * Gate an address on one or more S4 dimensions. Fetches the score, then
   * checks every threshold you provide (`actual >= required`).
   *
   * ```ts
   * const { passed } = await client.verify(address, { humanity: 50 })
   * ```
   */
  async verify(
    address: string,
    thresholds: VerifyThresholds,
  ): Promise<VerifyResult> {
    const data = await this.score(address)
    const failed: VerifyResult['failed'] = []
    for (const dimension of VERIFY_DIMENSIONS) {
      const required = thresholds[dimension]
      if (required == null) continue
      const actual = data.s4[dimension as keyof S4Vector]
      if (actual < required) failed.push({ dimension, required, actual })
    }
    return {
      address: data.address,
      passed: failed.length === 0,
      s4: data.s4,
      headline: data.headline,
      verifiedHuman: data.verifiedHuman,
      failed,
    }
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.timeoutMs)

    let res: Response
    try {
      res = await this.fetchImpl(`${this.baseUrl}${path}`, {
        method,
        headers: {
          'X-Api-Key': this.apiKey,
          Accept: 'application/json',
          ...(body ? { 'Content-Type': 'application/json' } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      })
    } catch (err) {
      const name = (err as Error)?.name
      if (name === 'AbortError') {
        throw new Soci4lError(`Request timed out after ${this.timeoutMs}ms`, {
          status: 0,
        })
      }
      throw new Soci4lError(
        `Network error: ${(err as Error)?.message ?? 'unknown'}`,
        { status: 0 },
      )
    } finally {
      clearTimeout(timer)
    }

    const rateLimit = readRateLimit(res.headers)
    const text = await res.text()
    let json: unknown
    try {
      json = text ? JSON.parse(text) : undefined
    } catch {
      json = undefined
    }

    if (!res.ok) {
      const message =
        (json as { error?: string } | undefined)?.error ?? `HTTP ${res.status}`
      throw new Soci4lError(message, {
        status: res.status,
        body: json ?? text,
        rateLimit,
      })
    }

    return json as T
  }
}

function assertAddress(address: string): void {
  if (typeof address !== 'string' || !ADDRESS_RE.test(address)) {
    throw new Error(`Invalid Avalanche C-Chain address: ${String(address)}`)
  }
}

function readRateLimit(headers: Headers): RateLimit {
  const num = (v: string | null): number | null =>
    v == null || v === '' ? null : Number(v)
  return {
    limit: num(headers.get('x-ratelimit-limit')),
    remaining: num(headers.get('x-ratelimit-remaining')),
    resetAt: headers.get('x-ratelimit-reset'),
  }
}
