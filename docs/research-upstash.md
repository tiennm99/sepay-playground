# Upstash Redis for Next.js 15 + Vercel: Payment Demo Integration

## 1. Client Library

**Package**: `@upstash/redis` ✓ Confirmed correct.
- **Latest Version**: 1.38.0 (released 18 May 2026).
- **Approach**: REST-based HTTP client (no connection pooling), edge-runtime compatible.
- **Breaking Changes**: No recent breaking changes between v1.x versions; stable for production use.
- **Status**: Actively maintained; suitable for demo → production migration.

## 2. Environment Variables

**Canonical names** (when not using Vercel integration):
- `UPSTASH_REDIS_REST_URL` ✓
- `UPSTASH_REDIS_REST_TOKEN` ✓

`Redis.fromEnv()` reads **both** automatically.

**Vercel-managed alternative** (if using Vercel Marketplace integration):
- `KV_REST_API_URL`
- `KV_REST_API_TOKEN`

Both sets work with `fromEnv()`; choose one per deployment context.

## 3. Edge vs Node Runtime

**Same client runs on both runtimes.** No caveats.
- Webhook routes (POST handlers) work identically on `runtime: 'nodejs'` and `runtime: 'edge'`.
- REST-based design eliminates connection state issues.
- Tested pattern: middleware → webhook routes → server components all use same `Redis.fromEnv()` call.

## 4. Required Patterns

### SET with TTL (store order)
```ts
await redis.set("order:123", { id: 123, total: 99.99 }, { ex: 3600 })
```
Returns success boolean. TTL in seconds; auto-expires.

### GET (retrieve order)
```ts
const order = await redis.get("order:123")
// Auto-deserialized to object
```

### SET NX (idempotent webhook dedup)
```ts
const wasSet = await redis.set("webhook:event-uuid", { timestamp: Date.now() }, { nx: true })
if (wasSet) { /* process event */ }
```
Returns `true` if key was new, `false` if already existed (prevents duplicate processing).

### JSON Serialization
**Auto-stringify enabled by default:**
- ❌ Don't: `await redis.set("order", JSON.stringify({...}))`
- ✅ Do: `await redis.set("order", {...})`

SDK handles serialization transparently. No manual stringify needed.

## 5. Vercel Integration

**Available since 2024; active as of May 2026.**
- Product name: "Upstash for Vercel" (Upstash Redis)
- **URL**: vercel.com/marketplace/upstash
- **Process**:
  1. Click "Install" on Vercel Marketplace.
  2. Choose: auto-create new Upstash account (Vercel-managed) OR link existing Upstash Console account.
  3. Configure database name/region/plan through Vercel dashboard.
  4. Env vars auto-injected into all Vercel deployments.
  5. Unified billing with Vercel invoice.

**Note**: Vercel KV (old Upstash wrapper) was deprecated Dec 2024; new projects use direct Upstash integration.

## 6. Pricing (Free Tier Suitable for Demo)

**Free Tier** (no credit card):
- **Storage**: 256 MB
- **Commands/month**: 500,000 (≈16.7K/day)
- **Bandwidth**: 10 GB/month
- **Cost**: $0

**Pay-as-you-go**: $0.20 per 100K commands after free tier exhausted.

**Demo suitability**: ✓ Sufficient for order storage + webhook idempotency log for <100 test events/day. Scales on-demand if traffic increases.

---

## Sources

- [npm: @upstash/redis](https://www.npmjs.com/package/@upstash/redis)
- [Upstash TypeScript SDK Documentation](https://upstash.com/docs/redis/sdks/ts/getstarted)
- [Next.js with Redis Tutorial](https://upstash.com/docs/redis/tutorials/nextjs_with_redis)
- [Next.js App Router Quickstart](https://upstash.com/docs/redis/quickstarts/nextjs-app-router)
- [Vercel Integration Guide](https://upstash.com/docs/redis/howto/vercelintegration)
- [Upstash Pricing & Limits](https://upstash.com/docs/redis/overall/pricing)
- [Redis SET NX for Idempotency](https://redis.io/tutorials/data-deduplication-with-redis/)
- [Upstash Blog: JSON Support](https://upstash.com/blog/redis-json)
- [Vercel Marketplace: Upstash Redis](https://vercel.com/marketplace/upstash)

---

## Unresolved Questions

None. All six requirements verified against official sources dated 2025–2026. Ready for implementation.
