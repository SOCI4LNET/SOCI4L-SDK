/**
 * Response types for the SOCI4L reputation API (v1).
 * These mirror the locked, versioned contract documented at
 * https://soci4l.net/developers/docs — every field below is what the live
 * `/api/v1` endpoints actually return.
 */

/** The S4 reputation vector — every dimension is 0–100 except `confidence` (0–1). */
export interface S4Vector {
  /** Likelihood the wallet belongs to a real, single human (0–100). */
  humanity: number
  /** On-chain activity depth: tx count, age, gas (0–100). */
  activity: number
  /** Verified social / follow-graph strength (0–100). */
  social: number
  /** Economic footprint: balance, holdings, value moved (0–100). */
  economic: number
  /** Weighted blend of the four dimensions — the headline number (0–100). */
  composite: number
  /** Data-coverage ratio (0–1). Low confidence ≠ low score: it means thin data. */
  confidence: number
}

/** Follow-graph anomaly heuristics applied to the score. */
export interface GraphSignals {
  /** Whether the follow graph was analyzed for this address. */
  analyzed: boolean
  /** Anomaly flags, e.g. `follow_ring`, `follower_burst`. Empty when clean. */
  flags: string[]
  /** Down-weight applied to the social dimension from graph anomalies (0–1). */
  socialDamping: number
}

/** Per-signal v1 point breakdown. `total` is the legacy flat score. */
export interface ScoreBreakdown {
  total: number
  [signal: string]: number
}

/** The public headline score: S4 composite rescaled to a tier. */
export interface Headline {
  /** Composite score, 0–100. */
  score: number
  /** Machine tier key, e.g. `legendary`. */
  tier: string
  /** Human-readable tier label, e.g. `Legendary`. */
  tierLabel: string
  /** Always `s4-composite` for the current model. */
  model: string
}

/** Full response from `GET /api/v1/score/:address`. */
export interface ScoreResponse {
  address: string
  /** Preferred public score: S4 composite + tier. */
  headline: Headline
  /** @deprecated Legacy v1 flat score — prefer `headline` / `s4`. */
  score: number
  /** @deprecated Legacy v1 tier key — prefer `headline.tier`. */
  tier: string
  /** @deprecated Legacy v1 tier label — prefer `headline.tierLabel`. */
  tierLabel: string
  /** Per-signal v1 breakdown (kept for back-compat). */
  breakdown: ScoreBreakdown
  /** The S4 reputation vector — this is what you threshold on. */
  s4: S4Vector
  /** Follow-graph anomaly heuristics. */
  graph: GraphSignals
  /** Verified-Human registry number, or `null` if not verified. */
  verifiedHuman: number | null
  /** ISO 8601 timestamp the score was computed. */
  fetchedAt: string
  model: string
}

/** Freshness of the cached signals backing a batch result. */
export type BatchSignals = 'fresh' | 'stale' | 'none'

/** A successfully-scored entry in a batch response. */
export interface BatchScore {
  address: string
  /** Legacy v1 flat score. */
  score: number
  tier: string
  tierLabel: string
  s4: S4Vector
  graph: GraphSignals
  verifiedHuman: number | null
  /**
   * `none` means the address has never been scored — warm it via the
   * single-address endpoint (`client.score(address)`) first.
   */
  signals: BatchSignals
  error?: undefined
}

/** A failed entry in a batch response (one address, not the whole call). */
export interface BatchError {
  address: string
  error: string
}

export type BatchResult = BatchScore | BatchError

/** Full response from `POST /api/v1/score/batch`. */
export interface BatchResponse {
  count: number
  results: BatchResult[]
  fetchedAt: string
  model: string
}

/** One daily snapshot in a history response. */
export interface HistoryPoint {
  date: string
  score: number
  tier: string
  /** Present only when `includeBreakdown` was requested. */
  breakdown?: Record<string, number>
}

/** Full response from `GET /api/v1/score/:address/history`. */
export interface HistoryResponse {
  address: string
  days: number
  count: number
  history: HistoryPoint[]
  fetchedAt: string
  model: string
}

/** Parsed `X-RateLimit-*` response headers (null when absent). */
export interface RateLimit {
  /** Daily request ceiling for your tier. */
  limit: number | null
  /** Requests left in the current window. */
  remaining: number | null
  /** ISO 8601 timestamp when the window resets. */
  resetAt: string | null
}

/**
 * Minimum thresholds for {@link Soci4lClient.verify}. Every dimension you
 * provide must be met (`>=`). Omitted dimensions are not checked.
 */
export interface VerifyThresholds {
  humanity?: number
  activity?: number
  social?: number
  economic?: number
  composite?: number
  /** Minimum data-coverage confidence (0–1) for the check to count. */
  confidence?: number
}

/** One unmet threshold, returned in {@link VerifyResult.failed}. */
export interface VerifyFailure {
  dimension: keyof VerifyThresholds
  required: number
  actual: number
}

/** Result of {@link Soci4lClient.verify}. */
export interface VerifyResult {
  address: string
  /** True when every requested threshold was met. */
  passed: boolean
  s4: S4Vector
  headline: Headline
  verifiedHuman: number | null
  /** Thresholds that were not met (empty when `passed` is true). */
  failed: VerifyFailure[]
}
