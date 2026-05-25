# Shared Resources Audit — sepay-playground

**VERDICT: NEEDS-REFACTOR**

Scope: Upstash usage only. No Supabase in repo (grep `-ri supabase` → 0 hits across `src/`, `package.json`, `docs/`, `README.md`). Sharing-readiness fails on **both** required Upstash patterns: dual env-var aliases AND `KEY_PREFIX`.

## Critical Findings (Upstash)

### F1. Client init misses Vercel Marketplace env alias

`src/lib/server/redis.js:1-3` — entire file:

```js
import { Redis } from '@upstash/redis';
export const redis = Redis.fromEnv();
```

`Redis.fromEnv()` reads only `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`. It does **not** fall back to `KV_REST_API_URL` / `KV_REST_API_TOKEN`. Per established pattern (`vngeoguessr/src/lib/upstash.js:27-29`, `store-scraper-bot/src/repository/upstash.js:25-27`), both alias pairs must be accepted with `??` fallback. As-is, deploying to Vercel with the Marketplace Upstash integration (which injects `KV_*` only) crashes at boot.

`.env.example:11-13` and `README.md:56-57` reinforce the single-alias assumption (comment: "Auto-loaded by `Redis.fromEnv()`") — both need updating once code is fixed.

### F2. No `KEY_PREFIX` — keys collide across projects

No grep hits for `KEY_PREFIX`, `physicalKey`, `pkey`, or any prefix helper. Every Redis access uses unprefixed logical keys:

- `src/lib/server/orders.js:6` — `const ORDER_KEY = (code) => \`order:${code}\``
- `src/lib/server/orders.js:33` — `redis.set(ORDER_KEY(code), …)`
- `src/lib/server/orders.js:44` — `redis.get(ORDER_KEY(code))`
- `src/lib/server/orders.js:60` — `redis.set(ORDER_KEY(code), …, { keepTtl: true })`
- `src/lib/server/orders.js:72` — `redis.set(\`webhook:${id}\`, …)`

Sharing risk is **real**, not theoretical: namespaces `order:*` and `webhook:*` are extremely generic. Any other project on the same Upstash DB using the same namespaces will overwrite or read foreign data. `SEPAY_ORDER_PREFIX` (`SEVQR…`) reduces the *value* collision risk for order codes but does not isolate the *key* namespace.

### F3. Direct `redis.*` calls leak unprefixed keys

`orders.js` calls `redis.set` / `redis.get` directly (lines 33, 44, 60, 72). Required pattern: a `physicalKey()` helper applied inside thin wrappers (`getJson`/`putJson`/etc.) — callers never touch the raw client. Refactor target: replace `export const redis` with a handle factory returning `{client, prefix}` plus wrapped helpers, mirroring `store-scraper-bot/src/repository/upstash.js:33-50`.

## Fix Sketch (do not apply — review only)

1. `src/lib/server/redis.js`: replace `Redis.fromEnv()` with explicit `new Redis({url, token})` reading `UPSTASH_REDIS_REST_URL ?? KV_REST_API_URL` and matching token pair. Export `{client, prefix}` with `prefix = process.env.KEY_PREFIX ?? 'sepay-playground:'`.
2. `src/lib/server/orders.js`: route every call through prefixed helpers (`getJson`, `setJsonNx`, `setJsonKeepTtl`, `setStringNxEx`). No raw `redis.set/get`.
3. `.env.example`: add `KEY_PREFIX=sepay-playground:` and document the `KV_REST_API_*` alias pair.
4. `README.md:50-58`: update env table; drop the "Auto-loaded by `Redis.fromEnv()`" line.

## Supплementary Observations (non-sharing)

- Webhook auth (`sepay.js:33-44`) correctly uses `timingSafeEqual` with length-check pre-guard. Good.
- Webhook dedup TTL 7d (`orders.js:72`) vs order TTL 24h (`orders.js:5`) is intentional and documented (`README.md:121`); not a bug.
- `markPaid` is a TOCTOU read-modify-write (`orders.js:56-61`) — concurrent duplicate webhooks could each pass the `status==='paid'` guard and double-write, but `claimWebhookId` upstream already dedups by `payload.id` so practical risk is bounded. Not blocking.
- `simulate-webhook` correctly double-gated on `dev` flag + token (`+server.js:17-22`). Good.

## Recommended Actions (priority order)

1. **Critical** — Fix F1, F2, F3 together in `src/lib/server/redis.js` + `src/lib/server/orders.js`. Single PR, ~40 LOC.
2. **Critical** — Update `.env.example` and `README.md` env table.
3. **Low** — Consider migrating `claimWebhookId` to use an atomic Lua/transaction for `markPaid` if real-money flow is ever planned (out of scope for playground).

## Unresolved Questions

- Should `KEY_PREFIX` default to `'sepay-playground:'` or `'sepay:'`? Other tiennm99 projects use full-repo-name slug — recommend matching that convention for consistency.
- Is Supabase planned for this project (any roadmap entry)? If not, no action; if yes, decide isolation strategy (schema vs prefix vs RLS) before adoption.
