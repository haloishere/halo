/**
 * Phase 0 smoke test — run manually against staging SM secret.
 *
 * Usage:
 *   DAYDREAM_JWT_SECRET_NAME=projects/halo-493622/secrets/daydream-jwt \
 *   GOOGLE_APPLICATION_CREDENTIALS=<path-to-key-or-leave-empty-for-ADC> \
 *   npx tsx apps/api/src/modules/daydream/__tests__/smoke.ts
 */
import { getJwt } from '../daydream.jwt.js'
import { search } from '../daydream.client.js'

const secretName = process.env.DAYDREAM_JWT_SECRET_NAME
if (!secretName) {
  console.error('Set DAYDREAM_JWT_SECRET_NAME first.')
  process.exit(1)
}

console.log('⏳ Loading JWT from Secret Manager…')
const jwt = await getJwt()
console.log(`✅ JWT valid until ${new Date(jwt.expiresAt).toISOString()}`)

const query = process.argv[2] ?? 'brown chelsea boots under 200 euros'
console.log(`\n⏳ Searching Daydream: "${query}"`)

const result = await search(query)
console.log(`✅ chatId=${result.chatId}`)
console.log(`✅ ${result.products.length} products returned\n`)

for (const p of result.products.slice(0, 5)) {
  const price = (p.priceCents / 100).toFixed(2)
  const sale = p.onSale ? ` (was ${(p.regularPriceCents / 100).toFixed(2)})` : ''
  console.log(`  ${p.brand ?? '?'} — ${p.name} — ${price}${sale} — ${p.shopUrl}`)
}
