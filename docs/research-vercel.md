# Next.js 15 + Vercel Webhook Deployment Research

## 1. Webhook Route Runtime: `nodejs` vs `edge`

**Recommendation: `nodejs` (default)**

| Dimension | nodejs | edge |
|-----------|--------|------|
| **Cold Start** | Slower | Faster (~10x) |
| **Available APIs** | Full Node.js + Web APIs | Web APIs only |
| **HMAC Verification** | ✓ Full crypto support | ✓ (`crypto` available) |
| **Third-party Libs** | Most npm packages | Web-API-only packages |
| **Streaming** | ✓ Supported | ✓ Supported |
| **Database Queries** | ✓ Native drivers | Depends on lib |
| **File System** | ✓ `fs` module | ✗ Blocked |

**Trade-off**: For SePay webhooks (no HMAC, just `Authorization` header), edge has zero advantage over the latency gain (~50ms). Choose nodejs unless you deploy >1000 webhooks/min.

**For SePay spec**: `Authorization: Apikey <KEY>` doesn't require raw-body access; both runtimes handle it. But nodejs is simpler and safer for database updates.

**Code**:
```typescript
// app/api/webhooks/sepay/route.ts
export const runtime = 'nodejs' // explicit, though default
export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization')
  const body = await request.json() // or request.text() if needed
  // process...
}
```

---

## 2. Body Parsing & Auth Header Verification

**Pattern for SePay**:
```typescript
export async function POST(request: Request) {
  // Auth check first (fail fast)
  const authHeader = request.headers.get('authorization')
  if (!authHeader?.startsWith('Apikey ')) {
    return new Response('Unauthorized', { status: 401 })
  }
  const apiKey = authHeader.split(' ')[1]
  if (apiKey !== process.env.SEPAY_WEBHOOK_KEY) {
    return new Response('Forbidden', { status: 403 })
  }

  // Body parsing (safe, no raw-body requirement for SePay)
  try {
    const payload = await request.json()
    // Process payment event...
  } catch (error) {
    return new Response('Invalid JSON', { status: 400 })
  }
}
```

**Key Points**:
- SePay uses simple API key auth, **no HMAC signature** required → no need for raw body buffering.
- `request.json()` is safe and idiomatic in Next.js App Router.
- `request.headers.get()` uses Web API (case-insensitive by spec).
- Body can only be read **once** per request (stream constraint).

---

## 3. Env Var Setup on Vercel

**Dashboard or CLI**:
```bash
# Add to Vercel (prompts for value)
vercel env add SEPAY_WEBHOOK_KEY

# Choose environments: Production, Preview, Development
# Sensitive = encrypted, hidden from logs/UI
```

**Local Development**:
```bash
# Pull Vercel dev env vars into .env.local
vercel env pull

# Or manually add to .env.local (git-ignored)
SEPAY_WEBHOOK_KEY=sk_test_...
```

**Best Practice**:
- Set `SEPAY_WEBHOOK_KEY` as **sensitive** in Vercel (defaults to this).
- Add `.env.local` to `.gitignore`.
- `vercel dev` auto-loads dev env vars; no need to `pull` for that.
- **Size limit**: 5 KB per env var on edge runtime; 64 KB total per deployment on nodejs.

---

## 4. Project Config: `vercel.json` Required?

**Answer: No**, for vanilla Next.js 15 + webhooks.

**Zero-config Default**:
- Vercel auto-detects `next.json` presence → builds with `next build`, serves with `next start`.
- Framework detection, routes, rewrites, ISR all automatic.

**When to Add `vercel.json`**:
- Custom build/start commands
- Cron jobs (`functions.crons`)
- Function-level memory or timeout overrides
- Middleware/edge function config
- Custom domains, redirects, or headers

**Minimal Config** (if needed):
```json
{
  "version": 2,
  "framework": "nextjs",
  "buildCommand": "next build",
  "env": {
    "SEPAY_WEBHOOK_KEY": "@sepay_webhook_key"
  }
}
```
The `@sepay_webhook_key` syntax references dashboard-stored secrets; avoid inline secrets.

---

## 5. Public URL for Webhooks During Local Dev

**Ranking** (by ease + reliability):

1. **ngrok** (Recommended for SePay)
   - `ngrok http 3000` → `https://abc123.ngrok.io`
   - Pros: Session inspection, replay, wildcard DNS, free tier
   - Cons: Changes URL each restart (but ngrok CLI supports fixed domains on pro)
   - **Ideal for**: Testing payment flows, debugging webhook payloads

2. **Cloudflare Tunnel** (via `cloudflared`)
   - `cloudflared tunnel --url localhost:3000`
   - Pros: Free, persistent (Zero Trust dashboard), enterprise-grade
   - Cons: Requires cloudflare.com account setup, slightly slower onboarding

3. **Vercel Preview Deployments**
   - `vercel` on feature branch → preview URL with env vars
   - Pros: Production-like env, real Vercel infra
   - Cons: ~30s deploy time, not for rapid iteration

**Verdict**: **Use ngrok for local iteration**, Vercel preview for full-stack testing.

---

## 6. Next.js 15 Specifics: SSE, Streaming, Server Actions

**Status**: Next.js 15 stable, React 19 GA compatible.

**For Payment Polling/SSE**:
- ✓ **Streaming Route Handlers**: Return `ReadableStream` directly.
  ```typescript
  export async function GET(request: Request) {
    const stream = new ReadableStream({
      start(controller) {
        // SSE: send payment status updates
        controller.enqueue('data: {"status":"pending"}\n\n')
      }
    })
    return new Response(stream, {
      headers: { 'Content-Type': 'text/event-stream' }
    })
  }
  ```
- ✓ **Server Actions**: Stable, no gotchas for payment state mutations.
- ✓ **`unstable_after`** (experimental): Schedule work post-response (e.g., SePay reconciliation).

**Gotchas**: None specific to webhooks. SSE works on nodejs runtime; edge has timeout constraints (~25s).

---

## Summary Table

| Question | Answer | Source |
|----------|--------|--------|
| Runtime for webhooks? | `nodejs` (default, explicit) | [Next.js Edge Docs](https://nextjs.org/docs/app/api-reference/edge) |
| Read auth header in POST? | `request.headers.get('authorization')` | [Next.js headers API](https://nextjs.org/docs/app/api-reference/functions/headers) |
| Body parsing? | `await request.json()` (no HMAC, no raw-body need) | Next.js Route Handler spec |
| Env vars locally? | `vercel env pull` → `.env.local` | [Vercel Env Docs](https://vercel.com/docs/environment-variables) |
| `vercel.json` needed? | No, for vanilla Next.js 15 | [Vercel Config Docs](https://vercel.com/docs/project-configuration/vercel-json) |
| Local webhook URL? | ngrok (best DX) or Cloudflare Tunnel | Tunnel/ngrok comparison |
| SSE support? | ✓ ReadableStream on nodejs runtime | [Next.js Streaming](https://nextjs.org/learn/dashboard-app/streaming) |

---

## Unresolved Questions

1. **SePay API rate limits**: Does SePay cap webhook retry attempts? Affects error handling strategy.
2. **Webhook signature format**: Confirm SePay sends plain JSON (no custom encoding) in body.
3. **Preview env var inheritance**: Do Vercel preview deployments auto-inherit production env vars, or require explicit setup?
4. **Edge function maxDuration**: What's the timeout for SSE on edge runtime (if needed later)?

---

## Sources

- [Next.js Edge Runtime API Reference](https://nextjs.org/docs/app/api-reference/edge)
- [Next.js headers Function](https://nextjs.org/docs/app/api-reference/functions/headers)
- [Vercel Environment Variables](https://vercel.com/docs/environment-variables)
- [Vercel Static Configuration](https://vercel.com/docs/project-configuration/vercel-json)
- [Next.js Streaming (App Router)](https://nextjs.org/learn/dashboard-app/streaming)
- [Testing Webhooks with ngrok](https://inventivehq.com/blog/testing-webhooks-locally-ngrok-guide)
- [Cloudflare Tunnel Docs](https://developers.cloudflare.com/pages/how-to/preview-with-cloudflare-tunnel/)
- [Next.js 15 Release Blog](https://nextjs.org/blog/next-15)
