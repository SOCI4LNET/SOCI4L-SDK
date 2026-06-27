/**
 * Gate an address on humanity in under 10 lines.
 * Run: SOCI4L_API_KEY=s4_live_... npx tsx examples/verify.ts
 */
import { Soci4lClient } from 'soci4l-sdk'

const client = new Soci4lClient({ apiKey: process.env.SOCI4L_API_KEY! })

const { passed, s4 } = await client.verify(
  '0xd8da6bf26964af9d7eed9e03e53415d37aa96045',
  { humanity: 50 },
)

console.log(passed ? '✅ human enough' : '❌ below threshold', s4)
