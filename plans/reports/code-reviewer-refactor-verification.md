# Code Review — Upstash sharing refactor

**Verdict:** PASS

## Pattern parity vs vngeoguessr reference

| Check | Status | Evidence |
|---|---|---|
| (a) Dual env-var fallback `UPSTASH_*` ?? `KV_*` | OK | `src/lib/server/redis.js:28-29` mirrors `vngeoguessr/src/lib/upstash.js:29-30`. Uses `$env/dynamic/private` (SvelteKit-correct) instead of `process.env` — proper adaptation, not divergence. |
| (b) Handle shape `{ client, prefix }` | OK | `src/lib/server/redis.js:36` returns `{ client, prefix }`; typedef at line 18. |
| (c) Trailing-colon prefix default | OK | `src/lib/server/redis.js:15` `DEFAULT_KEY_PREFIX = 'sepay-playground:'` — colon present. |
| (d) Every key access via `pkey()` | OK | All four call sites wrap: `orders.js:35,49,67,80`. |

Minor divergence (not a defect): reference keeps `pkey()` module-private; this diff exports it (`redis.js:45`) because `orders.js` lives in a sibling module. Necessary export — consistent with the project's split.

## Raw client leaks

`grep -rn "redis\.\(set\|get\|zadd\|del\|...\)" src/` → empty. `grep -rn "fromEnv\|Redis\.from"` → only the import line in `redis.js:1`. No raw client touches outside `orders.js`, and `orders.js` always routes through `h.client.<op>(pkey(h, ...))`. Clean.

## Lazy init correctness

- `redis.js:21` `let handle = null` — top-level allocation only.
- `getRedis()` only called inside the four exported async functions in `orders.js` (lines 24, 49, 66, 78). No top-level invocation.
- `orders.js:2` imports `{ getRedis, pkey }` — just symbols, no execution. Build without env succeeds.
- Singleton cached after first call (`redis.js:26`).

## NX + keepTtl preserved

- `createOrder`: `redis.js`-wrapped `set(key, order, { nx: true, ex: ORDER_TTL_SECONDS })` at `orders.js:35-38`. Options object passed verbatim to `client.set` (Upstash SDK is positional `(key, value, opts)`). NX semantics intact — return value still compared to `'OK'` at line 39.
- `markPaid`: `client.set(..., updated, { keepTtl: true })` at `orders.js:67`. Preserved.
- `claimWebhookId`: NX + 7-day TTL at `orders.js:80-83`, return value comparison preserved at line 84.

## Consumer impact

Verified named-export signatures unchanged:

- `routes/api/webhooks/sepay/+server.js:2` imports `claimWebhookId, markPaid, getOrder` — same names, same shapes (`createOrder({amount})`, `getOrder(code)`, `markPaid(code, {paidAt,txReference})`, `claimWebhookId(id)`).
- `routes/pay/+page.server.js:2` — `createOrder, getOrder`. OK.
- `routes/api/orders/[code]/+server.js:2` — `getOrder`. OK.
- `routes/api/dev/simulate-webhook/+server.js:4` — `getOrder`. OK.

Zero consumer breakage.

## Webhook dedup correctness

`claimWebhookId(id)` at `orders.js:78-85`: `set(WEBHOOK_KEY(id), '1', { nx: true, ex: ... })` then `return set === 'OK'`. Upstash returns `'OK'` on first write, `null` when key already exists under NX. First call → `true`; subsequent calls within 7d → `false`. Semantics preserved; key namespace now `sepay-playground:webhook:{id}`.

Bonus: extracting `WEBHOOK_KEY` at `orders.js:7` (parity with `ORDER_KEY`) is a nit-positive — keeps logical-key shape consistent.

## Red flags

- `Redis.fromEnv()` anywhere: **none** (grep clean).
- Unprefixed keys hitting client: **none**.
- Default prefix missing trailing colon: **N/A** (`'sepay-playground:'` correct).
- `getRedis()` at module top-level: **none**.

## Positive observations

- `$env/dynamic/private` chosen over `$env/static/private` — correct because dynamic envs (KV_* alias from Vercel Marketplace) shouldn't be inlined at build time.
- Error messages name both env-var conventions (`redis.js:30-31`) — good DX.
- JSDoc typedef `RedisHandle` reused — better than the reference (no typedef there).
- `.env.example` comment at lines 10-12 explains the *why* of `KEY_PREFIX`, not just the *what*.

## Unresolved questions

None.
