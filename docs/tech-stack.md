# Tech Stack — sepay-playground

User-fixed stack. Research confirms feasibility.

## Runtime / Framework

- **SvelteKit** (latest stable, 2.x) running on **Svelte 5** (runes available — `$state`, `$derived`, `$effect`).
- **JavaScript** (not TypeScript). Use **JSDoc** for type hints where it pays for itself (Redis client, SePay payload shapes). `jsconfig.json` for editor IntelliSense + `checkJs: false` to stay loose.
- **Package manager: pnpm** (`pnpm-lock.yaml` committed, `packageManager` field in `package.json`, `.npmrc` with `shamefully-hoist=false`).
- **Node.js runtime** for all server routes (incl. webhook). No edge runtime — keeps things uniform and avoids Upstash REST cold-path edge cases.

## UI

- **Tailwind CSS v4** (PostCSS plugin + `@import "tailwindcss"` in `app.css`).
- **shadcn-svelte** (https://shadcn-svelte.com) — direct Svelte port of shadcn/ui, copy-paste components into `src/lib/components/ui`. Install only what's used: `button`, `input`, `label`, `card`, `badge`, `alert`. Powered by `bits-ui` under the hood.
- `lucide-svelte` for icons (pulled by shadcn-svelte).
- `mode-watcher` for light/dark mode (shadcn-svelte standard).

## Storage

- **Upstash Redis** via `@upstash/redis` (framework-agnostic; works fine in SvelteKit).
  - Env: `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` — canonical names for `Redis.fromEnv()`.
  - Auto-serializes JSON values → store plain objects.
  - `set(key, val, { nx: true })` for idempotent webhook dedup.
  - `set(key, val, { ex: 86400 })` — orders TTL 24h (demo).

## Payments

- **SePay** VietQR.
  - QR image: `https://qr.sepay.vn/img?acc=<ACC>&bank=<BANK>&amount=<N>&des=<CODE>&template=compact`. No server-side QR lib.
  - Webhook: SePay POSTs to `/api/webhooks/sepay` with `Authorization: Apikey <SEPAY_WEBHOOK_API_KEY>`.
  - Order code surfaces in payload `code` (auto-extracted by SePay's dashboard prefix rule); fallback regex on `content`.
  - Dedup on payload `id` (stable across retries — up to 7 retries / 5h).
  - Respond `200 {"success":true}` within 30s.

## Deployment

- **Vercel** via **`@sveltejs/adapter-vercel`** (auto-detected by Vercel when present in `svelte.config.js`).
- No `vercel.json` needed.
- Env vars: `vercel env add ...` per-environment, `vercel env pull .env.local` for dev.
- Local public URL for SePay during dev: **ngrok** (`ngrok http 5173` — SvelteKit's default dev port).

## Project Layout (target)

```
sepay-playground/
├── src/
│   ├── app.css                    # Tailwind import + tokens
│   ├── app.html
│   ├── lib/
│   │   ├── server/
│   │   │   ├── redis.js           # Redis.fromEnv() client
│   │   │   ├── orders.js          # createOrder / getOrder / markPaid
│   │   │   └── sepay.js           # buildQrUrl, verifyWebhookAuth
│   │   ├── components/
│   │   │   ├── ui/                # shadcn-svelte components
│   │   │   ├── PayForm.svelte
│   │   │   ├── PayAwaiting.svelte
│   │   │   └── PayPaid.svelte
│   │   └── types.js               # JSDoc typedefs (Order, SepayWebhookPayload)
│   └── routes/
│       ├── +page.svelte           # /
│       ├── pay/
│       │   ├── +page.svelte       # /pay (state machine: form → awaiting → paid)
│       │   └── +page.server.js    # form action: createOrder
│       └── api/
│           ├── orders/[code]/+server.js   # GET status (polled by /pay)
│           ├── webhooks/sepay/+server.js  # POST receiver
│           └── dev/simulate-webhook/+server.js  # gated by !PROD
├── static/
├── svelte.config.js               # adapter-vercel
├── vite.config.js
├── tailwind.config.js (or v4 inline) + postcss.config.js
├── jsconfig.json
├── .npmrc
├── .env.example
├── package.json                   # packageManager: pnpm@...
└── pnpm-lock.yaml
```

## Env Vars

| Name | Source | Notes |
|------|--------|-------|
| `SEPAY_API_TOKEN` | SePay dashboard | Reserved per user spec; unused by current flow |
| `SEPAY_WEBHOOK_API_KEY` | SePay dashboard | Compared against `Authorization: Apikey <...>` |
| `SEPAY_ACCOUNT_NUMBER` | SePay-bound bank account | Used in QR URL |
| `SEPAY_BANK_CODE` | qr.sepay.vn/banks.json | e.g. `MBBank`, `Vietcombank`, `ACB` |
| `UPSTASH_REDIS_REST_URL` | Upstash console / Vercel integration | |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash console / Vercel integration | |
| `SEPAY_ORDER_PREFIX` | local config | Defaults `SEVQR` (VietinBank-compatible) |

All loaded via SvelteKit's `$env/static/private` (server-only — never leaks to client).

## Out of Scope (demo)

- Real auth / users
- Multi-currency (VND only)
- Refunds, settlement reconciliation
- Production observability beyond `console.log` + Redis state

## Confirmed decisions (vs. prior Next.js draft)

- SvelteKit replaces Next.js — Vercel still primary deploy target via official adapter.
- JavaScript replaces TypeScript — JSDoc typedefs cover the boundaries (Redis values, webhook payload).
- pnpm replaces npm — lockfile committed, `packageManager` field set.
- shadcn-svelte replaces shadcn/ui — same design system, Svelte port.
- Everything else (Upstash, SePay endpoints, env vars, ngrok-for-dev) unchanged.

## Open Question

- Include a dev-only `POST /api/dev/simulate-webhook` (gated by `!import.meta.env.PROD`) to test paid-state without a real transfer. **Recommendation: yes.**
