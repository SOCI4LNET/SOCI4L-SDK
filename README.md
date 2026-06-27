# soci4l-sdk

[![status](https://img.shields.io/badge/status-beta-yellow)](https://soci4l.net/developers)

Official TypeScript SDK for the **SOCI4L reputation API** — score any Avalanche
C-Chain wallet and gate your app on humanity, in a few lines of code.

- **Zero runtime dependencies** (uses the platform `fetch`; Node 18+).
- **Typed** responses matching the locked [`/api/v1` contract](https://soci4l.net/developers/docs).
- **ESM + CommonJS** builds, with `.d.ts` types.

## Install

```bash
npm install soci4l-sdk
```

Get an API key from your dashboard at **https://soci4l.net/developers**
(free tier: 1,000 requests/day).

## Quickstart

```ts
import { Soci4lClient } from 'soci4l-sdk'

const client = new Soci4lClient({ apiKey: process.env.SOCI4L_API_KEY! })

// Gate an address on humanity in one call:
const { passed, s4 } = await client.verify(address, { humanity: 50 })
if (!passed) throw new Error('Not human enough')

console.log(s4.composite, s4.confidence)
```

## API

### `new Soci4lClient(options)`

| Option      | Type     | Default                     | Notes                                 |
| ----------- | -------- | --------------------------- | ------------------------------------- |
| `apiKey`    | `string` | — (required)                | Your `s4_live_…` key.                 |
| `baseUrl`   | `string` | `https://soci4l.net/api/v1` | Override for self-hosted deployments. |
| `fetch`     | `fetch`  | global `fetch`              | Pass a polyfill on Node <18.          |
| `timeoutMs` | `number` | `15000`                     | Per-request timeout.                  |

### `client.score(address)`

Full reputation vector for one address.

```ts
const res = await client.score(address)
res.headline      // { score, tier, tierLabel, model } — the public headline
res.s4            // { humanity, activity, social, economic, composite, confidence }
res.graph         // { analyzed, flags, socialDamping }
res.verifiedHuman // number | null
```

### `client.batch(addresses)`

Score up to **50** addresses per call (one rate-limit unit each).

```ts
const { results } = await client.batch([addrA, addrB, addrC])
for (const r of results) {
  if ('error' in r) continue            // per-address failure
  if (r.signals === 'none') continue    // never scored — warm via client.score()
  console.log(r.address, r.s4.humanity)
}
```

### `client.history(address, { days?, includeBreakdown? })`

Daily score snapshots for trend analysis (`days` 1–90, default 30).

```ts
const { history } = await client.history(address, { days: 30 })
```

### `client.verify(address, thresholds)`

Convenience gate. Fetches the score and checks every dimension you pass
(`actual >= required`). Omitted dimensions are not checked.

```ts
const { passed, failed } = await client.verify(address, {
  humanity: 50,
  confidence: 0.4,
})
// failed: [{ dimension: 'humanity', required: 50, actual: 31 }, ...]
```

## Errors & rate limits

Non-2xx responses (and network/timeouts) throw `Soci4lError`:

```ts
import { Soci4lError } from 'soci4l-sdk'

try {
  await client.score(address)
} catch (err) {
  if (err instanceof Soci4lError) {
    if (err.isRateLimited) console.log('reset at', err.rateLimit?.resetAt)
    else if (err.isUnauthorized) console.log('check your API key')
    else console.log(err.status, err.message)
  }
}
```

Every successful response also surfaces the `X-RateLimit-*` headers; on a 429
they're attached to the thrown error as `err.rateLimit`.

## License

MIT © SOCI4L
