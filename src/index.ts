import { Soci4lClient, type Soci4lOptions } from './client'

export { Soci4lClient, type Soci4lOptions } from './client'
export { Soci4lError, type Soci4lErrorOptions } from './errors'
export type {
  S4Vector,
  GraphSignals,
  ScoreBreakdown,
  Headline,
  ScoreResponse,
  BatchSignals,
  BatchScore,
  BatchError,
  BatchResult,
  BatchResponse,
  HistoryPoint,
  HistoryResponse,
  RateLimit,
  VerifyThresholds,
  VerifyFailure,
  VerifyResult,
} from './types'

/** Convenience factory — same as `new Soci4lClient(options)`. */
export function createClient(options: Soci4lOptions): Soci4lClient {
  return new Soci4lClient(options)
}

export default Soci4lClient
